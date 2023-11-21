---
keywords:
- kilo
- WireGuard
- kubernetes
- mesh
title: "Kilo 使用教程"
subtitle: "使用 WireGuard 作为 Kubernetes 的 CNI 插件"
date: 2021-02-27T11:57:17+08:00
lastmod: 2021-02-27T11:57:17+08:00
description: 本文介绍了 Kilo 的网络架构和部署方法，并给出了打通本地与云上 Kubernetes 集群容器网络的解决方案。
draft: false 
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- WireGuard
categories: Network
img: https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210301162243.png
---

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210301162029.png)

写了这么多篇 `WireGuard` 相关的保姆教程，今天终于牵扯到 `Kubernetes` 了，不然怎么对得起“云原生”这三个字。如果看到这篇文章的你仍然是个 `WireGuard` 新手，请务必按照以下顺序阅读每一篇文章：

+ [WireGuard 教程：WireGuard 的工作原理](https://icloudnative.io/posts/wireguard-docs-theory/)
+ [WireGuard 快速安装教程](https://icloudnative.io/posts/wireguard-install/)
+ [WireGuard 配置教程：使用 wg-gen-web 来管理 WireGuard 的配置](https://icloudnative.io/posts/configure-wireguard-using-wg-gen-web/)
+ [Wireguard 全互联模式（full mesh）配置指南](https://icloudnative.io/posts/wireguard-full-mesh/)

如果遇到不明白的，可以参考这篇文章的注解：

+ [WireGuard 教程：WireGuard 的搭建使用与配置详解](https://icloudnative.io/posts/wireguard-docs-practice/)

剩下这几篇文章是可选的，有兴趣就看看：

+ [我为什么不鼓吹 WireGuard](https://icloudnative.io/posts/why-not-wireguard/)
+ [Why not "Why not WireGuard?"](https://icloudnative.io/posts/why-not-why-not-wireguard/)
+ [WireGuard 教程：使用 DNS-SD 进行 NAT-to-NAT 穿透](https://icloudnative.io/posts/wireguard-endpoint-discovery-nat-traversal/)

WireGuard 在云原生领域的应用有两个方面：**组网**和**加密**。不管是组网还是加密，其实都是和 `CNI` 有关，你可以在原有的组网方案上利用 WireGuard 进行加密，也可以直接利用 WireGuard 来进行组网。目前直接利用 WireGuard 进行组网的 CNI 有 [Flannel](https://github.com/flannel-io/flannel)、[Wormhole](https://github.com/gravitational/wormhole) 和 [Kilo](https://github.com/squat/kilo)，只利用 WireGuard 进行数据加密的 CNI 只有 [Calico](https://www.projectcalico.org/introducing-wireguard-encryption-with-calico/)，当然 `Flannel` 也可以和 `Kilo` 结合使用，这样就只利用 WireGuard 来进行加密了。

我的兴趣点还是在于利用 WireGuard 组网，想象一下，**你在 AWS、Azure、GCP 和阿里云上分别薅了一台云主机，你想将这四台云主机组建成一个 `k3s` 集群，而且在任何一个设备上都能直接访问这个 `k3s` 集群中的 `Pod IP` 和 `Service IP`，如何才能优雅地实现这个目标？**

要分两步走：第一步是打通 k3s 集群各个节点之间的容器网络，最后一步是打通本地与云上容器之间的网络。先来看第一步，跨云打通容器网络，这一步主要还是得仰仗 CNI。`Flannel` 的自定义选项比较少，`Whormhole` 已经很久没更新了，推荐使用 `Kilo` 来作为 k3s 的 `CNI`。

在部署 `Kilo` 之前，需要调整 k3s 的启动参数，取消默认的 CNI：

```bash
k3s server --flannel-backend none ...
```

然后重启 k3s server：

```bash
$ systemctl restart k3s
```

具体可以参考 [k3s 控制平面的部署](https://icloudnative.io/posts/deploy-k3s-cross-public-cloud/#4-部署控制平面)。如果你是从零开始部署 k3s，请参考[跨云厂商部署 k3s 集群](https://icloudnative.io/posts/deploy-k3s-cross-public-cloud/)。

## 1. Kilo 网络拓扑

Kilo 支持以下三种网络拓扑：

### 逻辑分组互联模式（Logical Groups）

默认情况下，Kilo 会在集群中的不同逻辑区域（例如数据中心、云服务商等）之间创建一个 mesh 网络。Kilo 默认会尝试使用节点标签 [topology.kubernetes.io/region](https://kubernetes.io/docs/reference/kubernetes-api/labels-annotations-taints/#topologykubernetesioregion) 来判断节点所在的逻辑区域，你也可以通过 Kilo 的启动参数 `--topology-label=<label>` 来指定逻辑区域的标签，还可以为 `node` 添加 `annotation` [kilo.squat.ai/location](https://github.com/squat/kilo/blob/main/docs/annotations.md#location) 来指定逻辑区域的标签。

例如，为了将 `GCP` 和 `AWS` 的节点加入到同一个 k3s 集群中，可以通过以下命令对所有 `GCP` 的节点添加注释：

```bash
$ for node in $(kubectl get nodes | grep -i gcp | awk '{print $1}'); do kubectl annotate node $node kilo.squat.ai/location="gcp"; done
```

这样所有添加了注释的节点都会被划分到同一个逻辑区域下，没有添加注释的节点会被划分到默认的逻辑区域下，所以总共有两个逻辑区域。每个逻辑区域都会选出一个 `leader` 和其他区域的 `leader` 之间建立 `WireGuard` 隧道，同时区域内部的节点之间通过 `Bridge` 模式打通容器的网络。

通过 [kgctl](https://github.com/squat/kilo/blob/main/docs/kgctl.md) 可以获取网络拓扑架构图：

```bash
$ kgctl graph | circo -Tsvg > cluster.svg
```

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/location.svg)

### 全互联模式（Full Mesh）

**全互联模式**其实就是**逻辑分组互联模式**的特例，即每一个节点都是一个逻辑区域，每个节点和其他所有节点都建立 WireGuard 隧道。关于全互联模式的更多详细内容请参考 [Wireguard 全互联模式（full mesh）配置指南](https://icloudnative.io/posts/wireguard-full-mesh/)。可以通过 Kilo 的启动参数 `--mesh-granularity=full` 来指定全互联模式。

通过 [kgctl](https://github.com/squat/kilo/blob/main/docs/kgctl.md) 可以获取网络拓扑架构图：

```bash
$ kgctl graph | circo -Tsvg > cluster.svg
```

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/full-mesh.svg)

### 混合模式

**混合模式**就是**逻辑分组模式**和**全互联模式**相结合，例如，如果集群中既有 GCP 的节点，还有一些无安全私有网段的裸金属节点，可以把 GCP 的节点放到同一个逻辑区域中，其他裸金属节点之间直接使用全互联模式连接，这就是**混合模式**。具体的操作方式是给 GCP 节点添加同一个 `annotation`，其他裸金属节点都添加相互独立的 `annotation`：

```bash
$ for node in $(kubectl get nodes | grep -i gcp | awk '{print $1}'); do kubectl annotate node $node kilo.squat.ai/location="gcp"; done
$ for node in $(kubectl get nodes | tail -n +2 | grep -v gcp | awk '{print $1}'); do kubectl annotate node $node kilo.squat.ai/location="$node"; done
```

通过 [kgctl](https://github.com/squat/kilo/blob/main/docs/kgctl.md) 获取网络拓扑架构图：

```bash
$ kgctl graph | circo -Tsvg > cluster.svg
```

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/mixed.svg)

如果集群中还包含 `AWS` 节点，可以这么添加 annotation：

```bash
$ for node in $(kubectl get nodes | grep -i aws | awk '{print $1}'); do kubectl annotate node $node kilo.squat.ai/location="aws"; done
$ for node in $(kubectl get nodes | grep -i gcp | awk '{print $1}'); do kubectl annotate node $node kilo.squat.ai/location="gcp"; done
$ for node in $(kubectl get nodes | tail -n +2 | grep -v aws | grep -v gcp | awk '{print $1}'); do kubectl annotate node $node kilo.squat.ai/location="$node"; done
```

网络拓扑架构图如下：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/complex.svg)

## 2. Kilo 部署

如果你用的是国内的云主机，一般都绑定了 `IP` 地址和 `MAC` 地址，也无法关闭源地址检测，无法使用 `Bridge` 模式，也就无法使用 Kilo 的**逻辑分组互联模式**，只能使用**全互联模式**。如果集群中还包含了数据中心，数据中心的节点之间是可以使用 `Bridge` 模式的，可以给数据中心的节点添加相同的 `annotation`，其他节点添加各不相同的 `annotation`。

我的节点都是国内公有云节点，无法使用逻辑分组互联模式，只能使用全互联模式。本节就以全互联模式为例，演示如何部署 `Kilo`。

Kilo 需要用到 `kubeconfig`，所以需要提前将 `kubeconfig` 文件从 Master 拷贝到所有 Node：

```bash
$ scp -r /etc/rancher/k3s/ nodexxx:/etc/rancher/k3s/
```

修改 `kubeconfig` 文件，将 `API Server` 的地址改为 Master 的公网地址：

```yaml
apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: *******
    server: https://<MASTER_PUBLIC_IP>:6443
  name: default
...
...
```

给每个节点添加相关的 annotaion：

```bash
# 指定 WireGuard 建立隧道的 Endpoint 公网 IP:Port
$ kubectl annotate nodes xxx kilo.squat.ai/force-endpoint=<Public_IP:Port>

# 指定节点的内网 IP，WireGuard 会将其添加到 allowed ips 中，这样可以打通各个节点的内网 IP
$ kubectl annotate nodes xxx kilo.squat.ai/force-internal-ip=<Private_IP>
```

克隆 Kilo 的官方仓库，进入部署清单目录：

```bash
$ git clone https://github.com/squat/kilo
$ cd kilo/manifests
```

修改 kilo 部署清单，调整启动参数：

```yaml
...
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: kilo
  namespace: kube-system
  labels:
    app.kubernetes.io/name: kilo
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: kilo
  template:
    metadata:
      labels:
        app.kubernetes.io/name: kilo
    spec:
      serviceAccountName: kilo
      hostNetwork: true
      containers:
      - name: kilo
        image: squat/kilo
        args:
        - --kubeconfig=/etc/kubernetes/kubeconfig
        - --hostname=$(NODE_NAME)
+       - --encapsulate=never
+       - --mesh-granularity=full
...
...
```

+ `--encapsulate=never` 表示不使用 `ipip` 协议对同一个逻辑区域内的容器网络流量进行加密。
+ `--mesh-granularity=full` 表示启用全互联模式。

使用部署清单部署 kilo：

```bash
$ kubectl apply -f kilo-k3s.yaml
```

部署成功后，每台节点会增加两个网络接口：

```bash
14: kilo0: <POINTOPOINT,NOARP,UP,LOWER_UP> mtu 1420 qdisc noqueue state UNKNOWN group default qlen 1000
    link/none
    inet 10.4.0.1/16 brd 10.4.255.255 scope global kilo0
       valid_lft forever preferred_lft forever
6: kube-bridge: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1420 qdisc noqueue state UP group default qlen 1000
    link/ether 2a:7d:32:71:75:97 brd ff:ff:ff:ff:ff:ff
    inet 10.42.0.1/24 scope global kube-bridge
       valid_lft forever preferred_lft forever
    inet6 fe80::287d:32ff:fe71:7597/64 scope link
       valid_lft forever preferred_lft forever
```

其中 `kilo0` 是 WireGuard 虚拟网络接口：

```bash
$ ip -d link show kilo0
14: kilo0: <POINTOPOINT,NOARP,UP,LOWER_UP> mtu 1420 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000
    link/none  promiscuity 0
    wireguard addrgenmode none numtxqueues 1 numrxqueues 1 gso_max_size 65536 gso_max_segs 65535
    
$ wg show kilo0
interface: kilo0
  public key: VLAjOkfb1U3/ftNOVtAjY8P3hafR12qQB05ueUJtLBQ=
  private key: (hidden)
  listening port: 51820
  
peer: JznFuu9Q7gXcfHFGRLB/LirKi8ttSX22T5f+1cWomzA=
  endpoint: xxxx:51820
  allowed ips: 10.42.1.0/24, 192.168.20.1/32, 10.4.0.2/32
  latest handshake: 51 seconds ago
  transfer: 88.91 MiB received, 76.11 MiB sent

peer: gOvNh1FHJKtfigxV1Az5OFCq2WMq3YEn2F4H4xknVFI=
  endpoint: xxxx:51820
  allowed ips: 10.42.2.0/24, 192.168.30.1/32, 10.4.0.3/32
  latest handshake: 17 seconds ago
  transfer: 40.86 MiB received, 733.03 MiB sent
...
...
```

`kube-bridge` 是本地容器网络 veth pair 所连接的 Bridge：

```bash
$ bridge link show kube-bridge
7: veth99d2f30b state UP @wg0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1420 master kube-bridge state forwarding priority 32 cost 2
8: vethfb6d487c state UP @wg0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1420 master kube-bridge state forwarding priority 32 cost 2
10: veth88ae725c state UP @wg0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1420 master kube-bridge state forwarding priority 32 cost 2
11: veth4c0d00d8 state UP @wg0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1420 master kube-bridge state forwarding priority 32 cost 2
12: veth5ae51319 state UP @wg0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1420 master kube-bridge state forwarding priority 32 cost 2
13: vethe5796697 state UP @wg0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1420 master kube-bridge state forwarding priority 32 cost 2
15: vethe169cdda state UP @wg0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1420 master kube-bridge state forwarding priority 32 cost 2
21: vethfe78e116 state UP @wg0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1420 master kube-bridge state forwarding priority 32 cost 2
```

至此 Kilo 的全互联模式就部署好了，跨公有云的各个云主机节点上的容器已经可以相互通信，下一步就是打通本地与云上容器之间的网络。

## 3. 打通本地与云上容器网络

为了便于理解，先来做个假设，假设有 4 个公有云节点，分别是 AWS、Azure、GCP、阿里云，再假设 `Service` 的子网是 `10.43.0.0/16`，`Pod` 的子网是 `10.42.0.0/16`，那么每台节点的 Pod 子网分别为 `10.42.0.0/24`、`10.42.1.0/24`、`10.42.2.0/24`、`10.42.3.0/24`。

为了和 Kubernetes 集群网络分开，需要使用一个新的网络接口 `wg0`，网络架构还是建议使用全互联模式，具体可参考 [Wireguard 全互联模式（full mesh）配置指南](https://icloudnative.io/posts/wireguard-full-mesh/)。

为了让本地客户端能访问云上的 `Pod IP`，可以让本地访问 AWS 节点的 `10.42.0.0/24`，访问 Azure 节点的  `10.42.1.0/24`，以此类推。当然也可以直接让本地访问任意一个云上节点的 `10.42.0.0/16`，不过我还是不建议使用这种架构。

至于 `Service IP`，并没有像 Pod 一样给每个节点划分一个更细粒度的子网，所有的节点都从同一个大的子网中分配，所以无法采用上面的方式，只能选择其中一个节点来集中转发本地客户端访问 `Service` 的流量，假设选择 `AWS` 的节点。

还是和之前一样，继续使用 [wg-gen-web](https://icloudnative.io/posts/configure-wireguard-using-wg-gen-web/) 来管理 WireGuard 的配置，假设使用 `AWS` 的节点来安装 wg-gen-web。

**这里有一个地方需要注意，`kilo0` 已经打通了 k3s 各个节点的私有网段，所以 `wg0` 不再需要打通私有网段，将 `k3s` 各个节点的私有网段删除即可：**

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210303111859.png)

先增加一个新配置给本地客户端使用，Allowed IPs 中新增 `10.42.0.0/24` 和 `10.43.0.0/16`，让本地客户端能访问 `AWS` 节点中的 Pod IP 和整个集群的 Service IP：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210303113317.png)

这时你会发现 `AWS` 节点中的 `wg0.conf` 中已经包含了本地客户端的配置：

```bash
$ cat /etc/wireguard/wg0.conf

...
# macOS /  / Updated: 2021-03-01 05:52:20.355083356 +0000 UTC / Created: 2021-03-01 05:52:20.355083356 +0000 UTC
[Peer]
PublicKey = CEN+s+jpMX1qzQRwbfkfYtHoJ+Hqq4APfISUkxmQ0hQ=
PresharedKey = pSAxmHb6xXRMl9667pFMLg/1cRBFDRjcVdD7PKtMP1M=
AllowedIPs = 10.0.0.5/32
...
```

修改 `Azure` 节点的 WireGuard 配置文件，添加本地客户端的配置：

```bash
$ cat Azure.conf

[Interface]
Address = 10.0.0.2/32
PrivateKey = IFhAyIWY7sZmabsqDDESj9fqoniE/uZFNIvAfYHjN2o=

PostUp = iptables -I FORWARD -i wg0 -j ACCEPT; iptables -I FORWARD -o wg0 -j ACCEPT; iptables -I INPUT -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT; iptables -D INPUT -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE


[Peer]
PublicKey = JgvmQFmhUtUoS3xFMFwEgP3L1Wnd8hJc3laJ90Gwzko=
PresharedKey = 1SyJuVp16Puh8Spyl81EgD9PJZGoTLJ2mOccs2UWDvs=
AllowedIPs = 10.0.0.1/32
Endpoint = aws.com:51820

# Aliyun /  / Updated: 2021-02-24 07:57:45.941019829 +0000 UTC / Created: 2021-02-24 07:57:45.941019829 +0000 UTC
[Peer]
PublicKey = kVq2ATMTckCKEJFF4TM3QYibxzlh+b9CV4GZ4meQYAo=
AllowedIPs = 10.0.0.4/32
Endpoint = aliyun.com:51820

# GCP /  / Updated: 2021-02-24 07:57:27.3555646 +0000 UTC / Created: 2021-02-24 07:57:27.3555646 +0000 UTC
[Peer]
PublicKey = qn0Xfyzs6bLKgKcfXwcSt91DUxSbtATDIfe4xwsnsGg=
AllowedIPs = 10.0.0.3/32
Endpoint = gcp.com:51820

# macOS /  / Updated: 2021-03-01 05:52:20.355083356 +0000 UTC / Created: 2021-03-01 05:52:20.355083356 +0000 UTC
[Peer]
PublicKey = CEN+s+jpMX1qzQRwbfkfYtHoJ+Hqq4APfISUkxmQ0hQ=
AllowedIPs = 10.0.0.5/32
```

同理，`GCP` 和 `Aliyun` 节点也要添加新增的本地客户端配置。

下载本地客户端的配置文件：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210301140145.png)

将 `AWS` 节点的 `wg0.conf` 中的 Aliyun、GCP 和 Azure 的配置拷贝到本地客户端的配置中，并删除 PresharedKey 的配置，再添加 `Endpoint` 的配置和相应的 Pod IP 所在的网段：

```bash
[Interface]
Address = 10.0.0.5/32
PrivateKey = wD595KeTPKBDneKWOTUjJQjxZ5RrlxsbeEsWL0gbyn8=


[Peer]
PublicKey = JgvmQFmhUtUoS3xFMFwEgP3L1Wnd8hJc3laJ90Gwzko=
PresharedKey = 5htJA/UoIulrgAn9tDdUxt1WYmOriCXIujBVVaz/uZI=
AllowedIPs = 10.0.0.1/32, 10.42.0.0/24, 10.43.0.0/16
Endpoint = aws.com:51820

# Aliyun /  / Updated: 2021-02-24 07:57:45.941019829 +0000 UTC / Created: 2021-02-24 07:57:45.941019829 +0000 UTC
[Peer]
PublicKey = kVq2ATMTckCKEJFF4TM3QYibxzlh+b9CV4GZ4meQYAo=
AllowedIPs = 10.0.0.4/32, 10.42.3.0/24
Endpoint = aliyun.com:51820

# GCP /  / Updated: 2021-02-24 07:57:27.3555646 +0000 UTC / Created: 2021-02-24 07:57:27.3555646 +0000 UTC
[Peer]
PublicKey = qn0Xfyzs6bLKgKcfXwcSt91DUxSbtATDIfe4xwsnsGg=
AllowedIPs = 10.0.0.3/32, 10.42.2.0/24
Endpoint = gcp.com:51820


# Azure /  / Updated: 2021-02-24 07:57:00.751653134 +0000 UTC / Created: 2021-02-24 07:43:52.717385042 +0000 UTC
[Peer]
PublicKey = OzdH42suuOpVY5wxPrxM+rEAyEPFg2eL0ZI29N7eSTY=
AllowedIPs = 10.0.0.2/32, 10.42.1.0/24
Endpoint = azure.com:51820
```

最后在本地把 WireGuard 跑起来，就可以畅游云主机的 Kubernetes 集群了。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210301142745.png)

如果你还想更进一步，在任何一个设备上都能通过 `Service` 的名称来访问 k3s 集群中的服务，就得在 `CoreDNS` 上做文章了，感兴趣的可以自己研究下。

这个坑总算填完了，`WireGuard` 系列暂时就告一段落了，后面如果发现了更有趣的玩法，我会第一时间给大家分享出来。

