---
keywords:
- 米开朗基杨
- kubernetes
- kube-proxy
- contrack
title: "当 kube-proxy 遇到连接重置"
subtitle: "解决 kube-proxy 中出现的一个小 bug"
description: 解决 kube-proxy 中出现的一个小 bug。
date: 2019-04-04T13:18:03+08:00
draft: false
author: 米开朗基杨
toc: true
categories: cloud-native
tags: ["kubernetes"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/GettyImages-1134704671.jpg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

<!--more-->

<p id="div-border-left-red">
原文链接：<a href="https://kubernetes.io/blog/2019/03/29/kube-proxy-subtleties-debugging-an-intermittent-connection-reset/" target="_blank">kube-proxy Subtleties: Debugging an Intermittent Connection Reset</a>
</p>

最近我一直被一个间歇性连接重置的 bug 所困扰，经过一段时间的调试之后，发现该 bug 是由几个不同的网络子系统联合导致的。通过这几天的深入挖掘和调试，我对 Kubernetes 的网络机制更加熟悉了，对此也有了一些经验总结，分享给社区。

## 症状

----

最近我们收到了一份用户报告，声称他们在使用 `ClusterIP` 类型的 Service 将大型文件提供给在同一群集中运行的 Pod时，会出现连接重置的情况。初步调试之后，没有发现任何有效信息：网络连接很正常，下载文件也没有遇到任何问题。但当我们通过多个客户端并行运行多个工作负载时，该问题就重现了。神奇的是，如果你只使用虚拟机，不使用 Kubernetes，就不会遇到该问题。该问题可以通过一个[简单的 app](https://github.com/tcarmet/k8s-connection-reset) 来复现，现在可以确定的是这肯定与 Kubernetes 的网络有关，但问题到底出在哪呢？

## Kubernetes 网络基础

----

在深入剖析问题根源之前，我们先来复习一下 Kubernetes 的网络基础。Kubernetes 处理从 Pod 发出的网络流量的方式与目标主机有关，这里主要分为三种类型：

### Pod 到 Pod

在 Kubernetes 集群中，每个 Pod 都有自己的 IP 地址，运行在 Pod 内的应用都可以使用标准的端口号，不用重新映射到不同的随机端口号。所有的 Pod 之间都可以保持三层网络的连通性，比如可以相互 ping 对方，相互发送 `TCP/UDP` 数据包。[CNI](https://github.com/containernetworking/cni) 就是用来实现这些网络功能的标准接口，目前有很多网络插件都支持 CNI。

### Pod 到集群外

从 Pod 内部到集群外部的流量，Kubernetes 会通过 [SNAT](https://en.wikipedia.org/wiki/Network_address_translation) 来处理。SNAT 做的工作就是将数据包的源从 Pod 内部的 `IP:Port` 替换为宿主机的 `IP:Port`，当数据包返回时，再将目的从宿主机的 `IP:Port` 替换为 Pod 内部的 `IP:Port`，然后再发送给 Pod。当然了，中间的整个过程对 Pod 来说是完全透明的，它们对地址转换不会有任何感知。

### Pod 到 Service

Pod 的生命周期是很短暂的，但客户需要的是可靠的服务，所以 Kubernetes 引入了新的资源对象 `Service`，其实它就是是 Pod 前面的四层负载均衡器。`Service` 总共有四种类型，其中最常用的类型是 `CLusterIP`，这种类型的 Service 会自动分配一个仅 cluster 内部可以访问的虚拟 IP。

Kubernetes 通过 `kube-proxy` 组件来实现这些功能，每台计算节点上都运行一个 kube-proxy 服务，通过复杂的 iptables 规则在 Pod 和 Service 之间进行各种过滤和 NAT。如果你登入某个计算节点的终端输入 `iptables-save`，就会看到 kube-proxy 和其他程序在 iptables 规则表中插入的规则。其中最主要的链是 `KUBE-SERVICES`，`KUBE-SVC-*` 和 `KUBE-SEP-*`。

+ `KUBE-SERVICES` 链是访问集群内服务的数据包入口点，它会根据匹配到的目标 `IP:port` 将数据包分发到相应的 `KUBE-SVC-*` 链。
+ `KUBE-SVC-*` 链相当于一个负载均衡器，它会将数据包平均分发到 `KUBE-SEP-*` 链。每个 `KUBE-SVC-*` 链后面的 `KUBE-SEP-*` 链都和 Service 后面的 Endpoint 数量一样。
+ `KUBE-SEP-*` 链通过 `DNAT` 将目标从 Service 的 IP:port 替换为 Endpoint 的 IP:port，从而将流量转发到相应的 Pod。

所有在内核中由 Netfilter 的特定框架做的连接跟踪模块称作 conntrack（connection tracking）。在 DNAT 的过程中，`conntrack` 使用状态机来启动并跟踪连接状态。为什么需要记录连接的状态呢？因为 iptables 需要记住数据包的目标地址被改成了什么，并且在返回数据包时再将目标地址改回来。除此之外 iptables 还可以依靠 conntrack 的状态（cstate）来决定数据包的命运。其中最主要的四个 conntrack 状态是：

+ `NEW` : 匹配连接的第一个包，这表示 conntrack 对该数据包的信息一无所知。通常发生在收到 `SYN` 数据包时。
+ `ESTABLISHED` : 匹配连接的响应包及后续的包，conntrack 知道该数据包属于一个已建立的连接。通常发生在 TCP 握手完成之后。
+ `RELATED` : RELATED 状态有点复杂，当一个连接与另一个已经是 `ESTABLISHED` 的连接有关时，这个连接就被认为是 RELATED。这意味着，一个连接要想成为 RELATED，必须首先有一个已经是 `ESTABLISHED` 的连接存在。这个 ESTABLISHED 连接再产生一个主连接之外的新连接，这个新连接就是 RELATED 状态了。
+ `INVALID` : 匹配那些无法识别或没有任何状态的数据包，conntrack 不知道如何去处理它。该状态在分析 Kubernetes 故障的过程中起着重要的作用。

TCP 连接在 Pod 和 Service 之间的工作流程如下图所示：

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/BIA066.jpg)

TCP 连接的生命周期：

+ 左边的客户端发送数据包到 Service：`192.168.0.2:80`
+ 数据包通过本地节点的 iptables 规则，目的地址被改为 Pod 的地址：`10.0.1.2:80`
+ 提供服务的 Pod（Server Pod）处理完数据包后返回响应包给客户端：`10.0.0.2`
+ 数据包到达客户端所在的节点后，被 conntrack 模块识别并将源地址改为 `192.169.0.2:80`
+ 客户端接收到响应包

整个流程看起来工作的很完美。

## 导致连接重置的原因是什么？

----

尽管 TCP 连接的工作过程看起来很完美，但在 Kubernetes 集群中还是遇到了连接重置的问题，到底是为什么呢？

如下图所示，我们将数据包的生命周期分为 5 个阶段，问题就出在第三阶段。当 conntrack 不能识别返回的包时，就会将其标记为 `INVALID` 状态，包括以下几种情况：由于内存溢出，conntrack 无法继续跟踪连接；数据包超过了 TCP 窗口长度；等等。被 conntrack 标记为 `INVALID` 的数据包，没有相应的 iptables 规则来丢弃它，所以会被转发到客户端，但源地址没有被修改（图中的第4阶段）。因为该响应包的源 IP 是 Pod 的 IP，不是 Service 的 IP，所以客户端无法识别该响应包。这时客户端会说：“等一下，我不记得和这个 IP 有过任何连接，为什么这个家伙要向我发送这个数据包？” 然后客户端就会发送一个 `RST` 包给服务端的 Pod，也就是图中的第 5 阶段。不幸的是，这是 Pod 到 Pod 之间的合法数据包，会被安全送达服务端的 Pod。服务端 Pod 并不知道 DNAT 的过程，从它的视角来看，数据包 5 和 数据包 2 与 3 一样是合法的，现在服务端 Pod 只知道：“客户端准备跑路了，不想和我继续通信了，那我们就关闭连接吧！” 当然，如果想要正常关闭 TCP 连接，`RST` 包必须也是合法的，比如要使用正确的 TCP 序列号等。协商完成后，客户端与服务端都各自关闭了连接。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/IXQkKj.jpg)

## 如何避免连接重置？

----

现在我们已经找到了问题的根源，解决起来就没那么困难了。有两种方法可以避免连接重置：

+ 给 conntrack 提供更多的自由，让它无论什么情况下都不会将数据包标记为 `INVALID`。可以通过以下命令来实现：`echo 1 > /proc/sys/net/ipv4/netfilter/ip_conntrack_tcp_be_liberal`。
+ 添加一个 iptables 规则来丢弃被标记为 `INVALID` 的数据包，这样数据包就不会到达客户端，也不会造成连接重置。

该 fix 已经开始起草（[https://github.com/kubernetes/kubernetes/pull/74840](https://github.com/kubernetes/kubernetes/pull/74840)），但还没有合并到 v1.14 版本中。我这边提供了一种比较便利的方法在集群内所有的节点上应用此规则，只需要创建一个 Deamonset 就可以了：

```yaml
apiVersion: extensions/v1beta1
kind: DaemonSet
metadata:
  name: startup-script
  labels:
    app: startup-script
spec:
  template:
    metadata:
      labels:
        app: startup-script
    spec:
      hostPID: true
      containers:
      - name: startup-script
        image: gcr.io/google-containers/startup-script:v1
        imagePullPolicy: IfNotPresent
        securityContext:
          privileged: true
        env:
        - name: STARTUP_SCRIPT
          value: |
            #! /bin/bash
            echo 1 > /proc/sys/net/ipv4/netfilter/ip_conntrack_tcp_be_liberal
            echo done
```

## 总结

----

很显然，这个 bug 已经存在很长时间了，让我惊讶的是，这么长时间都没人注意到这个问题，直到最近才被发现。我觉得原因有 2：

1. 这个问题通常出现在负载很高导致服务端阻塞的情况中，这不是一个常规现象，比较少见。
2. 应用层的重试可以容忍这种连接重置。

总之，无论 Kubernetes 发展得有多快，它仍然还是一个很年轻的项目。要想让 Kubernetes 真正变成运行应用程序的最佳平台，没有别的办法，只有不断聆听客户的反馈，不把任何事情看成理所当然，不断深入挖掘和优化。

特别感谢 [bowei](https://github.com/bowei) 在我调试和写文章的过程中提供的咨询帮助，感谢 [tcarmet](https://github.com/tcarmet) 反馈该 bug 并提供了复现方法。
