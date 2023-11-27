---
keywords:
- WireGuard
- wg-quick
- fwmark
- iproute
- 路由策略
- 策略路由
title: "WireGuard 基础教程：wg-quick 路由策略解读"
date: 2022-08-31T09:06:37+08:00
lastmod: 2022-08-31T19:06:37+08:00
description: 本文详细解读了 WireGuard 全局模式下的路由策略。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- WireGuard
- Linux
categories: ["Network", "VPN"]
img: https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting4@main/uPic/2022-08-31-12-24-nStmY2.jpg
meta_image: https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting4@main/uPic/2022-08-31-12-25-UbKSO1.jpg
libraries:
- katex
---

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting4@main/uPic/2022-08-31-12-25-UbKSO1.jpg)

很久以前，我们只需要在 Linux 终端中输入 `route -n`（后来演变出了 `ip route`，也就是 iproute2 提供的命令），就可以知晓系统中所有数据包的走向，但是，**大人，时代变了！**

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting4@main/uPic/2022-08-31-09-00-G2VPAG.jpg)

如果你是 WireGuard 玩家，并且所有的流量都通过 WireGuard 路由出去，但你却无法通过 `ip route` 命令的输出中看出任何的蛛丝马迹：

```bash
default via 192.168.100.254 dev eth0 proto dhcp src 192.168.100.63 metric 100 
192.168.100.0/24 dev eth0 proto kernel scope link src 192.168.100.63 
192.168.100.254 dev eth0 proto dhcp scope link src 192.168.100.63 metric 100
```

路由表告诉我们，所有的流量都是通过物理网卡出去的，并没有通过 WireGuard 虚拟网络接口。这是为什么呢？

## 路由表

事实上 Linux 从 2.2 版本左右的内核开始，便包含了多个路由表，而不是一个！同时，还有一套规则，**这套规则会告诉内核如何为每个数据包选择正确的路由表。**

当你执行 `ip route` 时，你看到的是一个特定的路由表 `main`，除了 main 之外还有其他的路由表存在。路由表一般用整数来标识，也可以通过文本对其命名，这些命名都保存在文件 `/etc/iproute2/rt_tables` 中。默认内容如下：

```bash
$ cat /etc/iproute2/rt_tables
#
# reserved values
#
255     local
254     main
253     default
0       unspec
#
# local
#
#1      inr.ruhep
```

Linux 系统中，可以自定义从 `1－252` 个路由表。Linux 系统默认维护了 4 个路由表：

+ **0**：系统保留表。
+ **253**：defulte table。没特别指定的默认路由都放在该表。
+ **254**：main table。没指明路由表的所有路由放在该表。
+ **255**：locale table。保存本地接口地址，广播地址、NAT 地址，由系统维护，用户不得更改。

