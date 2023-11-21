---
title: "Envoy 基础教程：开启 TLS 验证实战"
date: 2018-09-26T17:43:00+08:00
subtitle: "通过 Envoy 反向代理 hugo 静态页面"
draft: false
author: 米开朗基杨
categories: "service mesh"
tags: ["envoy", "service mesh", "hugo"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191203153032.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

我的博客之前是使用 `Nginx` 来反代的，由于 Nginx 性能优异，目前有很多国内网站采用 Nginx 作为 Web 服务器，而且参考文档比较丰富，无论是对于其部署，配置还是调优都更为有经验。但是还是会碰到几个绕不开的问题：

+ Nginx 的反向代理不支持 `http2/grpc` (好像今年 3 月份刚支持)
+ 不像 Envoy 几乎所有的网络配置都可以利用 `xDS API` 来实现动态变更，Nginx 缺乏有效的配置热变更机制(除非深入开发或者不断地 `reload`)。
+ Nginx 的很多微服务功能都是要买 Nginx Plus 才有的。

而 [Envoy](https://www.envoyproxy.io/) 是一款现代化的，高性能，小体积的边缘及服务代理，浑身散发出一股时尚潮流的气息。作为一名斜杠青年，在经过一定地了解后，我果断入了 Envoy 的坑。

关于如何为 Envoy 开启证书验证可以参考我之间的文章：[为 Envoy 启用证书验证](https://icloudnative.io/posts/setting-up-ssl-in-envoy/)。本文将直接进入实战部分，通过 Envoy 来反向代理我的博客静态页面，并且加密客户端和 Envoy 代理之间的所有流量。

## <span id="inline-toc">1.</span> 方案架构

----

本方案涉及到两层 Envoy：

+ 首先会有一个前端代理在某个地方单独运行。前端代理的工作是给其他地方提供一个入口。来自外部的传入连接请求到这里，前端代理将会决定他们在内部的转发路径。
+ 其次，博客静态页面由 nginx 提供，同时运行一个 “服务 Envoy”，它与 nginx 容器共享 `network nemspace`（相当于 Kubernetes 的 `Sidecar`）。
+ 所有的 Envoy 形成一个网格，然后在他们之间共享路由信息。

注意，通常情况下你也可以只使用前端代理，然后去掉服务 Envoy 这一层。但是，使用完整网格的话，服务 Envoy 可以对应用服务进行健康监控等，让网格知道尝试联系一个挂掉的服务是否是毫无意义的。此外，Envoy 的统计数据收集最适合用在全网格上。

但本文需要开启 TLS 验证，如果前端代理开启了 TLS 验证，那么必须配合服务 Envoy 使用，否则验证将无法通过。

## <span id="inline-toc">2.</span> 部署服务 Envoy

----

我的博客是通过 hugo 生成的，其他生成静态页面的软件类似，都可以采用我的方案。由于我的 hugo 根目录是 `/home/hugo`，首先进入该目录，然后创建容器编排的 `docker-compose.yml` 文件。

```yaml
version: '2'
services:

  hugo:
    image: nginx:alpine
    restart: always
    volumes:
      - /home/hugo/public:/usr/share/nginx/html ①
    networks:
      - default 
    expose:
      - "80"
      - "8080"

  service-envoy:
    image: envoyproxy/envoy-alpine:latest
    restart: always
    volumes:
      - ./service-envoy.yaml:/etc/envoy/envoy.yaml ②
    network_mode: "service:hugo" ③

networks:
  default:
    external:
      name: yang ④
```

+ ① : 将博客的静态页面挂载到 nginx 的 `root` 目录。
+ ② : 将服务 Envoy 的配置文件挂载到 Envoy 容器中。
+ ③ : 与 hugo 容器共享 `network namespace`。
+ ④ : 这是我自定义的网络，你可以换成你自己的。

接下来需要创建服务 Envoy 的配置文件 `service-envoy.yaml`：

```yaml
static_resources:
  listeners:
  - address:
      socket_address:
        address: 0.0.0.0
        port_value: 8080 ①
    filter_chains:
    - filters:
      - name: envoy.http_connection_manager
        config:
          codec_type: auto
          stat_prefix: ingress_http
          route_config:
            name: local_route
            virtual_hosts:
            - name: service
              domains:
              - "*"
              routes:
              - match:
                  prefix: "/"
                route:
                  cluster: local_service
          http_filters:
          - name: envoy.router
            config: {}
  clusters:
  - name: local_service
    connect_timeout: 0.25s
    type: strict_dns
    lb_policy: round_robin
    hosts:
    - socket_address:
        address: 127.0.0.1
        port_value: 80 ②
admin:
  access_log_path: "/dev/null"
  address:
    socket_address:
      address: 0.0.0.0
      port_value: 8081
```

+ ① `8080` : 服务 Envoy 的监听端口。
+ ② `80` : hugo 静态页面的监听端口。

## <span id="inline-toc">3.</span> 部署前端代理

----

在 `docker-compose.yml` 文件中添加前端代理部分：

```yaml
version: '2'
services:

  ...
  front-envoy:
    image: envoyproxy/envoy
    restart: always
    volumes:
      - ./front-envoy.yaml:/etc/envoy/envoy.yaml
      - /etc/letsencrypt:/etc/letsencrypt
    labels:
      EnvironmentName: "proxy"
      ServiceName: "envoy"
      ProxyMode: "tcp"
    networks:
      - default
    expose:
      - "80"
      - "443"
    ports:
      - "80:80"
      - "443:443"
```

创建前端代理需要的配置文件 `front-envoy.yaml`：

```yaml
static_resources:
  listeners:
  - address:
      socket_address:
        address: 0.0.0.0
        port_value: 80
    filter_chains:
    - filters:
      - name: envoy.http_connection_manager
        config:
          codec_type: auto ①
          stat_prefix: ingress_http
          route_config:
            virtual_hosts:
            - name: backend
              domains: ②
              - "yangcs.net"
              - "icloudnative.io"
              routes:
              - match:
                  prefix: "/"
                redirect:
                  path_redirect: "/"
                  https_redirect: true
          http_filters:
          - name: envoy.router
            config: {}
  - address:
      socket_address:
        address: 0.0.0.0
        port_value: 443
    filter_chains:
    - tls_context:
        common_tls_context:
          alpn_protocols: h2,http/1.1 ③
          tls_certificates: ④
            - certificate_chain:
                filename: "/etc/letsencrypt/live/icloudnative.io/fullchain.pem"
              private_key:
                filename: "/etc/letsencrypt/live/icloudnative.io/privkey.pem"
      filters:
      - name: envoy.http_connection_manager
        config:
          codec_type: auto
          stat_prefix: ingress_http
          route_config:
            name: local_route
            virtual_hosts:
            - name: backend
              domains:
              - "yangcs.net"
              - "icloudnative.io"
              routes:
              - match:
                  prefix: "/"
                route:
                  cluster: hugo
          http_filters:
          - name: envoy.router
            config: {}
  clusters:
  - name: hugo
    connect_timeout: 0.25s
    type: strict_dns
    lb_policy: round_robin
    http2_protocol_options: {}
    hosts:
    - socket_address:
        address: hugo
        port_value: 8080
admin:
  access_log_path: "/dev/null"
  address:
    socket_address:
      address: 0.0.0.0
      port_value: 8001
```

+ ① : 编码/解码方式。参考：[HttpConnectionManager.CodecType](https://www.envoyproxy.io/docs/envoy/latest/api-v2/config/filter/network/http_connection_manager/v2/http_connection_manager.proto#enum-config-filter-network-http-connection-manager-v2-httpconnectionmanager-codectype)
+ ② : 允许访问的域名（这里使用公网可以访问的域名）。
+ ③ : TLS 监听器支持 `ALPN`。HTTP 连接管理器使用这个信息（以及协议接口）来确定客户端使用的是 `HTTP/1.1` 还是 `HTTP/2`。
+ ④ : 网站使用的证书。可以通过 [Let's Encrypt](https://letsencrypt.org/) 申请免费的证书。

其他配置详细说明请参考：[为 Envoy 启用证书验证](https://icloudnative.io/posts/setting-up-ssl-in-envoy/)。

准备好所有配置以后，我们就可以通过以下命令来启动所有服务了：

```bash
$ docker-compose up -d

Creating front-proxy_hugo_1        ... done
Creating front-proxy_front-envoy_1 ... done
Creating front-proxy_service-envoy_1 ... done
```

接下来就可以通过公网域名访问博客网站啦！没错，你现在浏览的我的博客就是通过 Envoy 反向代理的。 不信请看：

```bash
$ curl -I https://icloudnative.io

HTTP/2 200
server: envoy
date: Fri, 30 Nov 2018 06:42:52 GMT
content-type: text/html
content-length: 40537
last-modified: Thu, 29 Nov 2018 05:41:29 GMT
etag: "5bff7c09-9e59"
accept-ranges: bytes
x-envoy-upstream-service-time: 0
strict-transport-security: max-age=63072000; includeSubDomains; preload
```
