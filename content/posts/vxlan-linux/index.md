---
keywords:
- 米开朗基杨
- vxlan
- linux vxlan
title: "VXLAN 基础教程：在 Linux 上配置 VXLAN 网络"
date: 2020-04-18T14:14:55+08:00
lastmod: 2020-04-18T14:14:55+08:00
description: 本文通过几个例子说明如何在 Linux 中搭建基于 VXLAN 的 Overlay 网络。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocLevels: ["h2", "h3", "h4"]
tags:
- Vxlan
- Linux
categories: 
- network
libraries:
- katex
img: https://hugo-picture.oss-cn-beijing.aliyuncs.com/2020-04-24-vxlan-bridge-mini.png 
---

[上篇文章](/posts/vxlan-protocol-introduction/)结尾提到 `Linux` 是支持 `VXLAN` 的，我们可以使用 Linux 搭建基于 `VXLAN` 的 overlay 网络，以此来加深对 VXLAN 的理解，毕竟光说不练假把式。

## 1. 点对点的 VXLAN

----

先来看看最简单的点对点 `VXLAN` 网络，点对点 `VXLAN` 即两台主机构建的 `VXLAN` 网络，每台主机上有一个 `VTEP`，`VTEP` 之间通过它们的 IP 地址进行通信。点对点 VXLAN 网络拓扑图如图所示：

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20200723162239.png)

