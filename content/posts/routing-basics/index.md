---
title: "Envoy 基础教程：HTTP 路由解析"
subtitle: "通过 HTTP 路由规则来切换流量"
date: 2018-06-29T09:57:33Z
draft: false
author: 米开朗基杨
toc: true
categories: "service-mesh"
tags: ["envoy"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191203203731.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

本文将更详细地讨论 Envoy 的 HTTP 路由，如果你已经看过了我的上篇文章：[在你的笔记本上运行 Envoy](https://icloudnative.io/posts/run-envoy-on-your-laptop/)，现在就可以更深入地了解如何在静态文件中配置路由（Route）、集群（Cluster）和监听器（Listener）了。

## <span id="inline-toc">1.</span> 相关组件

----

### 路由

<span id="inline-blue">路由</span> 是一组将虚拟主机与集群相匹配的规则，通过路由你可以很轻松地创建流量切换规则。路由的定义方式有两种：通过静态配置文件定义或通过路由发现服务（`RDS`）进行配置。

### 集群

<span id="inline-blue">集群</span> 是一组逻辑上相似的上游主机，它接收来自 Envoy 的流量。集群可以通过负载均衡策略来提高基础架构的弹性。集群可以通过静态文件进行配置，也可以通过集群发现服务（`CDS`）API 动态获取。

### 监听器

<span id="inline-blue">监听器</span> 是可以接受来自下游客户端的连接的命名网络位置（例如，端口，unix域套接字等）。Envoy 公开一个或多个下游主机连接的侦听器。同样，监听器可以通过静态定义，也可以通过监听器发现服务（LDS）动态获取。

## <span id="inline-toc">2.</span> 配置路由

----

Envoy 的路由定义将 `域 + URL` 映射到集群。在上一篇文章中，我们定义了两个集群（service1 和 service2），每一个集群都匹配一个单独的 URL（`/service1` 和 `/service2`）。

```yaml
virtual_hosts:
  - name: backend
    domains:
    - "*"
    routes:
    - match:
        prefix: "/service/1"
      route:
        cluster: service1
    - match:
        prefix: "/service/2"
      route:
        cluster: service2
```

集群从 DNS 中获取集群成员数据，并对集群中的所有主机使用**轮询**的方式进行负载均衡。

```yaml
clusters:
  - name: service1
      connect_timeout: 0.25s
      type: strict_dns
      lb_policy: round_robin
      http2_protocol_options: {}
      hosts:
      - socket_address:
          address: service1
          port_value: 80
  - name: service2
      connect_timeout: 0.25s
      type: strict_dns
      lb_policy: round_robin
      http2_protocol_options: {}
      hosts:
      - socket_address:
          address: service2
          port_value: 80
```

## <span id="inline-toc">3.</span> 配置监听器

----

路由的配置包含在监听器的配置中，现在我们再回过头来看一下监听器的配置。监听器通过**监听器过滤器**（Listener filter）来操作路由配置中定义的两个服务。监听器的 API 非常简单，它的作用是在不更改 Envoy 的核心功能的情况下添加更多的集成功能。

```yaml
listeners:
  - address:
      socket_address:
        address: 0.0.0.0
        port_value: 80
    filter_chains:
    - filters:
      - name: envoy.http_connection_manager
        config:
          codec_type: auto
          stat_prefix: ingress_http
          route_config:
            name: local_route
            virtual_hosts:
            - name: backend
              domains:
              - "*"
              routes:
              - match:
                  prefix: "/service/1"
                route:
                  cluster: service1
              - match:
                  prefix: "/service/2"
                route:
                  cluster: service2
          http_filters:
          - name: envoy.router
            config: {}
```

## <span id="inline-toc">4.</span> 动态发现路由、集群和监听器

----

到目前为止我们都是通过静态配置文件来配置路由和集群，但你也可以通过 `RDS` 和 `CDS` 来动态更新路由和集群。特别是当你的基础架构规模非常大时，你可以通过配置动态服务发现的规则来简化你的重复配置成本，并且可以将同一套动态服务发现规则应用于多个 Envoy 集群。

现在你已经了解了如何配置基本的路由、集群和监听器，下一节我们将学习如何在增量部署中设置更复杂的流量切换和过滤规则。

## <span id="inline-toc">5.</span> 参考

----

+ [Envoy 官方文档中文版](https://servicemesher.github.io/envoy/)


