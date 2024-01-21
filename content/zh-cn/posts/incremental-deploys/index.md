---
keywords:
- envoy
- envoy proxy
title: "Envoy 基础教程：实现增量部署"
subtitle: "基于请求头的路由和加权负载均衡"
date: 2018-07-02T05:37:37Z
draft: false
author: 米开朗基杨
toc: true
categories:
- cloud-native
tags:
- Envoy
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191203203329.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

微服务最常见的工作流程之一就是版本更新。不同于基础架构更新，通过流量管理可以优雅地实现微服务的版本更新。当新发布的版本有缺陷时，这种方法就可以避免版本缺陷对用户造成的不良影响。

本文将继续沿用前文使用的示例，在原有配置文件的基础上新增了个别服务的新版本来演示流量是如何切换的（包括基于请求头的路由和加权负载均衡）。

## 基于请求头的路由

----

为了说明基于请求头的路由对微服务产生的影响，首先创建一个新版本的 `service1` 。这里仍然使用 Envoy 仓库中的 [front-proxy](https://github.com/envoyproxy/envoy/tree/master/examples/front-proxy) 示例，修改 [docker-compose.yml](https://github.com/envoyproxy/envoy/blob/master/examples/front-proxy/docker-compose.yml) 文件，添加一个名为 `service1a` 的新服务。

```yaml
  service1a:
    build:
      context: .
      dockerfile: Dockerfile-service
    volumes:
      - ./service-envoy.yaml:/etc/service-envoy.yaml
    networks:
      envoymesh:
        aliases:
          - service1a
    environment:
      - SERVICE_NAME=1a
    expose:
      - "80"
```

为了确保 Envoy 可以发现该服务，需要将该服务添加到 `clusters` 配置项中。

```yaml
  - name: service1a
    connect_timeout: 0.25s
    type: strict_dns
    lb_policy: round_robin
    http2_protocol_options: {}
    hosts:
    - socket_address:
        address: service1a
        port_value: 80
```

为了使新加的服务路由可达，需要在 `match` 配置项中添加一个带有 `headers` 字段的新路由。因为路由规则列表是按顺序匹配的，所以我们需要将该规则添加到路由规则列表的顶部，这样与新规则匹配的包含该头文件的请求就会被转发到新服务，而不包含该头文件的请求仍然被转发到 service1。

```yaml
routes:
- match:
    prefix: "/service/1"
    headers:
      - name: "x-canary-version"
        value: "service1a"
  route:
    cluster: service1a
- match:
    prefix: "/service/1"
  route:
    cluster: service1
- match:
    prefix: "/service/2"
  route:
    cluster: service2
```

然后重启该示例服务：

```bash
$ docker-compose down --remove-orphans
$ docker-compose up --build -d
```

如果客户端发出的请求没有携带头文件，就会收到来自 `service1` 的响应：

```bash
$ curl localhost:8000/service/1

Hello from behind Envoy (service 1)! hostname: d0adee810fc4 resolvedhostname: 172.18.0.2
```

如果请求携带了头文件 `x-canary-version`，Envoy 就会将请求转发到 service 1a。

```bash
$ curl -H 'x-canary-version: service1a' localhost:8000/service/1

Hello from behind Envoy (service 1a)! hostname: 569ee89eebc8 resolvedhostname: 172.18.0.6
```

Envoy 基于头文件的路由功能解锁了[在生产环境中测试开发代码](https://opensource.com/article/17/8/testing-production)的能力。

## 加权负载均衡

----

接下来进一步修改配置来实现对 service1 新版本的增量发布，使用 `clusters` 数组替代原来的 `cluster` 键值对，从而实现将 25% 的流量转发到该服务的新版本上。

```yaml
- match:
    prefix: "/service/1"
  route:
    weighted_clusters:
      clusters:
      - name: service1a
        weight: 25
      - name: service1
        weight: 75
```

然后重启该示例服务：

```bash
$ docker-compose down --remove-orphans
$ docker-compose up --build -d
```

此时如果客户端发出的请求没有携带头文件，就会有 25% 的流量转发到 service 1a。

增量部署是个非常强大的功能，它还可以和监控配合使用，以确保服务的版本差异（或者后端服务的架构差异）不会对该服务的版本更新产生不良影响。如果想模拟新版本的成功发布，可以将 service1a 的权重设置为 `100`，然后所有的流量都会被转发到 service 1a。同样，如果新发布的版本有缺陷，你可以通过将 service1a 的权重设置为 `0` 来回滚到之前的版本。

## 最佳实践

----

学会了如何配置基于请求头的路由和加权负载均衡之后，就可以在生产或测试环境中进行实践了。首先需要将**部署**和**发布**这两个流程分离，部署了新版本之后，你就可以通过配置基于请求头的路由来让你的团队在内部进行测试，同时又不影响用户的使用。一旦测试通过，就可以通过滚动发布模式（逐步增加权重，如 1%，5%，10%，50% ...）来优雅地发布新版本。

通过将**部署**和**发布**这两个流程分离，使用基于请求头的路由在新版本发布之前进行测试，然后通过滚动部署模式来增量发布，你的团队将会从中受益匪浅。


