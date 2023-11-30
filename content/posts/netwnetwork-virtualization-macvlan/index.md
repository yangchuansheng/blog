---
keywords:
- 米开朗基杨
- macvlan
- vepa
- linux
title: "Linux 虚拟网卡技术：Macvlan"
subtitle: "Macvlan 的实现原理及其工作模式"
description: 本文主要介绍了 Macvlan 的实现原理，比较了它和 Linux Bridge 模式之间的差异及其使用场景，还详细剖析了 Macvlan 四种模式的工作原理和相关注意项。
date: 2019-03-25T17:29:43+08:00
draft: false
author: 米开朗基杨
toc: true
categories: 
- network
tags:
- Macvlan
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/mceclip0.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

## Macvlan 简介

在 Macvlan 出现之前，我们只能为一块以太网卡添加多个 IP 地址，却不能添加多个 MAC 地址，因为 MAC 地址正是通过其全球唯一性来标识一块以太网卡的，即便你使用了创建 `ethx:y` 这样的方式，你会发现所有这些“网卡”的 MAC 地址和 ethx 都是一样的，本质上，它们还是一块网卡，这将限制你做很多二层的操作。有了 `Macvlan` 技术，你可以这么做了。

Macvlan 允许你在主机的一个网络接口上配置多个虚拟的网络接口，这些网络 `interface` 有自己独立的 MAC 地址，也可以配置上 IP 地址进行通信。Macvlan 下的虚拟机或者容器网络和主机在同一个网段中，共享同一个广播域。Macvlan 和 `Bridge` 比较相似，但因为它省去了 Bridge 的存在，所以配置和调试起来比较简单，而且效率也相对高。除此之外，Macvlan 自身也完美支持 `VLAN`。

同一 VLAN 间数据传输是通过二层互访，即 MAC 地址实现的，不需要使用路由。不同 VLAN 的用户单播默认不能直接通信，如果想要通信，还需要三层设备做路由，Macvlan 也是如此。用 Macvlan 技术虚拟出来的虚拟网卡，在逻辑上和物理网卡是对等的。物理网卡也就相当于一个**交换机**，记录着对应的虚拟网卡和 MAC 地址，当物理网卡收到数据包后，会根据目的 MAC 地址判断这个包属于哪一个虚拟网卡。**这也就意味着，只要是从 Macvlan 子接口发来的数据包（或者是发往 Macvlan 子接口的数据包），物理网卡只接收数据包，不处理数据包，所以这就引出了一个问题：本机 Macvlan 网卡上面的 IP 无法和物理网卡上面的 IP 通信！**关于这个问题的解决方案我们下一节再讨论。

我们先来看一下 Macvlan 技术的流程示意图：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-11-26-23-13-0aXNFF.jpg)

简单来说，Macvlan 虚拟网卡设备是寄生在物理网卡设备上的。发包时调用自己的发包函数，查找到寄生的物理设备，然后通过物理设备发包。收包时，通过注册寄生的物理设备的 `rx_handler` 回调函数，处理数据包。

## Macvlan vs Bridge

说到 Macvlan，就不得不提 `Bridge`，因为你可以把 Macvlan 看成一个简单的 Bridge。但他们之间还是有很大的区别的。

### Bridge

Bridge 实际上就是一种旧式交换机，他们之间并没有很大的差别。Bridge 与交换机的区别在与市场，而不在与技术。交换机对网络进行分段的方式与 Bridge 相同，交换机就是一个多端口的网桥。确切地说，高端口密度的 Bridge 就称为局域网交换机。 

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-11-26-23-21-uzg6Tm.jpg)

Bridge 有以下特点：

+ Bridge 是二层设备，仅用来处理二层的通讯。
+ Bridge 使用 MAC 地址表来决定怎么转发帧（`Frame`）。
+ Bridge 会从 host 之间的通讯数据包中学习 MAC 地址。
+ 可以是硬件设备，也可以是纯软件实现(例如：`Linux Bridge`)。

以下是一个在 Linux 主机上，多个 VM 使用 bridge 相互通讯的状况：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-11-26-23-21-mZpEUH.jpg)

Linux 主机中可以通过命令行工具 `brctl` 来查看 Bridge 的配置，该工具可以通过安装软件包 `bridge-utils` 来获得。

```bash
$ brctl show

bridge name  bridge id          STP enabled  interfaces
br0          8000.080006ad34d1  no           eth0
                                             veth0
br1          8000.080021d2a187  no           veth1
                                             veth2
```

