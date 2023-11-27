---
keywords:
- envoy
- envoy proxy
- cds
- eds
title: "Envoy 基础教程：集成服务发现"
subtitle: "为 Envoy 配置 CDS 和 EDS"
date: 2018-07-04T10:12:43Z
draft: false
author: 米开朗基杨
toc: true
categories:
- cloud-native
tags:
- Envoy
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191203201843.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

在微服务中使用 Envoy，需要明确两个核心概念 : **数据平面**和**控制平面**。

+ <span id="inline-blue">数据平面</span> 由一组 Envoy 实例组成，用来调解和控制微服务之间的所有网络通信。
+ <span id="inline-blue">控制平面</span> 从 Envoy 代理和其他服务收集和验证配置，并在运行时执行访问控制和使用策略。

你可以使用静态类型的配置文件来实现控制平面，但为了能做出更加智能的负载均衡决策，最好的方法是通过 API 接口来实现。通过 API 接口来集中发现服务可以充分利用 Envoy 动态更新配置文件的能力。设置控制平面的第一步就是将 Envoy 连接到服务发现服务（SDS），通常分为三步：

1. 实现一个控制平面
2. 将控制平面中定义的服务发布到 Envoy 的 `clusters` 中
3. 将 主机/容器/实例 发布到 Envoy 的 `endpoints` 中

## 实现一个控制平面

----

控制平面必须要满足 [Envoy v2 xDS APIs](https://www.envoyproxy.io/docs/envoy/latest/api-v2/api)，同时为了更好地使用服务发现能力，你的控制平面最好能够实现集群发现服务（CDS）和端点发现服务（EDS）。为了避免重复造轮子，你可以选择社区已经实现好的控制平面：

+ <span id="inline-blue">Rotor</span> : [Rotor](https://github.com/turbinelabs/rotor) 是一种快速、轻量级的 xDS 实现，它可以和 `Kubernetes`、`Consul` 和 `AWS` 等服务集成，并且提供了一组默认的路由发现服务（RDS）和监听器发现服务（LDS）。它也是 Turbine Labs 的商业解决方案 [Houston](https://www.turbinelabs.io/) 的组件之一，Houston 在 Rotor 的基础上增加了更多的路由、指标和弹性方面的配置。
+ <span id="inline-blue">go-control-plane</span> : Envoy 官方仓库提供了一个开源版本的控制平面：[go-control-plane](https://github.com/envoyproxy/go-control-plane)。如果你想弄清楚如何从服务发现服务中获取所有内容，可以好好研究一下这个项目。
+ <span id="inline-blue">Pilot</span> :  如果想将 Envoy 和 Kubernetes 集成，你可以选择 [Istio](https://istio.io/) 项目。Istio 中的控制平面是由 [Pilot](https://istio.io/docs/concepts/traffic-management/pilot.html) 组件来实现的，它会将 `YAMl` 文件的内容转换为相应的 xDS 响应。如果你不想使用 Istio，也不用担心，因为 Pilot 完全可以脱离 Istio 的其他组件（如 `Mixer`）来单独和 Envoy 集成。

## 将服务发布到 CDS

----

集群是 Envoy 连接到的一组逻辑上相似的上游主机，通过它可以对流量进行负载均衡。你可以通过调用集群发现服务（CDS）的 API 来动态获取集群管理成员，Envoy 会定期轮询 `CDS` 端点以进行集群配置，配置文件形式如下：

```yaml
version_info: "0"
resources:
- "@type": type.googleapis.com/envoy.api.v2.Cluster
  name: some_service
  connect_timeout: 1.0s
  lb_policy: ROUND_ROBIN
  type: EDS
  eds_cluster_config:
    eds_config:
      api_config_source:
        api_type: GRPC
        cluster_names: [xds_cluster]
```

服务发现收集的每个服务都会映射到 `resources` 下面的一个配置项，除此之外你还需要为负载均衡设置一些额外的配置参数：

+ `lb_policy` : 集群的负载均衡类型，有以下几种方式：
  + `round_robin` : 轮询主机
  + `weighted_least_request` : 最近获得最少请求的主机
  + `random` : 随机
+ `connect_timeout` : 设置连接超时。越小越好，从 1 秒开始慢慢往上增加，直到网络没有明显的抖动为止。
+ `api_type` : 设置服务的协议。Envoy 通过该协议和服务发现服务进行通信。

通常情况下，你可以对端点（Endpoint）列表进行硬编码，但如果基础架构是动态的，则需要将 `type` 设置为 `EDS`，这将告诉 Envoy 轮询 `EDS API` 以获取可用的 IP/Port 列表。完整示例可以参考 [Envoy 的官方文档](https://www.envoyproxy.io/docs/envoy/latest/api-v1/cluster_manager/cluster.html)。

设置好 CDS 之后，就可以为此集群设置端点发现服务（EDS）了。

## 将实例发布到 EDS

----

Envoy 将端点（`Endpoint`）定义为集群中可用的 IP 和端口。为了能够对服务之间的流量进行负载均衡，Envoy 希望 `EDS API` 能够提供每个服务的端点列表。Envoy 会定期轮询 EDS 端点，然后生成响应：

```yaml
version_info: "0"
resources:
- "@type": type.googleapis.com/envoy.api.v2.ClusterLoadAssignment
  cluster_name: some_service
  endpoints:
  - lb_endpoints:
    - endpoint:
       address:
         socket_address:
           address: 127.0.0.2
           port_value: 1234
```

通过这种配置方式，Envoy 唯一需要知道的就是该端点属于哪个集群，这比直接定义集群更简单。

Envoy 将 CDS 和 EDS 视为一份份的报告并保持服务发现的最终一致性。如果到该端点的请求经常失败，就会从负载均衡中删除该端点，直到再次恢复正常访问。

## 最佳实践：对配置进行分区

----

当集群中有很多服务时，Envoy 与 CDS 和 EDS 的交互量将会非常庞大，一旦出现问题，从几千个 API 响应中排查问题是很不现实的。标准的做法是以两种方式对配置进行分区：

+ `根据数据中心/区域划分` : 通常情况下，一个数据中心的服务不需要知道其他数据中心可用的服务端点。要想在不同区域之间建立通信，需要将远程数据中心的前端代理添加到本地的负载均衡器中。
+ `根据服务需求划分` : 通过为不同的服务配置 Envoy 边车代理（服务 envoy 与每个 serivce 实例一起运行），设置白名单来限制不同服务之间的相互通信，可以降低 1000 个级别的微服务之间相互通信的复杂度。同时边车（Sidecars）代理还可以通过阻止对服务的意外调用来加强安全保护。

对配置进行分区可以降低对不同服务的运营和管理的难度，但它的代价是使控制平面变得更加复杂，但客户往往是不关心控制平面的，所以牺牲控制平面的复杂度还是很值得的。

## 下一步

----

一旦控制平面发现了所有可用服务，就可以在这些服务上配置路由了。下一节将会介绍如何配置路由发现服务（RDS）。

----

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/wechat.gif)
<center>扫一扫关注微信公众号</center>

