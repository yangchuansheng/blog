---
keywords:
- WireGuard
- wg
- coredns
- dns-sd
- UDP hole punching
- stun
- wgsd
title: "WireGuard 教程：使用 DNS-SD 进行 NAT-to-NAT 穿透"
subtitle: "WireGuard 使用 CoreDNS 的 wgsd 插件来发现 endpoint 地址"
date: 2021-01-28T16:41:34+08:00
lastmod: 2021-01-28T16:41:34+08:00
description: 本文探讨了如何在受 NAT 限制的两个 Peer 之间直接建立一条 WireGuard 隧道。
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
img: https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20210131173242.png
---

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20210129082441.png)

`WireGuard` 是由 Jason A. Donenfeld 等人创建的下一代开源 VPN 协议，旨在解决许多困扰 `IPSec/IKEv2`、`OpenVPN` 或 `L2TP` 等其他 VPN 协议的问题。2020 年 1 月 29 日，WireGuard 正式合并进入 `Linux 5.6` 内核主线。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20210128165526.png)

利用 WireGuard 我们可以实现很多非常奇妙的功能，比如跨公有云组建 Kubernetes 集群，本地直接访问公有云 `Kubernetes` 集群中的 Pod IP 和 Service IP，在家中没有公网 IP 的情况下直连家中的设备，等等。

