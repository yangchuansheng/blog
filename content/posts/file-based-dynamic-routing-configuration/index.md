---
keywords:
- 米开朗基杨
- envoy
- xds
- lds
- cds
title: "Envoy 基础教程：基于文件系统动态更新配置"
subtitle: "贫苦家庭用户的 Envoy xDS 控制平面"
description: 本文教你如何使用文件作为 Envoy 的 xDS 控制平面来动态更新 Envoy 的配置
date: 2019-12-23T13:05:09+08:00
draft: false
author: 米开朗基杨
toc: true
categories:
- cloud-native
tags:
- Envoy
- OpenWrt
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/2020-04-24-20191204132153.webp"
---

之前家里的路由器一直用的都是网件 `R7000` 搭载的梅林固件，虽说性能也还不错，比两百块钱的小米路由器强多了，但还是不能满足我的需求，装了某**魔法软件**后内存蹭蹭蹭爆满啊。终于有理由换软路由了，此时不换更待何时！

经过一番对比，最后决定在某宝上入手了一款低功耗的 `J3160`，4 核 4 G，700 大洋左右，刷了个 `LEDE` 系统，这下绝对够用了。跑了几个魔法软件和一堆容器也没耗多少资源，还是 x86 香啊！

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/20191223003341.png)
![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/20191223132402.png)
![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/20191223235257.png)

`R7000` 就老老实实通过 `Access Point` 模式作为二级路由提供 WiFi 吧。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/20191223131810.png)

到这里有人可能要问了，说了这么多跟这篇文章的主题有什么关系呢？别急，下面进入主题。

## 背景

----

作为顶级贫苦玩家，肯定会在家里装上各种奇奇怪怪的应用，Aria2 和 Transmission 肯定不能少。作为顶级云原生狂热信徒，监控一条龙服务肯定不能少，至少应该上一套 `Grafana` 和 `Prometheus`。然而，这么多乱七八糟的端口，我可记不住。。。 

我需要一款负载均衡器来反代所有的服务，别跟我说 `Nginx`，作为云原生舔狗，用 Nginx 是不可能的，必须用我的偶像 `Envoy` 来做反代啊，既能反代 Web 服务，还能代替防火墙的端口映射功能（就是反代 TCP 啦），最重要的是还能暴露所有 `Upstream` 服务的 metrics，再结合 Prometheus 和 Grafana，不香吗？（你想想，连 samba 和 UDP 服务都能监控）

第一步当然是让路由器获取外网 IP 了，现在上海电信用的都是 `SDN` 网关，破解都无从破解，但很多人不知道的是，**其实你可以打电信客服电话让人家在后台把 `SDN` 网关改成桥接模式**。。。改完桥接模式就好办了，直接路由器拨号就是外网 IP。

下面就是改 `LEDE` Web 服务端口，因为 Envoy 得用 80 端口，所以把它的端口改成别的，比如 81 就不错：

```bash
$ cat /etc/config/uhttpd

config uhttpd 'main'
	list listen_http '0.0.0.0:81'
	list listen_http '[::]:81'
	list listen_proxy '127.0.0.1:8000'
	list listen_https '0.0.0.0:6443'
	list listen_https '[::]:6443'
	option home '/www'
	...
```

改完之后重启 `httpd` 服务：

```bash
$ /etc/init.d/uhttpd restart
```

DDNS 和申请 https 证书什么的我就不说了，不是本文的重点。

## 基于文件的 xDS 动态更新

----

