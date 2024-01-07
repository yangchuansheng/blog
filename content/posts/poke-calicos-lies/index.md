---
keywords:
- 米开朗基杨
title: "Calico 网络通信原理揭秘"
subtitle: "戳穿 Calico 的谎言"
description: Calico 网络通信原理揭秘
date: 2019-07-30T17:00:49+08:00
draft: false
author: 米开朗基杨
toc: true
categories: Network
tags: ["calico"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-07-30-dockercalico.jpg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

Calico 是一个纯三层的数据中心网络方案，而且无缝集成像 OpenStack 这种 Iaas 云架构，能够提供可控的 VM、容器、裸机之间的 IP 通信。为什么说它是纯三层呢？因为所有的数据包都是通过路由的形式找到对应的主机和容器的，然后通过 BGP 协议来将所有路由同步到所有的机器或数据中心，从而完成整个网络的互联。

简单来说，Calico 在主机上创建了一堆的 veth pair，其中一端在主机上，另一端在容器的网络命名空间里，然后在容器和主机中分别设置几条路由，来完成网络的互联。

## Calico 网络模型揭秘

----

下面我们通过具体的例子来帮助大家理解 Calico 网络的通信原理。任意选择 k8s 集群中的一个节点作为实验节点，进入容器 A，查看容器 A 的 IP 地址：

```bash
$ ip a
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
3: eth0@if771: <BROADCAST,MULTICAST,UP,LOWER_UP,M-DOWN> mtu 1440 qdisc noqueue state UP
    link/ether 66:fb:34:db:c9:b4 brd ff:ff:ff:ff:ff:ff
    inet 172.17.8.2/32 scope global eth0
       valid_lft forever preferred_lft forever
```

这里容器获取的是 /32 位主机地址，表示将容器 A 作为一个单点的局域网。

瞄一眼容器 A 的默认路由：

```bash
$ ip route
default via 169.254.1.1 dev eth0
169.254.1.1 dev eth0 scope link
```

现在问题来了，从路由表可以知道 `169.254.1.1` 是容器的默认网关，但却找不到任何一张网卡对应这个 IP 地址，这是个什么鬼？

莫慌，先回忆一下，当一个数据包的目的地址不是本机时，就会查询路由表，从路由表中查到网关后，它首先会通过 `ARP` 获得网关的 MAC 地址，然后在发出的网络数据包中将目标 MAC 改为网关的 MAC，而网关的 IP 地址不会出现在任何网络包头中。也就是说，没有人在乎这个 IP 地址究竟是什么，只要能找到对应的 MAC 地址，能响应 ARP 就行了。

想到这里，我们就可以继续往下进行了，可以通过 `ip neigh` 命令查看一下本地的 ARP 缓存：

```bash
$ ip neigh
169.254.1.1 dev eth0 lladdr ee:ee:ee:ee:ee:ee REACHABLE
```

这个 MAC 地址应该是 Calico 硬塞进去的，而且还能响应 ARP。但它究竟是怎么实现的呢？

我们先来回想一下正常情况，内核会对外发送 ARP 请求，询问整个二层网络中谁拥有 `169.254.1.1` 这个 IP 地址，拥有这个 IP 地址的设备会将自己的 MAC
地址返回给对方。但现在的情况比较尴尬，容器和主机都没有这个 IP 地址，甚至连主机上的端口 `calicba2f87f6bb`，MAC 地址也是一个无用的 `ee:ee:ee:ee:ee:ee`。按道理容器和主机网络根本就无法通信才对呀！所以 Calico 是怎么做到的呢？

这里我就不绕弯子了，实际上 Calico 利用了网卡的代理 ARP 功能。代理 ARP 是 ARP 协议的一个变种，当 ARP 请求目标跨网段时，网关设备收到此 ARP 请求，会用自己的 MAC 地址返回给请求者，这便是代理 ARP（Proxy ARP）。举个例子：

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/2019-07-30-061928.jpg)

上面这张图中，电脑发送 ARP 请求服务器 8.8.8.8 的 MAC 地址，路由器（网关）收到这个请求时会进行判断，由于目标 8.8.8.8 不属于本网段（即跨网段），此时便返回自己的接口 MAC 地址给 PC，后续电脑访问服务器时，目标 MAC 直接封装为 MAC254。

现在我们知道，Calico 本质上还是利用了代理 ARP 撒了一个“善意的谎言”，下面我们来确认一下。

查看宿主机的网卡信息和路由信息：

```bash
$ ip addr
...
771: calicba2f87f6bb@if4: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1440 qdisc noqueue state UP group default
    link/ether ee:ee:ee:ee:ee:ee brd ff:ff:ff:ff:ff:ff link-netnsid 14
    inet6 fe80::ecee:eeff:feee:eeee/64 scope link
       valid_lft forever preferred_lft forever
...

$ ip route 
...
172.17.8.2 dev calicba2f87f6bb scope link
...
```

