---
keywords:
- WireGuard
- wg
- full mesh
- wg-gen-web
title: "Wireguard 全互联模式（full mesh）配置指南"
date: 2021-02-23T15:58:00+08:00
lastmod: 2021-02-25T17:50:00+08:00
description: 本文详述了 WireGuard 全互联模式的架构及其配置方法。
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
img: https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@master/img/20200704105149.png
---

上篇文章给大家介绍了如何[使用 wg-gen-web 来方便快捷地管理 WireGuard 的配置和秘钥](/posts/configure-wireguard-using-wg-gen-web/)，文末埋了两个坑：一个是 `WireGuard` 的全互联模式（full mesh），另一个是使用 WireGuard 作为 `Kubernetes` 的 CNI 插件。今天就来填第一个坑。

首先解释一下什么是全互联模式（full mesh），全互联模式其实就是一种网络连接形式，即所有结点之间都直接连接，不会通过第三方节点中转流量。和前面提到的[点对多点架构](/posts/why-not-why-not-wireguard/#7-wireguard-真的很快吗) 其实是一个意思。

## 1. 全互联模式架构与配置

在 WireGuard 的世界里没有 Server 和 Client 之分，所有的节点都是 `Peer`。大家使用 WireGuard 的常规做法是找一个节点作为中转节点，也就是 VPN 网关，然后所有的节点都和这个网关进行连接，所有节点之间都通过这个网关来进行通信。这种架构中，为了方便理解，我们可以把网关看成 Server，其他的节点看成 Client，但实际上是不区分 Server 和 Client 的。

举个例子，假设有 `4` 个节点，分别是 A/B/C/D，且这 4 个节点都不在同一个局域网，常规的做法是选取一个节点作为 VPN 网关，架构如图：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210223233520.png)

这种架构的缺点我在之前的文章里也介绍过了，缺点相当明显：

- 当 Peer 越来越多时，VPN 网关就会变成垂直扩展的瓶颈。
- 通过 VPN 网关转发流量的成本很高，毕竟云服务器的流量很贵。
- 通过 VPN 网关转发流量会带来很高的延迟。

那么全互联模式是什么样的架构呢？还是假设有 A/B/C/D 四个节点，每个节点都和其他节点建立 WireGuard 隧道，架构如图：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210224111030.png)

这种架构带来的直接优势就是快！任意一个 Peer 和其他所有 Peer 都是直连，无需中转流量。那么在 WireGuard 的场景下如何实现全互联模式呢？其实这个问题不难，难点在于配置的繁琐程度，本文的主要目标就是精简 WireGuard 全互联模式的配置流程。为了让大家更容易理解，咱们还是先通过架构图来体现各个 Peer 的配置：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210224141416.png)

配置一目了然，每个 Peer 和其他所有 Peer 都是直连，根本没有 VPN 网关这种角色。当然，现实世界的状况没有图中这么简单，有些 Peer 是没有公网 IP 的，躲在 NAT 后面，这里又分两种情况：

1. NAT 受自己控制。这种情况可以在公网出口设置端口转发，其他 Peer 就可以通过这个公网 IP 和端口连接当前 Peer。如果公网 IP 是动态的，可以通过 DDNS 来解决，但 DDNS 会出现一些小问题，解决方法可以参考 [WireGuard 的优化](/posts/configure-wireguard-using-wg-gen-web/#动态-ip)。
2. NAT 不受自己控制。这种情况无法在公网出口设置端口转发，只能通过 UDP 打洞来实现互联，具体可以参考 [WireGuard 教程：使用 DNS-SD 进行 NAT-to-NAT 穿透](/posts/wireguard-endpoint-discovery-nat-traversal/)。

**接着上述方案再更进一步，打通所有 Peer 的私有网段，让任意一个 Peer 可以访问其他所有 Peer 的私有网段的机器**。上述配置只是初步完成了全互联，让每个 Peer 可以相互访问彼此而已，要想相互访问私有网段，还得继续增加配置，还是直接看图：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210224150109.png)

