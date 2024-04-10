---
title: "Istio 流量管理实现机制深度解析"
subtitle: "从整体上理解 Pilot 和 Envoy 的流量管理机制"
date: 2018-10-09T20:00:17+08:00
draft: false
author: 米开朗基杨
toc: true
categories: 
- service-mesh
tags:
- Istio
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191203152457.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

> 本文转载自[赵化冰的博客](https://zhaohuabing.com/post/2018-09-25-istio-traffic-management-impl-intro/)

## 前言

----

Istio 作为一个 service mesh 开源项目,其中最重要的功能就是对网格中微服务之间的流量进行管理,包括服务发现,请求路由和服务间的可靠通信。Istio 实现了 service mesh 的控制平面，并整合 Envoy 开源项目作为数据平面的 sidecar，一起对流量进行控制。

Istio 体系中流量管理配置下发以及流量规则如何在数据平面生效的机制相对比较复杂，通过官方文档容易管中窥豹，难以了解其实现原理。本文尝试结合系统架构、配置文件和代码对 Istio 流量管理的架构和实现机制进行分析，以达到从整体上理解 Pilot 和 Envoy 的流量管理机制的目的。

## Pilot高层架构

----

Istio 控制平面中负责流量管理的组件为 `Pilot`，Pilot 的高层架构如下图所示：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/5Zywav.jpg "Pilot Architecture（来自 [Isio官网文档](https://istio.io/docs/concepts/traffic-management/))")

根据上图,Pilot 主要实现了下述功能：

### 统一的服务模型

Pilot 定义了网格中服务的标准模型，这个标准模型独立于各种底层平台。由于有了该标准模型，各个不同的平台可以通过适配器和 Pilot 对接，将自己特有的服务数据格式转换为标准格式，填充到 Pilot 的标准模型中。

例如 Pilot 中的 Kubernetes 适配器通过 `Kubernetes API` 服务器得到 kubernetes 中 service 和 pod 的相关信息，然后翻译为标准模型提供给 Pilot 使用。通过适配器模式，Pilot 还可以从 `Mesos`, `Cloud Foundry`, `Consul` 等平台中获取服务信息，还可以开发适配器将其他提供服务发现的组件集成到 Pilot 中。

### 标准数据平面 API

Pilot 使用了一套起源于 Envoy 项目的标准数据平面 API 来将服务信息和流量规则下发到数据平面的 `sidecar` 中。

通过采用该标准 API，Istio 将控制平面和数据平面进行了解耦，为多种数据平面 sidecar 实现提供了可能性。事实上基于该标准 API 已经实现了多种 Sidecar 代理和 Istio 的集成，除 Istio 目前集成的 Envoy 外，还可以和 `Linkerd`, `Nginmesh` 等第三方通信代理进行集成，也可以基于该 API 自己编写 Sidecar 实现。

控制平面和数据平面解耦是 Istio 后来居上，风头超过 Service mesh 鼻祖 `Linkerd` 的一招妙棋。Istio 站在了控制平面的高度上，而 Linkerd 则成为了可选的一种 sidecar 实现，可谓**降维打击**的一个典型成功案例！

数据平面标准 API 也有利于生态圈的建立，开源、商业的各种 sidecar 以后可能百花齐放，用户也可以根据自己的业务场景选择不同的 sidecar 和控制平面集成，如高吞吐量的，低延迟的，高安全性的等等。有实力的大厂商可以根据该 API 定制自己的 sidecar，例如蚂蚁金服开源的 Golang 版本的 Sidecar `MOSN`(Modular Observable Smart Netstub)（`SOFAMesh` 中 Golang 版本的 Sidecar)；小厂商则可以考虑采用成熟的开源项目或者提供服务的商业 sidecar 实现。

<p id="blockquote">Istio 和 Envoy 项目联合制定了 <code>Envoy V2 API</code>,并采用该 API 作为 Istio 控制平面和数据平面流量管理的标准接口。</p>

### 业务 DSL 语言

Pilot 还定义了一套 `DSL`（Domain Specific Language）语言，DSL 语言提供了面向业务的高层抽象，可以被运维人员理解和使用。运维人员使用该 DSL 定义流量规则并下发到 Pilot，这些规则被 Pilot 翻译成数据平面的配置，再通过标准 API 分发到 Envoy 实例，可以在运行期对微服务的流量进行控制和调整。

Pilot 的规则 DSL 是采用 K8S API Server 中的 [Custom Resource (CRD)](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/) 实现的，因此和其他资源类型如 Service，Pod 和 Deployment 的创建和使用方法类似，都可以用 `Kubectl` 进行创建。

通过运用不同的流量规则，可以对网格中微服务进行精细化的流量控制，如按版本分流，断路器，故障注入，灰度发布等。

## Istio 流量管理相关组件

----

我们可以通过下图了解 Istio 流量管理涉及到的相关组件。虽然该图来自 `Istio Github old pilot repo`, 但图中描述的组件及流程和目前 Pilot 的最新代码的架构基本是一致的。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/dCSUXw.jpg "Pilot Design Overview (来自 [Istio old_pilot_repo](https://github.com/istio/old_pilot_repo/blob/master/doc/design.md))")

图例说明：图中<font color=red>红色</font>的线表示控制流，**黑色**的线表示数据流。**蓝色**部分为和Pilot相关的组件。

从上图可以看到，Istio 中和流量管理相关的有以下组件：

### 控制平面组件

#### Discovery Services

对应的 docker 镜像为 `gcr.io/istio-release/pilot`,进程为 `pilot-discovery`，该组件的功能包括：

+ 从 `Service provider`（如kubernetes或者consul）中获取服务信息
+ 从 K8S API Server 中获取流量规则（K8S CRD Resource）
+ 将服务信息和流量规则转化为数据平面可以理解的格式，通过标准的数据平面 API 下发到网格中的各个 sidecar 中

#### K8S API Server

提供 Pilot 相关的 CRD Resource 的增、删、改、查。和 Pilot 相关的 `CRD` 有以下几种：

