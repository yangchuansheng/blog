---
keywords:
- 米开朗基杨
- envoy
- google
title: "Envoy 基础教程：反向代理谷歌搜索"
subtitle: "科学合理地访问 Google，一直用 Envoy 一直爽"
description: 本文教你如何使用 Envoy 来反向代理谷歌
date: 2019-12-28T15:47:03+08:00
draft: false
author: 米开朗基杨
toc: true
categories: 
- GFW
tags:
- Envoy
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/2020-04-24-20191228184723.png"
---

[上篇文章](/posts/file-based-dynamic-routing-configuration/)介绍了如何基于文件系统动态更新 `Envoy` 配置，还没看过的同学可以去恶补一下。今天要介绍一个新的基于 `Envoy` 的奇技淫巧，其实很简单，几句话就可以说完。但鉴于网上并无与此相关的资料，决定还是写出来吧，目测我是用此方法的第一人，至少国内如此。

想必大部分小朋友看标题就知道我要讲的是啥，没错，是用 `Envoy` 来反向代理 `Google`。网上铺天盖地都是 Nginx 反代 Google 的文章，看得我是真难受，还得添加各种模块自己编译，你累不累啊？今天让我用 Envoy 教你如何正确优雅地反代 Google，看懂的掌声。

首先得准备一个访问 Google 不受限的云服务器，知道的同学自然懂，不多说。

Envoy 的配置方法继续沿用上篇文章的方法，基于文件系统来动态更新配置。步骤非常简单，先在 `lds.yaml` 中添加 Listener：

```yaml
- "@type": type.googleapis.com/envoy.api.v2.Listener
  name: listener_https
  address:
    socket_address:
      address: 0.0.0.0
      port_value: 443
  filter_chains:
  - filter_chain_match:
      server_names: "google.icloudnative.io"
    transport_socket:
      name: envoy.transport_sockets.tls
      typed_config:
        "@type": type.googleapis.com/envoy.api.v2.auth.DownstreamTlsContext
        common_tls_context:
          tls_certificates:
          - certificate_chain:
              filename: "/etc/letsencrypt/live/www.icloudnative.io/fullchain.pem"
            private_key:
              filename: "/etc/letsencrypt/live/www.icloudnative.io/privkey.pem"
    filters:
    - name: envoy.http_connection_manager
      typed_config:
        "@type": type.googleapis.com/envoy.config.filter.network.http_connection_manager.v2.HttpConnectionManager
        stat_prefix: ingress_https
        codec_type: AUTO
        access_log:
          name: envoy.file_access_log
          typed_config:
            "@type": type.googleapis.com/envoy.config.accesslog.v2.FileAccessLog
            path: /dev/stdout
        route_config:
          name: https_route_google
          virtual_hosts:
          - name: default
            domains:
            - "*"
            routes:
            - match:
                prefix: "/"
              route:
                cluster: google
                host_rewrite: www.google.com
        http_filters:
        - name: envoy.router
```

+ 将域名替换成你自己的域名
+ 将配置中的证书替换成你自己的证书，至于证书如何申请我就不说了，不是本文的重点，请面向谷歌找答案。

下一步是向 `cds.yaml` 中添加 Cluster：

```yaml
- "@type": type.googleapis.com/envoy.api.v2.Cluster
  name: google
  connect_timeout: 1s
  type: logical_dns
  dns_lookup_family: V4_ONLY
  lb_policy: ROUND_ROBIN
  load_assignment:
    cluster_name: google
    endpoints:
    - lb_endpoints:
      - endpoint:
          address:
            socket_address:
              address: www.google.com
              port_value: 443
  tls_context:
    sni: www.google.com
```

这里解释一下 `logical_dns` 与 `strict_dns` 的区别：

+ 严格 DNS（strict_dns）: 当使用严格 DNS 服务发现时，Envoy 将持续并异步地解析指定的 DNS 目标。DNS 结果中的每个返回的IP地址将被视为上游群集中的显式主机。 这意味着如果查询返回三个 IP 地址，Envoy 将假定集群有三个主机，并且三个主机都应该负载均衡。简单直白一点 : **如果上游集群有多个 IP 地址，那么基于轮询算法，每隔一段时间都会连接到不同的 IP。**
+ 逻辑 DNS（logical_dns）: 与严格 DNS 服务发现类似，但在需要初始化新连接时仅使用返回的第一个 IP 地址。**简单直白一点：即使上游集群有多个 IP 地址，相关联的连接每次都会连接到相同的 IP，直到连接被关闭。**

`tls_context` 字段表示通过 `HTTPS` 协议连接上游集群。

最后一步，使配置生效，如果你的 Envoy 跑在宿主机上，不用做任何操作配置就已经生效了。如果你的 Envoy 跑在容器中，可以执行我上篇文章中的脚本：

```bash
$ bash apply.sh
```

现在就可以愉快地访问 Google 了：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/20191228175224.png)

已添加到我的博客首页，快快收藏起来：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/20191228180052.png)

以后请叫我云原生奇技淫巧之神。
