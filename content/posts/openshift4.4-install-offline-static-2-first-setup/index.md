---
keywords:
- openshift
- ocp
- openshift4
- ocp4
- quay
title: "Openshift 4.4 静态 IP 离线安装系列：初始安装"
date: 2020-06-02T18:40:45+08:00
lastmod: 2020-06-02T18:40:45+08:00
description: 本文开始正式安装 OCP（Openshift Container Platform） 集群，包括 DNS 解析、负载均衡配置、ignition 配置文件生成和集群部署。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocLevels: ["h2", "h3", "h4"]
tags:
- Openshift
categories:
- cloud-native
img: https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200601144925.png
libraries:
- katex
---

[上篇文章](/posts/openshift4.4-install-offline-static-1-requirement/)准备了离线安装 OCP 所需要的离线资源，包括安装镜像、所有样例 `Image Stream` 和 `OperatorHub` 中的所有 RedHat Operators。本文就开始正式安装 `OCP`（Openshift Container Platform） 集群，包括 DNS 解析、负载均衡配置、`ignition` 配置文件生成和集群部署。

`OCP` 安装期间需要用到多个文件：安装配置文件、Kubernetes 部署清单、Ignition 配置文件（包含了 machine types）。**安装配置文件将被转换为 Kubernetes 部署清单，然后将清单包装到 `Ignition` 配置文件中。** 安装程序使用这些 `Ignition` 配置文件来创建 Openshift 集群。运行安装程序时，所有原始安装配置文件都会修改，因此在安装之前应该先备份文件。

## 1. 安装过程

在安装 OCP 时，我们需要有一台引导主机（`Bootstrap`）。这个主机可以访问所有的 OCP 节点。引导主机启动一个临时控制平面，它启动 OCP 集群的其余部分然后被销毁。引导主机使用 Ignition 配置文件进行集群安装引导，该文件描述了如何创建 OCP 集群。**安装程序生成的 Ignition 配置文件包含 24 小时后过期的证书，所以必须在证书过期之前完成集群安装。**

引导集群安装包括如下步骤：

+ 引导主机启动并开始托管 `Master` 节点启动所需的资源。
+ `Master` 节点从引导主机远程获取资源并完成引导。
+ `Master` 节点通过引导主机构建 `Etcd` 集群。
+ 引导主机使用新的 `Etcd` 集群启动临时 `Kubernetes` 控制平面。
+ 临时控制平面在 Master 节点启动生成控制平面。
+ 临时控制平面关闭并将控制权传递给生产控制平面。
+ 引导主机将 OCP 组件注入生成控制平面。
+ 安装程序关闭引导主机。

引导安装过程完成以后，OCP 集群部署完毕。然后集群开始下载并配置日常操作所需的其余组件，包括创建计算节点、通过 `Operator` 安装其他服务等。

![创建引导主机、控制平面和计算节点](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200602195135.png)

## 2. 准备服务器资源

服务器规划如下：

+ 三个控制平面节点，安装 `Etcd`、控制平面组件和 `Infras` 基础组件。
+ 两个计算节点，运行实际负载。
+ 一个引导主机，执行安装任务，集群部署完成后可删除。
+ 一个基础节点，用于准备上节提到的离线资源，同时用来部署 DNS 和负载均衡。
+ 一个镜像节点，用来部署私有镜像仓库 `Quay`。

| 主机类型 |     操作系统      | Hostname  | vCPU | 内存 | 存储  |      IP       |               FQDN               |
| :------: | :---------------: | :-------: | :--: | ---- | :---: | :-----------: | :------------------------------: |
| 镜像节点 |     RHEL 7.6      | registry  |  4   | 8GB  | 150GB | 192.168.57.70 | registry.openshift4.example.com  |
| 基础节点 |     RHEL 7.6      |  bastion  |  4   | 16GB | 120GB | 192.168.57.60 |  bastion.openshift4.example.com  |
| 引导主机 |       RHCOS       | bootstrap |  4   | 16GB | 120GB | 192.168.57.61 | bootstrap.openshift4.example.com |
| 控制平面 |       RHCOS       |  master1  |  4   | 16GB | 120GB | 192.168.57.62 |  master1.openshift4.example.com  |
| 控制平面 |       RHCOS       |  master2  |  4   | 16GB | 120GB | 192.168.57.63 |  master2.openshift4.example.com  |
| 控制平面 |       RHCOS       |  master3  |  4   | 16GB | 120GB | 192.168.57.64 |  master3.openshift4.example.com  |
| 计算节点 | RHCOS 或 RHEL 7.6 |  worker1  |  2   | 8GB  | 120GB | 192.168.57.65 |  worker1.openshift4.example.com  |
| 计算节点 | RHCOS 或 RHEL 7.6 |  worker2  |  2   | 8GB  | 120GB | 192.168.57.66 |  worke2.openshift4.example.com   |

## 3. 防火墙配置

接下来看一下每个节点的端口号分配。

所有节点（计算节点和控制平面）之间需要开放的端口：

| 协议 |      端口       |                             作用                             |
| :--: | :-------------: | :----------------------------------------------------------: |
| ICMP |       N/A       |                        测试网络连通性                        |
| TCP  |   `9000-9999`   | 节点的服务端口，包括 node exporter 使用的 `9100-9101` 端口和 Cluster Version Operator 使用的 `9099` 端口 |
|      | `10250`-`10259` |                  Kubernetes 预留的默认端口                   |
|      |     `10256`     |                        openshift-sdn                         |
| UDP  |     `4789`      |              VXLAN 协议或 GENEVE 协议的通信端口              |
|      |     `6081`      |              VXLAN 协议或 GENEVE 协议的通信端口              |
|      |  `9000`-`9999`  |  节点的服务端口，包括 node exporter 使用的 `9100-9101` 端口  |
|      | `30000`-`32767` |                     Kubernetes NodePort                      |

控制平面需要向其他节点开放的端口：

| 协议 |     端口      |      作用      |
| :--: | :-----------: | :------------: |
| TCP  | `2379`-`2380` | Etcd 服务端口  |
|      |    `6443`     | Kubernetes API |