红色字体部分就是新增的配置，表示允许访问相应 Peer 的私有网段，就是这么简单。详细的配置步骤请看下一节。

## 2. 全互联模式最佳实践

对如何配置有了清晰的思路之后，接下来就可以进入实践环节了。我不打算从 WireGuard 安装开始讲起，而是以前几篇文章为基础添砖加瓦。所以我建议读者先按顺序看下这两篇文章：

+ [WireGuard 快速安装教程](/posts/wireguard-install/)
+ [WireGuard 配置教程：使用 wg-gen-web 来管理 WireGuard 的配置](/posts/configure-wireguard-using-wg-gen-web/)

咱们直接从配置开始说起。手撸配置的做法是不明智的，因为当节点增多之后工作量会很大，我还是建议通过图形化界面来管理配置，首选 [wg-gen-web](/posts/configure-wireguard-using-wg-gen-web/)。

现在还是假设有上节所述的 4 个 Peer，我们需要从中挑选一个 Peer 来安装 `wg-gen-web`，然后通过 `wg-gen-web` 来生成配置。挑选哪个 Peer 无所谓，这个没有特殊限制，这里假设挑选 `AWS` 来安装 `wg-gen-web`。

安装的步骤直接略过，不是本文的重点，不清楚的可以阅读我之前的文章 [WireGuard 配置教程：使用 wg-gen-web 来管理 WireGuard 的配置](/posts/configure-wireguard-using-wg-gen-web/)。Server 配置如图：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210224161202.png)

生成 `Azure` 的配置：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210224154416.png)

SUBMIT 之后再点击 `EDIT`，添加私有网段：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210303003000.png)

查看 `wg0.conf` 的内容：

```bash
$ cat /etc/wireguard/wg0.conf

# Updated: 2021-02-24 07:34:23.805535396 +0000 UTC / Created: 2021-02-24 07:24:02.208816462 +0000 UTC
[Interface]
Address = 10.0.0.1/24
ListenPort = 51820
PrivateKey = eEnHKGkGksx0jqrEDogjRj5l417BrEA39lr7WW9L9U0=

PreUp = echo WireGuard PreUp
PostUp = iptables -I FORWARD -i wg0 -j ACCEPT; iptables -I FORWARD -o wg0 -j ACCEPT; iptables -I INPUT -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PreDown = echo WireGuard PreDown
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT; iptables -D INPUT -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
# Azure /  / Updated: 2021-02-24 07:43:52.717385042 +0000 UTC / Created: 2021-02-24 07:43:52.717385042 +0000 UTC
[Peer]
PublicKey = OzdH42suuOpVY5wxPrxM+rEAyEPFg2eL0ZI29N7eSTY=
PresharedKey = 1SyJuVp16Puh8Spyl81EgD9PJZGoTLJ2mOccs2UWDvs=
AllowedIPs = 10.0.0.2/32, 192.168.20.0/24
```

下载 Azure 配置文件：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210303003624.png)

可以看到配置文件内容为：

```bash
$ cat Azure.conf

[Interface]
Address = 10.0.0.2/32, 192.168.20.0/24
PrivateKey = IFhAyIWY7sZmabsqDDESj9fqoniE/uZFNIvAfYHjN2o=


[Peer]
PublicKey = JgvmQFmhUtUoS3xFMFwEgP3L1Wnd8hJc3laJ90Gwzko=
PresharedKey = 1SyJuVp16Puh8Spyl81EgD9PJZGoTLJ2mOccs2UWDvs=
AllowedIPs = 10.0.0.1/32, 192.168.10.0/24
Endpoint = aws.com:51820
```

先不急着修改，一鼓作气生成所有 Peer 的配置文件：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210303003858.png)

这时你会发现 `wg0.conf` 中已经包含了所有 Peer 的配置：

