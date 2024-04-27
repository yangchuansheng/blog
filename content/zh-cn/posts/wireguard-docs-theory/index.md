---
keywords:
- WireGuard
- wg
- openvpn
- bounce server
title: "WireGuard 教程：WireGuard 的工作原理"
date: 2020-07-01T11:18:32+08:00
lastmod: 2020-07-01T11:18:32+08:00
description: 本文介绍了 WireGuard 相对于其他 VPN 的优点，以及 WireGuard 的工作原理。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocLevels: ["h2", "h3", "h4"]
tags:
- WireGuard
categories:
- Network
- VPN
img: https://images.icloudnative.io/uPic/20200704105149.png
---

> 本文翻译自：[https://github.com/pirate/wireguard-docs](https://github.com/pirate/wireguard-docs)

`WireGuard` 是由 `Jason Donenfeld` 等人用 `C` 语言编写的一个开源 VPN 协议，被视为下一代 VPN 协议，旨在解决许多困扰 `IPSec/IKEv2`、`OpenVPN` 或 `L2TP` 等其他 VPN 协议的问题。它与 `Tinc` 和 `MeshBird` 等现代 VPN 产品有一些相似之处，即加密技术先进、配置简单。从 2020 年 1 月开始，它已经并入了 Linux 内核的 `5.6` 版本，这意味着大多数 Linux 发行版的用户将拥有一个开箱即用的 WireGuard。

无论你是想破墙而出，还是想在服务器之间组网，WireGuard 都不会让你失望，它就是组网的『乐高积木』，就像 ZFS 是构建文件系统的『乐高积木』一样。

WireGuard 与其他 VPN 协议的性能测试对比：

![](https://images.icloudnative.io/uPic/20200701114722.png)

可以看到 WireGuard 直接碾压其他 VPN 协议。再来说说 `OpenVPN`，大约有 10 万行代码，而 WireGuard  只有大概 `4000` 行代码，代码库相当精简，简直就是件艺术品啊。你再看看 `OpenVPN` 的性能，算了不说了。

WireGuard 优点：

+ 配置精简，可直接使用默认值
+ 只需最少的密钥管理工作，每个主机只需要 1 个公钥和 1 个私钥。
+ 就像普通的以太网接口一样，以 Linux 内核模块的形式运行，资源占用小。
+ 能够将部分流量或所有流量通过 VPN 传送到局域网内的任意主机。
+ 能够在网络故障恢复之后自动重连，戳到了其他 VPN 的痛处。
+ 比目前主流的 VPN 协议，连接速度要更快，延迟更低（见上图）。
+ 使用了更先进的加密技术，具有前向加密和抗降级攻击的能力。
+ 支持任何类型的二层网络通信，例如 `ARP`、`DHCP` 和 `ICMP`，而不仅仅是 TCP/HTTP。
+ 可以运行在主机中为容器之间提供通信，也可以运行在容器中为主机之间提供通信。

WireGuard 不能做的事：

+ 类似 gossip 协议实现网络自愈。
+ 通过信令服务器突破双重 NAT。
+ 通过中央服务器自动分配和撤销密钥。
+ 发送原始的二层以太网帧。

当然，你可以使用 WireGuard 作为底层协议来实现自己想要的功能，从而弥补上述这些缺憾。

本系列 WireGuard 教程分为两个部分，第一部分偏理论，第二部分偏实践。本文是第一部分，下面开始正文教程。

## 1. WireGuard 术语

### Peer/Node/Device

连接到 VPN 并为自己注册一个 VPN 子网地址（如 192.0.2.3）的主机。还可以通过使用逗号分隔的 CIDR 指定子网范围，为其自身地址以外的 IP 地址选择路由。

### 中继服务器（Bounce Server）

一个公网可达的对等节点，可以将流量中继到 `NAT` 后面的其他对等节点。`Bounce Server` 并不是特殊的节点，它和其他对等节点一样，唯一的区别是它有公网 IP，并且开启了内核级别的 IP 转发，可以将 VPN 的流量转发到其他客户端。

### 子网（Subnet）

一组私有 IP，例如 `192.0.2.1-255` 或 `192.168.1.1/24`，一般在 NAT 后面，例如办公室局域网或家庭网络。

### CIDR 表示法

这是一种使用掩码表示子网大小的方式，这个不用解释了。

### NAT

子网的私有 IP 地址由路由器提供，通过公网无法直接访问私有子网设备，需要通过 NAT 做网络地址转换。路由器会跟踪发出的连接，并将响应转发到正确的内部 IP。

### 公开端点（Public Endpoint）

节点的公网 IP 地址:端口，例如 `123.124.125.126:1234`，或者直接使用域名 `some.domain.tld:1234`。如果对等节点不在同一子网中，那么节点的公开端点必须使用公网 IP 地址。

### 私钥（Private key）

单个节点的 WireGuard 私钥，生成方法是：`wg genkey > example.key`。

### 公钥（Public key）

单个节点的 WireGuard 公钥，生成方式为：`wg pubkey < example.key > example.key.pub`。

### DNS

域名服务器，用于将域名解析为 VPN 客户端的 IP，不让 DNS请求泄漏到 VPN 之外。

## 2. WireGuard 工作原理

### 中继服务器工作原理

中继服务器（Bounce Server）和普通的对等节点一样，它能够在 `NAT` 后面的 VPN 客户端之间充当中继服务器，可以将收到的任何 VPN 子网流量转发到正确的对等节点。事实上 WireGuard 并不关心流量是如何转发的，这个由系统内核和 `iptables` 规则处理。

如果所有的对等节点都是公网可达的，则不需要考虑中继服务器，只有当有对等节点位于 NAT 后面时才需要考虑。

**在 WireGuard 里，客户端和服务端基本是平等的，差别只是谁主动连接谁而已**。双方都会监听一个 UDP 端口，谁主动连接，谁就是客户端。主动连接的客户端需要指定对端的公网地址和端口，被动连接的服务端不需要指定其他对等节点的地址和端口。如果客户端和服务端都位于 NAT 后面，需要加一个中继服务器，客户端和服务端都指定中继服务器作为对等节点，它们的通信流量会先进入中继服务器，然后再转发到对端。

WireGuard 是支持漫游的，也就是说，双方不管谁的地址变动了，WireGuard 在看到对方从新地址说话的时候，就会记住它的新地址（跟  mosh 一样，不过是双向的）。所以双方要是一直保持在线，并且通信足够频繁的话（比如配置 `persistent-keepalive`），两边的 IP 都不固定也不影响的。

### Wireguard 如何路由流量

利用 WireGuard 可以组建非常复杂的网络拓扑，这里主要介绍几个典型的拓扑：

① 端到端直接连接

这是最简单的拓扑，所有的节点要么在同一个局域网，要么直接通过公网访问，这样 `WireGuard` 可以直接连接到对端，不需要中继跳转。

② 一端位于 NAT 后面，另一端直接通过公网暴露

这种情况下，最简单的方案是：通过公网暴露的一端作为服务端，另一端指定服务端的公网地址和端口，然后通过 `persistent-keepalive` 选项维持长连接，让 NAT 记得对应的映射关系。

③ 两端都位于 NAT 后面，通过中继服务器连接

大多数情况下，当通信双方都在 NAT 后面的时候，NAT 会做源端口随机化处理，直接连接可能比较困难。可以加一个中继服务器，通信双方都将中继服务器作为对端，然后维持长连接，流量就会通过中继服务器进行转发。

④ 两端都位于 NAT 后面，通过 UDP NAT 打洞

上面也提到了，当通信双方都在 NAT 后面的时候，直接连接不太现实，因为大多数 NAT 路由器对源端口的随机化相当严格，不可能提前为双方协调一个固定开放的端口。必须使用一个信令服务器（`STUN`），它会在中间沟通分配给对方哪些随机源端口。通信双方都会和公共信令服务器进行初始连接，然后它记录下随机的源端口，并将其返回给客户端。这其实就是现代 P2P 网络中 `WebRTC` 的工作原理。有时候，即使有了信令服务器和两端已知的源端口，也无法直接连接，因为 NAT 路由器严格规定只接受来自原始目的地址（信令服务器）的流量，会要求新开一个随机源端口来接受来自其他 IP 的流量（比如其他客户端试图使用原来的通信源端口）。运营商级别的 NAT 就是这么干的，比如蜂窝网络和一些企业网络，它们专门用这种方法来防止打洞连接。更多细节请参考下一部分的 NAT 到 NAT 连接实践的章节。

如果某一端同时连接了多个对端，当它想访问某个 IP 时，如果有具体的路由可用，则优先使用具体的路由，否则就会将流量转发到中继服务器，然后中继服务器再根据系统路由表进行转发。你可以通过测量 ping 的时间来计算每一跳的长度，并通过检查对端的输出（`wg show wg0`）来找到 WireGuard 对一个给定地址的路由方式。

### WireGuard 报文格式

WireGuard 使用加密的 UDP 报文来封装所有的数据，UDP 不保证数据包一定能送达，也不保证按顺序到达，但隧道内的 TCP 连接可以保证数据有效交付。WireGuard 的报文格式如下图所示：

![](https://images.icloudnative.io/uPic/20200702142917.png)

关于 WireGuard 报文的更多信息可以参考下面几篇文档：

+ [wireshark.org/docs/dfref/w/wg.html](https://www.wireshark.org/docs/dfref/w/wg.html)
+ [Lekensteyn/wireguard-dissector](https://github.com/Lekensteyn/wireguard-dissector)
+ [nbsoftsolutions.com/blog/viewing-wireguard-traffic-with-tcpdump](https://nbsoftsolutions.com/blog/viewing-wireguard-traffic-with-tcpdump)

### WireGuard 的性能

WireGuard 声称其性能比大多数 VPN 协议更好，但这个事情有很多争议，比如某些加密方式支持硬件层面的加速。

WireGuard 直接在内核层面处理路由，直接使用系统内核的加密模块来加密数据，和 Linux 原本内置的密码子系统共存，原有的子系统能通过 `API` 使用 WireGuard 的 `Zinc` 密码库。WireGuard 使用 UDP 协议传输数据，在不使用的情况下默认不会传输任何 UDP 数据包，所以比常规 VPN 省电很多，可以像 55 一样一直挂着使用，速度相比其他 VPN 也是压倒性优势。

![](https://images.icloudnative.io/uPic/20200702153436.png)

关于性能比较的更多信息可以参考下面几篇文档：

+ [wireguard.com/performance](https://www.wireguard.com/performance/)
+ [reddit.com/r/linux/comments/9bnowo/wireguard_benchmark_between_two_servers_with_10](https://www.reddit.com/r/linux/comments/9bnowo/wireguard_benchmark_between_two_servers_with_10/)
+ [restoreprivacy.com/openvpn-ipsec-wireguard-l2tp-ikev2-protocols](https://restoreprivacy.com/openvpn-ipsec-wireguard-l2tp-ikev2-protocols/)

### WireGuard 安全模型

WireGuard 使用以下加密技术来保障数据的安全：

+ 使用 `ChaCha20` 进行对称加密，使用 `Poly1305` 进行数据验证。
+ 利用 `Curve25519` 进行密钥交换。
+ 使用 `BLAKE2` 作为哈希函数。
+ 使用 `HKDF` 进行解密。

WireGuard 的加密技术本质上是 `Trevor Perrin` 的 `Noise` 框架的实例化，它简单高效，其他的 VPN 都是通过一系列协商、握手和复杂的状态机来保障安全性。WireGuard 就相当于 VPN 协议中的 `qmail`，代码量比其他 VPN 协议少了好几个数量级。

关于 WireGuard 加密的更多资料请参考下方链接：

+ [wireguard.com/papers/wireguard.pdf](https://www.wireguard.com/papers/wireguard.pdf)
+ [eprint.iacr.org/2018/080.pdf](https://eprint.iacr.org/2018/080.pdf)
+ [courses.csail.mit.edu/6.857/2018/project/He-Xu-Xu-WireGuard.pdf](https://courses.csail.mit.edu/6.857/2018/project/He-Xu-Xu-WireGuard.pdf)
+ [wireguard.com/talks/blackhat2018-slides.pdf](https://www.wireguard.com/talks/blackhat2018-slides.pdf)
+ [arstechnica.com/gadgets/2018/08/wireguard-vpn-review-fast-connections-amaze-but-windows-support-needs-to-happen](https://arstechnica.com/gadgets/2018/08/wireguard-vpn-review-fast-connections-amaze-but-windows-support-needs-to-happen/)

### WireGuard 密钥管理

WireGuard 通过为每个对等节点提供简单的公钥和私钥来实现双向认证，每个对等节点在设置阶段生成密钥，且只在对等节点之间共享密钥。每个节点除了公钥和私钥，不再需要其他证书或预共享密钥。

在更大规模的部署中，可以使用 `Ansible` 或 `Kubernetes Secrets` 等单独的服务来处理密钥的生成、分发和销毁。

下面是一些有助于密钥分发和部署的服务：

- [pypi.org/project/wireguard-p2p](https://pypi.org/project/wireguard-p2p/)
- [trailofbits/algo](https://github.com/trailofbits/algo)
- [StreisandEffect/streisand](https://github.com/StreisandEffect/streisand)
- [its0x08/wg-install](https://github.com/its0x08/wg-install)
- [brittson/wireguard_config_maker](https://github.com/brittson/wireguard_config_maker)
- [wireguardconfig.com](https://www.wireguardconfig.com)

如果你不想在 `wg0.conf` 配置文件中直接硬编码，可以从文件或命令中读取密钥，这使得通过第三方服务管理密钥变得更加容易：

```bash
[Interface]
...
PostUp = wg set %i private-key /etc/wireguard/wg0.key <(cat /some/path/%i/privkey)
```

从技术上讲，多个服务端之间可以共享相同的私钥，只要客户端不使用相同的密钥同时连接到两个服务器。但有时客户端会需要同时连接多台服务器，例如，你可以使用 `DNS` 轮询来均衡两台服务器之间的连接，这两台服务器配置相同。大多数情况下，每个对等节点都应该使用独立的的公钥和私钥，这样每个对等节点都不能读取到对方的流量，保障了安全性。

理论部分就到这里，下篇文章将会手把手教你如何从零开始配置 WireGuard，这里会涉及到很多高级的配置方法，例如动态 IP、NAT 到 NAT、IPv6 等等。