这里有一个很奇怪的单词：`inr.ruhep`，这可能是 Alexey Kuznetsov 添加的，他负责服务质量（QoS）在Linux内核中的实现，iproute2 也是他在负责，这个单词表示“核研究/俄罗斯高能物理研究所”，是 Alexey 当时工作的地方，可能指的是他们的内部网络。当然，还有另外一种可能，有一个老式的俄罗斯计算机网络/ISP 叫做 [RUHEP/Radio-MSU](http://www.radio-msu.net/about.htm)。

路由表的查看可有以下二种方法：

```bash
$ ip route show table table_number
 
$ ip route show table table_name
```

> 不要把路由表和 iptables 混淆，路由表决定**如何传输数据包**，而 iptables 决定**是否传输数据包**，他俩的职责不一样。

## 路由策略

内核是如何知道哪个数据包应该使用哪个路由表的呢？答案已经在前文给出来了，系统中有一套规则会告诉内核如何为每个数据包选择正确的路由表，这套规则就是**路由策略数据库**。这个数据库由 `ip rule` 命令来管理，如果不加任何参数，将会打印所有的路由规则：

```bash
0:      from all lookup local
32766:  from all lookup main
32767:  from all lookup default
```

左边的数字（0, 32764, ......）表示规则的优先级：**数值越小的规则，优先级越高**。也就是说，数值较小的规则会被优先处理。

> 路由规则的数值范围：1 ~ $2^{23}-1$

除了优先级之外，每个规则还有一个**选择器**（selector）和对应的**执行策略**（action）。选择器会判断该规则是否适用于当前的数据包，如果适用，就执行对应的策略。最常见的执行策略就是查询一个特定的路由表（参考上一节内容）。如果该路由表包含了当前数据包的路由，那么就执行该路由；否则就会跳过当前路由表，继续匹配下一个路由规则。

在 Linux 系统启动时，内核会为路由策略数据库配置三条缺省的规则：

+ **0**：匹配任何条件，查询路由表 **local** (ID 255)，该表 local 是一个特殊的路由表，包含对于本地和广播地址的优先级控制路由。rule 0 非常特殊，不能被删除或者覆盖。
+ **32766**：匹配任何条件，查询路由表 **main** (ID 254)，该表是一个常规的表，包含所有的无策略路由。系统管理员可以删除或者使用另外的规则覆盖这条规则。
+ **32767**：匹配任何条件，查询路由表 **default** (ID 253)，该表是一个空表，它是后续处理保留。对于前面的策略没有匹配到的数据包，系统使用这个策略进行处理，这个规则也可以删除。

在默认情况下进行路由时，首先会根据规则 **0** 在本地路由表里寻找路由，如果目的地址是本网络，或是广播地址的话，或者是人工添加的子网，在这里就可以找到合适的路由，匹配之后就会进入本机上层协议（iptables INPUT 可以拦截到）；如果路由失败，就会匹配下一个不空的规则，在这里只有 **32766** 规则，在这里将会在主路由表里寻找路由；如果失败，就会匹配 **32767** 规则，即寻找默认路由表。如果失败，路由将失败。从这里可以看出，**策略性路由是往前兼容的**。

## WireGuard 全局路由策略

现在回到 WireGuard，很多 WireGuard 用户会选择将本机的所有流量通过 WireGuard 对端路由，原因嘛大家都懂得😁。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting4@main/uPic/2022-08-31-10-34-RsLQ0f.jpg)

配置嘛也很简单，只需将 `0.0.0.0/0` 添加到 `AllowedIPs` 里即可：

```ini
# /etc/wireguard/wg0.conf

[Interface]
PrivateKey = xxxxxxxxxxxxxxxxxxxxxxxxxxxxx 
Address = 10.0.0.2/32
# PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
# PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
# ListenPort = 51820

[Peer]
PublicKey = xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Endpoint = 192.168.100.251:51820
AllowedIPs = 0.0.0.0/0
```

理论上这样就可以让所有的流量都通过对端路由了，但是如果你用的 wg-quick 版本比较旧，一顿操作猛如虎（`wg-quick up wg0`）之后，你会发现事情并不是你想象的那样，甚至可能连 WireGuard 对端都连不上了。主要还是因为 WireGuard 自身的流量也通过虚拟网络接口进行路由了，这肯定是不行的。

新版本的 `wg-quick` 通过路由策略巧妙地解决了这个问题，我们来看看它妙在何处！

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting4@main/uPic/2022-08-31-10-50-rBaNRx.jpg)

首先，使用 wg-quick 启动 `wg0` 网卡：

```bash
$ wg-quick up wg0
[#] ip link add wg0 type wireguard
[#] wg setconf wg0 /dev/fd/63
[#] ip -4 address add 10.0.0.2/32 dev wg0
[#] ip link set mtu 1420 up dev wg0
[#] wg set wg0 fwmark 51820
[#] ip -4 route add 0.0.0.0/0 dev wg0 table 51820
[#] ip -4 rule add not fwmark 51820 table 51820
[#] ip -4 rule add table main suppress_prefixlength 0
[#] sysctl -q net.ipv4.conf.all.src_valid_mark=1
[#] iptables-restore -n
```

嘻嘻，看到了熟悉的路由策略，这就打印所有的路由规则看看：

```bash
$ ip rule
0:      from all lookup local
32764:  from all lookup main suppress_prefixlength 0
32765:  not from all fwmark 0xca6c lookup 51820
32766:  from all lookup main
32767:  from all lookup default
```

好家伙，多了两条规则：

```bash
32764:  from all lookup main suppress_prefixlength 0
32765:  not from all fwmark 0xca6c lookup 51820
```

我们来扒扒他们的底裤，揭开神秘面纱。先来灵魂三问：`suppress_prefixlength` 是啥？`0xca6c` 又是啥？数据包怎么可能 `not from all`？