如果你是第一次听说 WireGuard，建议你花点时间看看我之前写的 WireGuard [工作原理](https://icloudnative.io/posts/wireguard-docs-theory/)。然后可以参考下面两篇文章来快速上手：

+ [WireGuard 快速安装教程](https://icloudnative.io/posts/wireguard-install/)
+ [WireGuard 配置教程：使用 wg-gen-web 来管理 WireGuard 的配置](https://icloudnative.io/posts/configure-wireguard-using-wg-gen-web/)

如果遇到某些细节不太明白的，再去参考 [WireGuard 配置详解](https://icloudnative.io/posts/wireguard-docs-practice/)。

本文将探讨 WireGuard 使用过程中遇到的一个重大难题：**如何使两个位于 NAT 后面（且没有指定公网出口）的客户端之间直接建立连接。**

WireGuard 不区分服务端和客户端，大家都是客户端，与自己连接的所有客户端都被称之为 `Peer`。

## 1. IP 不固定的 Peer

WireGuard 的核心部分是[加密密钥路由（Cryptokey Routing）](https://www.wireguard.com/#cryptokey-routing)，它的工作原理是将公钥和 IP 地址列表（`AllowedIPs`）关联起来。每一个网络接口都有一个私钥和一个 Peer 列表，每一个 Peer 都有一个公钥和 IP 地址列表。发送数据时，可以把 IP 地址列表看成路由表；接收数据时，可以把 IP 地址列表看成访问控制列表。

公钥和 IP 地址列表的关联组成了 Peer 的必要配置，从隧道验证的角度看，根本不需要 Peer 具备静态 IP 地址。理论上，如果 Peer 的 IP 地址不同时发生变化，WireGuard 是可以实现 IP 漫游的。

现在回到最初的问题：**假设两个 Peer 都在 NAT 后面，且这个 NAT 不受我们控制，无法配置 UDP 端口转发，即无法指定公网出口，要想建立连接，不仅要动态发现 Peer 的 IP 地址，还要发现 Peer 的端口。**

找了一圈下来，现有的工具根本无法实现这个需求，本文将致力于不对 WireGuard 源码做任何改动的情况下实现上述需求。

## 2. 中心辐射型网络拓扑

你可能会问我为什么不使用[中心辐射型（hub-and-spoke）网络拓扑](https://en.wikipedia.org/wiki/Spoke–hub_distribution_paradigm)？中心辐射型网络有一个 VPN 网关，这个网关通常都有一个静态 IP 地址，其他所有的客户端都需要连接这个 VPN 网关，再由网关将流量转发到其他的客户端。假设 `Alice` 和 `Bob` 都位于 NAT 后面，那么 `Alice` 和 `Bob` 都要和网关建立隧道，然后 `Alice` 和 `Bob` 之间就可以通过 VPN 网关转发流量来实现相互通信。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20210128211304.png)

其实这个方法是如今大家都在用的方法，已经没什么可说的了，缺点相当明显：

+ 当 Peer 越来越多时，VPN 网关就会变成垂直扩展的瓶颈。
+ 通过 VPN 网关转发流量的成本很高，毕竟云服务器的流量很贵。
+ 通过 VPN 网关转发流量会带来很高的延迟。

本文想探讨的是 `Alice` 和 `Bob` 之间直接建立隧道，中心辐射型（hub-and-spoke）网络拓扑是无法做到的。

## 3. NAT 穿透

要想在 `Alice` 和 `Bob` 之间直接建立一个 WireGuard 隧道，就需要它们能够穿过挡在它们面前的 NAT。由于 WireGuard 是通过 `UDP` 来相互通信的，所以理论上 [UDP 打洞（UDP hole punching）](https://en.wikipedia.org/wiki/UDP_hole_punching) 是最佳选择。

UDP 打洞（UDP hole punching）利用了这样一个事实：大多数 NAT 在将入站数据包与现有的连接进行匹配时都很宽松。这样就可以重复使用端口状态来打洞，因为 NAT 路由器不会限制只接收来自原始目的地址（信使服务器）的流量，其他客户端的流量也可以接收。

举个例子，假设 `Alice` 向新主机 `Carol` 发送一个 UDP 数据包，而 `Bob` 此时通过某种方法获取到了 `Alice` 的 NAT 在地址转换过程中使用的出站源 `IP:Port`，`Bob` 就可以向这个 `IP:Port`（2.2.2.2:7777） 发送 UDP 数据包来和 `Alice` 建立联系。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20210128214804.png)

其实上面讨论的就是**完全圆锥型 NAT**（Full cone NAT），即一对一（one-to-one）NAT。它具有以下特点：

+ 一旦内部地址（iAddr:iPort）映射到外部地址（eAddr:ePort），所有发自 iAddr:iPort 的数据包都经由 eAddr:ePort 向外发送。
+ 任意外部主机都能经由发送数据包给 eAddr:ePort 到达 iAddr:iPort。

大部分的 NAT 都是这种 NAT，对于其他少数不常见的 NAT，这种打洞方法有一定的局限性，无法顺利使用。

## 4. STUN

回到上面的例子，UDP 打洞过程中有几个问题至关重要：

+ Alice 如何才能知道自己的公网 `IP:Port`？
+ Alice 如何与 Bob 建立连接？
+ 在 WireGuard 中如何利用 UDP 打洞？

[RFC5389](https://tools.ietf.org/html/rfc5389) 关于 **STUN**（**Session Traversal Utilities for NAT**，NAT会话穿越应用程序）的详细描述中定义了一个协议回答了上面的一部分问题，这是一篇内容很长的 RFC，所以我将尽我所能对其进行总结。先提醒一下，`STUN` 并不能直接解决上面的问题，它只是个扳手，你还得拿他去打造一个称手的工具：

> STUN 本身并不是 NAT 穿透问题的解决方案，它只是定义了一个机制，你可以用这个机制来组建实际的解决方案。
>
> — [RFC5389](https://www.jordanwhited.com/posts/wireguard-endpoint-discovery-nat-traversal/#fn:1)

[**STUN**（**Session Traversal Utilities for NAT**，NAT会话穿越应用程序）](https://zh.wikipedia.org/wiki/STUN)是一种网络协议，它允许位于NAT（或多重NAT）后的客户端找出自己的公网地址，查出自己位于哪种类型的 NAT 之后以及 NAT 为某一个本地端口所绑定的公网端口。这些信息被用来在两个同时处于 NAT 路由器之后的主机之间建立 UDP 通信。该协议由 RFC 5389 定义。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20210128230103.png)

STUN 是一个客户端－服务端协议，在上图的例子中，`Alice` 是客户端，`Carol` 是服务端。`Alice` 向 `Carol` 发送一个 `STUN Binding` 请求，当 Binding 请求通过 `Alice` 的 NAT 时，源 `IP:Port` 会被重写。当 `Carol` 收到 Binding 请求后，会将三层和四层的源 `IP:Port` 复制到 Binding 响应的有效载荷中，并将其发送给 `Alice`。Binding 响应通过 Alice 的 NAT 转发到内网的 `Alice`，此时的目标 IP:Port 被重写成了内网地址，但有效载荷保持不变。`Alice` 收到 Binding 响应后，就会意识到这个 Socket 的公网 IP:Port 是 `2.2.2.2:7777`。

然而，`STUN` 并不是一个完整的解决方案，它只是提供了这么一种机制，让应用程序获取到它的公网 `IP:Port`，但 STUN 并没有提供具体的方法来向相关方向发出信号。如果要重头编写一个具有 NAT 穿透功能的应用，肯定要利用 STUN 来实现。当然，明智的做法是不修改 WireGuard 的源码，最好是借鉴 STUN 的概念来实现。总之，不管如何，都需要一个拥有静态公网地址的主机来充当**信使服务器**。

## 5. NAT 穿透示例

早在 2016 年 8 月份，WireGuard 的创建者就在 [WireGuard 邮件列表](https://lists.zx2c4.com/pipermail/wireguard/2016-August/000372.html)上分享了一个 [NAT 穿透示例](https://git.zx2c4.com/wireguard-tools/tree/contrib/nat-hole-punching)。Jason 的示例包含了客户端应用和服务端应用，其中客户端应用于 WireGuard 一起运行，服务端运行在拥有静态地址的主机上用来发现各个 Peer 的 `IP:Port`，客户端使用[原始套接字（raw socket）](https://zh.wikipedia.org/wiki/%E5%8E%9F%E5%A7%8B%E5%A5%97%E6%8E%A5%E5%AD%97)与服务端进行通信。

```c
/* We use raw sockets so that the WireGuard interface can actually own the real socket. */
sock = socket(AF_INET, SOCK_RAW, IPPROTO_UDP);
if (sock < 0) {
	perror("socket");
	return errno;
}
```

正如评论中指出的，WireGuard 拥有“真正的套接字”。通过使用原始套接字（raw socket），客户端能够向服务端伪装本地 WireGuard 的源端口，这样就确保了在服务端返回响应经过 NAT 时目标 `IP:Port` 会被映射到 WireGuard 套接字上。

客户端在其原始套接字上使用一个[经典的 BPF 过滤器](https://www.kernel.org/doc/Documentation/networking/filter.txt)来过滤服务端发往 WireGuard 端口的回复。

```c
static void apply_bpf(int sock, uint16_t port, uint32_t ip)
{
	struct sock_filter filter[] = {
		BPF_STMT(BPF_LD + BPF_W + BPF_ABS, 12 /* src ip */),
		BPF_JUMP(BPF_JMP + BPF_JEQ + BPF_K, ip, 0, 5),
		BPF_STMT(BPF_LD + BPF_H + BPF_ABS, 20 /* src port */),
		BPF_JUMP(BPF_JMP + BPF_JEQ + BPF_K, PORT, 0, 3),
		BPF_STMT(BPF_LD + BPF_H + BPF_ABS, 22 /* dst port */),
		BPF_JUMP(BPF_JMP + BPF_JEQ + BPF_K, port, 0, 1),
		BPF_STMT(BPF_RET + BPF_K, -1),
		BPF_STMT(BPF_RET + BPF_K, 0)
	};
	struct sock_fprog filter_prog = {
		.len = sizeof(filter) / sizeof(filter[0]),
		.filter = filter
	};
	if (setsockopt(sock, SOL_SOCKET, SO_ATTACH_FILTER, &filter_prog, sizeof(filter_prog)) < 0) {
		perror("setsockopt(bpf)");
		exit(errno);
	}
}
```

客户端与服务端的通信数据都被定义在 `packet` 和 `reply` 这两个结构体中：

```c
struct {
    struct udphdr udp;
    uint8_t my_pubkey[32];
    uint8_t their_pubkey[32];
} __attribute__((packed)) packet = {
    .udp = {
        .len = htons(sizeof(packet)),
        .dest = htons(PORT)
    }
};
struct {
    struct iphdr iphdr;
    struct udphdr udp;
    uint32_t ip;
    uint16_t port;
} __attribute__((packed)) reply;
```

客户端会遍历配置好的 WireGuard Peer（`wg show <interface> peers`），并为每一个 Peer 发送一个数据包给服务端，其中 `my_pubkey` 和 `their_pubkey` 字段会被适当填充。当服务端收到来自客户端的数据包时，它会向以公钥为密钥的 Peer 内存表中插入或更新一个 `pubkey=my_pubkey` 的 `entry`，然后再从该表中查找 `pubkey=their_pubkey` 的 `entry`，一但发现 `entry` 存在，就会将其中的 `IP:Port` 发送给客户端。当客户端收到回复时，会将 IP 和端口从数据包中解包，并配置 Peer 的 endpoint 地址（`wg set <interface> peer <key> <options...> endpoint <ip>:<port>`）。

`entry` 结构体源码：

```c
struct entry {
	uint8_t pubkey[32];
	uint32_t ip;
	uint16_t port;
};
```

`entry` 结构体中的 `ip` 和 `port` 字段是从客户端收到的数据包中提取的 IP 和 UDP 头部，每次客户端请求 Peer 的 IP 和端口信息时，都会在 Peer 列表中刷新自己的 IP 和端口信息。

上面的例子展示了 WireGuard 如何实现 UDP 打洞，但还是太复杂了，因为并不是所有的 Peer 端都能打开原始套接字（raw socket），也并不是所有的 Peer 端都能利用 BPF 过滤器。而且这里还用到了自定义的 [wire protocol](https://en.wikipedia.org/wiki/Wire_protocol)，代码层面的数据（链表、队列、二叉树）都是结构化的，但网络层看到的都是二进制流，所谓 `wire protocol` 就是把结构化的数据序列化为二进制流发送出去，并且对方也能以同样的格式反序列化出来。这种方式是很难调试的，所以我们需要另辟蹊径，利用现有的成熟工具来达到目的。

## 6. WireGuard NAT 穿透的正解

其实完全没必要这么麻烦，我们可以直接利用 WireGuard 本身的特性来实现 UDP 打洞，直接看图：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20210129061540.png)

你可能会认为这是个中心辐射型（hub-and-spoke）网络拓扑，但实际上还是有些区别的，这里的 Registry Peer 不会充当网关的角色，因为它没有相应的路由，不会转发流量。Registry 的 WireGuard 接口地址为 `10.0.0.254/32`，Alice 和 Bob 的 `AllowedIPs` 中只包含了 `10.0.0.254/32`，表示只接收来自 `Registry` 的流量，所以 Alice 和 Bob 之间无法通过 Registry 来进行通信。

这里有一点至关重要，`Registry` 分别和 Alice 与 Bob 建立了两个隧道，这就会在 Alice 和 Bob 的 NAT 上打开一个洞，我们需要找到一种方法来从 Registry Peer 中查询这些洞的 `IP:Port`，自然而然就想到了 `DNS` 协议。DNS 的优势很明显，它比较简单、成熟，还跨平台。有一种 DNS 记录类型叫 [**SRV记录**（Service Record，服务定位记录）](https://zh.wikipedia.org/wiki/SRV%E8%AE%B0%E5%BD%95)，它用来记录服务器提供的服务，即识别服务的 IP 和端口，[RFC6763](https://tools.ietf.org/html/rfc6763) 用具体的结构和查询模式对这种记录类型进行了扩展，用于发现给定域下的服务，我们可以直接利用这些扩展语义。

## 7. CoreDNS

选好了服务发现协议后，还需要一种方法来将其与 WireGuard 对接。[CoreDNS](https://github.com/coredns/coredns) 是 Golang 编写的一个插件式 DNS 服务器，是目前 Kubernetes 内置的默认 DNS 服务器，并且已从 [CNCF](https://cncf.io/) 毕业。我们可以直接写一个 CoreDNS 插件，用来接受 `DNS-SD`（DNS-based Service Discovery）查询并返回相关 WireGuard Peer 的信息，其中公钥作为记录名称，icloudnative.io 作为域。如果你熟悉 bind 风格的域文件，可以想象一个类似这样的域数据：

```bash
_wireguard._udp         IN PTR          alice._wireguard._udp.icloudnative.io.
_wireguard._udp         IN PTR          bob._wireguard._udp.icloudnative.io.
alice._wireguard._udp   IN SRV 0 1 7777 alice.icloudnative.io.
alice                   IN A            2.2.2.2
bob._wireguard._udp     IN SRV 0 1 8888 bob.icloudnative.io.
bob                     IN A            3.3.3.3
```

### 公钥使用 Base64 还是 Base32 ？

到目前为止，我们一直使用别名 Alice 和 Bob 来替代其对应的 WireGuard 公钥。WireGuard 公钥是 `Base64` 编码的，长度为 `44` 字节：

```bash
$ wg genkey | wg pubkey
UlVJVmPSwuG4U9BwyVILFDNlM+Gk9nQ7444HimPPgQg=
```

> Base 64 编码的设计是为了以一种允许使用大写字母和小写字母的形式来表示任意的八位字节序列。
>
> — [RFC4648](https://www.jordanwhited.com/posts/wireguard-endpoint-discovery-nat-traversal/#fn:2)

不幸的是，DNS 的 SRV 记录的服务名称是不区分大小写的：

> DNS 树中的每个节点都有一个由零个或多个标签组成的名称 [STD13, RFC1591, RFC2606]，这些标签不区分大小写。
>
> — [RFC4343](https://www.jordanwhited.com/posts/wireguard-endpoint-discovery-nat-traversal/#fn:3)

`Base32` 虽然产生了一个稍长的字符串（`56` 字节），但它的表现形式允许我们在 DNS 内部表示 WireGuard 公钥：

> Base32 编码的目的是为了表示任意八位字节序列，其形式必须不区分大小写。

我们可以使用 `base64` 和 `base32` 命令来回转换编码格式，例如：

```bash
$ wg genkey | wg pubkey > pub.txt
$ cat pub.txt
O9rAAiO5qTejOEtFbsQhCl745ovoM9coTGiprFTaHUE=
$ cat pub.txt | base64 -D | base32
HPNMAARDXGUTPIZYJNCW5RBBBJPPRZUL5AZ5OKCMNCU2YVG2DVAQ====
$ cat pub.txt | base64 -D | base32 | base32 -d | base64
O9rAAiO5qTejOEtFbsQhCl745ovoM9coTGiprFTaHUE=
```

我们可以直接使用 `base32` 这种不区分大小写的公钥编码，来使其与 DNS 兼容。

### 编译插件

CoreDNS 提供了[编写插件的文档](https://coredns.io/manual/toc/#writing-plugins)，插件必须要实现 `plugin.Handler` 接口：

```go
type Handler interface {
    ServeDNS(context.Context, dns.ResponseWriter, *dns.Msg) (int, error)
    Name() string
}
```

我自己已经写好了插件，通过 `DNS-SD`（DNS-based Service Discovery）语义来提供 WireGuard 的 Peer 信息，该插件名就叫 [wgsd](https://github.com/jwhited/wgsd)。自己编写的插件不属于官方内置插件，从 CoreDNS 官方下载页下载的可执行程序并不包括这两个插件，所以需要自己编译 CoreDNS。

编译 CoreDNS 并不复杂，在没有外部插件的情况下可以这么编译：

```bash
$ git clone https://github.com/coredns/coredns.git
$ cd coredns
$ make
```

如果要加上 wgsd 插件，则在 `make` 前，要修改 `plugin.cfg` 文件，加入以下一行：

```bash
wgsd:github.com/jwhited/wgsd
```

然后开始编译：

```bash
$ go generate
$ go build
```

查看编译好的二进制文件是否包含该插件：

```bash
$ ./coredns -plugins | grep wgsd
  dns.wgsd
```

编译完成后，就可以在配置文件中启用 `wgsd` 插件了：

```bash
.:53 {
  wgsd <zone> <wg device>
}
```

可以来测试一下，配置文件如下：

```bash
$ cat Corefile
.:53 {
  debug
  wgsd icloudnative.io. wg0
}
```

运行 CoreDNS：

```bash
$ ./coredns -conf Corefile
.:53
CoreDNS-1.8.1
linux/amd64, go1.15,

```

当前节点的 WireGuard 信息：

```bash
$ sudo wg show
interface: wg0
  listening port: 52022

peer: mvplwow3agnGM8G78+BiJ3tmlPf9gDtbJ2NdxqV44D8=
  endpoint: 3.3.3.3:8888
  allowed ips: 10.0.0.2/32
```

下面就是见证奇迹的时候，列出所有 Peer：

```bash
$ dig @127.0.0.1 _wireguard._udp.icloudnative.io. PTR +noall +answer +additional

; <<>> DiG 9.10.6 <<>> @127.0.0.1 _wireguard._udp.icloudnative.io. PTR +noall +answer +additional
; (1 server found)
;; global options: +cmd
_wireguard._udp.icloudnative.io. 0 IN  PTR     TL5GLQUMG5VATRRTYG57HYDCE55WNFHX7WADWWZHMNO4NJLY4A7Q====._wireguard._udp.icloudnative.io.
```

查询每个 Peer 的 IP 和端口：

```bash
$ dig @127.0.0.1 TL5GLQUMG5VATRRTYG57HYDCE55WNFHX7WADWWZHMNO4NJLY4A7Q====._wireguard._udp.icloudnative.io. SRV +noall +answer +additional

; <<>> DiG 9.10.6 <<>> @127.0.0.1 TL5GLQUMG5VATRRTYG57HYDCE55WNFHX7WADWWZHMNO4NJLY4A7Q====._wireguard._udp.icloudnative.io. SRV +noall +answer +additional
; (1 server found)
;; global options: +cmd
tl5glqumg5vatrrtyg57hydce55wnfhx7wadwwzhmno4njly4a7q====._wireguard._udp.icloudnative.io. 0 IN SRV 0 0 8888 TL5GLQUMG5VATRRTYG57HYDCE55WNFHX7WADWWZHMNO4NJLY4A7Q====.icloudnative.io.
TL5GLQUMG5VATRRTYG57HYDCE55WNFHX7WADWWZHMNO4NJLY4A7Q====.icloudnative.io. 0 IN A 3.3.3.3
```

🎉 🎉 🎉 完美！🎉 🎉 🎉

验证公钥是否匹配：

```bash
$ wg show wg0 peers
mvplwow3agnGM8G78+BiJ3tmlPf9gDtbJ2NdxqV44D8=
$ dig @127.0.0.1 _wireguard._udp.icloudnative.io. PTR +short | cut -d. -f1 | base32 -d | base64
mvplwow3agnGM8G78+BiJ3tmlPf9gDtbJ2NdxqV44D8=
```

👍 👍 👍

## 8. 最终通信流程

最终实现的通信流程如下：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20210129073327.png)

一开始，Alice 和 Bob 分别与 Registry 建立了隧道；接下来，Alice 上的 `wgsd-client` 向 Registry 节点上运行的 CoreDNS插件（`wgsd`）发起查询请求，该插件从 WireGuard 信息中检索 `Bob` 的 endpoint 信息，并将其返回给 `wgsd-client`；然后 `wgsd-client` 开始设置 Bob 的 endpoint；最后 Alice 和 Bob 之间直接建立了一条隧道。

任何提及 "建立隧道 "的地方都只是意味着发生了握手，数据包可以在 Peer 之间传输。虽然 WireGuard 确实有一个握手机制，但它比你想象的更像是一个无连接的协议。

> 任何安全协议都需要保持一些状态，所以最初的握手是非常简单的，只是建立用于数据传输的对称密钥。这种握手每隔几分钟就会发生一次，以提供轮换密钥来实现完美的前向保密。它是根据时间来完成的，而不是根据之前数据包的内容来完成的，因为它的设计是为了优雅地处理数据包丢失的问题。
>
> — [wireguard.com/protocol](https://www.jordanwhited.com/posts/wireguard-endpoint-discovery-nat-traversal/#fn:5)

现在万事俱备，只欠东风，只需要实现 `wgsd-client` 就完事了。

## 9. 实现 wgsd-client

`wgsd-client` 负责使 Peer 的 endpoint 配置保持最新状态，它会检索配置中的 Peer 列表，查询 CoreDNS 中与之匹配的公钥，然后在需要时为相应的 Peer 更新 endpoint 的值。最初的实现方式是以定时任务或者类似的调度机制运行，以序列化的方式检查所有 Peer，设置 endpoint，然后退出。目前它还不是一个守护进程，后续会继续改进优化。

`wgsd-client` 的源码位于 wgsd 仓库中的 [cmd/wgsd-client](https://github.com/jwhited/wgsd/tree/master/cmd/wgsd-client) 目录。

下面开始进行最终的测试。

Alice 和 Bob 都在 NAT 后面，Registry 没有 NAT，且有固定的公网地址。这三个 Peer 的信息如下：

| Peer     | Public Key                                   | Tunnel Address |
| -------- | -------------------------------------------- | -------------- |
| Alice    | xScVkH3fUGUv4RrJFfmcqm8rs3SEHr41km6+yffAHw4= | 10.0.0.1               |
| Bob      | syKB97XhGnvC+kynh2KqQJPXoOoOpx/HmpMRTc+r4js= | 10.0.0.2               |
| Registry | JeZlz14G8tg1Bqh6apteFCwVhNhpexJ19FDPfuxQtUY= | 10.0.0.254               |

它们各自的初始配置：

### Alice

```bash
$ cat /etc/wireguard/wg0.conf
[Interface]
Address = 10.0.0.1/32
PrivateKey = 0CtieMOYKa2RduPbJss/Um9BiQPSjgvHW+B7Mor5OnE=
ListenPort = 51820

# Registry
[Peer]
PublicKey = JeZlz14G8tg1Bqh6apteFCwVhNhpexJ19FDPfuxQtUY=
Endpoint = 4.4.4.4:51820
PersistentKeepalive = 5
AllowedIPs = 10.0.0.254/32

# Bob
[Peer]
PublicKey = syKB97XhGnvC+kynh2KqQJPXoOoOpx/HmpMRTc+r4js=
PersistentKeepalive = 5
AllowedIPs = 10.0.0.2/32

$ wg show
interface: wg0
  public key: xScVkH3fUGUv4RrJFfmcqm8rs3SEHr41km6+yffAHw4=
  private key: (hidden)
  listening port: 51820

peer: JeZlz14G8tg1Bqh6apteFCwVhNhpexJ19FDPfuxQtUY=
  endpoint: 4.4.4.4:51820
  allowed ips: 10.0.0.254/32
  latest handshake: 48 seconds ago
  transfer: 1.67 KiB received, 11.99 KiB sent
  persistent keepalive: every 5 seconds

peer: syKB97XhGnvC+kynh2KqQJPXoOoOpx/HmpMRTc+r4js=
  allowed ips: 10.0.0.2/32
  persistent keepalive: every 5 seconds
```

### Bob

```bash
$ cat /etc/wireguard/wg0.conf
[Interface]
Address = 10.0.0.2/32
PrivateKey = cIN5NqeWcbreXoaIhR/4wgrrQJGym/E7WrTttMtK8Gc=
ListenPort = 51820

# Registry
[Peer]
PublicKey = JeZlz14G8tg1Bqh6apteFCwVhNhpexJ19FDPfuxQtUY=
Endpoint = 4.4.4.4:51820
PersistentKeepalive = 5
AllowedIPs = 10.0.0.254/32

# Alice
[Peer]
PublicKey = xScVkH3fUGUv4RrJFfmcqm8rs3SEHr41km6+yffAHw4=
PersistentKeepalive = 5
AllowedIPs = 10.0.0.1/32

$ wg show
interface: wg0
  public key: syKB97XhGnvC+kynh2KqQJPXoOoOpx/HmpMRTc+r4js=
  private key: (hidden)
  listening port: 51820

peer: JeZlz14G8tg1Bqh6apteFCwVhNhpexJ19FDPfuxQtUY=
  endpoint: 4.4.4.4:51820
  allowed ips: 10.0.0.254/32
  latest handshake: 26 seconds ago
  transfer: 1.54 KiB received, 11.75 KiB sent
  persistent keepalive: every 5 seconds

peer: xScVkH3fUGUv4RrJFfmcqm8rs3SEHr41km6+yffAHw4=
  allowed ips: 10.0.0.1/32
  persistent keepalive: every 5 seconds
```

### Registry

```bash
$ cat /etc/wireguard/wg0.conf
[Interface]
Address = 10.0.0.254/32
PrivateKey = wLw2ja5AapryT+3SsBiyYVNVDYABJiWfPxLzyuiy5nE=
ListenPort = 51820

# Alice
[Peer]
PublicKey = xScVkH3fUGUv4RrJFfmcqm8rs3SEHr41km6+yffAHw4=
AllowedIPs = 10.0.0.1/32

# Bob
[Peer]
PublicKey = syKB97XhGnvC+kynh2KqQJPXoOoOpx/HmpMRTc+r4js=
AllowedIPs = 10.0.0.2/32

$ wg show
interface: wg0
  public key: JeZlz14G8tg1Bqh6apteFCwVhNhpexJ19FDPfuxQtUY=
  private key: (hidden)
  listening port: 51820

peer: xScVkH3fUGUv4RrJFfmcqm8rs3SEHr41km6+yffAHw4=
  endpoint: 2.2.2.2:41424
  allowed ips: 10.0.0.1/32
  latest handshake: 6 seconds ago
  transfer: 510.29 KiB received, 52.11 KiB sent

peer: syKB97XhGnvC+kynh2KqQJPXoOoOpx/HmpMRTc+r4js=
  endpoint: 3.3.3.3:51820
  allowed ips: 10.0.0.2/32
  latest handshake: 1 minute, 46 seconds ago
  transfer: 498.04 KiB received, 50.59 KiB sent
```

Registry 与 Alice 和 Bob 都建立了连接，可以直接查询它们的 endpoint 信息：

```bash
$ dig @4.4.4.4 -p 53 _wireguard._udp.icloudnative.io. PTR +noall +answer +additional

; <<>> DiG 9.10.6 <<>> @4.4.4.4 -p 53 _wireguard._udp.icloudnative.io. PTR +noall +answer +additional
; (1 server found)
;; global options: +cmd
_wireguard._udp.icloudnative.io. 0 IN  PTR     YUTRLED535IGKL7BDLERL6M4VJXSXM3UQQPL4NMSN27MT56AD4HA====._wireguard._udp.icloudnative.io.
_wireguard._udp.icloudnative.io. 0 IN  PTR     WMRID55V4ENHXQX2JSTYOYVKICJ5PIHKB2TR7R42SMIU3T5L4I5Q====._wireguard._udp.icloudnative.io.

$ dig @4.4.4.4 -p 53 YUTRLED535IGKL7BDLERL6M4VJXSXM3UQQPL4NMSN27MT56AD4HA====._wireguard._udp.icloudnative.io. SRV +noall +answer +additional

; <<>> DiG 9.10.6 <<>> @4.4.4.4 -p 53 YUTRLED535IGKL7BDLERL6M4VJXSXM3UQQPL4NMSN27MT56AD4HA====._wireguard._udp.icloudnative.io. SRV +noall +answer +additional
; (1 server found)
;; global options: +cmd
yutrled535igkl7bdlerl6m4vjxsxm3uqqpl4nmsn27mt56ad4ha====._wireguard._udp.icloudnative.io. 0 IN SRV 0 0 41424 YUTRLED535IGKL7BDLERL6M4VJXSXM3UQQPL4NMSN27MT56AD4HA====.icloudnative.io.
YUTRLED535IGKL7BDLERL6M4VJXSXM3UQQPL4NMSN27MT56AD4HA====.icloudnative.io. 0 IN A 2.2.2.2
```

完美，下面分别在 Alice 和 Bob 上启动 `wgsd-client` 试试：

```bash
# Alice
$ ./wgsd-client -device=wg0 -dns=4.4.4.4:53 -zone=icloudnative.io.
2020/05/20 13:24:02 [JeZlz14G8tg1Bqh6apteFCwVhNhpexJ19FDPfuxQtUY=] no SRV records found
jwhited@Alice:~$ ping 10.0.0.2
PING 10.0.0.2 (10.0.0.2): 56 data bytes
64 bytes from 10.0.0.2: icmp_seq=0 ttl=64 time=173.260 ms
^C
jwhited@Alice:~$ wg show
interface: wg0
  public key: xScVkH3fUGUv4RrJFfmcqm8rs3SEHr41km6+yffAHw4=
  private key: (hidden)
  listening port: 51820

peer: syKB97XhGnvC+kynh2KqQJPXoOoOpx/HmpMRTc+r4js=
  endpoint: 3.3.3.3:51820
  allowed ips: 10.0.0.2/32
  latest handshake: 2 seconds ago
  transfer: 252 B received, 264 B sent
  persistent keepalive: every 5 seconds

peer: JeZlz14G8tg1Bqh6apteFCwVhNhpexJ19FDPfuxQtUY=
  endpoint: 4.4.4.4:51820
  allowed ips: 10.0.0.254/32
  latest handshake: 1 minute, 19 seconds ago
  transfer: 184 B received, 1.57 KiB sent
  persistent keepalive: every 5 seconds
```

```bash
# Bob
$ ./wgsd-client -device=wg0 -dns=4.4.4.4:53 -zone=icloudnative.io.
2020/05/20 13:24:04 [JeZlz14G8tg1Bqh6apteFCwVhNhpexJ19FDPfuxQtUY=] no SRV records found
jwhited@Bob:~$ wg show
interface: wg0
  public key: syKB97XhGnvC+kynh2KqQJPXoOoOpx/HmpMRTc+r4js=
  private key: (hidden)
  listening port: 51820

peer: xScVkH3fUGUv4RrJFfmcqm8rs3SEHr41km6+yffAHw4=
  endpoint: 2.2.2.2:41424
  allowed ips: 10.0.0.1/32
  latest handshake: 22 seconds ago
  transfer: 392 B received, 9.73 KiB sent
  persistent keepalive: every 5 seconds

peer: JeZlz14G8tg1Bqh6apteFCwVhNhpexJ19FDPfuxQtUY=
  endpoint: 4.4.4.4:51820
  allowed ips: 10.0.0.254/32
  latest handshake: 1 minute, 14 seconds ago
  transfer: 2.08 KiB received, 17.59 KiB sent
  persistent keepalive: every 5 seconds
```

`wgsd-client` 成功发现了 Peer 的 endpoint 地址并更新了 WireGuard 的配置，最终 Alice 和 Bob 之间直接建立了一条隧道！

## 总结

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20210129082354.png)

本文探讨了如何在受 NAT 限制的两个 Peer 之间直接建立一条 WireGuard 隧道。本文提供的解决方案都是使用现有的协议和服务发现技术，以及自己写了个可插拔的插件，你可以直接使用 `dig` 或 `nslookup` 来进行调试，不需要干扰或修改 WireGuard 本身。

当然，这个 CoreDNS 插件肯定还可以优化，`wgsd-client` 也需要继续优化。比如，CoreDNS 服务器是否应该限制只在 Registry 的隧道中可用？是否应该对域进行签名？每次查询 DNS 时是否都需要查询一次 WireGuard 的 Peer 信息，还是说可以用缓存来解决？这些都是值得思考的问题。

[wgsd 插件](https://github.com/jwhited/wgsd)的代码是开源的，欢迎大家踊跃贡献。