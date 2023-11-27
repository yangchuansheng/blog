---
keywords:
- service mesh
- envoy
- 服务网格
- SSL
- TLS
title: "Envoy 基础教程：启用证书验证"
subtitle: "加密客户端和 Envoy 代理之间的所有流量"
date: 2018-07-03T06:43:33Z
draft: false
author: 米开朗基杨
toc: true
categories:
- cloud-native
tags:
- Envoy
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191203202436.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

如果你准备将服务暴露在互联网上，最好启用 `SSL/TLS` 加密协议。当使用 Envoy 作为前端代理或者服务网格代理时，可以通过 SSL/TLS 协议来加密客户端和代理之间的所有通信流量。

Envoy 同时支持监听器中的 [TLS 终止](https://www.envoyproxy.io/docs/envoy/latest/api-v1/listeners/listeners.html#config-listener-ssl-context) 和与上游集群建立连接时的 [TLS 发起](https://www.envoyproxy.io/docs/envoy/latest/api-v1/cluster_manager/cluster_ssl#config-cluster-manager-cluster-ssl)。不管是为现代 web 服务提供标准的边缘代理功能，还是同具有高级 TLS 要求（TLS1.2, SNI, 等等）的外部服务建立连接，Envoy 都提供了充分的支持。

本文将会演示如何在前端代理中设置 TLS 终止，同时指定访问域名。主要分三个步骤：

1. 创建 Envoy 需要使用的证书
2. 为 Envoy 启用证书验证
3. 配置 Envoy 将 80 端口重定向到 443 端口

## 创建证书

----

如果要启用 HTTPS，我们就需要从证书授权机构(以下简称 CA) 处获取一个证书。如果你还没有证书，你可以从 [Let’s Encrypt](https://letsencrypt.org/) 获得网站域名的免费的证书，因为 Let’s Encrypt 就是一个 `CA`。本文为了测试使用 `OpenSSL` 生成私钥文件 `example-com.key` 和 自签名证书 `example-com.crt`。

{{< alert >}}
需要注意的是 <code>Common Name</code> 字段，本文测试使用的是 <code>example.com</code>。
{{< /alert >}}

```bash
# 继续沿用前文使用的示例
$ cd envoy/examples/front-proxy

# 生成2048位的加密私钥
$ openssl genrsa -out example-com.key 2048

#生成证书签名请求(CSR)
$ openssl req -new -key example-com.key -out example-com.csr

You are about to be asked to enter information that will be incorporated
into your certificate request.
What you are about to enter is what is called a Distinguished Name or a DN.
There are quite a few fields but you can leave some blank
For some fields there will be a default value,
If you enter '.', the field will be left blank.
-----
Country Name (2 letter code) [XX]:CN
State or Province Name (full name) []:CA
Locality Name (eg, city) [Default City]:Shanghai
Organization Name (eg, company) [Default Company Ltd]:Daocloud
Organizational Unit Name (eg, section) []:Envoy Division
Common Name (eg, your name or your server's hostname) []:example.com
Email Address []:chuansheng.yang@daocloud.io

Please enter the following 'extra' attributes
to be sent with your certificate request
A challenge password []:
An optional company name []:

# 生成X509自签名证书
$ openssl x509 -req -days 365 -in example-com.csr -signkey example-com.key -out example-com.crt
```

## 为 Envoy 启用证书验证

----


修改 `Dockerfile-frontenvoy` 文件：

```Dockerfile
ADD ./example-com.crt /etc/example-com.crt
ADD ./example-com.key /etc/example-com.key
```

修改 `front-envoy.yaml` 配置文件，在 `filters` 列表后面添加 `tls_context` 配置项：

```yaml
tls_context:
  common_tls_context:
    tls_certificates:
      - certificate_chain:
          filename: "/etc/example-com.crt"
        private_key:
          filename: "/etc/example-com.key"
```

将监听器的监听端口改为标准的 TLS 端口：443。

```yaml
  - address:
      socket_address:
        address: 0.0.0.0
        port_value: 443
```

还要指定访问的域名，不再使用之前的通配符匹配：

```yaml
domains:
- "example.com"
```

Envoy 可以通过在同一个监听器中配置多个监听器过滤器链来支持多个域名的 `SNI`（如 example.com 和 www.example.com），你可以在 [Envoy 官方文档](https://www.envoyproxy.io/docs/envoy/latest/faq/sni) 中看到一个示例。

最后修改 `docker-compose.yaml` 文件，将 443 端口暴露出来，同时将 8080 端口替换为 80 端口。

```yaml
services:
  front-envoy:
  ...
    expose:
      - "80"
      - "443"
    ports:
      - "80:80"
      - "443:443"
```

重启该示例服务：

```bash
$ docker-compose down --remove-orphans
$ docker-compose up --build -d
```

下面就可以使用 curl 来进行测试了。这里有两个需要注意的地方：

+ 为了确保 curl 能成功验证证书，必须通过 `--cacert` 参数将证书文件传递给 Envoy。
+ 由于 DNS 无法解析 example.com，所以需要通过参数 `--connect-to` 明确指定连接到 localhost，同时在请求的头文件中申明 localhost 的域名为 `example.com`。

```bash
$ curl --cacert example-com.crt --connect-to localhost -H 'Host: example.com' https://localhost/service/1

Hello from behind Envoy (service 1)! hostname: 56e8a5bff6bd resolvedhostname: 172.18.0.2
```

如果你的 curl 版本不支持 `--connect-to` 参数，可以在 `/etc/hosts` 中添加一个条目：`127.0.0.1    example.com`，然后直接通过域名访问：

```bash
$ curl --cacert example-com.crt https://example.com/service/1
```

## 将 80 端口重定向到 443 端口

----

为了将所有 80 端口的流量重定向到 443 端口，可以将 443 端口的路由配置复制一份，然后稍作修改：

```yaml
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
            virtual_hosts:
            - name: backend
              domains:
              - "example.com"
              routes:
              - match:
                  prefix: "/"
                redirect:
                  path_redirect: "/"
                  https_redirect: true
          http_filters:
          - name: envoy.router
            config: {}
```

重启服务：

```bash
$ docker-compose down --remove-orphans
$ docker-compose up --build -d
```

再次通过 `HTTP` 协议访问 service1，将会返回 `301` 状态码：

```bash
$ curl -I -H 'Host: example.com' http://localhost/service/1

HTTP/1.1 301 Moved Permanently
location: https://example.com/
date: Tue, 03 Jul 2018 06:32:13 GMT
server: envoy
content-length: 0
```

OK，大功告成！完整的 front-proxy.yaml 配置文件内容如下：

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
          codec_type: auto
          stat_prefix: ingress_http
          route_config:
            virtual_hosts:
            - name: backend
              domains:
              - "example.com"
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
              - "example.com"
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
      tls_context:
        common_tls_context:
          tls_certificates:
            - certificate_chain:
                filename: "/etc/example-com.crt"
              private_key:
                filename: "/etc/example-com.key"
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
admin:
  access_log_path: "/dev/null"
  address:
    socket_address:
      address: 0.0.0.0
      port_value: 8001
```

----

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/wechat.gif)
<center>扫一扫关注微信公众号</center>