```bash
$ cat /etc/wireguard/wg0.conf

# Updated: 2021-02-24 07:57:00.745287945 +0000 UTC / Created: 2021-02-24 07:24:02.208816462 +0000 UTC
[Interface]
Address = 10.0.0.1/24
ListenPort = 51820
PrivateKey = eEnHKGkGksx0jqrEDogjRj5l417BrEA39lr7WW9L9U0=

PreUp = echo WireGuard PreUp
PostUp = iptables -I FORWARD -i wg0 -j ACCEPT; iptables -I FORWARD -o wg0 -j ACCEPT; iptables -I INPUT -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PreDown = echo WireGuard PreDown
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT; iptables -D INPUT -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
# Aliyun /  / Updated: 2021-02-24 07:57:45.941019829 +0000 UTC / Created: 2021-02-24 07:57:45.941019829 +0000 UTC
[Peer]
PublicKey = kVq2ATMTckCKEJFF4TM3QYibxzlh+b9CV4GZ4meQYAo=
PresharedKey = v818B5etpRlyVYHGUrv9abM5AIQK5xeoCizdWj1AqcE=
AllowedIPs = 10.0.0.4/32, 192.168.40.0/24

# GCP /  / Updated: 2021-02-24 07:57:27.3555646 +0000 UTC / Created: 2021-02-24 07:57:27.3555646 +0000 UTC
[Peer]
PublicKey = qn0Xfyzs6bLKgKcfXwcSt91DUxSbtATDIfe4xwsnsGg=
PresharedKey = T5UsVvOEYwfMJQDJudC2ryKeCpnO3RV8GFMoi76ayyI=
AllowedIPs = 10.0.0.3/32, 192.168.30.0/24

# Azure /  / Updated: 2021-02-24 07:57:00.751653134 +0000 UTC / Created: 2021-02-24 07:43:52.717385042 +0000 UTC
[Peer]
PublicKey = OzdH42suuOpVY5wxPrxM+rEAyEPFg2eL0ZI29N7eSTY=
PresharedKey = 1SyJuVp16Puh8Spyl81EgD9PJZGoTLJ2mOccs2UWDvs=
AllowedIPs = 10.0.0.2/32, 192.168.20.0/24
```

现在问题就好办了，我们只需将 `wg0.conf` 中的 Aliyun 和 GCP 部分的配置拷贝到 `Azure` 的配置中，并删除 `PresharedKey` 的配置，再添加 `Endpoint` 的配置和 `PostUP/PostDown` 规则，**最后别忘了删除 `Address` 中的私有网段**：

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
AllowedIPs = 10.0.0.1/32, 192.168.10.0/24
Endpoint = aws.com:51820

# Aliyun /  / Updated: 2021-02-24 07:57:45.941019829 +0000 UTC / Created: 2021-02-24 07:57:45.941019829 +0000 UTC
[Peer]
PublicKey = kVq2ATMTckCKEJFF4TM3QYibxzlh+b9CV4GZ4meQYAo=
AllowedIPs = 10.0.0.4/32, 192.168.40.0/24
Endpoint = aliyun.com:51820

# GCP /  / Updated: 2021-02-24 07:57:27.3555646 +0000 UTC / Created: 2021-02-24 07:57:27.3555646 +0000 UTC
[Peer]
PublicKey = qn0Xfyzs6bLKgKcfXwcSt91DUxSbtATDIfe4xwsnsGg=
AllowedIPs = 10.0.0.3/32, 192.168.30.0/24
Endpoint = gcp.com:51820
```

同理，GCP 的配置如下：

```bash
$ cat GCP.conf

[Interface]
Address = 10.0.0.3/32
PrivateKey = oK2gIMBAob67Amj2gT+wR9pzkbqWGNtq794nOoD3i2o=

PostUp = iptables -I FORWARD -i wg0 -j ACCEPT; iptables -I FORWARD -o wg0 -j ACCEPT; iptables -I INPUT -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT; iptables -D INPUT -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE


