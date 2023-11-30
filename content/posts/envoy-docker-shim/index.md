---
keywords:
- envoy
- envoy proxy
- docker
- shim
- docker-proxy
title: "使用 envoy-docker-shim 替代 docker-proxy"
subtitle: "Docker 端口映射的新姿势"
date: 2018-06-22T08:22:07Z
draft: false
author: 米开朗基杨
toc: true
categories:
- cloud-native
tags:
- Docker
- Envoy
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191203221426.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

在过去一年中，服务网格技术的崛起引发了吃瓜群众对 Istio 的持续关注，而 Istio 的核心组件 [Envoy](https://github.com/envoyproxy/envoy) 是一款由 Lyft 开源的，使用 C++ 编写的 L7 代理和通信总线，目前是 [CNCF](https://cncf.io/) 旗下的开源项目，代码托管在 GitHub 上，它也是 Istio service mesh 中默认的 data plane。

目前网上关于 Envoy 的文档非常少，能够找到的比较权威的资料只有官方文档，但官方文档的痛点是只有理论概念，没有实际应用指南。

+ [Envoy 官方文档](https://www.envoyproxy.io/docs/envoy/latest/)
+ [Envoy 官方文档中文版](https://servicemesher.github.io/envoy/)

要想真正掌握 Envoy，只有通过实践融入该语境才能真正理解这门技术，而目前能够找到的最佳实践项目就是 [Envoy Docker Shim](https://github.com/Nitro/envoy-docker-shim)。在实践该项目之前，你需要了解 Envoy 中的基本术语和概念，可以参考 Jimmy Song 的文章：[Envoy 的架构与基本术语](https://jimmysong.io/posts/envoy-archiecture-and-terminology/)。下面我就为大家简单地介绍下这个项目。

## Envoy Docker Shim

----

`Envoy Docker Shim` 是一个预生产项目，它使用 Envoy 来替代 Docker 的 `docker-proxy`，这样做的目的是为在 Docker 上运行的服务启用 Envoy 的指标收集和分布式路由跟踪功能。使用了 Envoy Docker Shim，就相当于获得了服务网格的一半功能。该项目由以下四个组件组成：

+ `envoy-docker-server` : 运行在 Docker 主机上的注册中心，用来向 Envoy 提供 服务发现 API。
+ `envoy-docker-shim` : 命令行应用程序，采用与 `docker-proxy` 相同的命令参数，但它的作用是将新的端点（endpoint）注册到注册中心。
+ `Envoy 实例` : 以 host 网络模式运行在 Docker 容器中。
+ `resync` : shell 脚本，当容器重启时用来恢复注册中心的状态。

通过将这些组件结合在一起，就形成了一个通过 Envoy 来代理 HTTP 和 TCP 流量的系统，对 `UDP` 流量的处理继续使用 docker-proxy 的代码逻辑，目前暂不支持 `SCTP` 协议。

## 安装步骤

----

要想使用 Envoy Docker Shim，首先需要修改 `dockerd` 的启动参数：

+ `--userland-proxy-path=/path/to/envoy-docker-shim` : 使用 envoy-docker-shim 替换 `docker-proxy`，用来告诉 Envoy 需要监听的服务以及如何转发。
+ `--iptables=false` : 禁用 Iptables 来转发 Docker 的流量，强制使用 Envoy 来转发 Docker 流量。

一旦设置了 --iptables=false，Docker 流量就不会再通过内核直接流入桥接网络。通过配置不同的代理模式，所有的流量都会在 4 层或 7 层进行代理。

修改完启动参数后，就可以重启 Docker 服务了：

```bash
$ systemctl daemon-reload
$ systemctl restart docker
```

### 下载二进制文件和脚本

安装 `envoy-docker-server`：

```bash
$ go get github.com/Nitro/envoy-docker-shim/cmd/envoy-docker-server
```

安装 `envoy-docker-shim`：

```bash
$ go get github.com/Nitro/envoy-docker-shim/cmd/envoy-docker-shim
```

克隆 envoy-docker-shim 项目：

```bash
$ git clone https://github.com/Nitro/envoy-docker-shim
```

将脚本 `resync` 复制到 /usr/local/bin 目录下：

```bash
$ cd envoy-docker-shim
$ cp scripts/resync /usr/local/bin
```

### 配置 envoy-docker-server 和 resync

修改 examples 目录下的 `envoy-docker-server.service` 文件：

```ini
[Unit]
Description=Envoy Docker Shim
PartOf=docker.service

[Service]
ExecStart=$GOPATH/bin/envoy-docker-server
ExecStartPost=/usr/local/bin/resync
ExecReload=/usr/local/bin/resync
KillMode=process
Restart=on-failure
Type=simple

[Install]
WantedBy=multi-user.target
```

为了防止出现状态不同步的问题，envoy-docker-server 仅将状态存储在内存中，一旦重启了 envoy-docker-server，就需要执行脚本 resync 来同步容器的状态。

将 envoy-docker-server.service 文件复制到 `/etc/systemd/system/` 目录下并启动该服务：

```bash
$ cp examples/envoy-docker-server.service /etc/systemd/system/
$ systemctl start envoy-docker-server
```

### 启动 Envoy 实例

在 examples 目录中包含了一个 `envoy.yaml` 文件，你可以通过该配置文件启动 Envoy 实例（在 1.6 和 1.7 版本上测试通过）。你也可以选择通过 Docker 容器来运行 Envoy 实例，这里我们通过容器的方式来启动 Envoy：

```bash
$ docker run -d --name envoyproxy --restart always --net host --cap-add NET_ADMIN -e ENVOY_BASE_ID=100 -e ENVOY_PORT=9902 -e ENVOY_UI_LISTEN_PORT=8081 gonitro/envoyproxy:1.7.0-27960f3-tracing
```

该 Envoy 容器还提供了一个 UI 来展示指标和路由，可以通过在浏览器中输入 url：`http://host_ip:8081` 来打开 UI 界面：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/PTNe2v.jpg)

至此，Envoy Docker Shim 已经完美地完成了替代 docker-proxy 的工作，接下来就可以不通过 iptables 而使用 Envoy 来实现 Docker 容器的端口映射啦！

## 容器配置

----

一切准备就绪后，就可以启动一个容器试试了。如果想完美地使用 envoy-docker-shim，你需要在启动容器时指定两个或三个标签，虽然这不是必须的，但可以更方便地跟踪流量。这些 Docker 标签被映射成报告给 `Zipkin` 或 `Jaeger` 的服务的标签。这三个标签是从 [Sidecar](https://github.com/Nitro/sidecar) 项目集成而来的：

+ `EnvironmentName` : 这个标签可以成某个客户的名字，或者表示这是生产项目还是测试项目，反正只要对你来说有意义就行。
+ `ServiceName` : 设置 Envoy 跟踪的服务名。例如，如果你将这个标签设置为 `nginx`，将 EnvironmentName 标签设置为 `prod`，那么该服务名为 `nginx-prod`。
+ `ProxyMode` : 设置 Envoy 的代理模式。默认使用 `http` 代理模式，如果想使用 tcp 代理模式，需要指定该标签值为 `tcp`。

示例：

```bash
$ docker run -d -p 80:80 -p 443:443 -l EnvironmentName=proxy -l ServiceName=nginx -l ProxyMode=tcp nginx:alpine
```

打开 Envoy UI：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/T7W8BJ.jpg)

可以看到 nginx 的服务名为 `nginx-proxy`。

