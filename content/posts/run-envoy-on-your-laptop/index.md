---
keywords:
- envoy
- envoy proxy
title: "Envoy 基础教程：入门篇"
subtitle: "在你的笔记本上运行 Envoy"
date: 2018-06-28T08:54:18Z
draft: false
author: 米开朗基杨
toc: true
categories:
- cloud-native
tags: 
- Envoy
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191203220605.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

## 前言

----

过去一年中，Kubernetes 已经赢得了容器编排大战，如果说 2017 年是 Kubernetes 的元年，那么 2018 将会是 `Service Mesh`（服务网格） 的元年，在未来两年中，Service Mesh 将迎来爆发式增长，成为下一代的微服务架构。

[Istio](https://istio.io/) 作为 Service Mesh 新秀，初出茅庐便声势浩荡，前有 Google，IBM 和 Lyft 倾情奉献，后有业界大佬俯首膜拜。作为一名**斜杠青年**，如果再不停下脚步认真审视一下这位后起之秀，未免显得太不符合潮流了。

Istio 这个大家庭的家庭成员很多，为了能够顺利打入 Istio 内部，我们先从它的核心家庭成员 `Envoy` 入手。

从今天起，我将带领大家从零开始学习和使用 Envoy，着重于经验分享和总结，同时也会有相关的概念解析，希望能够帮助大家少走弯路，能不采坑尽量不采坑。

本篇是 Envoy 系列教程的第一篇，介绍如何在笔记本电脑上运行 Envoy、测试代理配置并观察结果，让我们开始吧！

## 前提

---- 

你可以选择从源代码构建 Envoy，但最简单的办法是通过 `Docker` 容器来运行。所以在开始之前，你需要安装并配置以下工具：

+ [Docker](https://docs.docker.com/install/)
+ [Docker Compose](https://docs.docker.com/compose/install/)
+ [Git](https://help.github.com/articles/set-up-git/)
+ [curl](https://curl.haxx.se/)

我们使用 Docker 和 Docker Compose 来编排和运行 Envoy 的示例服务，使用 curl 来访问 Envoy 示例服务。

## 部署 Envoy

---- 

[Envoy 官方](https://github.com/envoyproxy/envoy)提供了一组 Envoy 的用例，我们将要使用的用例是前端代理，它会将流量发送到两个服务后端。首先克隆 Envoy 的代码仓库并转到 `examples/front-proxy` 目录：

```bash
$ git clone https://github.com/envoyproxy/envoy
$ cd envoy/examples/front-proxy
```

<span id="inline-blue">后端服务</span> 是一个非常简单的 `Flask` 应用程序，在 `service.py` 中定义。其中 Envoy 作为一个边车（Sidecar）伴随每个服务一起运行在同一个容器中，所有的规则配置都通过 YAML 文件 `service-envoy.yaml` 来完成。最后 `Dockerfile-service` 创建一个在启动时同时运行服务和 Envoy 的容器。

<span id="inline-blue">前端代理</span> 比后端服务更简单，它使用配置文件 `front-envoy.yaml` 来运行 Envoy，使用 `Dockerfile-frontenvoy` 来构建容器镜像。

`docker-compose.yaml` 文件描述了如何构建、打包和运行前端代理与服务。

整体架构如下：

![](https://jimmysong.io/kubernetes-handbook/images/envoyproxy-docker-compose.png)

使用 docker-compose 启动容器：

```bash
$ docker-compose up --build -d
$ docker-compose ps

          Name                        Command               State                      Ports
----------------------------------------------------------------------------------------------------------------
frontproxy_front-envoy_1   /bin/sh -c /usr/local/bin/ ...   Up      0.0.0.0:8000->80/tcp, 0.0.0.0:8001->8001/tcp
frontproxy_service1_1      /bin/sh -c /usr/local/bin/ ...   Up      80/tcp
frontproxy_service2_1      /bin/sh -c /usr/local/bin/ ...   Up      80/tcp
```

该命令将会启动一个前端代理和两个服务实例：service1 和 service2。


## 配置 Envoy

---- 

为了达到演示的目的，本文采用的是 Envoy 的静态配置。后续教程将会告诉你们如何使用动态配置来发挥 Envoy 的强大功能。

为了了解 Envoy 是如何配置的，先来看看 `docker-compose.yaml` 文件的前端代理部分的配置：

```yaml
  front-envoy:
    build:
      context: ../
      dockerfile: front-proxy/Dockerfile-frontenvoy
    volumes:
      - ./front-envoy.yaml:/etc/front-envoy.yaml
    networks:
      - envoymesh
    expose:
      - "80"
      - "8001"
    ports:
      - "8000:80"
      - "8001:8001"
```

从上到下做了这么几件事：

1. 使用位于当前目录中的 `Dockerfile-frontenvoy` 构建镜像。
2. 将 `front-envoy.yaml` 文件作为 `/etc/front-envoy.yaml` 挂载到容器中的 `/etc` 目录。
3. 为这个容器创建并使用名为 `envoymesh` 的 Docker 网络。
4. 暴露 80 端口（用于一般通用流量）和 8001 端口（用于管理服务）。
5. 将主机的 8000 端口和 8001 端口分别映射到容器的 80 端口和 8001 端口。

前面已经了解到了前端代理使用 front-envoy.yaml 来配置 Envoy，下面来深入解析一下。该配置文件有两大配置项：`static_resources` 和 `admin`：

```yaml
static_resources:
admin:
```

admin 配置项的内容非常简单：

```yaml
admin:
  access_log_path: "/dev/null"
  address:
    socket_address:
      address: 0.0.0.0
      port_value: 8001
```

`access_log_path` 字段的值设置为 `/dev/null`，意味着 admin 服务的访问日志将会被丢弃，在测试或生产环境中，你最好将这个值修改为不同的目录。socket_address 字段告诉 Envoy 创建一个监听在 8001 端口的 admin 服务。

`static_resources` 配置项定义了一组静态配置的集群（Cluster）和侦听器（Listener）。

**集群**是 Envoy 连接到的一组逻辑上相似的上游主机。Envoy 通过服务发现发现集群中的成员。Envoy 可以通过主动运行状况检查来确定集群成员的健康状况。Envoy 如何将请求路由到集群成员由负载均衡策略确定。

**侦听器**是服务(程序)监听者，就是真正干活的。 它是可以由下游客户端连接的命名网络位置（例如，端口、unix域套接字等）。

### Listener 配置

该示例中的前端代理有一个监听在 80 端口的侦听器，并配置了一个**监听器过滤器链**（filter_chains），用来管理 HTTP 流量：

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
```

在 HTTP 连接管理过滤器中，每一个虚拟主机都有单独的配置，并且都配置为接收所有域的流量：

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

HTTP 路由规则将 `/service/1` 和 `/service/1` 的流量转发到各自的 Cluster。

### Cluster 配置

接下来看一下静态 Cluster 的定义：

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

在 Cluster 的配置中，你可以自定义超时、断路器和服务发现等。Cluster 由 Endpoint（端点）组成，其中 Endpoint 是一组可以为 Cluster 的请求提供服务的网络位置。本例中的 Endpoint 是通过 DNS 域名的方式定义的，Envoy 可以从域名中读取 Endpoint。Endpoint 也可以直接定义为 socket 地址，或者通过 `EDS`（Endpoint Discovery Service）动态读取。

### 修改配置

你可以通过修改配置文件重新构建镜像来进行测试。`Listener filter`（监听器过滤器）的作用是在不更改 Envoy 的核心功能的情况下添加更多的集成功能。例如，如果想要将访问日志添加到 HTTP 过滤器中，可以在 filter 的配置中添加 `access_log` 配置项：

```yaml
    - filters:
      - name: envoy.http_connection_manager
        config:
          codec_type: auto
          stat_prefix: ingress_http
          access_log:
            - name: envoy.file_access_log
              config:
                path: "/var/log/access.log"
          route_config:
```

然后停止服务，重新构建并运行容器：

```bash
$ docker-compose down
$ docker-compose up --build -d
```

通过 `curl` 访问服务，然后通过 `docker-compose exec front-envoy /bin/bash` 命令进入容器的终端，你会看到 `/var/log/access.log` 文件记录着你的请求结果。

### Admin Server

Envoy 的一大特色是内置的 Admin 服务，如果你在浏览器中访问 `http://localhost:8001` ，可以看到 Envoy admin 提供以下管理 API 端点。

| 命令                 | 描述                                     |
|----------------------|------------------------------------------|
| /                    | Admin 主页                               |
| /certs               | 打印机器上的 certs                       |
| /clusters            | upstream cluster 状态                    |
| /config_dump         | 输出当前的 Envoy 配置                    |
| /cpuprofiler         | 开启/关闭 CPU profiler                   |
| /healthcheck/fail    | 导致服务失败健康检查                     |
| /healthcheck/ok      | 导致服务通过健康检查                     |
| /help                | 打印管理命令的帮助信息                   |
| /hot_restart_version | 打印热重启兼容版本                       |
| /listeners           | 打印 listener 地址                       |
| /logging             | 查询/更改日志级别                        |
| /quitquitquit        | 退出服务                                 |
| /reset_counters      | 将计数器重置为 1                         |
| /runtime             | 打印运行时值                             |
| /runtime_modify      | 修改运行时值                             |
| /server_info         | 打印服务器版本/状态信息                  |
| /stats               | 打印服务器状态统计信息                   |
| /stats/prometheus    | 打印 prometheus 格式的服务器状态统计信息 |

通过 API 管理端可以对 Envoy 进行动态配置，参考 [v2 API reference](https://www.envoyproxy.io/docs/envoy/latest/api-v2/api)。


## 进一步探索

----

如果你有兴趣探索 Envoy 的更多其他功能，[Envoy 官方示例](https://github.com/envoyproxy/envoy/tree/master/examples)还有一些更复杂的拓扑结构，但这些示例仍然使用静态类型的服务发现。如果你还想了解有关如何在生产环境中使用 Envoy 的更多信息，请参阅 [Integrating Service Discovery with Envoy](https://www.learnenvoy.io/articles/service-discovery.html) 以了解将 Envoy 与现有环境集成的意义。如果你在测试 Envoy 的过程中遇到问题，请访问 [Getting Help](https://www.learnenvoy.io/articles/getting-help.html) 页面以获取更多的帮助信息。


## 参考

----

+ [Envoy 的架构与基本术语](https://jimmysong.io/posts/envoy-archiecture-and-terminology/)
+ [使用 Envoy 作为前端代理](https://jimmysong.io/posts/envoy-as-front-proxy/)

----

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/wechat.gif)
<center>扫一扫关注微信公众号</center>