除此之外，还要配置两个四层负载均衡器，一个用来暴露集群 API，一个用来暴露 Ingress：

|  端口   |                             作用                             | 内部 | 外部 |         描述          |
| :-----: | :----------------------------------------------------------: | :--: | :--: | :-------------------: |
| `6443`  | 引导主机和控制平面使用。在引导主机初始化集群控制平面后，需从负载均衡器中手动删除引导主机 |  x   |  x   | Kubernetes API server |
| `22623` | 引导主机和控制平面使用。在引导主机初始化集群控制平面后，需从负载均衡器中手动删除引导主机 |      |  x   | Machine Config server |
|  `443`  |              Ingress Controller 或 Router 使用               |  x   |  x   |      HTTPS 流量       |
|  `80`   |              Ingress Controller 或 Router 使用               |  x   |  x   |       HTTP 流量       |

## 4. 配置 DNS

按照官方文档，使用 UPI 基础架构的 OCP 集群需要以下的 DNS 记录。在每条记录中，`<cluster_name>` 是集群名称，`<base_domain>` 是在 `install-config.yaml` 文件中指定的集群基本域，如下表所示：

|      组件      |                        DNS记录                        |                             描述                             |
| :------------: | :---------------------------------------------------: | :----------------------------------------------------------: |
| Kubernetes API |          `api.<cluster_name>.<base_domain>.`          | 此 DNS 记录必须指向控制平面节点的负载均衡器。此记录必须可由集群外部的客户端和集群中的所有节点解析。 |
|                |        `api-int.<cluster_name>.<base_domain>.`        | 此 DNS 记录必须指向控制平面节点的负载均衡器。此记录必须可由集群外部的客户端和集群中的所有节点解析。 |
|     Routes     |        `*.apps.<cluster_name>.<base_domain>.`         | DNS 通配符记录，指向负载均衡器。这个负载均衡器的后端是 Ingress router 所在的节点，默认是计算节点。此记录必须可由集群外部的客户端和集群中的所有节点解析。 |
|      etcd      |     `etcd-<index>.<cluster_name>.<base_domain>.`      | OCP 要求每个 etcd 实例的 DNS 记录指向运行实例的控制平面节点。etcd 实例由 <index> 值区分，它们以 `0` 开头，以 `n-1` 结束，其中 `n` 是集群中控制平面节点的数量。集群中的所有节点必须都可以解析此记录。 |
|                | `_etcd-server-ssl._tcp.<cluster_name>.<base_domain>.` | 因为 etcd 使用端口 `2380` 对外服务，因此需要建立对应每台 etcd 节点的 SRV DNS 记录，优先级 0，权重 10 和端口 2380 |

DNS 服务的部署方法由很多种，我当然推荐使用 `CoreDNS`，毕竟云原生标配。由于这里需要添加 SRV 记录，所以需要 CoreDNS 结合 `etcd` 插件使用。**以下所有操作在基础节点上执行。**

首先通过 yum 安装并启动 etcd：

```bash
$ yum install -y etcd
$ systemctl enable etcd --now
```

然后下载 CoreDNS 二进制文件：

```bash
$ wget https://github.com/coredns/coredns/releases/download/v1.6.9/coredns_1.6.9_linux_amd64.tgz
$ tar zxvf coredns_1.6.9_linux_amd64.tgz
$ mv coredns /usr/local/bin
```

创建 `Systemd Unit` 文件：

```bash
$ cat > /etc/systemd/system/coredns.service <<EOF
[Unit]
Description=CoreDNS DNS server
Documentation=https://coredns.io
After=network.target

[Service]
PermissionsStartOnly=true
LimitNOFILE=1048576
LimitNPROC=512
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
User=coredns
WorkingDirectory=~
ExecStart=/usr/local/bin/coredns -conf=/etc/coredns/Corefile
ExecReload=/bin/kill -SIGUSR1 $MAINPID
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
```

新建 `coredns` 用户：

```bash
$ useradd coredns -s /sbin/nologin
```

新建 CoreDNS 配置文件：

```bash
$ cat > /etc/coredns/Corefile <<EOF
.:53 {  # 监听 TCP 和 UDP 的 53 端口
    template IN A apps.openshift4.example.com {
    match .*apps\.openshift4\.example\.com # 匹配请求 DNS 名称的正则表达式
    answer "{{ .Name }} 60 IN A 192.168.57.60" # DNS 应答
    fallthrough
    }
    etcd {   # 配置启用 etcd 插件,后面可以指定域名,例如 etcd test.com {
        path /skydns # etcd 里面的路径 默认为 /skydns，以后所有的 dns 记录都存储在该路径下
        endpoint http://localhost:2379 # etcd 访问地址，多个空格分开
        fallthrough # 如果区域匹配但不能生成记录，则将请求传递给下一个插件
        # tls CERT KEY CACERT # 可选参数，etcd 认证证书设置
    }
    prometheus  # 监控插件
    cache 160
    loadbalance   # 负载均衡，开启 DNS 记录轮询策略
    forward . 192.168.57.1
    log # 打印日志
}
EOF
```

其中 `template` 插件用来实现泛域名解析。

启动 CoreDNS 并设置开机自启：

```bash
$ systemctl enable coredns --now
```

验证泛域名解析：

```bash
$ dig +short apps.openshift4.example.com @127.0.0.1
192.168.57.60

$ dig +short x.apps.openshift4.example.com @127.0.0.1
192.168.57.60
```

添加其余 DNS 记录：