{{< alert >}}
Bridge 有可能会遇到二层环路，如有需要，你可以开启 [STP](https://www.wikiwand.com/zh-hans/%E7%94%9F%E6%88%90%E6%A0%91%E5%8D%8F%E8%AE%AE) 来防止出现环路。
{{< /alert >}}

### Macvlan

Macvlan 有以下特点：

+ 可让使用者在同一张实体网卡上设定多个 MAC 地址。
+ 承上，带有上述设定的 MAC 地址的网卡称为子接口（`sub interface`）；而实体网卡则称为父接口（`parent interface`）。
+ `parent interface` 可以是一个物理接口（eth0），可以是一个 802.1q 的子接口（eth0.10），也可以是 `bonding` 接口。
+ 可在 parent/sub interface 上设定的不只是 MAC 地址，IP 地址同样也可以被设定。
+ `sub interface` 无法直接与 `parent interface` 通讯 (带有 sub interface 的 VM 或容器无法与 host 直接通讯)。
+ 承上，若 VM 或容器需要与 host 通讯，那就必须额外建立一个 `sub interface` 给 host 用。
+ sub interface 通常以 `mac0@eth0` 的形式来命名以方便区別。

用张图来解释一下设定 Macvlan 后的样子：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-11-26-23-21-cmnaFw.jpg)

## Macvlan 的工作模式

Macvlan 共支持四种模式，分别是：

### VEPA（Virtual Ethernet Port Aggregator）

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-11-26-23-21-FNNoJq.jpg)

在 `VEPA` 模式下，所有从 Macvlan 接口发出的流量，不管目的地全部都发送给父接口，即使流量的目的地是共享同一个父接口的其它 Macvlan 接口。在二层网络场景下，由于生成树协议的原因，两个 Macvlan 接口之间的通讯会被阻塞，这时需要上层路由器上为其添加路由（需要外部交换机配置 `Hairpin` 支持，即需要兼容 802.1Qbg 的交换机支持，其可以把源和目的地址都是本地 Macvlan 接口地址的流量发回给相应的接口）。此模式下从父接口收到的广播包，会泛洪给 VEPA 模式的所有子接口。

现在大多数交换机都不支持 `Hairpin` 模式，但 Linux 主机中可以通过一种 `Harpin` 模式的 Bridge 来让 `VEPA` 模式下的不同 Macvlan 接口通信(前文已经提到，Bridge 其实就是一种旧式交换机)。怎么配置呢？非常简单，通过一条命令就可以解决：

```bash
$ brctl hairpin br0 eth1 on
```

或者使用 `iproute2` 来设置：

```bash
$ bridge link set dev eth0 hairpin on
```

如果你的内核是你手工编译升级的，那么可能你的用户态程序并不支持新内核对应的所有特性，也就是说你的 `brctl` 可能版本过老不支持 hairpin 命令，那么可以 `sysfs` 来搞定：

```bash
$ echo 1 >/sys/class/net/br0/brif/eth1/hairpin_mode
```

在 Linux 主机上配置了 `Harpin` 模式之后，源和目的地址都是本地 Macvlan 接口地址的流量，都会被 `br0`（假设你创建的 Bridge 是 br0）发回给相应的接口。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-11-26-23-21-2dXOlQ.jpg)

如果想在物理交换机层面对虚拟机或容器之间的访问流量进行优化设定，VEPA 模式将是一种比较好的选择。

{{< alert >}}
<code>VEPA</code> 和 <code>Passthru</code> 模式下，两个 Macvlan 接口之间的通信会经过主接口两次：第一次是发出的时候，第二次是返回的时候。这样会影响物理接口的宽带，也限制了不同 Macvlan 接口之间通信的速度。如果多个 Macvlan 接口之间通信比较频繁，对于性能的影响会比较明显。
{{< /alert >}}

### Bridge

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-11-26-23-21-DgMUzi.jpg)

此种模式类似 Linux 的 Bridge，拥有相同父接口的两块 Macvlan 虚拟网卡是可以直接通讯的，不需要把流量通过父网卡发送到外部网络，广播帧将会被泛洪到连接在"网桥"上的所有其他子接口和物理接口。这比较适用于让共享同一个父接口的 Macvlan 网卡进行直接通讯的场景。

这里所谓的 Bridge 指的是在这些网卡之间，数据流可以实现直接转发，不需要外部的协助，这有点类似于 Linux host 内建了一个 Bridge，即用 brctl 命令所做的那一切。但和 Linux bridge 绝不是一回事，它不需要学习 MAC 地址，也不需要 `STP`，因此效能比起使用 Linux bridge 好上很多。