`80` 和 `443` 端口被腾出来之后，就可以愉快地使用反代了。可是安装 Envoy 是个头疼的问题啊，编译太复杂，[GetEnvoy](https://www.getenvoy.io/) 项目又不支持 `busybox`，只能通过容器跑了。配置如图：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/20191223154116.png)    

 下面就是老老实实写配置文件，没什么可说的，但问题就出在这里，Upstream 服务不多倒好办，一旦变多，`Envoy` 配置文件会过于冗长，很容易看花眼。虽想到了用控制平面来动态更新配置，但我没必要单独起个控制平面服务，还有没有别的办法呢？有的，其实 `Envoy` 是可以将文件作为配置的订阅来源的。方法很简单，首先需要参加一个 `Bootstrap` 引导程序配置文件，里面定义了 node 信息和动态资源：

```yaml
$ cat envoy.yaml
node:
  id: node0
  cluster: cluster0
dynamic_resources:
  lds_config:
    path: /etc/envoy/lds.yaml
  cds_config:
    path: /etc/envoy/cds.yaml
admin:
  access_log_path: "/dev/stdout"
  address:
    socket_address:
      address: "::"
      ipv4_compat: true
      port_value: 15001
```

Envoy 将使用 [inotify](https://www.infoq.cn/article/inotify-linux-file-system-event-monitoring)（MacOS 用的是 `kqueue`）来监视文件的更改，一旦检测到更改，就立即订阅更新。查看系统是否支持 inotify：

```bash
$ ll /proc/sys/fs/inotify/

-rw-r--r--    1 root     root           0 Dec 23 16:05 max_queued_events
-rw-r--r--    1 root     root           0 Dec 23 16:05 max_user_instances
-rw-r--r--    1 root     root           0 Dec 23 16:05 max_user_watches
```

`lds.yaml` 里是 Listener 的配置，`cds.yaml` 里是 Cluster 的配置，先往 lds.yaml 中加入如下的配置：

```yaml
version_info: "0"
resources:
- "@type": type.googleapis.com/envoy.api.v2.Listener
  name: listener_http_v4
  address:
    socket_address:
      address: 0.0.0.0
      port_value: 80
  filter_chains:
  - filters:
    - name: envoy.http_connection_manager
      typed_config:
        "@type": type.googleapis.com/envoy.config.filter.network.http_connection_manager.v2.HttpConnectionManager
        stat_prefix: ingress_http
        codec_type: AUTO
        access_log:
          name: envoy.file_access_log
          typed_config:
            "@type": type.googleapis.com/envoy.config.accesslog.v2.FileAccessLog
            path: /dev/stdout
        route_config:
          name: http_route_v4
          virtual_hosts:
          - name: backend
            domains:
            - "router.icloudnative.io"
            - "mynas.icloudnative.io"
            routes:
            - match:
                prefix: "/"
              redirect:
                https_redirect: true
                port_redirect: 8443
                response_code: "FOUND"
          - name: default
            domains:
            - "*"
            routes:
            - match:
                prefix: "/"
              route:
                cluster: lede
        http_filters:
        - name: envoy.router
```

域名改成你自己的就好，路由分为两部分，通过那两个域名访问的就会被转到 `https`，其他的都转到 lede Web 服务。其实 http 转 https 的那部分路由可以删掉，因为国内的运营商基本上都把 `80` 端口封了，外网是无法访问的。第二部分不能删除，删除之后就不能通过内网访问 lede Web 界面了。

再加入 https 的配置：

```yaml
- "@type": type.googleapis.com/envoy.api.v2.Listener
  name: listener_https_v4
  address:
    socket_address:
      address: 0.0.0.0
      port_value: 8443
  filter_chains:
  - filter_chain_match:
      server_names: "router.icloudnative.io"
    transport_socket:
      name: envoy.transport_sockets.tls
      typed_config:
        "@type": type.googleapis.com/envoy.api.v2.auth.DownstreamTlsContext
        common_tls_context:
          tls_certificates:
          - certificate_chain:
              filename: "/etc/ssl/router.icloudnative.io/3207748_router.icloudnative.io.pem"
            private_key:
              filename: "/etc/ssl/router.icloudnative.io/3207748_router.icloudnative.io.key"
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
          name: https_route_v4_default
          virtual_hosts:
          - name: default
            domains:
            - "*"
            routes:
            - match:
                prefix: "/"
              route:
                cluster: lede
        http_filters:
        - name: envoy.router
```

接下来往 `cds.yaml` 中加入 Cluster 配置：

```yaml
version_info: "0"
resources:
- "@type": type.googleapis.com/envoy.api.v2.Cluster
  name: lede
  connect_timeout: 1s
  type: strict_dns
  dns_lookup_family: V4_ONLY
  lb_policy: ROUND_ROBIN
  load_assignment:
    cluster_name: lede
    endpoints:
    - lb_endpoints:
      - endpoint:
          address:
            socket_address:
              address: 127.0.0.1
              port_value: 81
```

由于 Docker 对 `inotify` 的支持不太友好，有时不会检测不到文件系统的更改，所以最好的办法是强制更改，原理很简单，将文件重命名，然后再改回来。写一个脚本就好了：

```bash
$ cat apply.sh
#!/bin/bash

mv cds.yaml cds.yaml.temp
mv cds.yaml.temp cds.yaml
mv lds.yaml lds.yaml.temp
mv lds.yaml.temp lds.yaml
```

> 注意：必须先更新 `CDS`，后更新 `LDS`。

执行脚本之后，查看 Envoy 日志，发现配置已经生效：

```bash
$ docker logs -f envoy

[2019-12-23 09:22:14.644][1][info][upstream] [source/common/upstream/cds_api_impl.cc:71] cds: add 1 cluster(s), remove 0 cluster(s)
[2019-12-23 09:22:14.648][1][info][upstream] [source/common/upstream/cds_api_impl.cc:87] cds: add/update cluster 'lede'
[2019-12-23 09:22:30.186][1][info][upstream] [source/server/lds_api.cc:71] lds: add/update listener 'listener_http_v4'
[2019-12-23 09:22:45.881][1][warning][config] [source/server/listener_impl.cc:287] adding listener '0.0.0.0:8443': filter chain match rules require TLS Inspector listener filter, but it isn't configured, trying to inject it (this might fail if Envoy is compiled without it)
[2019-12-23 09:22:45.882][1][info][upstream] [source/server/lds_api.cc:71] lds: add/update listener 'listener_https_v4'
```

### ipv6

上面只是 `ipv4` 的配置，如果你的宽带开启了 `ipv6`，还可以开启 ipv6 端口。至于我为什么要将 ipv4 和 ipv6 分开呢，因为据我测试，电信运营商只封了 ipv4 的 `80` 和 `443` 端口，ipv6 还可以用，所以我需要为 ipv4 和 ipv6 分配不同的路由策略。在 `lds.yaml` 中加入 ipv6 的配置：

``` yaml
- "@type": type.googleapis.com/envoy.api.v2.Listener
  name: listener_http_v6
  address:
    socket_address:
      address: "::"
      port_value: 80
  filter_chains:
  - filters:
    - name: envoy.http_connection_manager
      typed_config:
        "@type": type.googleapis.com/envoy.config.filter.network.http_connection_manager.v2.HttpConnectionManager
        stat_prefix: ingress_http
        codec_type: AUTO
        access_log:
          name: envoy.file_access_log
          typed_config:
            "@type": type.googleapis.com/envoy.config.accesslog.v2.FileAccessLog
            path: /dev/stdout
        route_config:
          name: http_route_v6
          virtual_hosts:
          - name: backend
            domains:
            - "router.icloudnative.io"
            - "mynas.icloudnative.io"
            routes:
            - match:
                prefix: "/"
              redirect:
                https_redirect: true
                port_redirect: 443
                response_code: "FOUND"
          - name: default
            domains:
            - "*"
            routes:
            - match:
                prefix: "/"
              route:
                cluster: lede
        http_filters:
        - name: envoy.router
- "@type": type.googleapis.com/envoy.api.v2.Listener
  name: listener_https_v6
  address:
    socket_address:
      address: "::"
      port_value: 443
  filter_chains:
  - filter_chain_match:
      server_names: "router.icloudnative.io"
    transport_socket:
      name: envoy.transport_sockets.tls
      typed_config:
        "@type": type.googleapis.com/envoy.api.v2.auth.DownstreamTlsContext
        common_tls_context:
          tls_certificates:
          - certificate_chain:
              filename: "/etc/ssl/router.icloudnative.io/3207748_router.icloudnative.io.pem"
            private_key:
              filename: "/etc/ssl/router.icloudnative.io/3207748_router.icloudnative.io.key"
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
          name: https_route_v6_default
          virtual_hosts:
          - name: default
            domains:
            - "*"
            routes:
            - match:
                prefix: "/"
              route:
                cluster: lede
        http_filters:
        - name: envoy.router
```

执行 `apply.sh` 使配置生效，查看日志：

```bash
$ docker logs -f envoy

[2019-12-23 09:43:44.431][1][info][upstream] [source/server/lds_api.cc:71] lds: add/update listener 'listener_http_v6'
[2019-12-23 09:43:44.441][1][warning][config] [source/server/listener_impl.cc:287] adding listener '[::]:443': filter chain match rules require TLS Inspector listener filter, but it isn't configured, trying to inject it (this might fail if Envoy is compiled without it)
[2019-12-23 09:43:44.441][1][info][upstream] [source/server/lds_api.cc:71] lds: add/update listener 'listener_https_v6'
```

### Grafana

`Grafana`  的安装我就不多说了，直接容器跑，配置如下：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/20191223174930.png)

 为了能够通过反向代理正确访问 `Grafana`，需要对 `Grafana` 的配置做一些调整，修改 `grafana.ini` 中的以下几个字段：

```ini
[server]
domain = foo.bar
root_url = %(protocol)s://%(domain)s/grafana/
```

将 `domain` 的值换成你自己的域名。

修改 Listener `listener_https_v4` 的路由：

```yaml
route_config:
  name: https_route_v4_default
  virtual_hosts:
  - name: default
    domains:
    - "*"
    routes:
    - match:
        prefix: "/grafana/"
      route:
        cluster: grafana
    - match:
        prefix: "/"
      route:
        cluster: lede
```

修改 Listener `listener_https_v6` 的路由：

```yaml
route_config:
  name: https_route_v6_default
  virtual_hosts:
  - name: default
    domains:
    - "*"
    routes:
    - match:
        prefix: "/grafana/"
      route:
        cluster: grafana
    - match:
        prefix: "/"
      route:
        cluster: lede
```

向 `cds.yaml` 中添加 Cluster：

```yaml
- "@type": type.googleapis.com/envoy.api.v2.Cluster
  name: grafana
  connect_timeout: 1s
  type: strict_dns
  dns_lookup_family: V4_ONLY
  lb_policy: ROUND_ROBIN
  load_assignment:
    cluster_name: grafana
    endpoints:
    - lb_endpoints:
      - endpoint:
          address:
            socket_address:
              address: 127.0.0.1
              port_value: 3000
```

应用更新：

```bash
$ ./apply.sh
```

然后就可以通过 `subpath` 访问 Grafana 了。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/20191223180534.png)