```bash
$ alias etcdctlv3='ETCDCTL_API=3 etcdctl'
$ etcdctlv3 put /skydns/com/example/openshift4/api '{"host":"192.168.57.60","ttl":60}'
$ etcdctlv3 put /skydns/com/example/openshift4/api-int '{"host":"192.168.57.60","ttl":60}'

$ etcdctlv3 put /skydns/com/example/openshift4/etcd-0 '{"host":"192.168.57.62","ttl":60}'
$ etcdctlv3 put /skydns/com/example/openshift4/etcd-1 '{"host":"192.168.57.63","ttl":60}'
$ etcdctlv3 put /skydns/com/example/openshift4/etcd-2 '{"host":"192.168.57.64","ttl":60}'

$ etcdctlv3 put /skydns/com/example/openshift4/_tcp/_etcd-server-ssl/x1 '{"host":"etcd-0.openshift4.example.com","ttl":60,"priority":0,"weight":10,"port":2380}'
$ etcdctlv3 put /skydns/com/example/openshift4/_tcp/_etcd-server-ssl/x2 '{"host":"etcd-1.openshift4.example.com","ttl":60,"priority":0,"weight":10,"port":2380}'
$ etcdctlv3 put /skydns/com/example/openshift4/_tcp/_etcd-server-ssl/x3 '{"host":"etcd-2.openshift4.example.com","ttl":60,"priority":0,"weight":10,"port":2380}'

# 除此之外再添加各节点主机名记录
$ etcdctlv3 put /skydns/com/example/openshift4/bootstrap '{"host":"192.168.57.61","ttl":60}'
$ etcdctlv3 put /skydns/com/example/openshift4/master1 '{"host":"192.168.57.62","ttl":60}'
$ etcdctlv3 put /skydns/com/example/openshift4/master2 '{"host":"192.168.57.63","ttl":60}'
$ etcdctlv3 put /skydns/com/example/openshift4/master3 '{"host":"192.168.57.64","ttl":60}'
$ etcdctlv3 put /skydns/com/example/openshift4/worker1 '{"host":"192.168.57.65","ttl":60}'
$ etcdctlv3 put /skydns/com/example/openshift4/worker2 '{"host":"192.168.57.66","ttl":60}'
$ etcdctlv3 put /skydns/com/example/openshift4/registry '{"host":"192.168.57.70","ttl":60}'
```

验证 DNS 解析：

```bash
$ yum install -y bind-utils
$ dig +short api.openshift4.example.com @127.0.0.1
192.168.57.60

$ dig +short api-int.openshift4.example.com @127.0.0.1
192.168.57.60

$ dig +short etcd-0.openshift4.example.com @127.0.0.1
192.168.57.62
$ dig +short etcd-1.openshift4.example.com @127.0.0.1
192.168.57.63
$ dig +short etcd-2.openshift4.example.com @127.0.0.1
192.168.57.64

$ dig +short -t SRV _etcd-server-ssl._tcp.openshift4.example.com @127.0.0.1
10 33 2380 etcd-0.openshift4.example.com.
10 33 2380 etcd-1.openshift4.example.com.
10 33 2380 etcd-2.openshift4.example.com.

$ dig +short bootstrap.openshift4.example.com @127.0.0.1
192.168.57.61
$ dig +short master1.openshift4.example.com @127.0.0.1
192.168.57.62
$ dig +short master2.openshift4.example.com @127.0.0.1
192.168.57.63
$ dig +short master3.openshift4.example.com @127.0.0.1
192.168.57.64
$ dig +short worker1.openshift4.example.com @127.0.0.1
192.168.57.65
$ dig +short worker2.openshift4.example.com @127.0.0.1
192.168.57.66
```

## 5. 配置负载均衡

负载均衡我选择使用 `Envoy`，先准备配置文件：

{{< tabs Bootstrap LDS CDS >}}
{{< tab Bootstrap >}}
```yaml
# /etc/envoy/envoy.yaml
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
      address: "0.0.0.0"
      port_value: 15001
```
{{< /tab >}}
{{< tab LDS >}}
```yaml
# /etc/envoy/lds.yaml
version_info: "0"
resources:
- "@type": type.googleapis.com/envoy.config.listener.v3.Listener
  name: listener_openshift-api-server
  address:
    socket_address:
      address: 0.0.0.0
      port_value: 6443
  filter_chains:
  - filters:
    - name: envoy.tcp_proxy
      typed_config:
        "@type": type.googleapis.com/envoy.extensions.filters.network.tcp_proxy.v3.TcpProxy
        stat_prefix: openshift-api-server
        cluster: openshift-api-server
        access_log:
          name: envoy.access_loggers.file
          typed_config:
            "@type": type.googleapis.com/envoy.extensions.access_loggers.file.v3.FileAccessLog
            path: /dev/stdout
- "@type": type.googleapis.com/envoy.config.listener.v3.Listener
  name: listener_machine-config-server
  address:
    socket_address:
      address: "::"
      ipv4_compat: true
      port_value: 22623
  filter_chains:
  - filters:
    - name: envoy.tcp_proxy
      typed_config:
        "@type": type.googleapis.com/envoy.extensions.filters.network.tcp_proxy.v3.TcpProxy
        stat_prefix: machine-config-server
        cluster: machine-config-server
        access_log:
          name: envoy.access_loggers.file
          typed_config:
            "@type": type.googleapis.com/envoy.extensions.access_loggers.file.v3.FileAccessLog
            path: /dev/stdout
- "@type": type.googleapis.com/envoy.config.listener.v3.Listener
  name: listener_ingress-http
  address:
    socket_address:
      address: "::"
      ipv4_compat: true
      port_value: 80
  filter_chains:
  - filters:
    - name: envoy.tcp_proxy
      typed_config:
        "@type": type.googleapis.com/envoy.extensions.filters.network.tcp_proxy.v3.TcpProxy
        stat_prefix: ingress-http
        cluster: ingress-http
        access_log:
          name: envoy.access_loggers.file
          typed_config:
            "@type": type.googleapis.com/envoy.extensions.access_loggers.file.v3.FileAccessLog
            path: /dev/stdout
- "@type": type.googleapis.com/envoy.config.listener.v3.Listener
  name: listener_ingress-https
  address:
    socket_address:
      address: "::"
      ipv4_compat: true
      port_value: 443
  filter_chains:
  - filters:
    - name: envoy.tcp_proxy
      typed_config:
        "@type": type.googleapis.com/envoy.extensions.filters.network.tcp_proxy.v3.TcpProxy
        stat_prefix: ingress-https
        cluster: ingress-https
        access_log:
          name: envoy.access_loggers.file
          typed_config:
            "@type": type.googleapis.com/envoy.extensions.access_loggers.file.v3.FileAccessLog
            path: /dev/stdout
```
{{< /tab >}}
{{< tab CDS >}}
```yaml
# /etc/envoy/cds.yaml
version_info: "0"
resources:
- "@type": type.googleapis.com/envoy.config.cluster.v3.Cluster
  name: openshift-api-server
  connect_timeout: 1s
  type: strict_dns
  dns_lookup_family: V4_ONLY
  lb_policy: ROUND_ROBIN
  load_assignment:
    cluster_name: openshift-api-server
    endpoints:
    - lb_endpoints:
      - endpoint:
          address:
            socket_address:
              address: 192.168.57.61
              port_value: 6443
      - endpoint:
          address:
            socket_address:
              address: 192.168.57.62
              port_value: 6443
      - endpoint:
          address:
            socket_address:
              address: 192.168.57.63
              port_value: 6443
      - endpoint:
          address:
            socket_address:
              address: 192.168.57.64
              port_value: 6443
- "@type": type.googleapis.com/envoy.config.cluster.v3.Cluster
  name: machine-config-server
  connect_timeout: 1s
  type: strict_dns
  dns_lookup_family: V4_ONLY
  lb_policy: ROUND_ROBIN
  load_assignment:
    cluster_name: machine-config-server
    endpoints:
    - lb_endpoints:
      - endpoint:
          address:
            socket_address:
              address: 192.168.57.61
              port_value: 22623
      - endpoint:
          address:
            socket_address:
              address: 192.168.57.62
              port_value: 22623
      - endpoint:
          address:
            socket_address:
              address: 192.168.57.63
              port_value: 22623
      - endpoint:
          address:
            socket_address:
              address: 192.168.57.64
              port_value: 22623
- "@type": type.googleapis.com/envoy.config.cluster.v3.Cluster
  name: ingress-http
  connect_timeout: 1s
  type: strict_dns
  dns_lookup_family: V4_ONLY
  lb_policy: ROUND_ROBIN
  load_assignment:
    cluster_name: ingress-http
    endpoints:
    - lb_endpoints:
      - endpoint:
          address:
            socket_address:
              address: 192.168.57.65
              port_value: 80
      - endpoint:
          address:
            socket_address:
              address: 192.168.57.66
              port_value: 80
- "@type": type.googleapis.com/envoy.config.cluster.v3.Cluster
  name: ingress-https
  connect_timeout: 1s
  type: strict_dns
  dns_lookup_family: V4_ONLY
  lb_policy: ROUND_ROBIN
  load_assignment:
    cluster_name: ingress-https
    endpoints:
    - lb_endpoints:
      - endpoint:
          address:
            socket_address:
              address: 192.168.57.65
              port_value: 443
      - endpoint:
          address:
            socket_address:
              address: 192.168.57.66
              port_value: 443
```
{{< /tab >}}
{{< /tabs >}}