+ <span id="inline-blue">Virtualservice</span> : 用于定义路由规则，如根据来源或 Header 制定规则，或在不同服务版本之间分拆流量。
+ <span id="inline-blue">DestinationRule</span> : 定义目的服务的配置策略以及可路由子集。策略包括断路器、负载均衡以及 TLS 等。
+ <span id="inline-blue">ServiceEntry</span> : 用 [ServiceEntry](https://istio.io/docs/reference/config/istio.networking.v1alpha3/#ServiceEntry) 可以向 Istio 中加入附加的服务条目，以使网格内可以向 Istio 服务网格之外的服务发出请求。
+ <span id="inline-blue">Gateway</span> : 为网格配置网关，以允许一个服务可以被网格外部访问。
+ <span id="inline-blue">EnvoyFilter</span> : 可以为 Envoy 配置过滤器。由于 Envoy 已经支持 `Lua` 过滤器，因此可以通过 `EnvoyFilter` 启用 Lua 过滤器，动态改变 Envoy 的过滤链行为。我之前一直在考虑如何才能动态扩展 Envoy 的能力，EnvoyFilter 提供了很灵活的扩展性。

### 数据平面组件

在数据平面有两个进程 `Pilot-agent` 和 `envoy`，这两个进程被放在一个 docker 容器 `gcr.io/istio-release/proxyv2` 中。

#### Pilot-agent

该进程根据 K8S API Server 中的配置信息生成 Envoy 的配置文件，并负责启动 Envoy 进程。注意 Envoy 的大部分配置信息都是通过 `xDS` 接口从 Pilot 中动态获取的，因此 Agent 生成的只是用于初始化 Envoy 的少量静态配置。在后面的章节中，本文将对 Agent 生成的 Envoy 配置文件进行进一步分析。

#### Envoy

Envoy 由 `Pilot-agent` 进程启动，启动后，Envoy 读取 Pilot-agent 为它生成的配置文件，然后根据该文件的配置获取到 Pilot 的地址，通过数据平面标准 API 的 xDS 接口从 pilot 拉取动态配置信息，包括路由（route），监听器（listener），服务集群（cluster）和服务端点（endpoint）。Envoy 初始化完成后，就根据这些配置信息对微服务间的通信进行寻址和路由。

### 命令行工具

`kubectl` 和 `istioctl`，由于 Istio 的配置是基于 K8S 的 `CRD`，因此可以直接采用 kubectl 对这些资源进行操作。Istioctl 则针对 Istio 对 CRD 的操作进行了一些封装。Istioctl 支持的功能参见该 [表格](https://istio.io/docs/reference/commands/istioctl)。

## 数据平面标准 API

----

前面讲到，Pilot 采用了一套标准的 API 来向数据平面 Sidecar 提供服务发现，负载均衡池和路由表等流量管理的配置信息。该标准 API 的文档参见 [Envoy v2 API](https://www.envoyproxy.io/docs/envoy/latest/configuration/overview/v2_overview)。[Data Plane API Protocol Buffer Definition](https://github.com/envoyproxy/data-plane-api/tree/master/envoy/api/v2) 给出了 `v2 grpc` 接口相关的数据结构和接口定义。

<p id="blockquote">Istio 早期采用了 Envoy v1 API，目前的版本中则使用 V2 API，V1 已被废弃。</p>

### 基本概念和术语

首先我们需要了解数据平面 API 中涉及到的一些基本概念：

+ `Host` ：能够进行网络通信的实体（如移动设备、服务器上的应用程序）。在此文档中，主机是逻辑网络应用程序。一块物理硬件上可能运行有多个主机，只要它们是可以独立寻址的。在 EDS 接口中，也使用 `Endpoint` 来表示一个应用实例，对应一个 IP+Port 的组合。
+ `Downstream` : 下游主机连接到 Envoy，发送请求并接收响应。
+ `Upstream` : 上游主机接收来自 Envoy 的连接和请求，并返回响应。
+ `Listener` : 监听器是命名网地址（例如，端口、unix domain socket 等)，可以被下游客户端连接。Envoy 暴露一个或者多个监听器给下游主机连接。在 Envoy 中，Listener 可以绑定到端口上直接对外服务，也可以不绑定到端口上，而是接收其他 listener 转发的请求。
+ `Cluster` : 集群是指 Envoy 连接到的逻辑上相同的一组上游主机。Envoy 通过服务发现来发现集群的成员。可以选择通过主动健康检查来确定集群成员的健康状态。Envoy 通过负载均衡策略决定将请求路由到哪个集群成员。

### XDS 服务接口

Istio 数据平面 API 定义了 xDS 服务接口，Pilot 通过该接口向数据平面 sidecar 下发动态配置信息，以对 Mesh 中的数据流量进行控制。xDS 中的 DS 表示 `discovery service`，即发现服务，表示 `xDS` 接口使用动态发现的方式提供数据平面所需的配置数据。而 x 则是一个代词，表示有多种 discover service。这些发现服务及对应的数据结构如下：

+ `LDS` (Listener Discovery Service) : [envoy.api.v2.Listener](https://github.com/envoyproxy/data-plane-api/blob/master/envoy/api/v2/lds.proto)
+ `CDS` (Cluster Discovery Service) : [envoy.api.v2.RouteConfiguration](https://github.com/envoyproxy/data-plane-api/blob/master/envoy/api/v2/rds.proto)
+ `EDS` (Endpoint Discovery Service) : [envoy.api.v2.Cluster](https://github.com/envoyproxy/data-plane-api/blob/master/envoy/api/v2/cds.proto)
+ `RDS` (Route Discovery Service) : [envoy.api.v2.ClusterLoadAssignment](https://github.com/envoyproxy/data-plane-api/blob/master/envoy/api/v2/eds.proto)

### XDS 服务接口的最终一致性考虑

xDS 的几个接口是相互独立的，接口下发的配置数据是最终一致的。但在配置更新过程中，可能暂时出现各个接口的数据不匹配的情况，从而导致部分流量在更新过程中丢失。

设想这种场景：在 `CDS/EDS` 只知道 cluster X 的情况下，`RDS` 的一条路由配置将指向Cluster X 的流量调整到了 Cluster Y。在 CDS/EDS 向 Mesh 中 Envoy 提供 Cluster Y 的更新前，这部分导向 Cluster Y 的流量将会因为 Envoy 不知道 Cluster Y 的信息而被丢弃。

对于某些应用来说，短暂的部分流量丢失是可以接受的，例如客户端重试可以解决该问题，并不影响业务逻辑。对于另一些场景来说，这种情况可能无法容忍。可以通过调整 xDS 接口的更新逻辑来避免该问题，对上面的情况，可以先通过 CDS/EDS 更新 Y Cluster，然后再通过 RDS 将 X 的流量路由到Y。

一般来说，为了避免 Envoy 配置数据更新过程中出现流量丢失的情况，xDS 接口应采用下面的顺序：

1. `CDS` 首先更新 `Cluster` 数据（如果有变化）
2. `EDS` 更新相应 Cluster 的 `Endpoint` 信息（如果有变化）
3. `LDS` 更新 CDS/EDS 相应的 `Listener`
4. `RDS` 最后更新新增 Listener 相关的 `Route` 配置
5. 删除不再使用的 CDS cluster 和 EDS endpoints

### ADS 聚合发现服务

保证控制平面下发数据一致性，避免流量在配置更新过程中丢失的另一个方式是使用 ADS(Aggregated Discovery Services)，即聚合的发现服务。`ADS` 通过一个 gRPC 流来发布所有的配置更新，以保证各个 xDS 接口的调用顺序，避免由于 xDS 接口更新顺序导致的配置数据不一致问题。

关于 XDS 接口的详细介绍可参考 [xDS REST and gRPC protocol](https://github.com/envoyproxy/data-plane-api/blob/master/XDS_PROTOCOL.md)

## Bookinfo 示例程序分析

----

下面我们以 `Bookinfo` 为例对 Istio 中的流量管理实现机制，以及控制平面和数据平面的交互进行进一步分析。

### Bookinfo 程序结构

下图显示了 Bookinfo 示例程序中各个组件的 IP 地址，端口和调用关系，以用于后续的分析。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/fONobF.jpg)

### xDS 接口调试方法

首先我们看看如何对 xDS 接口的相关数据进行查看和分析。Envoy v2 接口采用了 `gRPC`，由于 gRPC 是基于二进制的 RPC 协议，无法像 V1 的 `REST` 接口一样通过 curl 和浏览器进行进行分析。但我们还是可以通过 Pilot 和 Envoy 的调试接口查看 xDS 接口的相关数据。

#### Pilot 调试方法

Pilot 在 `9093` 端口提供了下述 [调试接口](https://github.com/istio/istio/tree/master/pilot/pkg/proxy/envoy/v2) 下述方法查看 xDS 接口相关数据。

```bash
PILOT=istio-pilot.istio-system:9093

# What is sent to envoy
# Listeners and routes
curl $PILOT/debug/adsz

# Endpoints
curl $PILOT/debug/edsz

# Clusters
curl $PILOT/debug/cdsz
```

#### Envoy 调试方法

Envoy 提供了管理接口，缺省为 localhost 的 `15000` 端口，可以获取 listener，cluster 以及完整的配置数据导出功能。

```bash
$ kubectl exec productpage-v1-54b8b9f55-bx2dq -c istio-proxy curl http://127.0.0.1:15000/help

  /: Admin home page
  /certs: print certs on machine
  /clusters: upstream cluster status
  /config_dump: dump current Envoy configs (experimental)
  /cpuprofiler: enable/disable the CPU profiler
  /healthcheck/fail: cause the server to fail health checks
  /healthcheck/ok: cause the server to pass health checks
  /help: print out list of admin commands
  /hot_restart_version: print the hot restart compatibility version
  /listeners: print listener addresses
  /logging: query/change logging levels
  /quitquitquit: exit the server
  /reset_counters: reset all counters to zero
  /runtime: print runtime values
  /runtime_modify: modify runtime values
  /server_info: print server version/status information
  /stats: print server stats
  /stats/prometheus: print server stats in prometheus format
```

进入 productpage pod 中的 istio-proxy(Envoy) container，可以看到有下面的监听端口：

+ `9080` : productpage 进程对外提供的服务端口
+ `15001` : Envoy 的入口监听器，iptable 会将 pod 的流量导入该端口中由 Envoy 进行处理
+ `15000` : Envoy 管理端口，该端口绑定在本地环回地址上，只能在 Pod 内访问。

```bash
$ kubectl exec productpage-v1-76474f6fb7-j8fm4 -c istio-proxy -- ss -tulnp

Netid  State      Recv-Q Send-Q Local Address:Port               Peer Address:Port
tcp    LISTEN     0      128    127.0.0.1:15000                 *:*                   users:(("envoy",pid=12,fd=9))
tcp    LISTEN     0      128       *:9080                  *:*
tcp    LISTEN     0      128       *:15001                 *:*                   users:(("envoy",pid=12,fd=85))
```

### Envoy 启动过程分析

Istio 通过 K8s 的 [Admission webhook](/posts/kubernetes-extensible-admission/) 机制实现了 sidecar 的自动注入，Mesh 中的每个微服务会被加入 Envoy 相关的容器。下面是 `Productpage` 微服务的 Pod 内容，可见除 productpage 之外，Istio 还在该 Pod 中注入了两个容器 `gcr.io/istio-release/proxy_init` 和 `gcr.io/istio-release/proxyv2`。

{{< alert >}}
下面 Pod description 中只保留了需要关注的内容，删除了其它不重要的部分。为方便查看，本文中后续的其它配置文件以及命令行输出也会进行类似处理。
{{< /alert >}}

```bash
$ kubectl describe pod productpage-v1-54b8b9f55-bx2dq

Name:               productpage-v1-54b8b9f55-bx2dq
Namespace:          default
Init Containers:
  istio-init:
    Image:         gcr.io/istio-release/proxy_init:1.0.0
      Args:
      -p
      15001
      -u
      1337
      -m
      REDIRECT
      -i
      *
      -x

      -b
      9080,
      -d

Containers:
  productpage:
    Image:          istio/examples-bookinfo-productpage-v1:1.8.0
    Port:           9080/TCP

  istio-proxy:
    Image:         gcr.io/istio-release/proxyv2:1.0.0
    Args:
      proxy
      sidecar
      --configPath
      /etc/istio/proxy
      --binaryPath
      /usr/local/bin/envoy
      --serviceCluster
      productpage
      --drainDuration
      45s
      --parentShutdownDuration
      1m0s
      --discoveryAddress
      istio-pilot.istio-system:15007
      --discoveryRefreshDelay
      1s
      --zipkinAddress
      zipkin.istio-system:9411
      --connectTimeout
      10s
      --statsdUdpAddress
      istio-statsd-prom-bridge.istio-system:9125
      --proxyAdminPort
      15000
      --controlPlaneAuthPolicy
      NONE
```

#### Proxy_init

Productpage 的 Pod 中有一个 InitContainer `proxy_init`，`InitContrainer` 是 K8S 提供的机制，用于在 Pod 中执行一些初始化任务。在 Initialcontainer 执行完毕并退出后，才会启动 Pod 中的其它 container。

我们看一下 proxy_init 容器中的内容：

```bash
$ docker image inspect gcr.io/istio-release/proxy_init:1.0.0
```
```json
[
    {
        "RepoTags": [
            "gcr.io/istio-release/proxy_init:1.0.0"
        ],

        "ContainerConfig": {
            "Env": [
                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
            ],
            "Cmd": [
                "/bin/sh",
                "-c",
                "#(nop) ",
                "ENTRYPOINT [\"/usr/local/bin/istio-iptables.sh\"]"
            ],
            "Entrypoint": [
                "/usr/local/bin/istio-iptables.sh"
            ],
        },
    }
]
```

从上面的命令行输出可以看到，Proxy_init 中执行的命令是 `istio-iptables.sh`，该脚本源码较长，就不列出来了，有兴趣可以在 Istio 源码仓库的 [tools/deb/istio-iptables.sh](https://github.com/istio/istio/blob/master/tools/deb/istio-iptables.sh) 查看。

该脚本的作用是通过配置 iptables 来劫持 Pod 中的流量。结合前面 Pod 中该容器的命令行参数 `-p 15001`，可以得知 Pod 中的数据流量被 iptables 拦截，并发向 Envoy 的 15001 端口。 `-u 1337` 参数用于排除用户 ID 为 1337，即 Envoy 自身的流量，以避免 Iptables 把 Envoy 发出的数据又重定向到 Envoy，形成死循环。

#### Proxyv2

前面提到，该容器中有两个进程 Pilot-agent 和 envoy。我们进入容器中看看这两个进程的相关信息。

```bash
$ kubectl exec productpage-v1-54b8b9f55-bx2dq -c istio-proxy -- ps -ef

UID        PID  PPID  C STIME TTY          TIME CMD
istio-p+     1     0  0 Sep06 ?        00:00:00 /usr/local/bin/pilot-agent proxy sidecar --configPath /etc/istio/proxy --binaryPath /usr/local/bin/envoy --serviceCluster productpage --drainDuration 45s --parentShutdownDuration 1m0s --discoveryAddress istio-pilot.istio-system:15007 --discoveryRefreshDelay 1s --zipkinAddress zipkin.istio-system:9411 --connectTimeout 10s --statsdUdpAddress istio-statsd-prom-bridge.istio-system:9125 --proxyAdminPort 15000 --controlPlaneAuthPolicy NONE
istio-p+    13     1  0 Sep06 ?        00:47:37 /usr/local/bin/envoy -c /etc/istio/proxy/envoy-rev0.json --restart-epoch 0 --drain-time-s 45 --parent-shutdown-time-s 60 --service-cluster productpage --service-node sidecar~192.168.206.23~productpage-v1-54b8b9f55-bx2dq.default~default.svc.cluster.local --max-obj-name-len 189 -l warn --v2-config-only
```

Envoy 的大部分配置都是 `dynamic resource`，包括网格中服务相关的 service cluster, listener, route 规则等。这些 dynamic resource 是通过 xDS 接口从 Istio 控制平面中动态获取的。但 Envoy 如何知道 xDS server 的地址呢？这是在 Envoy 初始化配置文件中以 `static resource` 的方式配置的。

#### Envoy 初始配置文件

`Pilot-agent` 进程根据启动参数和 K8S API Server 中的配置信息生成 Envoy 的初始配置文件，并负责启动 Envoy 进程。从 ps 命令输出可以看到 Pilot-agent 在启动 Envoy 进程时传入了 `pilot` 地址和 `zipkin` 地址，并为 Envoy 生成了一个初始化配置文件 `envoy-rev0.json`。

Pilot agent 生成初始化配置文件的代码： [https://github.com/istio/istio/blob/release-1.0/pkg/bootstrap/bootstrap_config.go](https://github.com/istio/istio/blob/release-1.0/pkg/bootstrap/bootstrap_config.go) 137行

```go
// WriteBootstrap generates an envoy config based on config and epoch, and returns the filename.
// TODO: in v2 some of the LDS ports (port, http_port) should be configured in the bootstrap.
func WriteBootstrap(config *meshconfig.ProxyConfig, node string, epoch int, pilotSAN []string, opts map[string]interface{}) (string, error) {
	if opts == nil {
		opts = map[string]interface{}{}
	}
	if err := os.MkdirAll(config.ConfigPath, 0700); err != nil {
		return "", err
	}
	// attempt to write file
	fname := configFile(config.ConfigPath, epoch)

	cfg := config.CustomConfigFile
	if cfg == "" {
		cfg = config.ProxyBootstrapTemplatePath
	}
	if cfg == "" {
		cfg = DefaultCfgDir
	}
	......

	if config.StatsdUdpAddress != "" {
		h, p, err = GetHostPort("statsd UDP", config.StatsdUdpAddress)
		if err != nil {
			return "", err
		}
		StoreHostPort(h, p, "statsd", opts)
	}

	fout, err := os.Create(fname)
	if err != nil {
		return "", err
	}

	// Execute needs some sort of io.Writer
	err = t.Execute(fout, opts)
	return fname, err
}
```

可以使用下面的命令将 productpage pod 中该文件导出来查看其中的内容：

```bash
$ kubectl exec productpage-v1-54b8b9f55-bx2dq -c istio-proxy -- cat /etc/istio/proxy/envoy-rev0.json > envoy-rev0.json
```

配置文件的结构如图所示：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/Rwq4zh.jpg)

其中各个配置节点的内容如下：

<p id=blue>Node</p>

包含了 Envoy 所在节点相关信息。

```json
"node": {
    "id": "sidecar~192.168.206.23~productpage-v1-54b8b9f55-bx2dq.default~default.svc.cluster.local",
    //用于标识 envoy 所代理的 node（在k8s中对应为Pod）上的 service cluster，来自于 Envoy 进程启动时的 service-cluster 参数
    "cluster": "productpage",  
    "metadata": {
          "INTERCEPTION_MODE": "REDIRECT",
          "ISTIO_PROXY_SHA": "istio-proxy:6166ae7ebac7f630206b2fe4e6767516bf198313",
          "ISTIO_PROXY_VERSION": "1.0.0",
          "ISTIO_VERSION": "1.0.0",
          "POD_NAME": "productpage-v1-54b8b9f55-bx2dq",
          "istio": "sidecar"
    }
  }
```

<p id=blue>Admin</p>

配置 Envoy 的日志路径以及管理端口。

```json
"admin": {
    "access_log_path": "/dev/stdout",
    "address": {
      "socket_address": {
        "address": "127.0.0.1",
        "port_value": 15000
      }
    }
  }
```

<p id=blue>Dynamic_resources</p>

配置动态资源,这里配置了 `ADS` 服务器。

```json
"dynamic_resources": {
    "lds_config": {
        "ads": {}
    },
    "cds_config": {
        "ads": {}
    },
    "ads_config": {
      "api_type": "GRPC",
      "refresh_delay": {"seconds": 1, "nanos": 0},
      "grpc_services": [
        {
          "envoy_grpc": {
            "cluster_name": "xds-grpc"
          }
        }
      ]
    }
  }
```

<p id=blue>Static_resources</p>

配置静态资源，包括了 `xds-grpc` 和 `zipkin` 两个 cluster。其中 xds-grpc cluster 对应前面 dynamic_resources 中 ADS 配置，指明了 Envoy 用于获取动态资源的服务器地址。

```json
"static_resources": {
  "clusters": [
    {
      "name": "xds-grpc",
      "type": "STRICT_DNS",
      "connect_timeout": {
        "seconds": 10,
        "nanos": 0
      },
      "lb_policy": "ROUND_ROBIN",
      "hosts": [
        {
          "socket_address": {
            "address": "istio-pilot.istio-system",
            "port_value": 15010
          }
        }
      ],
      "circuit_breakers": {
        "thresholds": [
          {
            "priority": "default",
            "max_connections": "100000",
            "max_pending_requests": "100000",
            "max_requests": "100000"
          },
          {
            "priority": "high",
            "max_connections": "100000",
            "max_pending_requests": "100000",
            "max_requests": "100000"
          }
        ]
      },
      "upstream_connection_options": {
        "tcp_keepalive": {
          "keepalive_time": 300
        }
      },
      "http2_protocol_options": {}
    },
    {
      "name": "zipkin",
      "type": "STRICT_DNS",
      "connect_timeout": {
        "seconds": 1
      },
      "lb_policy": "ROUND_ROBIN",
      "hosts": [
        {
          "socket_address": {
            "address": "zipkin.istio-system",
            "port_value": 9411
          }
        }
      ]
    }
  ]
}
```

<p id=blue>Tracing</p>

配置分布式链路跟踪。

```json
"tracing": {
  "http": {
    "name": "envoy.zipkin",
    "config": {
      "collector_cluster": "zipkin"
    }
  }
}
```

<p id=blue>Stats_sinks</p>

这里配置的是和 Envoy 直连的 `metrics` 收集 sink,和 `Mixer telemetry` 没有关系。Envoy 自带 stats 格式的 metrics 上报。

```json
"stats_sinks": [
  {
    "name": "envoy.statsd",
    "config": {
      "address": {
        "socket_address": {
          "address": "10.254.238.237",
          "port_value": 9125
        }
      }
    }
  }
]
```

在Gist [https://gist.github.com/zhaohuabing/14191bdcf72e37bf700129561c3b41ae](https://gist.github.com/zhaohuabing/14191bdcf72e37bf700129561c3b41ae) 中可以查看该配置文件的完整内容。

### Envoy 配置分析

#### 通过管理接口获取完整配置

从 Envoy 初始化配置文件中，我们可以大致看到 Istio 通过 Envoy 来实现服务发现和流量管理的基本原理。即控制平面将 xDS server 信息通过 `static resource` 的方式配置到 Envoy 的初始化配置文件中，Envoy 启动后通过 xDS server 获取到 `dynamic resource`，包括网格中的 service 信息及路由规则。

Envoy 配置初始化流程：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/NQTN5a.jpg)

1. Pilot-agent 根据启动参数和 K8S API Server 中的配置信息生成 Envoy 的初始配置文件 `envoy-rev0.json`，该文件告诉 Envoy 从 `xDS server` 中获取动态配置信息，并配置了 xDS server 的地址信息，即控制平面的 `Pilot`。
2. Pilot-agent 使用 envoy-rev0.json 启动 Envoy 进程。
3. Envoy 根据初始配置获得 Pilot 地址，采用 xDS 接口从 Pilot 获取到 `Listener`，`Cluster`，`Route` 等动态配置信息。
4. Envoy 根据获取到的动态配置启动 Listener，并根据 Listener 的配置，结合 Route 和 Cluster 对拦截到的流量进行处理。

可以看到，Envoy 中实际生效的配置是由初始化配置文件中的静态配置和从 Pilot 获取的动态配置一起组成的。因此只对 envoy-rev0.json 进行分析并不能看到 Mesh 中流量管理的全貌。那么有没有办法可以看到 Envoy 中实际生效的完整配置呢？答案是可以的，我们可以通过 Envoy 的管理接口来获取 Envoy 的完整配置。

```bash
$ kubectl exec -it productpage-v1-54b8b9f55-bx2dq -c istio-proxy curl http://127.0.0.1:15000/config_dump > config_dump
```

该文件内容长达近7000行，本文中就不贴出来了，在Gist [https://gist.github.com/zhaohuabing/034ef87786d290a4e89cd6f5ad6fcc97](https://gist.github.com/zhaohuabing/034ef87786d290a4e89cd6f5ad6fcc97) 中可以查看到全文。

#### Envoy 配置文件结构

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/3DyRUz.jpg)

文件中的配置节点包括：

##### Bootstrap

从名字可以大致猜出这是 Envoy 的初始化配置，打开该节点，可以看到文件中的内容和前一章节中介绍的 envoy-rev0.json 是一致的，这里不再赘述。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/CBAqAH.jpg)

##### Clusters

在 Envoy 中，Cluster 是一个服务集群，Cluster 中包含一个到多个 endpoint，每个 endpoint 都可以提供服务，Envoy 根据负载均衡算法将请求发送到这些 endpoint 中。

在 Productpage 的 clusters 配置中包含 `static_clusters` 和 `dynamic_active_clusters` 两部分，其中 static_clusters 是来自于 envoy-rev0.json 的 xDS server 和 zipkin server 信息。dynamic_active_clusters 是通过 xDS 接口从 Istio 控制平面获取的动态服务信息。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/pXRSn3.jpg)

Dynamic Cluster 中有以下几类 Cluster：

<p id=blue>Outbound Cluster</p>

这部分的 Cluster 占了绝大多数，该类 Cluster 对应于 Envoy 所在节点的外部服务。以 `details` 为例，对于 Productpage 来说，details 是一个外部服务，因此其 Cluster 名称中包含 `outbound` 字样。

从 details 服务对应的 cluster 配置中可以看到，其类型为 `EDS`，即表示该 Cluster 的 endpoint 来自于动态发现，动态发现中 `eds_config` 则指向了 `ads`，最终指向 static Resource 中配置的 xds-grpc cluster，即 Pilot 的地址。

```json
{
 "version_info": "2018-09-06T09:34:19Z",
 "cluster": {
  "name": "outbound|9080||details.default.svc.cluster.local",
  "type": "EDS",
  "eds_cluster_config": {
   "eds_config": {
    "ads": {}
   },
   "service_name": "outbound|9080||details.default.svc.cluster.local"
  },
  "connect_timeout": "1s",
  "circuit_breakers": {
   "thresholds": [
    {}
   ]
  }
 },
 "last_updated": "2018-09-06T09:34:20.404Z"
}
```

可以通过 Pilot 的调试接口获取该 Cluster 的 endpoint：

```bash
$ curl http://10.96.8.103:9093/debug/edsz > pilot_eds_dump
```

导出的文件长达 1300 多行，本文只贴出 details 服务相关的 `endpoint` 配置，完整文件参见: [https://gist.github.com/zhaohuabing/a161d2f64746acd18097b74e6a5af551](https://gist.github.com/zhaohuabing/a161d2f64746acd18097b74e6a5af551)

从下面的文件内容可以看到，details cluster 配置了 1 个 endpoint 地址，是 details 的 `pod ip`。

```json
{
  "clusterName": "outbound|9080||details.default.svc.cluster.local",
  "endpoints": [
    {
      "locality": {

      },
      "lbEndpoints": [
        {
          "endpoint": {
            "address": {
              "socketAddress": {
                "address": "192.168.206.21",
                "portValue": 9080
              }
            }
          },
          "metadata": {
            "filterMetadata": {
              "istio": {
                  "uid": "kubernetes://details-v1-6764bbc7f7-qwzdg.default"
                }
            }
          }
        }
      ]
    }
  ]
}
```

<p id=blue>Inbound Cluster</p>

该类 Cluster 对应于 Envoy 所在节点上的服务。如果该服务接收到请求，当然就是一个入站请求。对于 Productpage Pod 上的 Envoy，其对应的 Inbound Cluster 只有一个，即 productpage。该 cluster 对应的 host 为 `127.0.0.1`，即环回地址上 productpage 的监听端口。由于 iptables 规则中排除了 127.0.0.1,入站请求通过该 Inbound cluster 处理后将跳过 Envoy，直接发送给 Productpage 进程处理。

```json
{
   "version_info": "2018-09-14T01:44:05Z",
   "cluster": {
    "name": "inbound|9080||productpage.default.svc.cluster.local",
    "connect_timeout": "1s",
    "hosts": [
     {
      "socket_address": {
       "address": "127.0.0.1",
       "port_value": 9080
      }
     }
    ],
    "circuit_breakers": {
     "thresholds": [
      {}
     ]
    }
   },
   "last_updated": "2018-09-14T01:44:05.291Z"
}
```

<p id=blue>BlackHoleCluster</p>

这是一个特殊的 Cluster，并没有配置后端处理请求的 Host。如其名字所暗示的一样，请求进入后将被直接丢弃掉。如果一个请求没有找到其对的目的服务，则被发到 BlackHoleCluster。

```json
{
   "version_info": "2018-09-06T09:34:19Z",
   "cluster": {
    "name": "BlackHoleCluster",
    "connect_timeout": "5s"
   },
   "last_updated": "2018-09-06T09:34:20.408Z"
}
```

##### Listeners

Envoy 采用 listener 来接收并处理 `downstream` 发过来的请求，listener 的处理逻辑是插件式的，可以通过配置不同的 `filter` 来插入不同的处理逻辑。Istio 就在 Envoy 中加入了用于 `policy check` 和 `metric report` 的 Mixer filter。

Listener 可以绑定到 `IP Socket` 或者 `Unix Domain Socket` 上，也可以不绑定到一个具体的端口上，而是接收从其他 listener 转发来的数据。Istio 就是利用了 Envoy listener 的这一特点实现了将来发向不同服务的请求转交给不同的 listener 处理。

<p id=blue>Virtual Listener</p>

Envoy 创建了一个在 `15001` 端口监听的入口监听器。Iptables 将请求截取后发向 15001 端口，该监听器接收后并不进行业务处理，而是根据请求目的地分发给其他监听器处理。该监听器取名为 `virtual`（虚拟）监听器也是这个原因。

Envoy 是如何做到按服务分发的呢？ 可以看到该 Listener 的配置项 `use_original_dest` 设置为 true,该配置要求监听器将接收到的请求转交给和请求原目的地址关联的 listener 进行处理。

从其 filter 配置可以看到，如果找不到和请求目的地配置的 listener 进行转交，则请求将被发送到 `BlackHoleCluster`,由于 BlackHoleCluster 并没有配置 host，因此找不到对应目的地对应监听器的请求实际上会被丢弃。

```json
{
 "version_info": "2018-09-06T09:34:19Z",
 "listener": {
  "name": "virtual",
  "address": {
   "socket_address": {
    "address": "0.0.0.0",
    "port_value": 15001
   }
  },
  "filter_chains": [
   {
    "filters": [
     {
      "name": "envoy.tcp_proxy",
      "config": {
       "stat_prefix": "BlackHoleCluster",
       "cluster": "BlackHoleCluster"
      }
     }
    ]
   }
  ],
  "use_original_dst": true
 },
 "last_updated": "2018-09-06T09:34:26.262Z"
}
```

<p id=blue>Inbound Listener</p>

在 Productpage Pod 上的 Envoy 创建了 `Listener 192.168.206.23_9080`，当外部调用 Productpage 服务的请求到达 Pod 上 15001 的 `Virtual Listener` 时，Virtual Listener 根据请求目的地匹配到该 Listener,请求将被转发过来。

```json
{
 "version_info": "2018-09-14T01:44:05Z",
 "listener": {
  "name": "192.168.206.23_9080",
  "address": {
   "socket_address": {
    "address": "192.168.206.23",
    "port_value": 9080
   }
  },
  "filter_chains": [
   {
    "filters": [
     {
      "name": "mixer",
      "config": {
       "transport": {
        "check_cluster": "outbound|9091||istio-policy.istio-system.svc.cluster.local",
        "network_fail_policy": {
         "policy": "FAIL_CLOSE"
        },
        "report_cluster": "outbound|9091||istio-telemetry.istio-system.svc.cluster.local",
        "attributes_for_mixer_proxy": {
         "attributes": {
          "source.uid": {
           "string_value": "kubernetes://productpage-v1-54b8b9f55-bx2dq.default"
          }
         }
        }
       },
       "mixer_attributes": {
        "attributes": {
         "destination.port": {
          "int64_value": "9080"
         },
         "context.reporter.uid": {
          "string_value": "kubernetes://productpage-v1-54b8b9f55-bx2dq.default"
         },
         "destination.namespace": {
          "string_value": "default"
         },
         "destination.ip": {
          "bytes_value": "AAAAAAAAAAAAAP//wKjOFw=="
         },
         "destination.uid": {
          "string_value": "kubernetes://productpage-v1-54b8b9f55-bx2dq.default"
         },
         "context.reporter.kind": {
          "string_value": "inbound"
         }
        }
       }
      }
     },
     {
      "name": "envoy.tcp_proxy",
      "config": {
       "stat_prefix": "inbound|9080||productpage.default.svc.cluster.local",
       "cluster": "inbound|9080||productpage.default.svc.cluster.local"
      }
     }
    ]
   }
  ],
  "deprecated_v1": {
   "bind_to_port": false
  }
 },
 "last_updated": "2018-09-14T01:44:05.754Z"
}
```

从上面的配置 `”bind_to_port”: false` 可以得知该 listener 创建后并不会被绑定到 tcp 端口上直接接收网络上的数据，因此其所有请求都转发自 15001 端口。

该 listener 配置的 `envoy.tcp_proxy filter` 对应的 cluster为 `inbound|9080||productpage.default.svc.cluster.local`,该 cluster 配置的 host 为 127.0.0.1:9080，因此 Envoy 会将该请求发向 `127.0.0.1:9080`。由于 iptables 设置中 127.0.0.1 不会被拦截,该请求将发送到 Productpage 进程的 9080 端口进行业务处理。

除此以外，Listenter 中还包含 `Mixer filter` 的配置信息，配置了策略检查(Mixer check)和 Metrics 上报(Mixer report)服务器地址，以及 Mixer上 报的一些 attribute 取值。

<p id=blue>Outbound Listener</p>

Envoy 为网格中的外部服务按端口创建多个 Listener，以用于处理出向请求。

Productpage Pod 中的 Envoy 创建了多个 Outbound Listener：

+ `0.0.0.0_9080` : 处理对 details，reviews 和 rating 服务的出向请求
+ `0.0.0.0_9411` : 处理对 `zipkin` 的出向请求
+ `0.0.0.0_15031` :处理对 `ingressgateway` 的出向请求
+ `0.0.0.0_3000` : 处理对 `grafana` 的出向请求
+ `0.0.0.0_9093` :处理对 citadel、galley、pilot、(Mixer)policy、(Mixer)telemetry 的出向请求
+ `0.0.0.0_15004` : 处理对 (Mixer)policy、(Mixer)telemetry 的出向请求
+ ......

除了 9080 这个 Listener 用于处理应用的业务之外，其他 listener 都是 Istio 用于处理自身组件之间通信使用的，有的控制平面组件如 Pilot，Mixer 对应多个 listener，是因为该组件有多个端口提供服务。

我们这里主要分析一下 `9080` 这个业务端口的 Listenrer。和 Outbound Listener 一样，该 Listener 同样配置了 `”bind_to_port”: false` 属性，因此该 listener 也没有被绑定到 tcp 端口上，其接收到的所有请求都转发自 15001 端口的 Virtual listener。

监听器 name 为 `0.0.0.0_9080`，推测其含义应为匹配发向任意 IP 的 9080 的请求，从 bookinfo 程序结构可以看到该程序中的 productpage，revirews，ratings，details 四个 service 都是 9080 端口，那么 Envoy 如何区别处理这四个 service 呢？

首先需要区分**入向**（发送给productpage）请求和**出向**（发送给其他几个服务）请求：

+ 发给 productpage 的入向请求，virtual listener 根据其目的 IP 和 Port 首先匹配到 `192.168.206.23_9080` 这个 listener 上，不会进入 `0.0.0.0_9080` listener处理。
+ 从 productpage 外发给 reviews、details 和 ratings 的出向请求，virtual listener 无法找到和其目的 IP 完全匹配的 listener，因此根据通配原则转交给 `0.0.0.0_9080` 处理。

<p id=blockquote>备注：<br />
1. 该转发逻辑为根据 Envoy 配置进行的推测，并未分析 Envoy 代码进行验证。欢迎了解 Envoy 代码和实现机制的朋友指正。
<br />
2. 根据业务逻辑，实际上 productpage 并不会调用 ratings 服务，但 Istio 并不知道各个业务之间会如何调用，因此将所有的服务信息都下发到了 Envoy 中。这样做对效率和性能理论上有一定影响，存在一定的优化空间。</p>

由于对应到 reviews、details 和 ratings 三个服务，当 0.0.0.0_9080 接收到出向请求后，并不能直接发送到一个 downstream cluster 中，而是需要根据请求目的地进行不同的路由。

在该 listener 的配置中，我们可以看到并没有像 inbound listener 那样通过 envoy.tcp_proxy 直接指定一个 downstream 的 cluster，而是通过 `rds` 配置了一个路由规则 `9080`，在路由规则中再根据不同的请求目的地对请求进行处理。

```json
{
     "version_info": "2018-09-06T09:34:19Z",
     "listener": {
      "name": "0.0.0.0_9080",
      "address": {
       "socket_address": {
        "address": "0.0.0.0",
        "port_value": 9080
       }
      },
      "filter_chains": [
       {
        "filters": [
         {
          "name": "envoy.http_connection_manager",
          "config": {
           "access_log": [
            {
             "name": "envoy.file_access_log",
             "config": {
              "path": "/dev/stdout"
             }
            }
           ],
           "http_filters": [
            {
             "name": "mixer",
             "config": {

			  ......

             }
            },
            {
             "name": "envoy.cors"
            },
            {
             "name": "envoy.fault"
            },
            {
             "name": "envoy.router"
            }
           ],
           "tracing": {
            "operation_name": "EGRESS",
            "client_sampling": {
             "value": 100
            },
            "overall_sampling": {
             "value": 100
            },
            "random_sampling": {
             "value": 100
            }
           },
           "use_remote_address": false,
           "stat_prefix": "0.0.0.0_9080",
           "rds": {
            "route_config_name": "9080",
            "config_source": {
             "ads": {}
            }
           },
           "stream_idle_timeout": "0.000s",
           "generate_request_id": true,
           "upgrade_configs": [
            {
             "upgrade_type": "websocket"
            }
           ]
          }
         }
        ]
       }
      ],
      "deprecated_v1": {
       "bind_to_port": false
      }
     },
     "last_updated": "2018-09-06T09:34:26.172Z"
    },
```

##### Routes

配置 Envoy 的路由规则。Istio 下发的缺省路由规则中对每个端口设置了一个路由规则，根据 host 来对请求进行路由分发。

下面是 `9080` 的路由配置，从文件中可以看到对应了 3 个 `virtual host`，分别是 details、ratings 和 reviews，这三个 virtual host 分别对应到不同的 `outbound cluster`。

```json
{
     "version_info": "2018-09-14T01:38:20Z",
     "route_config": {
      "name": "9080",
      "virtual_hosts": [
       {
        "name": "details.default.svc.cluster.local:9080",
        "domains": [
         "details.default.svc.cluster.local",
         "details.default.svc.cluster.local:9080",
         "details",
         "details:9080",
         "details.default.svc.cluster",
         "details.default.svc.cluster:9080",
         "details.default.svc",
         "details.default.svc:9080",
         "details.default",
         "details.default:9080",
         "10.101.163.201",
         "10.101.163.201:9080"
        ],
        "routes": [
         {
          "match": {
           "prefix": "/"
          },
          "route": {
           "cluster": "outbound|9080||details.default.svc.cluster.local",
           "timeout": "0s",
           "max_grpc_timeout": "0s"
          },
          "decorator": {
           "operation": "details.default.svc.cluster.local:9080/*"
          },
          "per_filter_config": {
           "mixer": {
            ......

           }
          }
         }
        ]
       },
       {
        "name": "ratings.default.svc.cluster.local:9080",
        "domains": [
         "ratings.default.svc.cluster.local",
         "ratings.default.svc.cluster.local:9080",
         "ratings",
         "ratings:9080",
         "ratings.default.svc.cluster",
         "ratings.default.svc.cluster:9080",
         "ratings.default.svc",
         "ratings.default.svc:9080",
         "ratings.default",
         "ratings.default:9080",
         "10.99.16.205",
         "10.99.16.205:9080"
        ],
        "routes": [
         {
          "match": {
           "prefix": "/"
          },
          "route": {
           "cluster": "outbound|9080||ratings.default.svc.cluster.local",
           "timeout": "0s",
           "max_grpc_timeout": "0s"
          },
          "decorator": {
           "operation": "ratings.default.svc.cluster.local:9080/*"
          },
          "per_filter_config": {
           "mixer": {
           ......

            },
            "disable_check_calls": true
           }
          }
         }
        ]
       },
       {
        "name": "reviews.default.svc.cluster.local:9080",
        "domains": [
         "reviews.default.svc.cluster.local",
         "reviews.default.svc.cluster.local:9080",
         "reviews",
         "reviews:9080",
         "reviews.default.svc.cluster",
         "reviews.default.svc.cluster:9080",
         "reviews.default.svc",
         "reviews.default.svc:9080",
         "reviews.default",
         "reviews.default:9080",
         "10.108.25.157",
         "10.108.25.157:9080"
        ],
        "routes": [
         {
          "match": {
           "prefix": "/"
          },
          "route": {
           "cluster": "outbound|9080||reviews.default.svc.cluster.local",
           "timeout": "0s",
           "max_grpc_timeout": "0s"
          },
          "decorator": {
           "operation": "reviews.default.svc.cluster.local:9080/*"
          },
          "per_filter_config": {
           "mixer": {
            ......

            },
            "disable_check_calls": true
           }
          }
         }
        ]
       }
      ],
      "validate_clusters": false
     },
     "last_updated": "2018-09-27T07:17:50.242Z"
    }
```

### Bookinfo 端到端调用分析

通过前面章节对 Envoy 配置文件的分析，我们了解到 Istio 控制平面如何将服务和路由信息通过 xDS 接口下发到数据平面中；并介绍了 Envoy 上生成的各种配置数据的结构，包括 listener，cluster，route 和 endpoint。

下面我们来分析一个端到端的调用请求，通过调用请求的流程把这些配置串连起来，以从全局上理解 Istio 控制平面的流量控制是如何在数据平面的 Envoy 上实现的。

下图描述了一个 `Productpage` 服务调用 `Details` 服务的请求流程：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/yD84dx.jpg)

1、Productpage 发起对 Details 的调用：`http://details:9080/details/0`。

2、请求被 Pod 的 iptables 规则拦截，转发到 15001 端口。

3、Envoy 的 Virtual Listener 在 `15001` 端口上监听，收到了该请求。

4、请求被 Virtual Listener 根据原目标 IP（通配）和端口（9080）转发到 `0.0.0.0_9080` 这个 listener。

```json
{
 "version_info": "2018-09-06T09:34:19Z",
 "listener": {
  "name": "virtual",
  "address": {
   "socket_address": {
    "address": "0.0.0.0",
    "port_value": 15001
   }
  }
  ......

  "use_original_dst": true //请求转发给和原始目的IP:Port匹配的listener
 },
```

5、根据 0.0.0.0_9080 listener 的 `http_connection_manager filter` 配置,该请求采用 “9080” route 进行分发。

```json
 {
  "version_info": "2018-09-06T09:34:19Z",
  "listener": {
   "name": "0.0.0.0_9080",
   "address": {
    "socket_address": {
     "address": "0.0.0.0",
     "port_value": 9080
    }
   },
   "filter_chains": [
    {
     "filters": [
      {
       "name": "envoy.http_connection_manager",
       "config": {
       ......

        "rds": {
         "route_config_name": "9080",
         "config_source": {
          "ads": {}
         }
        },

      }
     ]
    }
   ],
   "deprecated_v1": {
    "bind_to_port": false
   }
  },
  "last_updated": "2018-09-06T09:34:26.172Z"
 },

 {
  },
```

6、`9080` 这个 route 的配置中，host name 为 `details:9080` 的请求对应的 cluster 为 `outbound|9080||details.default.svc.cluster.local`

```json
 {
  "version_info": "2018-09-14T01:38:20Z",
  "route_config": {
   "name": "9080",
   "virtual_hosts": [
    {
     "name": "details.default.svc.cluster.local:9080",
     "domains": [
      "details.default.svc.cluster.local",
      "details.default.svc.cluster.local:9080",
      "details",
      "details:9080",
      "details.default.svc.cluster",
      "details.default.svc.cluster:9080",
      "details.default.svc",
      "details.default.svc:9080",
      "details.default",
      "details.default:9080",
      "10.101.163.201",
      "10.101.163.201:9080"
     ],
     "routes": [
      {
       "match": {
        "prefix": "/"
       },
       "route": {
        "cluster": "outbound|9080||details.default.svc.cluster.local",
        "timeout": "0s",
        "max_grpc_timeout": "0s"
       },
         ......

        }
       }
      }
     ]
    },
      ......

 {
  },   
```

7、`outbound|9080||details.default.svc.cluster.local` cluster 为动态资源，通过 eds 查询得到其 endpoint 为 192.168.206.21:9080。

```json
 {
 "clusterName": "outbound|9080||details.default.svc.cluster.local",
 "endpoints": [
 {
   "locality": {

   },
   "lbEndpoints": [
     {
       "endpoint": {
         "address": {
           "socketAddress": {
             "address": "192.168.206.21",
             "portValue": 9080
           }
         }
       },
      ......  
     }
   ]
 }
 ]
 }   
```

8、请求被转发到 192.168.206.21，即 Details 服务所在的 Pod，被 iptables 规则拦截，转发到 15001 端口。

9、Envoy 的 `Virtual Listener` 在 15001 端口上监听，收到了该请求。

10、请求被 Virtual Listener 根据请求原目标地址 IP（192.168.206.21）和端口（9080）转发到 `192.168.206.21_9080` 这个 listener。

11、根据 92.168.206.21_9080 listener 的 `http_connection_manager filter` 配置，该请求对应的 cluster 为 `inbound|9080||details.default.svc.cluster.local`。

```json
 {
  "version_info": "2018-09-06T09:34:16Z",
  "listener": {
   "name": "192.168.206.21_9080",
   "address": {
    "socket_address": {
     "address": "192.168.206.21",
     "port_value": 9080
    }
   },
   "filter_chains": [
    {
     "filters": [
      {
       "name": "envoy.http_connection_manager",
       ......

       "route_config": {
         "name": "inbound|9080||details.default.svc.cluster.local",
         "validate_clusters": false,
         "virtual_hosts": [
          {
           "name": "inbound|http|9080",
           "routes": [
             ......

             "route": {
              "max_grpc_timeout": "0.000s",
              "cluster": "inbound|9080||details.default.svc.cluster.local",
              "timeout": "0.000s"
             },
             ......

             "match": {
              "prefix": "/"
             }
            }
           ],
           "domains": [
            "*"
           ]
          }
         ]
        },
         ......

        ]
       }
      }
     ]
    }
   ],
   "deprecated_v1": {
    "bind_to_port": false
   }
  },
  "last_updated": "2018-09-06T09:34:22.184Z"
 }   
```

12、`inbound|9080||details.default.svc.cluster.local` cluster 配置的 host 为`127.0.0.1:9080`。

13、请求被转发到 127.0.0.1:9080，即 Details 服务进行处理。

上述调用流程涉及的完整 Envoy 配置文件参见：

+ Proudctpage ：[https://gist.github.com/zhaohuabing/034ef87786d290a4e89cd6f5ad6fcc97](https://gist.github.com/zhaohuabing/034ef87786d290a4e89cd6f5ad6fcc97)
+ Details ：[https://gist.github.com/zhaohuabing/544d4d45447b65d10150e528a190f8ee](https://gist.github.com/zhaohuabing/544d4d45447b65d10150e528a190f8ee)

## 小结

----

本文介绍了 Istio 流量管理相关组件，Istio 控制平面和数据平面之间的标准接口，以及 Istio 下发到 Envoy 的完整配置数据的结构和内容。然后通过 Bookinfo 示例程序的一个端到端调用分析了 Envoy 是如何实现服务网格中服务发现和路由转发的，希望能帮助大家透过概念更进一步深入理解 Istio 流量管理的实现机制。

## 参考资料

----

1. [Istio Traffic Managment Concept](https://istio.io/docs/concepts/traffic-management/#pilot-and-envoy)
2. [Data Plane API](https://github.com/envoyproxy/data-plane-api/blob/master/API_OVERVIEW.md)
3. [kubernetes Custom Resource](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources)
4. [Istio Pilot Design Overview](https://github.com/istio/old_pilot_repo/blob/master/doc/design.md)
5. [Envoy V2 API Overview](https://www.envoyproxy.io/docs/envoy/latest/configuration/overview/v2_overview)
6. [Data Plane API Protocol Buffer Definition](https://github.com/envoyproxy/data-plane-api/tree/master/envoy/api/v2)
7. [xDS REST and gRPC protocol](https://github.com/envoyproxy/data-plane-api/blob/master/XDS_PROTOCOL.md)
8. [Pilot Debug interface](https://github.com/istio/istio/tree/master/pilot/pkg/proxy/envoy/v2)
9. [Istio Sidecar自动注入原理](https://zhaohuabing.com/2018/05/23/istio-auto-injection-with-webhook/)

