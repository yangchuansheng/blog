---
keywords:
- 米开朗基杨
- macvlan
- linux
title: "Macvlan 网络方案实践"
subtitle: "通过实验来验证 Macvlan Bridge 模式的连通性"
description: 通过实验来验证 Macvlan Bridge 模式的连通性。
date: 2019-04-01T10:20:04+08:00
draft: false
author: 米开朗基杨
toc: true
categories: 
- network
tags:
- Macvlan
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/docker_networking-banner1.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

通过[上篇文章](/posts/netwnetwork-virtualization-macvlan/)的学习，我们已经知道 Macvlan 四种模式的工作原理，其中最常用的就是 Bridge 模式，本文我们将通过实验来验证 Macvlan Bridge 模式的连通性。

Macvlan 是 linux 内核比较新的特性，可以通过以下方法判断当前系统是否支持：

```bash
$ modprobe macvlan
$ lsmod | grep macvlan
  macvlan                19233  0
```

如果第一个命令报错，或者第二个命令没有返回，则说明当前系统不支持 Macvlan，需要升级系统或者升级内核。

## 各个 Linux 发行版对 Macvlan 的支持

----

Macvlan 对 Kernel 版本依赖：`Linux kernel v3.9–3.19` and `4.0+`。几个重要发行版支持情况：

+ ubuntu：>= saucy(13.10)
+ RHEL(Red Hat Enterprise Linux): >= 7.0(3.10.0)
+ Fedora: >=19(3.9)
+ Debian: >=8(3.16)

各个发行版的内核都可以自行手动升级，具体操作可以参考官方提供的文档。

以上版本信息参考了这些资料：