配置看不懂的去看我的电子书：[Envoy 中文指南](https://icloudnative.io/envoy-handbook/)

启动 `Envoy`：

```bash
$ podman run -d --restart=always --name envoy --net host -v /etc/envoy:/etc/envoy envoyproxy/envoy
```

## 6. 安装准备

### 生成 SSH 私钥并将其添加到 agent

在安装过程中，我们会在基础节点上执行 OCP 安装调试和灾难恢复，因此必须在基础节点上配置 SSH key，`ssh-agent` 将会用它来执行安装程序。

基础节点上的 `core` 用户可以使用该私钥登录到 Master 节点。部署集群时，该私钥会被添加到 core 用户的 `~/.ssh/authorized_keys` 列表中。

密钥创建步骤如下：

① 创建无密码验证的 SSH key：

```bash
$ ssh-keygen -t rsa -b 4096 -N '' -f ~/.ssh/new_rsa
```

② 启动 `ssh-agent` 进程作为后台任务：

```bash
$ eval "$(ssh-agent -s)"
```

③ 将 SSH 私钥添加到 `ssh-agent`：

```bash
$ ssh-add ~/.ssh/new_rsa
```

后续集群安装过程中，有一步会提示输入 SSH public key，届时使用前面创建的公钥 `new_rsa.pub` 就可以了。

### 获取安装程序

如果是在线安装，还需要在基础节点上下载安装程序。但这里是离线安装，安装程序在上篇文章中已经被提取出来了，所以不需要再下载。

### 创建安装配置文件

首先创建一个安装目录，用来存储安装所需要的文件：

```bash
$ mkdir /ocpinstall
```

自定义 `install-config.yaml` 并将其保存在 `/ocpinstall` 目录中。配置文件必须命名为 `install-config.yaml`。配置文件内容：

```yaml
apiVersion: v1
baseDomain: example.com
compute:
- hyperthreading: Enabled
  name: worker
  replicas: 0
controlPlane:
  hyperthreading: Enabled
  name: master
  replicas: 3
metadata:
  name: openshift4
networking:
  clusterNetwork:
  - cidr: 10.128.0.0/14
    hostPrefix: 23
  networkType: OpenShiftSDN
  serviceNetwork:
  - 172.30.0.0/16
platform:
  none: {}
fips: false
pullSecret: '{"auths": ...}'
sshKey: 'ssh-rsa ...'
additionalTrustBundle: |
  -----BEGIN CERTIFICATE-----
  省略，注意这里要前面空两格
  -----END CERTIFICATE-----
imageContentSources:
- mirrors:
  - registry.openshift4.example.com/ocp4/openshift4
  source: quay.io/openshift-release-dev/ocp-release
- mirrors:
  - registry.openshift4.example.com/ocp4/openshift4
  source: quay.io/openshift-release-dev/ocp-v4.0-art-dev
```

+ **baseDomain** : 所有 Openshift 内部的 DNS 记录必须是此基础的子域，并包含集群名称。
+ **compute** : 计算节点配置。这是一个数组，每一个元素必须以连字符 `-` 开头。
+ **hyperthreading** : Enabled 表示启用同步多线程或超线程。默认启用同步多线程，可以提高机器内核的性能。如果要禁用，则控制平面和计算节点都要禁用。
+ **compute.replicas** : 计算节点数量。因为我们要手动创建计算节点，所以这里要设置为 0。
+ **controlPlane.replicas** : 控制平面节点数量。控制平面节点数量必须和 etcd 节点数量一致，为了实现高可用，本文设置为 3。
+ **metadata.name** : 集群名称。即前面 DNS 记录中的 `<cluster_name>`。
+ **cidr** : 定义了分配 Pod IP 的 IP 地址段，不能和物理网络重叠。
+ **hostPrefix** : 分配给每个节点的子网前缀长度。例如，如果将 `hostPrefix` 设置为 `23`，则为每一个节点分配一个给定 cidr 的 `/23` 子网，允许 $510 (2^{32 - 23} - 2)$ 个 Pod IP 地址。
+ **serviceNetwork** : Service IP 的地址池，只能设置一个。
+ **pullSecret** : 上篇文章使用的 pull secret，可通过命令 `cat /root/pull-secret.json|jq -c` 来压缩成一行。
+ **sshKey** : 上面创建的公钥，可通过命令 `cat ~/.ssh/new_rsa.pub` 查看。
+ **additionalTrustBundle** : 私有镜像仓库 Quay 的信任证书，可在镜像节点上通过命令 `cat /data/quay/config/ssl.cert` 查看。
+ **imageContentSources** : 来自前面 `oc adm release mirror` 的输出结果。

备份安装配置文件，便于以后重复使用：

```bash
$ cd /ocpinstall
$ cp install-config.yaml  install-config.yaml.20200604
```

### 创建 Kubernetes 部署清单

> 创建 Kubernetes 部署清单后 `install-config.yaml` 将被删除，请务必先备份此文件！

创建 Kubernetes 部署清单文件：

```bash
$ openshift-install create manifests --dir=/ocpinstall
```

修改 `manifests/cluster-scheduler-02-config.yml` 文件，将 `mastersSchedulable` 的值设为 `flase`，以防止 Pod 调度到控制节点。

### 创建 Ignition 配置文件

> 创建 Ignition 配置文件后 `install-config.yaml` 将被删除，请务必先备份此文件！

```bash
$ cp install-config.yaml.20200604 install-config.yaml
$ openshift-install create ignition-configs --dir=/ocpinstall
```

生成的文件：

```bash
├── auth
│   ├── kubeadmin-password
│   └── kubeconfig
├── bootstrap.ign
├── master.ign
├── metadata.json
└── worker.ign
```

准备一个 HTTP 服务，这里选择使用 Nginx：

```bash
$ yum install -y nginx
```

修改 Nginx 的配置文件 `/etc/nginx/nginx/.conf`，将端口改为 `8080`（因为负载均衡器已经占用了 80 端口）。然后启动 Nginx 服务：

```bash
$ systemctl enable nginx --now
```

将 `Ignition` 配置文件拷贝到 HTTP 服务的 ignition 目录：

```bash
$ mkdir /usr/share/nginx/html/ignition
$ cp -r *.ign /usr/share/nginx/html/ignition/
```

### 获取 RHCOS 的 BIOS 文件

下载用于裸机安装的 BIOS 文件，并上传到 Nginx 的目录：

```bash
$ mkdir /usr/share/nginx/html/install
$ wget https://mirror.openshift.com/pub/openshift-v4/dependencies/rhcos/4.4/latest/rhcos-4.4.3-x86_64-metal.x86_64.raw.gz -O /usr/share/nginx/html/install/rhcos-4.4.3-x86_64-metal.x86_64.raw.gz
```

### 获取 RHCOS 的 ISO 文件

本地下载 RHCOS 的 `ISO` 文件：[https://mirror.openshift.com/pub/openshift-v4/dependencies/rhcos/4.4/latest/rhcos-4.4.3-x86_64-installer.x86_64.iso](https://mirror.openshift.com/pub/openshift-v4/dependencies/rhcos/4.4/latest/rhcos-4.4.3-x86_64-installer.x86_64.iso)，然后上传到 `vSphere`。步骤如下：

① 首先登陆 vSphere，然后点击『存储』。
![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200605130737.png)
    
② 选择一个『数据存储』，然后在右边的窗口中选择『上载文件』。

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200605131505.png)

③ 选择刚刚下载的 ISO 文件，上传到 ESXI 主机。

## 7. 安装集群

### Bootstrap

最后开始正式安装集群，先创建 bootstrap 节点虚拟机，操作系统选择『Red Hat Enterprise Linux 7 (64-Bit)』，并挂载之前上传的 ISO，按照之前的表格设置 CPU 、内存和硬盘，打开电源，然后按照下面的步骤操作：

① 在 RHCOS Installer 安装界面按 `Tab` 键进入引导参数配置选项。

② 在默认选项 `coreos.inst = yes` 之后添加（由于无法拷贝粘贴，请输入**仔细核对**后再回车进行）：

```bash
ip=192.168.57.61::192.168.57.1:255.255.255.0:bootstrap.openshift4.example.com:ens192:none nameserver=192.168.57.60 coreos.inst.install_dev=sda coreos.inst.image_url=http://192.168.57.60:8080/install/rhcos-4.4.3-x86_64-metal.x86_64.raw.gz coreos.inst.ignition_url=http://192.168.57.60:8080/ignition/bootstrap.ign 
```

其中 `ip=...` 的含义为 `ip=$IPADDRESS::$DEFAULTGW:$NETMASK:$HOSTNAMEFQDN:$IFACE:none`。

如图所示：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200605134815.png)

