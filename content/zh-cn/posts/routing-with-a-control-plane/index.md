---
keywords:
- envoy
- envoy proxy
- xds
- rds
title: "Envoy 基础教程：通过控制平面提供路由"
subtitle: "路由定义的最佳实践"
date: 2018-07-06T06:16:02Z
draft: false
author: 米开朗基杨
toc: true
categories:
- cloud-native
tags:
- Envoy
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191203200936.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

当微服务集群规模非常庞大时，控制平面包含了大量的 Envoy 配置项和基础设施状态，这时最好将数据平面与控制平面分离。控制平面最主要的功能包括自动重试和[集成服务发现](/posts/integrating-service-discovery-with-envoy/)。

单独创建控制平面的最大优势之一是可以为路由配置提供统一的来源。传统架构的路由定义分散存储在 Web 服务器的配置文件、负载均衡器配置文件和特定应用程序的配置中（如 `routes.rb`），使用单独的控制平面可以集中所有的路由配置，使它们更易于更改和管理，同时也为应用的迁移和发布提供了更高的灵活性。

## 通过 RDS 提供路由

----

Envoy 的动态配置功能允许通过路由发现服务（RDS）的 `API` 来动态获取路由配置。控制平面通过 RDS 提供路由配置，将 **域名+路径** 映射到 Envoy 中的某个集群（cluster），而实际的流量控制由 Envoy 实例来完成。

这里是一个使用 RDS 来动态获取路由的示例：

```yaml
version_info: "0"
resources:
- "@type": type.googleapis.com/envoy.api.v2.RouteConfiguration
  name: local_route
  virtual_hosts:
  - name: local_service
    domains: ["*"]
    routes:
    - match: { prefix: "/" }
      route: { cluster: some_service }
```

开源项目 [go-control-plane](https://github.com/envoyproxy/go-control-plane)，[Istio Pilot](https://istio.io/docs/concepts/traffic-management/pilot.html) 和 商业项目 [Houston](http://turbinelabs.io/product) 都提供了 RDS 的 API，Envoy 官方文档也定义了一个[完整的 RDS 规范](https://www.envoyproxy.io/docs/envoy/latest/configuration/overview/v2_overview.html#v2-grpc-streaming-endpoints)。RDS 规范只是一种流量传输机制，如何对路由进行管理还是要取决于你。

## 路由定义的最佳实践

----

当你的系统中有数千个 Envoy 实例时，应该选择控制平面来作为所有路由的统一来源。客户端请求可以直接来自用户、内部服务或者来自不同的云区域，因此最好使用 Envoy 来处理这些不同的网络拓扑（例如，作为客户流量的前端代理以及内部流量的服务网格），虽然流量来自不同的方向，但它们的行为都是相似的。

为了扩展单个系统的路由定义，通常需要遵循以下三个关键原则：

1. 将路由视为数据，而不是配置
2. 将控制权分配给具有 `ACL` 权限的团队
3. 使用审计日志和回滚操作来管理路由的更改

### 将路由视为数据

将路由视为一组相互关联的服务的数据可以防止发生冲突，同时确保了其语义的正确性。虽然像 `Istio` 这样的工具可以很容易地编写基于 `YAML` 配置文件的路由，但是在数千行 YAML 文件中管理数百条路由很难保证每个定义都是有效的路由。或许你也想过使用版本控制来管理这些配置文件，但如果合并分支时发生致命错误将会导致灾难性的后果（如路由丢失或通过 API 重写）。

实际上，从静态配置文件转移到动态配置文件是在大规模集群中使用 Envoy 的第一步。为了能够将 Envoy 投入生产，建议至少使用像 [go-control-plane](https://github.com/envoyproxy/go-control-plane) 这样实现了 `xDS` 的控制平面统一提供路由配置。通过将路由的来源转移到 `RDS API` 背后，可以实现路由的并发更新，同时也可以防止对路由进行无意义的更新。

### 将控制权分配给具有 `ACL` 权限的团队

通过对流量进行管控可以解锁更强大的工作流程（如蓝绿发布和增量迁移），同时也能让服务团队确保各个服务之间的路由是安全可用的。你可以根据需要来隐藏管控区域之外的路由以防止误点击或者发生意外事故，你也可以完全禁止某些成员修改路由。

### 管理路由的更改

了解路由何时被更改以及被谁更改是极其重要的，许多团队会发现，在他们分配好了定义路由的任务之后，实际路由的数量将会超出他们的预期，因此为了保险起见，最好对路由的更改进行记录。例如，`master` 分支中的自动蓝绿发布应该打上最后一个合并分支的人的标签。

为了更好地管理路由，团队内部必须要知道如何在两个时间点之间更改路由以及如何在必要时将其回滚，同时最好将这些操作收集到监控系统中。当你需要进一步优化时，这些操作记录是很有价值的（例如 git 历史记录在编写新代码时很有帮助）。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/wechat.gif)