### TCP

一般情况下，路由器的端口映射都是通过 `iptables` 来做的，但我既然用了 Envoy，端口映射肯定还是要用 Envoy 来实现，毕竟 `Grafana` 真香。

Envoy 通过 TCP 代理即可实现端口映射功能，比如我想将 `samba` 服务暴露到公网，只需向 `lds.yaml` 中加入配置：

```yaml
- "@type": type.googleapis.com/envoy.api.v2.Listener
  name: listener_smb_local
  address:
    socket_address:
      address: "::"
      ipv4_compat: true
      port_value: 139
  filter_chains:
  - filters:
    - name: envoy.tcp_proxy
      typed_config:
        "@type": type.googleapis.com/envoy.config.filter.network.tcp_proxy.v2.TcpProxy
        stat_prefix: smb_local
        cluster: smb_local
        access_log:
          name: envoy.file_access_log
          typed_config:
            "@type": type.googleapis.com/envoy.config.accesslog.v2.FileAccessLog
            path: /dev/stdout
- "@type": type.googleapis.com/envoy.api.v2.Listener
  name: listener_smb_internet
  address:
    socket_address:
      address: "::"
      ipv4_compat: true
      port_value: 4450
  filter_chains:
  - filters:
    - name: envoy.tcp_proxy
      typed_config:
        "@type": type.googleapis.com/envoy.config.filter.network.tcp_proxy.v2.TcpProxy
        stat_prefix: smb_internet
        cluster: smb_internet
        access_log:
          name: envoy.file_access_log
          typed_config:
            "@type": type.googleapis.com/envoy.config.accesslog.v2.FileAccessLog
            path: /dev/stdout
```