③ 如果安装有问题会进入 `emergency shell`，检查网络、域名解析是否正常，如果正常一般是以上参数输入有误，reboot 退出 shell 回到第一步重新开始。

安装成功后从基础节点通过命令 `ssh -i ~/.ssh/new_rsa core@192.168.57.61` 登录 bootstrap 节点，然后验证：

+ 网络配置是否符合自己的设定：
  + `hostname`
  + `ip route`
  + `cat /etc/resolv.conf`
+ 验证是否成功启动 bootstrap 相应服务：
  + `podman ps` 查看服务是否以容器方式运行
  + 使用 `ss -tulnp` 查看 6443 和 22623 端口是否启用。

这里简单介绍一下 bootstrap 节点的启动流程，它会先通过 `podman` 跑一些容器，然后在容器里面启动临时控制平面，这个临时控制平面是通过 `CRIO` 跑在容器里的，有点绕。。直接看命令：

```bash
$ podman ps -a --no-trunc --sort created --format "{{.Command}}"

start --tear-down-early=false --asset-dir=/assets --required-pods=openshift-kube-apiserver/kube-apiserver,openshift-kube-scheduler/openshift-kube-scheduler,openshift-kube-controller-manager/kube-controller-manager,openshift-cluster-version/cluster-version-operator
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
render --dest-dir=/assets/cco-bootstrap --cloud-credential-operator-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:244ab9d0fcf7315eb5c399bd3fa7c2e662cf23f87f625757b13f415d484621c3
bootstrap --etcd-ca=/assets/tls/etcd-ca-bundle.crt --etcd-metric-ca=/assets/tls/etcd-metric-ca-bundle.crt --root-ca=/assets/tls/root-ca.crt --kube-ca=/assets/tls/kube-apiserver-complete-client-ca-bundle.crt --config-file=/assets/manifests/cluster-config.yaml --dest-dir=/assets/mco-bootstrap --pull-secret=/assets/manifests/openshift-config-secret-pull-secret.yaml --etcd-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:aba3c59eb6d088d61b268f83b034230b3396ce67da4f6f6d49201e55efebc6b2 --kube-client-agent-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:8eb481214103d8e0b5fe982ffd682f838b969c8ff7d4f3ed4f83d4a444fb841b --machine-config-operator-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:31dfdca3584982ed5a82d3017322b7d65a491ab25080c427f3f07d9ce93c52e2 --machine-config-oscontent-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:b397960b7cc14c2e2603111b7385c6e8e4b0f683f9873cd9252a789175e5c4e1 --infra-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:d7862a735f492a18cb127742b5c2252281aa8f3bd92189176dd46ae9620ee68a --keepalived-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:a882a11b55b2fc41b538b59bf5db8e4cfc47c537890e4906fe6bf22f9da75575 --coredns-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:b25b8b2219e8c247c088af93e833c9ac390bc63459955e131d89b77c485d144d --mdns-publisher-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:dea1fcb456eae4aabdf5d2d5c537a968a2dafc3da52fe20e8d99a176fccaabce --haproxy-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:7064737dd9d0a43de7a87a094487ab4d7b9e666675c53cf4806d1c9279bd6c2e --baremetal-runtimecfg-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:715bc48eda04afc06827189883451958d8940ed8ab6dd491f602611fe98a6fba --cloud-config-file=/assets/manifests/cloud-provider-config.yaml --cluster-etcd-operator-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:9f7a02df3a5d91326d95e444e2e249f8205632ae986d6dccc7f007ec65c8af77
render --prefix=cluster-ingress- --output-dir=/assets/ingress-operator-manifests
/usr/bin/cluster-kube-scheduler-operator render --manifest-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:187b9d29fea1bde9f1785584b4a7bbf9a0b9f93e1323d92d138e61c861b6286c --asset-input-dir=/assets/tls --asset-output-dir=/assets/kube-scheduler-bootstrap --config-output-file=/assets/kube-scheduler-bootstrap/config
/usr/bin/cluster-kube-controller-manager-operator render --manifest-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:187b9d29fea1bde9f1785584b4a7bbf9a0b9f93e1323d92d138e61c861b6286c --asset-input-dir=/assets/tls --asset-output-dir=/assets/kube-controller-manager-bootstrap --config-output-file=/assets/kube-controller-manager-bootstrap/config --cluster-config-file=/assets/manifests/cluster-network-02-config.yml
/usr/bin/cluster-kube-apiserver-operator render --manifest-etcd-serving-ca=etcd-ca-bundle.crt --manifest-etcd-server-urls=https://localhost:2379 --manifest-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:187b9d29fea1bde9f1785584b4a7bbf9a0b9f93e1323d92d138e61c861b6286c --manifest-operator-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:718ca346d5499cccb4de98c1f858c9a9a13bbf429624226f466c3ee2c14ebf40 --asset-input-dir=/assets/tls --asset-output-dir=/assets/kube-apiserver-bootstrap --config-output-file=/assets/kube-apiserver-bootstrap/config --cluster-config-file=/assets/manifests/cluster-network-02-config.yml
/usr/bin/cluster-config-operator render --config-output-file=/assets/config-bootstrap/config --asset-input-dir=/assets/tls --asset-output-dir=/assets/config-bootstrap
/usr/bin/cluster-etcd-operator render --etcd-ca=/assets/tls/etcd-ca-bundle.crt --etcd-metric-ca=/assets/tls/etcd-metric-ca-bundle.crt --manifest-etcd-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:aba3c59eb6d088d61b268f83b034230b3396ce67da4f6f6d49201e55efebc6b2 --etcd-discovery-domain=test.example.com --manifest-cluster-etcd-operator-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:9f7a02df3a5d91326d95e444e2e249f8205632ae986d6dccc7f007ec65c8af77 --manifest-setup-etcd-env-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:31dfdca3584982ed5a82d3017322b7d65a491ab25080c427f3f07d9ce93c52e2 --manifest-kube-client-agent-image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:8eb481214103d8e0b5fe982ffd682f838b969c8ff7d4f3ed4f83d4a444fb841b --asset-input-dir=/assets/tls --asset-output-dir=/assets/etcd-bootstrap --config-output-file=/assets/etcd-bootstrap/config --cluster-config-file=/assets/manifests/cluster-network-02-config.yml
render --output-dir=/assets/cvo-bootstrap --release-image=registry.openshift4.example.com/ocp4/openshift4@sha256:4a461dc23a9d323c8bd7a8631bed078a9e5eec690ce073f78b645c83fb4cdf74
/usr/bin/grep -oP Managed /manifests/0000_12_etcd-operator_01_operator.cr.yaml
```

