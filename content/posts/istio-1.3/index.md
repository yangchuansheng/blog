---
keywords:
- 米开朗基杨
- istio
- mixer
- envoy
- 遥测
title: "Istio 1.3 发布，HTTP 遥测不再需要 Mixer"
subtitle: "重磅来袭！"
description: Istio 1.3 发布，HTTP 遥测不再需要 Mixer。 
date: 2019-09-14T23:31:46+08:00
draft: false
author: 米开朗基杨
toc: true
categories: "service mesh"
tags: ["istio", "service mesh", "kubernetes"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/WechatIMG12.jpeg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

Istio 是 Google、IBM 和 Lyft 联合开源的服务网格（Service Mesh）框架，旨在解决大量微服务的发现、连接、管理、监控以及安全等问题。 Istio 对应用是透明的，不需要改动任何服务代码就可以实现透明的服务治理。[1.3](https://istio.io/about/notes/1.3) 版本已经发布，距离上一个重要版本 [1.2](https://istio.io/about/notes/1.3) 发布已过去两个多月，我们来看看有哪些修改内容。

## <span id="inline-toc">1.</span> 智能协议检测

----

在之前的版本中，如果要使用 Istio 的路由功能，`Service` 的端口命名必须使用特殊的命名格式。如果用户不遵循该命名规则，就无法使用路由功能。从 1.3 版本开始，即使没有按照规则命名 Service 的端口，Istio 也会自动识别出站流量的协议为 `HTTP` 或 `TCP`。目前还不支持自动识别入站流量的协议，下个版本将会支持。

## <span id="inline-toc">2.</span> 无 Mixer 的遥测功能（实验性）

----

这才是大家最期待的！该版本将大多数常见的安全策略相关的功能（如 RBAC）直接迁移到了 `Envoy` 中，同时也将大部分遥测功能迁移到了 Envoy 中。现在 Istio proxy 可以直接将收集到的 `HTTP` 指标暴露给 `Prometheus`，无需通过 `istio-telemetry` 服务来中转并丰富指标信息。如果你只关心 HTTP 服务的遥测，可以试试这个新功能，具体步骤参考[无 Mixer 的 HTTP 遥测](https://github.com/istio/istio/wiki/Mixerless-HTTP-Telemetry)。该功能接下来几个月将会逐渐完善，以便在启用双向 TLS 认证时支持 `TCP` 服务的遥测。

## <span id="inline-toc">3.</span> 无需定义 containerPort

----

此前的版本要求网格中的每个 Pod 必须明确申明每个容器的 `containerPort`，任何未申明的端口都会绕过 Istio Proxy。1.3 版本使用了一种更为简单安全的方法，不需要显示申明 `containerPort` 就可以处理工作负载任何端口上的所有入站流量。之前的版本中，当工作负载向自己发送流量时，会陷入 iptables 规则表导致的无限循环，这个版本也修复了。

## <span id="inline-toc">4.</span> 支持完全自定义 Envoy 配置

----

虽然 Istio 1.3 专注于可用性，但高级用户仍然可以使用 `Envoy` 中不属于 Istio Networking API 的高级功能。1.3 版本增强了 `EnvoyFilter` API 以允许用户完全自定义以下的 Envoy 配置：

+ LDS 返回的 `HTTP/TCP` 监听器以及 filter 链配置。
+ RDS 返回的 `HTTP` 路由配置。
+ CDS 返回的 `Cluster` 配置。

## <span id="inline-toc">5.</span> 其他增强功能

----

+ `istioctl` 新增了许多调试功能，可以帮助你排查安装过程中出现的各种问题。详细信息可以查看 istioctl 的[参考页面](https://istio.io/docs/reference/commands/istioctl/)
+ 区域感知负载均衡功能从实验分支转移到默认分支。现在 Istio 可以利用现有的位置信息来确定负载均衡池的优先级，并支持将请求转发到地理位置最近的后端。
+ Istio 开启双向 TLS 认证时可以更好地支持 headless service。
+ 从以下几个方面增强了控制平面的监控：
   + 添加新指标来监控配置的状态
   + 新增了 sidecar injector 的指标
   + 为 `Citadel` 添加了新的 Grafana 仪表板
   + 改进了 `Pilot` 仪表板，新增了几个关键指标
+ 新增了 [Istio 部署模型文档](https://istio.io/docs/concepts/deployment-models/)，可以帮助你选择合适的部署模型。
+ 重新组织了[操作指南](https://istio.io/docs/ops/)中的内容，新增了一个[包含所有故障排除任务的章节](https://istio.io/docs/ops/troubleshooting)，可以帮助你快速寻找所需信息。

详细内容请查看[发布公告](https://istio.io/about/notes/1.3)。

## 参考资料

----

+ [Announcing Istio 1.3](https://istio.io/blog/2019/announcing-1.3/)