{{< alert >}}
Bridge 模式有个缺点：如果父接口 down 掉，所有的 Macvlan 子接口也会全部 down 掉，同时子接口之间也将无法进行通讯。
{{< /alert >}}

### Private

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-11-26-23-21-OIReFA.jpg)

此种模式相当于 `VEPA` 模式的增强模式，其完全阻止共享同一父接口的 Macvlan 虚拟网卡之间的通讯，即使配置了 `Hairpin` 让从父接口发出的流量返回到宿主机，相应的通讯流量依然被丢弃。具体实现方式是丢弃广播/多播数据，这就意味着以太网地址解析 `arp` 将不可运行，除非手工探测 MAC 地址，否则通信将无法在同一宿主机下的多个 Macvlan 网卡间展开。之所以隔离广播流量，是因为以太网是基于广播的，隔离了广播，以太网将失去了依托。 

### Passthru

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-11-26-23-21-uuJuoP.jpg)

此种模式会直接把父接口和相应的MacVLAN接口捆绑在一起，这种模式每个父接口只能和一个 Macvlan 虚拟网卡接口进行捆绑，并且 Macvlan 虚拟网卡接口继承父接口的 MAC 地址。

此种模式的优点是虚拟机和容器可以更改 MAC 地址和其它一些接口参。

## Macvlan 和 Bridge 的使用场景

最后我们再来讨论一下 Macvlan 和 Bridge 的各自使用场景。

**使用 Macvlan :** 

+ 仅仅需要为虚拟机或容器提供访问外部物理网络的连接。
+ [Macvlan 占用较少的 CPU，同时提供较高的吞吐量](https://www.google.si/url?sa=t&rct=j&q=&esrc=s&source=web&cd=1&cad=rja&uact=8&ved=0ahUKEwiSiaXg69bLAhVDdCwKHY9KA_cQFggdMAA&url=http%3A%2F%2Fevents.linuxfoundation.org%2Fsites%2Fevents%2Ffiles%2Fslides%2FLinuxConJapan2014_makita_0.pdf&usg=AFQjCNFl2atyFB5aALHH5cKA8XkFqGQ1DQ&sig2=Nc5q1QsTrG9g8_YYRDrEog)。
+ 当使用 Macvlan 时，宿主机无法和 VM 或容器直接进行通讯。

**使用 Bridge :** 

+ 当在同一台宿主机上需要连接多个虚拟机或容器时。
+ 对于拥有多个网桥的混合环境。
+ 需要应用高级流量控制，FDB的维护。

## Macvlan 的局限性

Macvlan 是将 VM 或容器通过二层连接到物理网络的近乎理想的方案，但它也有一些局限性：

+ Linux 主机连接的交换机可能会限制同一个物理端口上的 MAC 地址数量。虽然你可以让网络管理员更改这些策略，但有时这种方法是无法实行的（比如你要去给客户做一个快速的 PoC 演示）。
+ 许多 [NIC](https://www.wikiwand.com/zh/%E7%BD%91%E5%8D%A1) 也会对该物理网卡上的 MAC地址数量有限制。超过这个限制就会影响到系统的性能。
+ [IEEE 802.11](https://www.wikiwand.com/zh-hans/IEEE_802.11) 不喜欢同一个客户端上有多个 MAC 地址，这意味着你的 Macvlan 子接口在无线网卡或 [AP](https://www.wikiwand.com/en/Wireless_access_point) 中都无法通信。可以通过复杂的办法来突破这种限制，但还有一种更简单的办法，那就是使用 `Ipvlan`，感兴趣可以自己查阅相关资料。

## 总结

本文主要介绍了 Macvlan 的实现原理，比较了它和 Linux Bridge 模式之间的差异及其使用场景，还详细剖析了 Macvlan 四种模式的工作原理和相关注意项。下一节我们将通过实际演练来模拟 Macvlan 的四种工作模式。

## 参考资料

+ [Bridge vs Macvlan](http://hicu.be/bridge-vs-macvlan)
+ [图解几个与Linux网络虚拟化相关的虚拟网卡-VETH/MACVLAN/MACVTAP/IPVLAN](https://blog.csdn.net/ztguang/article/details/51854037)
+ [iproute2/iplink: add macvlan options for bridge mode](https://lists.linuxfoundation.org/pipermail/bridge/2009-November/006842.html)