为了不影响主机的网络环境，我们可以使用 Linux `VRF` 来隔离 root network namespace 的路由。VRF（Virtual Routing and Forwarding）是由路由表和一组网络设备组成的路由实例，你可以理解为轻量级的 `network namespace`，只虚拟了三层的网络协议栈，而 `network namespace` 虚拟了整个网络协议栈。详情参看 [Linux VRF(Virtual Routing Forwarding)的原理和实现](https://blog.csdn.net/dog250/article/details/78069964)。

{{< alert >}}
Linux Kernel 版本大于 `4.3` 才支持 VRF，建议做本文实验的同学先升级内核。
{{< /alert >}}

当然了，如果你有专门用来做实验的干净主机，可以不用 VRF 来隔离。

下面结合 `VRF` 来创建一个点对点 VXLAN 网络。

首先在 `192.168.57.50` 上创建 VXLAN 接口：

```bash
$ ip link add vxlan0 type vxlan \
  id 42 \
  dstport 4789 \
  remote 192.168.57.54 \
  local 192.168.57.50 \
  dev eth0
```

重要参数解释：

+ **id 42** : 指定 `VNI` 的值，有效值在 1 到 $2^{24}$ 之间。
+ **dstport** : `VTEP` 通信的端口，IANA 分配的端口是 4789。如果不指定，Linux 默认使用 `8472`。
+ **remote** : 对端 VTEP 的地址。 
+ **local** : 当前节点 `VTEP` 要使用的 IP 地址，即当前节点隧道口的 IP 地址。
+ **dev eth0** : 当前节点用于 `VTEP` 通信的设备，用来获取 VTEP IP 地址。**这个参数与 local 参数目的相同，二选一即可**。

查看 `vxlan0` 的详细信息：

```bash
$ ip -d link show vxlan0

11: vxlan0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue master vrf-test state UNKNOWN mode DEFAULT group default qlen 1000
    link/ether 82:f3:76:95:ab:e1 brd ff:ff:ff:ff:ff:ff promiscuity 0
    vxlan id 42 remote 192.168.57.54 local 192.168.57.50 srcport 0 0 dstport 4789 ageing 300 udpcsum noudp6zerocsumtx noudp6zerocsumrx
```

接下来创建一个 VRF，并将 `vxlan0` 绑定到该 `VRF` 中：

```bash
$ ip link add vrf0 type vrf table 10
$ ip link set vrf0 up
$ ip link set vxlan0 master vrf0
```

再次查看 `vxlan0` 的信息：

```bash
$ ip -d link show vxlan0

13: vxlan0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue master vrf0 state UNKNOWN mode DEFAULT group default qlen 1000
    link/ether aa:4d:80:e3:75:e0 brd ff:ff:ff:ff:ff:ff promiscuity 0
    vxlan id 42 remote 192.168.57.54 local 192.168.57.50 srcport 0 0 dstport 4789 ageing 300 udpcsum noudp6zerocsumtx noudp6zerocsumrx
    vrf_slave table 10 addrgenmode eui64 numtxqueues 1 numrxqueues 1 gso_max_size 65536 gso_max_segs 65535
```

你会发现多了 VRF 的信息。

接下来为 vxlan0 配置 IP 地址并启用它：

```bash
$ ip addr add 172.18.1.2/24 dev vxlan0
$ ip link set vxlan0 up
```

执行成功后会发现 VRF 路由表项多了下面的内容，所有目的地址是 `172.18.1.0/24` 网络包要通过 vxlan0 转发：

```bash
$ ip route show vrf vrf0

172.18.1.0/24 dev vxlan0 proto kernel scope link src 172.18.1.2
```

同时也会增加一条 `FDB` 转发表：

```bash
$ bridge fdb show

00:00:00:00:00:00 dev vxlan0 dst 192.168.57.54 self permanent
```

这个表项的意思是，默认的 `VTEP` 对端地址为 `192.168.57.54`。换句话说，原始报文经过 `vxlan0` 后会被内核添加上 VXLAN 头部，而外部 UDP 头的目的 IP 地址会被冠上 `192.168.57.54`。

在另一台主机（192.168.57.54）上也进行相同的配置：

```bash
$ ip link add vxlan0 type vxlan id 42 dstport 4789 remote 192.168.57.50
$ ip link add vrf0 type vrf table 10
$ ip link set vrf0 up
$ ip link set vxlan0 master vrf0
$ ip addr add 172.18.1.3/24 dev vxlan0
$ ip link set vxlan0 up
```

一切大功告成之后，就可以相互通信了，在 `192.168.57.50` 上 ping `172.18.1.3`：

```bash
$ ping 172.18.1.3 -I vrf0
```

同时使用 `wireshark` 远程抓包：

```bash
$ ssh root@192.168.57.54 'tcpdump -i any -s0 -c 10 -nn -w - port 4789' | /Applications/Wireshark.app/Contents/MacOS/Wireshark -k -i -
```

具体含义我就不解释了，参考 [Tcpdump 示例教程](/posts/tcpdump-examples/#%E5%B0%86%E8%BE%93%E5%87%BA%E5%86%85%E5%AE%B9%E9%87%8D%E5%AE%9A%E5%90%91%E5%88%B0-wireshark)。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20200723162240.jpg)

可以看到 `VXLAN` 报文可以分为三块：

+ 最内层是 overlay 网络中实际通信的实体看到的报文（比如这里的 `ARP` 请求），它们和经典网络的通信报文没有任何区别，除了因为 `MTU` 导致有些报文比较小。
+ 中间一层是 VXLAN 头部，我们最关心的字段 `VNI` 确实是 `42`。
+ 最外层是 `VTEP` 所在主机的通信报文头部，目的 IP 地址为对端 `192.168.57.54`。

下面来分析这个最简单的模式下 vxlan 通信的过程：

1. 发送 ping 报文到 `172.18.1.3`，查看路由表，报文会从 `vxlan0` 发出去。

2. 内核发现 `vxlan0` 的 IP 是 `172.18.1.2/24`，和目的 IP 在同一个网段，所以在同一个局域网，需要知道对方的 MAC 地址，因此会发送 `ARP` 报文查询。

3. `ARP` 报文源 MAC 地址为 `vxlan0` 的 MAC 地址，目的 MAC 地址为全 1 的广播地址（ff:ff:ff:ff:ff:ff）。

4. `VXLAN` 根据配置（VNI 42）添加上头部。

5. 对端的 `VTEP` 地址为 192.168.57.54，将报文发送到该地址。

6. 对端主机接收到这个报文，内核发现是 VXLAN 报文，会根据 `VNI` 发送给对应的 `VTEP`。

7. `VTEP` 去掉 VXLAN 头部，取出真正的 `ARP` 请求报文，同时，`VTEP` 会记录源 `MAC` 地址和 IP 地址信息到 `FDB` 表中，这便是一次学习过程。然后生成 `ARP` 应答报文。

   ```bash
   $ bridge fdb show
   
   00:00:00:00:00:00 dev vxlan0 dst 192.168.57.50 self permanent
   aa:4d:80:e3:75:e0 dev vxlan0 dst 192.168.57.50 self
   ```

   

8. 应答报文目的 MAC 地址是发送方 `VTEP` 的 MAC 地址，目的 IP 是发送方 `VTEP` 的 IP 地址，直接发送给目的 VTEP。

9. 应答报文通过 underlay 网络直接返回给发送方主机，发送方主机根据 `VNI` 把报文转发给 VTEP，VTEP 解包取出 ARP 应答报文，添加 `ARP` 缓存到内核，并根据报文学习到目的 `VTEP` 的 `IP` 地址和目的 `MAC` 地址，添加到 `FDB` 表中。

   ```bash
   $ ip neigh show vrf vrf0
   
   172.18.1.3 dev vxlan0 lladdr 76:06:5c:15:d9:78 STALE
   
   $ bridge fdb show
   
   00:00:00:00:00:00 dev vxlan0 dst 192.168.57.54 self permanent
   fe:4a:7e:a2:b5:5d dev vxlan0 dst 192.168.57.54 self
   ```

10. 至此 `VTEP` 已经知道了通信需要的所有信息，后续 ICMP 的 ping 报文都是在这条逻辑隧道中单播进行的，不再需要发送 `ARP` 报文查询。

总结以上过程：一个 VXLAN 网络的 ping 报文要经历 **ARP 寻址 + ICMP 响应** 两个过程，一旦 `VTEP` 设备学习到了对方 ARP 地址，后续通信就可以免去 `ARP` 寻址的过程。

## 2. VXLAN + Bridge

----

上述的点对点 `VXLAN` 网络通信双方只有一个 `VTEP`，且只有一个通信实体，而在实际生产中，每台主机上都有几十台甚至上百台虚拟机或容器需要通信，因此需要一种机制将这些**通信实体**组织起来，再通过隧道口 `VTEP` 转发出去。

方案其实也很常见，Linux Bridge 就可以将多块虚拟网卡连接起来，因此可以选择使用 `Bridge` 将多个虚拟机或容器放到同一个 VXLAN 网络中，网络拓扑图如图所示：

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20200723162241.png)

和上面的模式相比，这里只是多了一个 `Bridge`，用来连接不同 network namespace 中的 `veth pair`，同时 `VXLAN` 网卡也需要连接到该 `Bridge`。

首先在 `192.168.57.50` 上创建 VXLAN 接口：

```bash
$ ip link add vxlan0 type vxlan \
  id 42 \
  dstport 4789 \
  local 192.168.57.50 \
  remote 192.168.57.54
```

然后创建网桥 `bridge0`，把 VXLAN 网卡 `vxlan0` 绑定到上面，然后将 `bridge0` 绑定到 `VRF` 中，并启动它们：

```bash
$ ip link add br0 type bridge
$ ip link set vxlan0 master br0
$ ip link add vrf0 type vrf table 10
$ ip link set br0 master vrf0
$ ip link set vxlan0 up
$ ip link set br0 up
$ ip link set vrf0 up
```

下面创建 `network namespace` 和一对 `veth pair`，并把 veth pair 的其中一端绑定到网桥，然后把另一端放到 network namespace 并绑定 IP 地址 `172.18.1.2`：

```bash
$ ip netns add ns0

$ ip link add veth0 type veth peer name eth0 netns ns0
$ ip link set veth0 master br0
$ ip link set veth0 up

$ ip -n ns0 link set lo up
$ ip -n ns0 addr add 172.18.1.2/24 dev eth0
$ ip -n ns0 link set eth0 up
```

用同样的方法在另一台主机上配置 VXLAN 网络，绑定 `172.18.1.3` 到另外一个 `network namespace` 中的 eth0：

```bash
$ ip link add vxlan0 type vxlan \
  id 42 \
  dstport 4789 \
  local 192.168.57.54 \
  remote 192.168.57.50
  
$ ip link add br0 type bridge
$ ip link set vxlan0 master br0
$ ip link add vrf0 type vrf table 10
$ ip link set br0 master vrf0
$ ip link set vxlan0 up
$ ip link set br0 up
$ ip link set vrf0 up

$ ip netns add ns0

$ ip link add veth0 type veth peer name eth0 netns ns0
$ ip link set veth0 master br0
$ ip link set veth0 up

$ ip -n ns0 link set lo up
$ ip -n ns0 addr add 172.18.1.3/24 dev eth0
$ ip -n ns0 link set eth0 up
```

从 `172.18.1.2` ping `172.18.1.3` 发现整个通信过程和前面的实验类似，只不过容器发出的 `ARP` 报文会先经过网桥，再转发给 `vxlan0`，然后在 `vxlan0` 处由 Linux 内核添加 VXLAN 头部，最后发送给对端。

逻辑上，VXLAN 网络下不同主机上的 `network namespace` 中的网卡都被连接到了同一个网桥上，这样就可以在同一个主机上创建同一 `VXLAN` 网络下的多个容器，并相互通信了。

## 3. 多播模式的 VXLAN

----

上面两种模式只能点对点连接，也就是说同一个 VXLAN 网络中只能有两个节点，这怎么能忍。。。有没有办法让同一个 VXLAN 网络中容纳多个节点呢？我们先来回顾一下 VXLAN 通信的两个关键信息：

1. 对方虚拟机（或容器）的 `MAC` 地址
2. 对方所在主机的 IP 地址（即对端 `VTEP` 的 IP 地址）

跨主机的容器之间首次通信时需要知道对方的 `MAC` 地址，因此会发送 `ARP` 报文查询。如果有多个节点，就要把 `ARP` 查询报文发送到所有节点，但传统的 `ARP` 报文广播是做不到的，因为 Underlay 和 Overlay 不在同一个二层网络，默认情况下 `ARP` 广播是**逃不出**主机的。要想实现 Overlay 网络的广播，必须要把报文发送到所有 VTEP 所在的节点，为了解决这个问题，大概有两种思路：

1. 使用多播，把网络中的某些节点组成一个虚拟的整体。
2. 事先知道 `MAC` 地址和 `VTEP IP` 信息，直接把 `ARP` 和 `FDB` 信息告诉发送方 VTEP。一般是通过外部的分布式控制中心来收集这些信息，收集到的信息会分发给同一个 VXLAN 网络的所有节点。

我们先来看看多播是怎么实现的，分布式控制中心留到下一篇再讲。

{{< alert >}}
如果 VXLAN 要使用多播模式，需要底层的网络支持多播功能，多播地址范围为 `224.0.0.0~239.255.255.255`。
{{< /alert >}}

和上面的 点对点 VXLAN + Bridge 模式相比，这里只是将对端的参数改成 `group` 参数，其他不变，命令如下：

```bash
# 在主机 192.168.57.50 上执行
$ ip link add vxlan0 type vxlan \
  id 42 \
  dstport 4789 \
  local 192.168.57.50 \
  group 224.1.1.1
  
$ ip link add br0 type bridge
$ ip link set vxlan0 master br0
$ ip link add vrf0 type vrf table 10
$ ip link set br0 master vrf0
$ ip link set vxlan0 up
$ ip link set br0 up
$ ip link set vrf0 up

$ ip netns add ns0

$ ip link add veth0 type veth peer name eth0 netns ns0
$ ip link set veth0 master br0
$ ip link set veth0 up

$ ip -n ns0 link set lo up
$ ip -n ns0 addr add 172.18.1.2/24 dev eth0
$ ip -n ns0 link set eth0 up
```

```bash
# 在主机 192.168.57.54 上执行
$ ip link add vxlan0 type vxlan \
  id 42 \
  dstport 4789 \
  local 192.168.57.54 \
  group 224.1.1.1
  
$ ip link add br0 type bridge
$ ip link set vxlan0 master br0
$ ip link add vrf0 type vrf table 10
$ ip link set br0 master vrf0
$ ip link set vxlan0 up
$ ip link set br0 up
$ ip link set vrf0 up

$ ip netns add ns0

$ ip link add veth0 type veth peer name eth0 netns ns0
$ ip link set veth0 master br0
$ ip link set veth0 up

$ ip -n ns0 link set lo up
$ ip -n ns0 addr add 172.18.1.3/24 dev eth0
$ ip -n ns0 link set eth0 up
```

和上面的实验明显有区别的是 FDB 表项的内容：

```bash
$ bridge fdb show

00:00:00:00:00:00 dev vxlan0 dst 224.1.1.1 self permanent
```

`dst` 字段的值变成了多播地址 `224.1.1.1`，而不是之前对方的 VTEP 地址，VTEP 会通过 [IGMP（**I**nternet **G**roup **M**anagement **P**rotocol）](https://zh.wikipedia.org/wiki/%E5%9B%A0%E7%89%B9%E7%BD%91%E7%BB%84%E7%AE%A1%E7%90%86%E5%8D%8F%E8%AE%AE) 加入同一个多播组 `224.1.1.1`。

我们来分析下多播模式下 `VXLAN` 通信的全过程：

1. 发送 ping 报文到 `172.18.1.3`，查看路由表，报文会从 `vxlan0` 发出去。
2. 内核发现 `vxlan0` 的 IP 是 `172.18.1.2/24`，和目的 IP 在同一个网段，所以在同一个局域网，需要知道对方的 MAC 地址，因此会发送 `ARP` 报文查询。
3. `ARP` 报文源 MAC 地址为 `vxlan0` 的 MAC 地址，目的 MAC 地址为全 1 的广播地址（ff:ff:ff:ff:ff:ff）。
4. `VXLAN` 根据配置（VNI 42）添加上头部。
5. **到这一步就和之前不一样了**，由于不知道对端 `VTEP` 在哪台主机，根据多播配置，`VTEP` 会往多播地址 `224.1.1.1` 发送多播报文。
6. 多播组中的所有主机都会收到这个报文，内核发现是 `VXLAN` 报文，就会根据 `VNI` 发送给相应的 `VTEP`。
7. 收到报文的所有主机的 `VTEP` 会去掉 `VXLAN` 的头部，取出真正的 `ARP` 请求报文。同时，`VTEP` 会记录源 `MAC` 地址和 IP 地址信息到 `FDB` 表中，这便是一次学习过程。如果发现 `ARP` 不是发送给自己的，就直接丢弃；如果是发送给自己的，则生成 `ARP` 应答报文。
8. 后面的步骤就和上面的实验相同了。

整个通信过程和之前比较类似，只是 `Underlay` 采用组播的方式发送报文，对于多节点的 `VXLAN` 网络来说比较简单高效。但多播也是有它的问题的，并不是所有网络设备都支持多播（比如公有云），再加上多播方式带来的报文浪费，在实际生成中很少被采用。下篇文章就着重介绍如何通过分布式控制中心来自动发现 `VTEP` 和 `MAC` 地址等信息。

## 4. 参考资料

----

+ [linux 上实现 vxlan 网络](https://cizixs.com/2017/09/28/linux-vxlan/)