```bash
$ crictl pods

POD ID              CREATED             STATE               NAME                                                                  NAMESPACE                             ATTEMPT
17a978b9e7b1e       3 minutes ago       Ready               bootstrap-kube-apiserver-bootstrap.openshift4.example.com             kube-system                           24
8a0f79f38787a       3 minutes ago       Ready               bootstrap-kube-scheduler-bootstrap.openshift4.example.com             kube-system                           4
1a707da797173       3 minutes ago       Ready               bootstrap-kube-controller-manager-bootstrap.openshift4.example.com    kube-system                           4
0461d2caa2753       3 minutes ago       Ready               cloud-credential-operator-bootstrap.openshift4.example.com            openshift-cloud-credential-operator   4
ab6519286f65a       3 minutes ago       Ready               bootstrap-cluster-version-operator-bootstrap.openshift4.example.com   openshift-cluster-version             2
457a7a46ec486       8 hours ago         Ready               bootstrap-machine-config-operator-bootstrap.openshift4.example.com    default                               0
e4df49b4d36a1       8 hours ago         Ready               etcd-bootstrap-member-bootstrap.openshift4.example.com                openshift-etcd                        0
```

如果验证无问题，则可以一边继续下面的步骤一边观察日志：`journalctl -b -f -u bootkube.service`

