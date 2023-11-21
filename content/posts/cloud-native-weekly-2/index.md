---
keywords:
- 米开朗基杨
- kubernetes
- cloud-native
title: "云原生周报第 2 期"
subtitle: "每周最新云原生项目与博客推荐"
description: 每周最新云原生项目与博客推荐
date: 2019-07-05T22:11:46+08:00
draft: false
author: 米开朗基杨
toc: true
categories: cloud-native
tags: ["kubernetes"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-07-06-071216.jpg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

这是云原生周报第 2 期，主要分享云原生社区最新开源项目，优秀博客、电子书和视频。

## <span id="inline-toc">1.</span> 开源项目推荐

----

[Kube Forwarder](https://kube-forwarder.pixelpoint.io/) : Kubernetes 端口转发的 GUI 客户端，支持多集群，断开后可自动重连（`kubectl` 可做不到这一点哦），可对多个 Service 同时进行端口转发。

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-07-04-131408.jpg)

[Kube eagle](https://github.com/cloudworkz/kube-eagle) : 这是一个 Prometheus Exporter，用来更精确地抓取 Kubernetes 集群中 Pod 资源的 `requests`、`limits` 和实际使用量。

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-07-04-132825.jpg)

[Kube-hunter](https://github.com/aquasecurity/kube-hunter) : Kubernetes 集群渗透测试工具，从事安全工作的相关人员可以关注一下。

[ko](https://github.com/google/ko) : 用来在 Kubernetes 中构建并部署 `golang` 应用的工具。它的使用方法非常简单，如果你想构建一个 golang 应用，并把它部署到 Kubernetes 集群中，只需要编写一个如下的 YAML 文件：

```yaml
# helloworld.yaml
apiVersion: apps/v1beta1
kind: Deployment
metadata:
  name: hello-world
spec:
  selector:
    matchLabels:
      foo: bar
  replicas: 1
  template:
    metadata:
      labels:
        foo: bar
    spec:
      containers:
      - name: hello-world
        # 将 image 的值换成 golang 的项目路径
        # 比如如果你的项目路径为 ~/gopath/src/github.com/mattmoor/examples
        # 那么 image 的值为 github.com/mattmoor/examples
        image: github.com/mattmoor/examples/http/cmd/helloworld
        ports:
        - containerPort: 8080
```

然后使用命令 `ko apply -f helloworld.yaml` 即可自动编译成二进制文件、构建镜像然后部署到集群中，一步到位！

[Cluster version of VictoriaMetrics](https://github.com/VictoriaMetrics/VictoriaMetrics/tree/cluster) : VictoriaMetrics 是 Prometheus 支持的远程存储，而集群版 VictoriaMetrics 用来实现大规模 Prometheus 集群的高可用，并提供了全局视图和可靠的历史数据存储，与 [Thanos](https://github.com/improbable-eng/thanos) 的功能类似，但比 Thanos 的架构更简单，值得一试！

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-07-04-150300.jpg)

[Service Mesh Hub](https://github.com/solo-io/service-mesh-hub) : [solo.io](https://www.solo.io/) 开源的 `Service Mesh` 仓库，提供了一个 Dashboard 用来发现和部署不同类型的 Service Mesh，也可以管理每个 Service Mesh 的扩展。

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-07-04-152250.png)

这是仓库里包含的所有扩展：

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-07-04-152233.png)

[Kubernetes Standardized Glossary](https://kubernetes.io/docs/reference/glossary/) : 这是 Kubernetes 官方文档新出的标准术语表，对每种资源类型和组件都有标准化的解释。

[netramesh](https://github.com/avito-tech/netramesh) : 这是一个轻量级的 Service Mesh 框架。你没有听错，这是一个全新的 Service Mesh 框架。据官方文档所述，它比 `Istio` 和 `Linkerd2` 的资源消耗更少，性能更高，每个 Sidecar 大约消耗 10-50Mb 的内存和 1ms 的延迟开销。这是它的架构图：

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-07-04-154128.jpg)

[KubeOne](https://github.com/kubermatic/kubeone) : Golang 编写的 Kubernetes 高可用集群部署工具，底层使用的是 `kubeadm`。

[ingress-nginx kubectl plugin](https://kubernetes.github.io/ingress-nginx/kubectl-plugin/) : NGINX Ingress Controller 的 `kubectl` 插件，可用来方便快速地调试 ingress。通过该插件，你可以直接查看某个 ingress 资源后端有哪些 endpoint，直接导出某个域名的证书和秘钥，也可以导出 Nginx 的配置文件，非常实用。

[Singer](https://github.com/pinterest/singer) : Printerest 开源的高性能可扩展日志收集 agent，可对接 Kafaka。

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-07-05-075333.jpg)

## <span id="inline-toc">2.</span> 博客推荐

----

[Multi-Container Pods in Kubernetes](https://linchpiner.github.io/k8s-multi-container-pods.html) : 在 Kubernetes 中，Pod 是最小的调度单元，Pod 中可以只运行一个容器，也可以运行多个容器。本文主要讨论了在什么场景下需要在一个 Pod 中运行多个容器，主要包括三种需求：共享存储、进程间通信、共享网络。

[云原生架构的五大原则](https://cloud.google.com/blog/products/application-development/5-principles-for-cloud-native-architecture-what-it-is-and-how-to-master-it) : 这是一篇 Google Cloud 的官方博客，描述了云原生架构应该遵循的五个准则。

[使用 nftables 实现 API Server 的高可用](https://thebsdbox.co.uk/2019/06/20/Balancing-the-API-Server-with-nftables/) : 这篇文章比较有意思，详细描述了如何用 `nftables` 来实现 API Server 的高可用，后面还提到了如何用 nftables 来实现 `kube-proxy` 的四层负载均衡功能。

[podpreset批量添加时区配置](https://www.li-rui.top/2019/06/20/kubernetes/podpreset%E6%89%B9%E9%87%8F%E6%B7%BB%E5%8A%A0%E6%97%B6%E5%8C%BA%E9%85%8D%E7%BD%AE/) : 使用 Docker 镜像来部署应用时，大家都会遇到一个让人头疼的问题，那就是时区不一致。为了解决这个问题，也涌现出了各种各样的方法，例如改 Dockerfile，将宿主机的 /etc/localtime 挂载到容器中等。本文给出了一种一劳永逸的巧妙方法，大家可以尝试一下。

[容器环境中的应用弹性能力](https://medium.com/@trevor00/application-resiliency-in-a-containerized-environment-b5e42120ae1) : 本文介绍了如何在容器环境中提高应用的弹性能力和可用性。

[弹性能力设计模式：重试，回退，超时，断路器](https://blog.codecentric.de/en/2019/06/resilience-design-patterns-retry-fallback-timeout-circuit-breaker/) : 本文主要讨论了松耦合、隔离和延迟控制是如何对系统的弹性能力产生积极的影响。其中重试模式可以通过多次尝试来恢复通信，回退模式可以在本地解决通信故障，断路器可以抵挡由于重试而导致的 DoS 攻击以及当持续出现通信错误时可以快速回退。

[明智的微服务之路](http://www.javiercasas.com/articles/sensible-steps-to-microservices) : 过去几年中，越来越多的创业公司转向了微服务架构，DevOps 相关招聘需求暴增，容器文化盛行。这篇文章试图解释这一切背后的原因，先列出了微服务架构的痛点，增加了系统的各种复杂度，最后告诉我们即使微服务架构增加了各种复杂度，你仍然可以转向微服务架构的原因。

[macvtap实践教程](https://sealyun.com/post/macvtap/) : `macvtap` 是网络虚拟化常用的一种技术，基于传统的 MACVLAN。它可以用来简化虚拟化环境中的交换网络，代替传统的 Linux TAP 设备加 Bridge 设备组合。`kata` 的虚拟化网络就用了这个技术，通过本文的实践可以帮助你理解 kata 的网络原理。

[解决 CoreDNS 缓存不一致而导致的域名解析问题](https://discover.curve.app/a/mind-of-a-problem-solver) : 如果你在 CoreDNS 中启用了 `cache` 和 `autopath` 插件，并且 CoreDNS 版本低于 **1.5.1**，就会遇到缓存不一致的问题。本文作者是该 bug 的修复者，他会带领我们一步一步进行调查，最后找到问题所在。

## <span id="inline-toc">3.</span> 视频推荐

----

**Envoy SDS：增强 Istio 的安全性** : Istio 1.1 之前，Istio 为工作负载提供的密钥和证书是由 Citadel 生成并使用加载 Secret 卷的方式分发给 Sidecar 的，这种方式有很多缺陷，比如证书轮换造成的性能损失和安全漏洞。在 Istio 1.1 中，可以使用 SDS 来解决这些问题，它的主要工作原理如下：

1. 工作负载的 Sidecar 从 Citadel 代理中请求密钥和证书：Citadel 代理是一个 SDS 服务器，这一代理以 DaemonSet 的形式在每个节点上运行，在这一请求中，Envoy 把 Kubernetes service account 的 JWT 传递给 Citadel 代理。
2. Citadel 代理生成密钥对，并向 Citadel 发送 CSR 请求： Citadel 校验 JWT，并给 Citadel 代理签发证书。
3. Citadel 代理把密钥和证书返回给工作负载的 Sidecar。

本视频主要演示了 SDS 是如何高效地进行证书轮换，以及 Citadel 是如何独立于其他 Istio 组件工作的。

{{< bilibili BV1p4411c7mB >}}

**使用 Envoy，Cilium 和 BPF 进行透明混沌测试** : 混沌测试主要用来在分布式系统上做对照实验，引入混沌：服务器崩溃、硬盘异常、网络连接中断等，从而帮助建立对系统承受不可避免的故障的能力的信心。目前大部分的混沌测试都是手动完成的，本视频演示了如何将 Envoy 和 Cilium、BPF 结合使用，以完全透明的方式将服务不可用性、延迟和随机限速等混乱引入 Kubernetes 集群。

{{< bilibili BV1u4411c7Fp >}}