+ [List of ubuntu versions with corresponding linux kernel version](http://askubuntu.com/questions/517136/list-of-ubuntu-versions-with-corresponding-linux-kernel-version)
+ [Red Hat Enterprise Linux Release Dates](https://access.redhat.com/articles/3078)

## 实验环境

----

后面的测试将会在以下环境进行：

|     OS     | hostname | 物理网卡 |         IP        |   Gateway   |
|:----------:|:--------:|:--------:|:-----------------:|:-----------:|
| CentOS 7.3 |   node1  |  ens160  |  192.168.179.9/16 | 192.168.1.1 |
| CentOS 7.3 |   node2  |  ens160  | 192.168.179.10/16 | 192.168.1.1 |

我的本地操作系统为 MacOS，IP 为 `10.8.0.241`，网关为 `10.8.0.1`。

## 连通性测试

----

下面开始对 Bridge 模式下 Macvlan 的连通性进行测试。

首先在 `node1` 上创建两个 network namespace：

```bash
# 开启混杂模式
$ ip link set ens160 promisc on

$ ip netns add ns1
$ ip netns add ns2
```

然后创建 Macvlan 接口:

```bash
$ ip link add link ens160 mac1 type macvlan mode bridge
```

创建的格式为 `ip link add link <PARENT> <NAME> type macvlan mode <MODE>`，其中 `<PARENT>` 是 Macvlan 接口的父接口名称，`<NAME>` 是新建的 Macvlan 接口的名称，这个名字可以任意取，`<MODE>` 是 Macvlan 的模式。

可以查看创建接口的详细信息：

```bash
$ ip -d link show mac1

13: mac1@ens160: <BROADCAST,MULTICAST> mtu 1500 qdisc noop state DOWN mode DEFAULT qlen 1000
    link/ether 5a:94:85:a6:96:95 brd ff:ff:ff:ff:ff:ff promiscuity 0
    macvlan  mode bridge addrgenmode eui64
```

下面就是把创建的 Macvlan 接口放到 network namespace 中，配置好 IP 地址，然后启用它：

```bash
$ ip link set mac1 netns ns1
$ ip netns exec ns1 ip addr add 192.168.179.12/16 dev mac1
$ ip netns exec ns1 ip link set dev mac1 up
```

同理可以配置另外一个 Macvlan 接口：

```bash
$ ip link add link ens160 mac2 type macvlan mode bridge
$ ip link set mac2 netns ns2
$ ip netns exec ns2 ip addr add 192.168.179.13/16 dev mac2
$ ip netns exec ns2 ip link set dev mac2 up
```

可以测试两个 IP 的连通性：

### ns1 --> ns2

```bash
$ ip netns exec ns1 ping -c 3 192.168.179.13

PING 192.168.179.13 (192.168.179.13) 56(84) bytes of data.
64 bytes from 192.168.179.13: icmp_seq=1 ttl=64 time=0.090 ms
64 bytes from 192.168.179.13: icmp_seq=2 ttl=64 time=0.061 ms

--- 192.168.179.13 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1000ms
rtt min/avg/max/mdev = 0.061/0.075/0.090/0.016 ms
```

### ns2 --> ns1

```bash
$ ip netns exec ns2 ping -c 2 192.168.179.12

PING 192.168.179.12 (192.168.179.12) 56(84) bytes of data.
64 bytes from 192.168.179.12: icmp_seq=1 ttl=64 time=0.059 ms
64 bytes from 192.168.179.12: icmp_seq=2 ttl=64 time=0.043 ms

--- 192.168.179.12 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1000ms
rtt min/avg/max/mdev = 0.043/0.051/0.059/0.008 ms
```

### ns1 --> 192.168/16

首先测试 ns1 与 `node2` 的连通性：

```bash
$ ip netns exec ns1 ping -c 2 192.168.179.10

PING 192.168.179.10 (192.168.179.10) 56(84) bytes of data.
64 bytes from 192.168.179.10: icmp_seq=1 ttl=64 time=0.976 ms
64 bytes from 192.168.179.10: icmp_seq=2 ttl=64 time=0.430 ms

--- 192.168.179.10 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1001ms
rtt min/avg/max/mdev = 0.430/0.703/0.976/0.273 ms
```

下面测试 ns1 与 node2 中 network namespace 的连通性。

先在 node2 中配置一个 Macvlan 接口：

```bash
[root@node2 ~]# ip link set ens160 promisc on
[root@node2 ~]# ip netns add ns1
[root@node2 ~]# ip link add link ens160 mac1 type macvlan mode bridge
[root@node2 ~]# ip link set mac1 netns ns1
[root@node2 ~]# ip netns exec ns1 ip addr add 192.168.179.14/16 dev mac1
[root@node2 ~]# ip link set dev mac1 up
```

测试 node1 的 ns1 与 node2 的 ns1 的连通性：

```bash
[root@node1 ~]# ip netns exec ns1 ping -c 2 192.168.179.14

PING 192.168.179.14 (192.168.179.14) 56(84) bytes of data.
64 bytes from 192.168.179.14: icmp_seq=1 ttl=64 time=0.976 ms
64 bytes from 192.168.179.14: icmp_seq=2 ttl=64 time=0.430 ms

--- 192.168.179.14 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1001ms
rtt min/avg/max/mdev = 0.430/0.703/0.976/0.273 ms
```

### 10.8/16 --> ns1

```bash
# 在本地的 MacOS 客户端 ping 192.168.179.12
$ ping 192.168.179.12 -c 2

PING 192.168.179.12 (192.168.179.12): 56 data bytes
Request timeout for icmp_seq 0

--- 192.168.179.12 ping statistics ---
2 packets transmitted, 0 packets received, 100.0% packet loss
```

发现跨三层网段是 ping 不通的。这个问题很好解决，我们刚刚给 `ns1` 和 `ns2` 分配 IP 的时候并没有指定默认路由，指定个默认路由问题就迎刃而解了。

```bash
$ ip netns exec ns1 ip route add default via 192.168.1.1 dev mac1
```

{{< alert >}}
如果你想开发 Macvlan cni 插件，这个地方需要注意一下，每次给 Pod 分配好 IP 以后要添加一条默认路由指向网关，不然无法跨三层通信。
{{< /alert >}}

### ns1 --> ens160

```bash
$ ip netns exec ns1 ping -c 2 192.168.179.9

PING 192.168.179.9 (192.168.179.9) 56(84) bytes of data.

--- 192.168.179.9 ping statistics ---
2 packets transmitted, 0 received, 100% packet loss, time 999ms
```

这里就遇到了我在[上一篇文章](/posts/netwnetwork-virtualization-macvlan/#span-id-inline-toc-1-span-macvlan-简介)开头提到的问题。到目前为止，整个实验的拓扑结构如下：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting5@main/uPic/2023-11-26-23-12-pBrsLq.jpg)

其实也很好解决，额外创建一个 Macvlan 子接口，并把 ens160 的 IP 分给这个子接口，最后还要修改默认路由。

```bash
$ ip link add link ens160 mac0 type macvlan mode bridge
# 下面的命令一定要放在一起执行，否则中间会失去连接
$ ip addr del 192.168.179.9/16 dev ens160 && \
  ip addr add 192.168.179.9/16 dev mac0 && \
  ip link set dev mac0 up && \
  ip route flush dev ens160 && \
  ip route flush dev mac0 && \
  ip route add 192.168.0.0/16 dev mac0 metric 0 && \
  ip route add default via 192.168.1.1 dev mac0 &
```

{{< alert >}}
这里一定不能 Down 掉 <code>ens160</code>，否则所有的子接口都将无法工作。
{{< /alert >}}

现在就能 ping 通了：

```bash
$ ip netns exec ns1 ping -c 2 192.168.179.9

PING 192.168.179.9 (192.168.179.9) 56(84) bytes of data.
64 bytes from 192.168.179.9: icmp_seq=1 ttl=64 time=0.137 ms
64 bytes from 192.168.179.9: icmp_seq=2 ttl=64 time=0.078 ms

--- 192.168.179.9 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 999ms
rtt min/avg/max/mdev = 0.078/0.107/0.137/0.031 ms
```