查看是否开启代理 ARP：

```bash
$ cat /proc/sys/net/ipv4/conf/calicba2f87f6bb/proxy_arp
1
```

如果还不放心，可以通过 tcpdump 抓包验证一下：

```bash
$ tcpdump -i calicba2f87f6bb -e -nn
tcpdump: verbose output suppressed, use -v or -vv for full protocol decode
listening on calicba2f87f6bb, link-type EN10MB (Ethernet), capture size 262144 bytes


14:27:13.565539 ee:ee:ee:ee:ee:ee > 0a:58:ac:1c:ce:12, ethertype IPv4 (0x0800), length 4191: 10.96.0.1.443 > 172.17.8.2.36180: Flags [P.], seq 403862039:403866164, ack 2023703985, win 990, options [nop,nop,TS val 331780572 ecr 603755526], length 4125
14:27:13.565613 0a:58:ac:1c:ce:12 > ee:ee:ee:ee:ee:ee, ethertype IPv4 (0x0800), length 66: 172.17.8.2.36180 > 10.96.0.1.443: Flags [.], ack 4125, win 2465, options [nop,nop,TS val 603758497 ecr 331780572], length 0
```

总结：

1. Calico 通过一个巧妙的方法将 workload 的所有流量引导到一个特殊的网关 169.254.1.1，从而引流到主机的 calixxx 网络设备上，最终将二三层流量全部转换成三层流量来转发。
2. 在主机上通过开启代理 ARP 功能来实现 ARP 应答，使得 ARP 广播被抑制在主机上，抑制了广播风暴，也不会有 ARP 表膨胀的问题。

## 模拟组网

----

既然我们已经掌握了 Calico 的组网原理，接下来就可以手动模拟验证了。架构如图所示：

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/2019-07-30-calico-test.jpg)

先在 Host0 上执行以下命令：

```bash
$ ip link add veth0 type veth peer name eth0
$ ip netns add ns0
$ ip link set eth0 netns ns0
$ ip netns exec ns0 ip a add 10.20.1.2/24 dev eth0
$ ip netns exec ns0 ip link set eth0 up
$ ip netns exec ns0 ip route add 169.254.1.1 dev eth0 scope link
$ ip netns exec ns0 ip route add default via 169.254.1.1 dev eth0
$ ip link set veth0 up
$ ip route add 10.20.1.2 dev veth0 scope link
$ ip route add 10.20.1.3 via 192.168.1.16 dev ens192
$ echo 1 > /proc/sys/net/ipv4/conf/veth0/proxy_arp
```

在 Host1 上执行以下命令：

```bash
$ ip link add veth0 type veth peer name eth0
$ ip netns add ns1
$ ip link set eth0 netns ns1
$ ip netns exec ns1 ip a add 10.20.1.3/24 dev eth0
$ ip netns exec ns1 ip link set eth0 up
$ ip netns exec ns1 ip route add 169.254.1.1 dev eth0 scope link
$ ip netns exec ns1 ip route add default via 169.254.1.1 dev eth0
$ ip link set veth0 up
$ ip route add 10.20.1.3 dev veth0 scope link
$ ip route add 10.20.1.2 via 192.168.1.32 dev ens192
$ echo 1 > /proc/sys/net/ipv4/conf/veth0/proxy_arp
```

网络连通性测试：

```bash
# Host0
$ ip netns exec ns1 ping 10.20.1.3
PING 10.20.1.3 (10.20.1.3) 56(84) bytes of data.
64 bytes from 10.20.1.3: icmp_seq=1 ttl=62 time=0.303 ms
64 bytes from 10.20.1.3: icmp_seq=2 ttl=62 time=0.334 ms
```

实验成功！

具体的转发过程如下：

1. ns0 网络空间的所有数据包都转发到一个虚拟的 IP 地址 169.254.1.1，发送 ARP 请求。
2. Host0 的 veth 端收到 ARP 请求时通过开启网卡的代理 ARP 功能直接把自己的 MAC 地址返回给 ns0。
3. ns0 发送目的地址为 ns1 的 IP 数据包。
4. 因为使用了 169.254.1.1 这样的地址，Host 判断为三层路由转发，查询本地路由 `10.20.1.3 via 192.168.1.16 dev ens192` 发送给对端 Host1，如果配置了 BGP，这里就会看到 proto 协议为 BIRD。
5. 当 Host1 收到 10.20.1.3 的数据包时，匹配本地的路由表 `10.20.1.3 dev veth0 scope link`，将数据包转发到对应的 veth0 端，从而到达 ns1。
6. 回程类似

通过这个实验，我们可以很清晰地掌握 Calico 网络的数据转发流程，首先需要给所有的 ns 配置一条特殊的路由，并利用 veth 的代理 ARP 功能让 ns 出来的所有转发都变成三层路由转发，然后再利用主机的路由进行转发。这种方式不仅实现了同主机的二三层转发，也能实现跨主机的转发。