{{< alert >}}
RHCOS 的默认用户是 `core`，如果想获取 root 权限，可以执行命令 `sudo su`（不需要输入密码）。
{{< /alert >}}

### Master

控制节点和之前类似，先创建虚拟机，然后修改引导参数，引导参数调整为：

```bash
ip=192.168.57.62::192.168.57.1:255.255.255.0:master1.openshift4.example.com:ens192:none nameserver=192.168.57.60 coreos.inst.install_dev=sda coreos.inst.image_url=http://192.168.57.60:8080/install/rhcos-4.4.3-x86_64-metal.x86_64.raw.gz coreos.inst.ignition_url=http://192.168.57.60:8080/ignition/master.ign 
```

控制节点安装成功后会重启一次，之后同样可以从基础节点通过 SSH 密钥登录。

然后重复相同的步骤创建其他两台控制节点，注意修改引导参数（IP 和主机名）。先不急着创建计算节点，先在基础节点执行以下命令完成生产控制平面的创建：

```bash
$ openshift-install --dir=/ocpinstall wait-for bootstrap-complete --log-level=debug

DEBUG OpenShift Installer 4.4.5
DEBUG Built from commit 15eac3785998a5bc250c9f72101a4a9cb767e494
INFO Waiting up to 20m0s for the Kubernetes API at https://api.openshift4.example.com:6443...
INFO API v1.17.1 up
INFO Waiting up to 40m0s for bootstrapping to complete...
DEBUG Bootstrap status: complete
INFO It is now safe to remove the bootstrap resources
```

待出现 `It is now safe to remove the bootstrap resources` 提示之后，从负载均衡器中删除引导主机，本文使用的是 Envoy，只需从 `cds.yaml` 中删除引导主机的 endpoint，然后重新加载就好了。

观察引导节点的日志：

```bash
$ journalctl -b -f -u bootkube.service

...
Jun 05 00:24:12 bootstrap.openshift4.example.com bootkube.sh[12571]: I0605 00:24:12.108179       1 waitforceo.go:67] waiting on condition EtcdRunningInCluster in etcd CR /cluster to be True.
Jun 05 00:24:21 bootstrap.openshift4.example.com bootkube.sh[12571]: I0605 00:24:21.595680       1 waitforceo.go:67] waiting on condition EtcdRunningInCluster in etcd CR /cluster to be True.
Jun 05 00:24:26 bootstrap.openshift4.example.com bootkube.sh[12571]: I0605 00:24:26.250214       1 waitforceo.go:67] waiting on condition EtcdRunningInCluster in etcd CR /cluster to be True.
Jun 05 00:24:26 bootstrap.openshift4.example.com bootkube.sh[12571]: I0605 00:24:26.306421       1 waitforceo.go:67] waiting on condition EtcdRunningInCluster in etcd CR /cluster to be True.
Jun 05 00:24:29 bootstrap.openshift4.example.com bootkube.sh[12571]: I0605 00:24:29.097072       1 waitforceo.go:64] Cluster etcd operator bootstrapped successfully
Jun 05 00:24:29 bootstrap.openshift4.example.com bootkube.sh[12571]: I0605 00:24:29.097306       1 waitforceo.go:58] cluster-etcd-operator bootstrap etcd
Jun 05 00:24:29 bootstrap.openshift4.example.com podman[16531]: 2020-06-05 00:24:29.120864426 +0000 UTC m=+17.965364064 container died 77971b6ca31755a89b279fab6f9c04828c4614161c2e678c7cba48348e684517 (image=quay.io/openshift-release-dev/ocp-v4.0-art-dev@sha256:9f7a02df3a5d91326d95e444e2e249f8205632ae986d6dccc7f007ec65c8af77, name=recursing_cerf)
Jun 05 00:24:29 bootstrap.openshift4.example.com bootkube.sh[12571]: bootkube.service complete
```

### Worker

计算节点和之前类似，先创建虚拟机，然后修改引导参数，引导参数调整为：

```bash
ip=192.168.57.65::192.168.57.1:255.255.255.0:worker1.openshift4.example.com:ens192:none nameserver=192.168.57.60 coreos.inst.install_dev=sda coreos.inst.image_url=http://192.168.57.60:8080/install/rhcos-4.4.3-x86_64-metal.x86_64.raw.gz coreos.inst.ignition_url=http://192.168.57.60:8080/ignition/worker.ign 
```

计算节点安装成功后也会重启一次，之后同样可以从基础节点通过 SSH 密钥登录。

然后重复相同的步骤创建其他计算节点，注意修改引导参数（IP 和主机名）。

### 登录集群

可以通过导出集群 kubeconfig 文件以默认系统用户身份登录到集群。kubeconfig 文件包含有关 CLI 用于将客户端连接到正确的集群和 API Server 的集群信息，该文件在 OCP 安装期间被创建。

```bash
$ mkdir ~/.kube
$ cp /ocpinstall/auth/kubeconfig ~/.kube/config
$ oc whoami
system:admin
```

### 批准 CSR