其中 `ipv4_compat: true` 表示同时监听 ipv4 和 ipv6。`445` 端口也被运营商封了，所以可以使用 4450 端口。

再向 `cds.yaml` 中加入如下的配置：

```yaml
- "@type": type.googleapis.com/envoy.api.v2.Cluster
  name: smb_local
  connect_timeout: 1s
  type: strict_dns
  dns_lookup_family: V4_ONLY
  lb_policy: ROUND_ROBIN
  load_assignment:
    cluster_name: smb_local
    endpoints:
    - lb_endpoints:
      - endpoint:
          address:
            socket_address:
              address: 192.168.100.20
              port_value: 139
- "@type": type.googleapis.com/envoy.api.v2.Cluster
  name: smb_internet
  connect_timeout: 1s
  type: strict_dns
  dns_lookup_family: V4_ONLY
  lb_policy: ROUND_ROBIN
  load_assignment:
    cluster_name: smb_internet
    endpoints:
    - lb_endpoints:
      - endpoint:
          address:
            socket_address:
              address: 192.168.100.20
              port_value: 445
```

将其中的地址改成你的 `samba` 服务内网地址。

配置生效后，就可以通过外网连接你的 samba 服务了。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/20191223181539.png)

当然了，我自己的 Upstream 服务远远不止这些，我只是针对每一种类型举一个示例，大家可以举一反三。看看我的：