[Peer]
PublicKey = JgvmQFmhUtUoS3xFMFwEgP3L1Wnd8hJc3laJ90Gwzko=
PresharedKey = T5UsVvOEYwfMJQDJudC2ryKeCpnO3RV8GFMoi76ayyI=
AllowedIPs = 10.0.0.1/32, 192.168.10.0/24
Endpoint = aws.com:51820

# Aliyun /  / Updated: 2021-02-24 07:57:45.941019829 +0000 UTC / Created: 2021-02-24 07:57:45.941019829 +0000 UTC
[Peer]
PublicKey = kVq2ATMTckCKEJFF4TM3QYibxzlh+b9CV4GZ4meQYAo=
AllowedIPs = 10.0.0.4/32, 192.168.40.0/24
Endpoint = aliyun.com:51820

# Azure /  / Updated: 2021-02-24 07:57:00.751653134 +0000 UTC / Created: 2021-02-24 07:43:52.717385042 +0000 UTC
[Peer]
PublicKey = OzdH42suuOpVY5wxPrxM+rEAyEPFg2eL0ZI29N7eSTY=
AllowedIPs = 10.0.0.2/32, 192.168.20.0/24
Endpoint = azure.com:51820
```

Aliyun 的配置如下：

```bash
$ cat Aliyun.conf

[Interface]
Address = 10.0.0.4/32
PrivateKey = +A1ZESJjmHuskB4yKqTcqC3CB24TwBKHGSffWDHxI28=

PostUp = iptables -I FORWARD -i wg0 -j ACCEPT; iptables -I FORWARD -o wg0 -j ACCEPT; iptables -I INPUT -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT; iptables -D INPUT -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE


[Peer]
PublicKey = JgvmQFmhUtUoS3xFMFwEgP3L1Wnd8hJc3laJ90Gwzko=
PresharedKey = v818B5etpRlyVYHGUrv9abM5AIQK5xeoCizdWj1AqcE=
AllowedIPs = 10.0.0.1/32, 192.168.10.0/24
Endpoint = aws.com:51820

# GCP /  / Updated: 2021-02-24 07:57:27.3555646 +0000 UTC / Created: 2021-02-24 07:57:27.3555646 +0000 UTC
[Peer]
PublicKey = qn0Xfyzs6bLKgKcfXwcSt91DUxSbtATDIfe4xwsnsGg=
AllowedIPs = 10.0.0.3/32, 192.168.30.0/24
Endpoint = gcp.com:51820

# Azure /  / Updated: 2021-02-24 07:57:00.751653134 +0000 UTC / Created: 2021-02-24 07:43:52.717385042 +0000 UTC
[Peer]
PublicKey = OzdH42suuOpVY5wxPrxM+rEAyEPFg2eL0ZI29N7eSTY=
AllowedIPs = 10.0.0.2/32, 192.168.20.0/24
Endpoint = azure.com:51820
```

最后在各自的节点上通过各自的配置文件把 WireGuard 跑起来，就搞定了。

整个图形化界面配置过程中不需要手动调整配置，功能还是比较完善的，**只有客户端的配置需要手动调整**。如果你无法接受手动调整配置，可以尝试另外一个项目：[wg-meshconf](https://github.com/k4yt3x/wg-meshconf/blob/master/README.md)，这个项目专门用来生成 mesh 的配置，但没有图形化管理界面。各有利弊吧，大家自行选择。

## 3. 总结

我知道，很多人可能还是一头雾水，这玩意儿的应用场景有哪些？我随便举个简单的例子，假设你在云服务器上部署了 Kubernetes 集群，可以用本地的机器和云服务器的某台节点组建 WireGuard 隧道，然后在本地的 `AllowedIPs` 中加上 Pod 网段和 Service 网段，就可以那啥了，你懂吧？

好吧，又埋了一个坑，关于如何在家中直接访问云服务器 k8s 集群的 Pod IP 和 Service IP，后面会有专门的文章给大家讲解，虽然我也不确定是多久以后。。