将节点添加到集群时，会为添加的每台节点生成**两个**待处理证书签名请求（CSR）。必须确认这些 CSR 已获得批准，或者在必要时自行批准。

```bash
$ oc get node

NAME                             STATUS   ROLES           AGE     VERSION
master1.openshift4.example.com   Ready    master,worker   6h25m   v1.17.1
master2.openshift4.example.com   Ready    master,worker   6h39m   v1.17.1
master3.openshift4.example.com   Ready    master,worker   6h15m   v1.17.1
worker1.openshift4.example.com   NotReady worker          5h8m    v1.17.1
worker2.openshift4.example.com   NotReady worker          5h9m    v1.17.1
```

输出列出了创建的所有节点。查看挂起的证书签名请求（CSR），并确保添加到集群的每台节点都能看到具有 `Pending` 或 `Approved` 状态的客户端和服务端请求。针对 Pending 状态的 CSR 批准请求：

```bash
$ oc adm certificate approve xxx
```

或者执行以下命令批准所有 CSR：

```bash
$ oc get csr -ojson | jq -r '.items[] | select(.status == {} ) | .metadata.name' | xargs oc adm certificate approve
```

### Operator 自动初始化

控制平面初始化后，需要确认所有的 `Operator` 都处于可用的状态，即确认所有 Operator 的 `Available` 字段值皆为 `True`：

```bash
$ oc get clusteroperators

NAME                                       VERSION   AVAILABLE   PROGRESSING   DEGRADED   SINCE
authentication                             4.4.5     True        False         False      150m
cloud-credential                           4.4.5     True        False         False      7h7m
cluster-autoscaler                         4.4.5     True        False         False      6h12m
console                                    4.4.5     True        False         False      150m
csi-snapshot-controller                    4.4.5     True        False         False      6h13m
dns                                        4.4.5     True        False         False      6h37m
etcd                                       4.4.5     True        False         False      6h19m
image-registry                             4.4.5     True        False         False      6h12m
ingress                                    4.4.5     True        False         False      150m
insights                                   4.4.5     True        False         False      6h13m
kube-apiserver                             4.4.5     True        False         False      6h15m
kube-controller-manager                    4.4.5     True        False         False      6h36m
kube-scheduler                             4.4.5     True        False         False      6h36m
kube-storage-version-migrator              4.4.5     True        False         False      6h36m
machine-api                                4.4.5     True        False         False      6h37m
machine-config                             4.4.5     True        False         False      6h36m
marketplace                                4.4.5     True        False         False      6h12m
monitoring                                 4.4.5     True        False         False      6h6m
network                                    4.4.5     True        False         False      6h39m
node-tuning                                4.4.5     True        False         False      6h38m
openshift-apiserver                        4.4.5     True        False         False      6h14m
openshift-controller-manager               4.4.5     True        False         False      6h12m
openshift-samples                          4.4.5     True        False         False      6h11m
operator-lifecycle-manager                 4.4.5     True        False         False      6h37m
operator-lifecycle-manager-catalog         4.4.5     True        False         False      6h37m
operator-lifecycle-manager-packageserver   4.4.5     True        False         False      6h15m
service-ca                                 4.4.5     True        False         False      6h38m
service-catalog-apiserver                  4.4.5     True        False         False      6h38m
service-catalog-controller-manager         4.4.5     True        False         False      6h39m
storage                                    4.4.5     True        False         False      6h12m
```

如果 Operator 不正常，需要进行问题诊断和修复。

### 完成安装

最后一步，完成集群的安装，执行以下命令：

```bash
$ openshift-install --dir=/ocpinstall wait-for install-complete --log-level=debug
```

注意最后提示访问 `Web Console` 的网址及用户密码。如果密码忘了也没关系，可以查看文件 `/ocpinstall/auth/kubeadmin-password` 来获得密码。

本地访问 Web Console，需要添加 hosts：

```bash
192.168.57.60 console-openshift-console.apps.openshift4.example.com
192.168.57.60 oauth-openshift.apps.openshift4.example.com
```

浏览器访问 `https://console-openshift-console.apps.openshift4.example.com`，输入上面输出的用户名密码登录。首次登录后会提示：

```bash
You are logged in as a temporary administrative user. Update the Cluster OAuth configuration to allow others to log in.
```

我们可以通过 htpasswd 自定义管理员账号，步骤如下：

① `htpasswd -c -B -b users.htpasswd admin xxxxx`

② 将 `users.htpasswd` 文件下载到本地。

③ 在 Web Console 页面打开 `Global Configuration`：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200605150947.png)

然后找到 `OAuth`，点击进入，然后添加 `HTPasswd` 类型的 `Identity Providers`，并上传 `users.htpasswd` 文件。

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200605151307.png)

④ 退出当前用户，注意要退出到如下界面：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200605151646.png)

选择 `htpasswd`，然后输入之前创建的用户名密码登录。

如果退出后出现的就是用户密码输入窗口，实际还是 `kube:admin` 的校验，如果未出现如上提示，可以手动输入 Web Console 地址来自动跳转。

⑤ 登录后貌似能看到 `Administrator` 菜单项，但访问如 `OAuth Details` 仍然提示：

```bash
oauths.config.openshift.io "cluster" is forbidden: User "admin" cannot get resource "oauths" in API group "config.openshift.io" at the cluster scope
```

因此需要授予集群管理员权限：

```bash
$ oc adm policy add-cluster-role-to-user cluster-admin admin
```

Web Console 部分截图：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200605152528.png)

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200605152729.png)

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200605152911.png)

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200605153048.png)

如果想删除默认账号，可以执行以下命令：

```bash
$ oc -n kube-system delete secrets kubeadmin
```

## 8. 参考资料

+ [OpenShift 4.2 vSphere Install with Static IPs](https://www.openshift.com/blog/openshift-4-2-vsphere-install-with-static-ips)
+ [OpenShift Container Platform 4.3部署实录](https://blog.csdn.net/scwang18/article/details/104222408)
+ [Chapter 1. Installing on bare metal](https://access.redhat.com/documentation/en-us/openshift_container_platform/4.4/html/installing_on_bare_metal/installing-on-bare-metal)