```bash
$ docker logs -f envoy

[2019-12-23 10:16:58.199][1][info][upstream] [source/common/upstream/cds_api_impl.cc:87] cds: add/update cluster 'prometheus'
[2019-12-23 10:16:58.201][1][info][upstream] [source/common/upstream/cds_api_impl.cc:87] cds: add/update cluster 'transmission'
[2019-12-23 10:16:58.204][1][info][upstream] [source/common/upstream/cds_api_impl.cc:87] cds: add/update cluster 'mynas'
[2019-12-23 10:16:58.205][1][info][upstream] [source/common/upstream/cds_api_impl.cc:87] cds: add/update cluster 'aria2'
[2019-12-23 10:16:58.207][1][info][upstream] [source/common/upstream/cds_api_impl.cc:87] cds: add/update cluster 'aria2_bt'
[2019-12-23 10:16:58.209][1][info][upstream] [source/common/upstream/cds_api_impl.cc:87] cds: add/update cluster 'aria2_dht'
[2019-12-23 10:16:58.211][1][info][upstream] [source/common/upstream/cds_api_impl.cc:87] cds: add/update cluster 'smb_local'
[2019-12-23 10:16:58.213][1][info][upstream] [source/common/upstream/cds_api_impl.cc:87] cds: add/update cluster 'smb_internet'
[2019-12-23 10:16:58.215][1][info][upstream] [source/common/upstream/cds_api_impl.cc:87] cds: add/update cluster 'transmission_bt'
[2019-12-23 10:16:58.217][1][info][upstream] [source/common/upstream/cds_api_impl.cc:87] cds: add/update cluster 'time'
[2019-12-23 10:16:58.233][1][info][upstream] [source/server/lds_api.cc:71] lds: add/update listener 'listener_http_v6'
[2019-12-23 10:16:58.243][1][warning][config] [source/server/listener_impl.cc:287] adding listener '0.0.0.0:8443': filter chain match rules require TLS Inspector listener filter, but it isn't configured, trying to inject it (this might fail if Envoy is compiled without it)
[2019-12-23 10:16:58.243][1][info][upstream] [source/server/lds_api.cc:71] lds: add/update listener 'listener_https_v4'
[2019-12-23 10:16:58.254][1][warning][config] [source/server/listener_impl.cc:287] adding listener '[::]:443': filter chain match rules require TLS Inspector listener filter, but it isn't configured, trying to inject it (this might fail if Envoy is compiled without it)
[2019-12-23 10:16:58.255][1][info][upstream] [source/server/lds_api.cc:71] lds: add/update listener 'listener_https_v6'
[2019-12-23 10:16:58.255][1][info][upstream] [source/server/lds_api.cc:71] lds: add/update listener 'listener_ntp'
[2019-12-23 10:16:58.260][1][info][upstream] [source/server/lds_api.cc:71] lds: add/update listener 'listener_aria2'
[2019-12-23 10:16:58.263][1][info][upstream] [source/server/lds_api.cc:71] lds: add/update listener 'listener_aria2_bt'
[2019-12-23 10:16:58.265][1][info][upstream] [source/server/lds_api.cc:71] lds: add/update listener 'listener_aria2_dht'
[2019-12-23 10:16:58.269][1][info][upstream] [source/server/lds_api.cc:71] lds: add/update listener 'listener_smb_local'
[2019-12-23 10:16:58.272][1][info][upstream] [source/server/lds_api.cc:71] lds: add/update listener 'listener_smb_internet'
[2019-12-23 10:16:58.275][1][info][upstream] [source/server/lds_api.cc:71] lds: add/update listener 'listener_transmission_bt'
```

监控截图：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/20191223223654.png)
![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/20191223223839.png)
![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/20191223235932.png)