### Rule 32764

先从规则 `32764` 开始分析，因为它的数值比较小，会被优先匹配：

```bash
32764:  from all lookup main suppress_prefixlength 0
```

这条规则没有使用选择器，也就是说，内核会为每一个数据包去查询 `main` 路由表。我们来看看 main 路由表内容是啥：

```bash
$ ip route
default via 192.168.100.254 dev eth0 proto dhcp src 192.168.100.63 metric 100 
192.168.100.0/24 dev eth0 proto kernel scope link src 192.168.100.63 
192.168.100.254 dev eth0 proto dhcp scope link src 192.168.100.63 metric 100
```

如果真的是这样，那所有的数据包都会通过 main 路由表路由，永远不会到达 wg0。你别忘了，这条规则末尾还有一个参数：`suppress_prefixlength 0`，这是啥意思呢？参考  `ip-rule(8)` man page：

```bash
suppress_prefixlength NUMBER
    reject routing decisions that have a prefix length of NUMBER or less.
```

这里的 `prefix` 也就是**前缀**，表示路由表中匹配的地址范围的**掩码**。因此，如果路由表中包含 `10.2.3.4` 的路由，前缀长度就是 32；如果是 `10.0.0.0/8`，前缀长度就是 8。

`suppress` 的意思是抑制，所以 `suppress_prefixlength 0` 的意思是：**拒绝前缀长度小于或等于 0 的路由策略**。

那么什么样的地址范围前缀长度才会小于等于 0？只有一种可能：`0.0.0.0/0`，也就是默认路由。以我的机器为例，默认路由就是：

```bash
default via 192.168.100.254 dev eth0 proto dhcp src 192.168.100.63 metric 100
```

如果数据包匹配到了默认路由，就拒绝转发；如果是其他路由，就正常转发。

这条规则的目的很简单，**管理员手动添加到 main 路由表中的路由都会正常转发，而默认路由会被忽略，继续匹配下一条规则**。

### Rule 32765

下一条规则就是 `32765`：

```bash
32765:  not from all fwmark 0xca6c lookup 51820
```

这里的 `not from all` 是 ip rule 格式化的问题，有点反人类，人类更容易理解的顺序应该是这样：

```bash
32765:  from all not fwmark 0xca6c lookup 51820
```

从前面 `wg-quick up wg0` 的输出来看，规则的选择器是没有添加 from 前缀（地址或者地址范围）的：

```bash
ip -4 rule add not fwmark 51820 table 51820
```

如果规则选择器没有 from 前缀，`ip rule` 就会打印出 `from all`，所以这条规则才会是这个样子。

51820 是一个路由表，也是由 wg-quick 创建的，只包含一条路由：

```bash
$ ip route show table 51820
default dev wg0 scope link
```

所以这条规则的效果是：**匹配到该规则的所有数据包都通过 WireGuard 对端进行路由**，除了 `not fwmark 0xca6c`。

0xca6c 只是一个防火墙标记，wg-quick 会让 wg 标记它发出的所有数据包（**wg set wg0 fwmark 51820**），这些数据包已经封装了其他数据包，如果这些数据包也通过 WireGuard 进行路由，就会形成一个无限路由环路。

所以 `not from all fwmark 0xca6c lookup 51820` 意思是说，满足条件 `from all fwmark 0xca6c`（WireGuard 发出的都带 fwmark 0xca6c）请忽略本条规则，继续往下走。否则，请使用 51820 路由表，通过 wg0 隧道出去。

对于 wg0 接口发包自带的 0xca6c，继续走下一条规则，也就是匹配默认的 main 路由表：

```bash
32766:  from all lookup main
```

此时已经没有抑制器了，所有的数据包都可以自由使用 main 路由表，因此 WireGuard 对端的 Endpoint 地址会通过 eth0 接口发送出去。

完美！

> wg-quick 创建的路由表和 fwmark 使用的是同一个数字：51820。0xca6c 是 51820 的十六进制表示。

## 总结

wg-quick 这种做法的巧妙之处在于，它不会扰乱你的主路由表，而是通过规则匹配新创建的路由表。断开连接时只需删除这两条路由规则，默认路由就会被重新激活。**你学废了吗？**