---
keywords:
- 米开朗基杨 
- netfilter
- nftables
- nftables 教程
title: "nftables 中文教程"
subtitle: "nftables 命令行工具 nft 的用法"
description: 本文带你了解 nftables 的功能和用法，包括集合和字典等高级用法。
date: 2019-09-29T21:01:14+08:00
draft: false
author: 米开朗基杨
toc: true
categories:
- Linux
tags:
- Nftables
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/2020-04-24-130811.webp"
---

nftables 是一个 `netfilter` 项目，旨在替换现有的 {ip,ip6,arp,eb}tables 框架，为 {ip,ip6}tables 提供一个新的包过滤框架、一个新的用户空间实用程序（nft）和一个兼容层。它使用现有的钩子、链接跟踪系统、用户空间排队组件和 `netfilter` 日志子系统。

nftables 主要由三个组件组成：内核实现、libnl netlink 通信和 nftables 用户空间。 其中内核提供了一个 `netlink` 配置接口以及运行时规则集评估，`libnl` 包含了与内核通信的基本函数，用户空间可以通过 `nft` 和用户进行交互。

本文是 nftables 中文教程，主要介绍用户空间命令行工具 `nft` 的用法。

## nftables VS iptables

nftables 和 iptables 一样，由表（table）、链（chain）和规则（rule）组成，其中表包含链，链包含规则，规则是真正的 action。与 iptables 相比，nftables 主要有以下几个变化：

+ `iptables` 规则的布局是基于连续的大块内存的，即数组式布局；而 `nftables` 的规则采用链式布局。其实就是数组和链表的区别，好像 Kubernetes 用户对此应该很兴奋？
+ `iptables` 大部分工作在内核态完成，如果要添加新功能，只能重新编译内核；而 `nftables` 的大部分工作是在用户态完成的，添加新功能很 easy，不需要改内核。
+ `iptables` 有内置的链，即使你只需要一条链，其他的链也会跟着注册；而 `nftables` 不存在内置的链，你可以按需注册。由于 `iptables` 内置了一个数据包计数器，所以即使这些内置的链是空的，也会带来性能损耗。
+ 简化了 `IPv4/IPv6` 双栈管理
+ 原生支持集合、字典和映射

回到 nftables，先来看一下默认的规则集是啥：

```bash
$ nft list ruleset
```

啥也没有，果然是没有内置的链啊（如果你关闭了 `firewalld` 服务）。

## 创建表

nftables 的每个表只有一个地址簇，并且只适用于该簇的数据包。表可以指定五个簇中的一个：

|     nftables簇     | iptables命令行工具 |
|:----------:|:--------:|
| ip |   iptables  |
| ip6 |   ip6tables  |
| inet |   iptables和ip6tables  |
| arp |   arptables  |
| bridge |   ebtables  |

`inet` 同时适用于 IPv4 和 IPv6 的数据包，即统一了 `ip` 和 `ip6` 簇，可以更容易地定义规则，下文的示例都将采用 inet 簇。

先创建一个新的表：

```bash
$ nft add table inet my_table
```

列出所有的规则：
```bash
$ nft list ruleset
table inet my_table {
}
```

现在表中还没有任何规则，需要创建一个链来保存规则。

## 创建链

链是用来保存规则的，和表一样，链也需要被显示创建，因为 nftables 没有内置的链。链有以下两种类型：

+ **常规链** : 不需要指定钩子类型和优先级，可以用来做跳转，从逻辑上对规则进行分类。
+ **基本链** : 数据包的入口点，需要指定钩子类型和优先级。

创建常规链：

```bash
$ nft add chain inet my_table my_utility_chain
```

创建基本链：

```bash
$ nft add chain inet my_table my_filter_chain { type filter hook input priority 0 \; }
```

+ 反斜线（`\`）用来转义，这样 shell 就不会将分号解释为命令的结尾。
+ `priority` 采用整数值，可以是负数，值较小的链优先处理。

列出链中的所有规则：

```bash
$ nft list chain inet my_table my_utility_chain
table inet my_table {
        chain my_utility_chain {
        }
}

$ nft list chain inet my_table my_filter_chain
table inet my_table {
        chain my_filter_chain {
                type filter hook input priority 0; policy accept;
        }
}
```

## 创建规则

有了表和链之后，就可以创建规则了，规则由语句或表达式构成，包含在链中。下面添加一条规则允许 SSH 登录：

```bash
$ nft add rule inet my_table my_filter_chain tcp dport ssh accept
```

`add` 表示将规则添加到链的末尾，如果想将规则添加到链的开头，可以使用 `insert`。

```bash
$ nft insert rule inet my_table my_filter_chain tcp dport http accept
```

列出所有规则：

```bash
$ nft list ruleset
table inet my_table {
        chain my_filter_chain {
                type filter hook input priority 0; policy accept;
                tcp dport http accept
                tcp dport ssh accept
        }
}
```

注意 http 规则排在 ssh 规则的前面，因为之前使用了 `insert`。

也可以将规则插入到链的指定位置，有两种方法：

1、 使用 `index` 来指定规则的索引。`add` 表示新规则添加在索引位置的规则后面，`inser` 表示新规则添加在索引位置的规则前面。index 的值从 0 开始增加。

```bash
$ nft insert rule inet my_table my_filter_chain index 1 tcp dport nfs accept
$ nft list ruleset
table inet my_table {
     chain my_filter_chain {
             type filter hook input priority 0; policy accept;
             tcp dport http accept
             tcp dport nfs accept
             tcp dport ssh accept
     }
}

$ nft add rule inet my_table my_filter_chain index 0 tcp dport 1234 accept
$ nft list ruleset
table inet my_table {
     chain my_filter_chain {
             type filter hook input priority 0; policy accept;
             tcp dport http accept
             tcp dport 1234 accept
             tcp dport nfs accept
             tcp dport ssh accept
     }
}
```
   
`index` 类似于 iptables 的 `-I` 选项，但有两点需要注意：一是 index 的值是从 0 开始的；二是 index 必须指向一个存在的规则，比如 `nft insert rule … index 0` 就是非法的。
   
2、 使用 `handle` 来指定规则的句柄。`add` 表示新规则添加在索引位置的规则后面，`inser` 表示新规则添加在索引位置的规则前面。`handle` 的值可以通过参数 `--handle` 获取。

```bash
$ nft --handle list ruleset
table inet my_table { # handle 10
     chain my_filter_chain { # handle 2
             type filter hook input priority 0; policy accept;
             tcp dport http accept # handle 4
             tcp dport 1234 accept # handle 6
             tcp dport nfs accept # handle 5
             tcp dport ssh accept # handle 3
     }
}

$ nft add rule inet my_table my_filter_chain handle 4 tcp dport 1234 accept
$ nft insert rule inet my_table my_filter_chain handle 5 tcp dport nfs accept
$ nft --handle list ruleset
table inet my_table { # handle 10
     chain my_filter_chain { # handle 2
             type filter hook input priority 0; policy accept;
             tcp dport http accept # handle 4
             tcp dport 2345 accept # handle 8
             tcp dport 1234 accept # handle 6
             tcp dport 3456 accept # handle 9
             tcp dport nfs accept # handle 5
             tcp dport ssh accept # handle 3
     }
}
```
   
在 nftables 中，句柄值是固定不变的，除非规则被删除，这就为规则提供了稳定的索引。而 `index` 的值是可变的，只要有新规则插入，就有可能发生变化。一般建议使用 `handle` 来插入新规则。

也可以在创建规则时就获取到规则的句柄值，只需要在创建规则时同时加上参数 `--echo` 和 `--handle`。

```bash
$ nft --echo --handle add rule inet my_table my_filter_chain udp dport 3333 accept
add rule inet my_table my_filter_chain udp dport 3333 accept # handle 10
```

## 删除规则

单个规则只能通过其句柄删除，首先需要找到你想删除的规则句柄：

```bash
$ nft --handle list ruleset
table inet my_table { # handle 10
        chain my_filter_chain { # handle 2
                type filter hook input priority 0; policy accept;
                tcp dport http accept # handle 4
                tcp dport 2345 accept # handle 8
                tcp dport 1234 accept # handle 6
                tcp dport 3456 accept # handle 9
                tcp dport nfs accept # handle 5
                tcp dport ssh accept # handle 3
                udp dport 3333 accept # handle 10
        }
}
```

然后使用句柄值来删除该规则：

```bash
$ nft delete rule inet my_table my_filter_chain handle 8
$ nft --handle list ruleset
table inet my_table { # handle 10
        chain my_filter_chain { # handle 2
                type filter hook input priority 0; policy accept;
                tcp dport http accept # handle 4
                tcp dport 1234 accept # handle 6
                tcp dport 3456 accept # handle 9
                tcp dport nfs accept # handle 5
                tcp dport ssh accept # handle 3
                udp dport 3333 accept # handle 10
        }
}
```

## 列出规则

----

前面的示例都是列出了所有规则，我们还可以根据自己的需求列出规则的一部分。例如：

列出某个表中的所有规则：

```bash
$ nft list table inet my_table
table inet my_table {
        chain my_filter_chain {
                type filter hook input priority 0; policy accept;
                tcp dport http accept
                tcp dport 1234 accept
                tcp dport 3456 accept
                tcp dport nfs accept
                tcp dport ssh accept
                udp dport 3333 accept
        }
}
```

列出某条链中的所有规则：

```bash
$ nft list chain inet my_table my_other_chain
table inet my_table {
    chain my_other_chain {
        udp dport 12345 log prefix "UDP-12345"
    }
}
```

## 集合

`nftables` 的语法原生支持集合，可以用来匹配多个 IP 地址、端口号、网卡或其他任何条件。

### 匿名集合

集合分为**匿名集合**与**命名集合**，匿名集合比较适合用于将来不需要更改的规则。

例如，下面的规则允许来自源 IP 处于 `10.10.10.123 ~ 10.10.10.231` 这个区间内的主机的流量。

```bash
$ nft add rule inet my_table my_filter_chain ip saddr { 10.10.10.123, 10.10.10.231 } accept
$ nft list ruleset
table inet my_table {
        chain my_filter_chain {
                type filter hook input priority 0; policy accept;
                tcp dport http accept
                tcp dport nfs accept
                tcp dport ssh accept
                ip saddr { 10.10.10.123, 10.10.10.231 } accept
        }
}
```

匿名集合的缺点是，如果需要修改集合，就得替换规则。如果后面需要频繁修改集合，推荐使用命名集合。

之前的示例中添加的规则也可以通过集合来简化：

```bash
$ nft add rule inet my_table my_filter_chain tcp dport { http, nfs, ssh } accept
```

> iptables 可以借助 `ipset` 来使用集合，而 nftables 原生支持集合，所以不需要借助 `ipset`。

### 命名集合

nftables 也支持命名集合，命名集合是可以修改的。创建集合需要指定其元素的类型，当前支持的数据类型有：

+ `ipv4_addr` : IPv4 地址
+ `ipv6_addr` : IPv6 地址
+ `ether_addr` : 以太网（Ethernet）地址
+ `inet_proto` : 网络协议
+ `inet_service` : 网络服务
+ `mark` : 标记类型

先创建一个空的命名集合：

```bash
$ nft add set inet my_table my_set { type ipv4_addr \; }
$ nft list sets
table inet my_table {
        set my_set {
                type ipv4_addr
        }
}
```

要想在添加规则时引用集合，可以使用 `@` 符号跟上集合的名字。下面的规则表示将集合 `my_set` 中的 IP 地址添加到黑名单中。

```bash
$ nft insert rule inet my_table my_filter_chain ip saddr @my_set drop
$ nft list chain inet my_table my_filter_chain
table inet my_table {
        chain my_filter_chain {
                type filter hook input priority 0; policy accept;
                ip saddr @my_set drop
                tcp dport http accept
                tcp dport nfs accept
                tcp dport ssh accept
                ip saddr { 10.10.10.123, 10.10.10.231 } accept
        }
}
```

向集合中添加元素：

```bash
$ nft add element inet my_table my_set { 10.10.10.22, 10.10.10.33 }
$ nft list set inet my_table my_set
table inet my_table {
        set my_set {
                type ipv4_addr
                elements = { 10.10.10.22, 10.10.10.33 }
        }
}
```

如果你向集合中添加一个区间就会报错：

```bash
$ nft add element inet my_table my_set { 10.20.20.0-10.20.20.255 }

Error: Set member cannot be range, missing interval flag on declaration
add element inet my_table my_set { 10.20.20.0-10.20.20.255 }
                                   ^^^^^^^^^^^^^^^^^^^^^^^
```

要想在集合中使用区间，需要加上一个 flag `interval`，因为内核必须提前确认该集合存储的数据类型，以便采用适当的数据结构。

### 支持区间

创建一个支持区间的命名集合：

```bash
$ nft add set inet my_table my_range_set { type ipv4_addr \; flags interval
$ nft add element inet my_table my_range_set { 10.20.20.0/24 }
$ nft list set inet my_table my_range_set
table inet my_table {
        set my_range_set {
                type ipv4_addr
                flags interval
                elements = { 10.20.20.0/24 }
        }
}
```

> 子网掩码表示法会被隐式转换为 IP 地址的区间，你也可以直接使用区间 `10.20.20.0-10.20.20.255` 来获得相同的效果。

### 级联不同类型

命名集合也支持对不同类型的元素进行级联，通过级联操作符 `.` 来分隔。例如，下面的规则可以一次性匹配 IP 地址、协议和端口号。

```bash
$ nft add set inet my_table my_concat_set  { type ipv4_addr . inet_proto . inet_service \; }

$ nft list set inet my_table my_concat_set
table inet my_table {
        set my_concat_set {
                type ipv4_addr . inet_proto . inet_service
        }
}
```

向集合中添加元素：

```bash
$ nft add element inet my_table my_concat_set { 10.30.30.30 . tcp . telnet }
```

在规则中引用级联类型的集合和之前一样，但需要标明集合中每个元素对应到规则中的哪个位置。

```bash
$ nft add rule inet my_table my_filter_chain ip saddr . meta l4proto . tcp dport @my_concat_set accept
```

这就表示如果数据包的源 IP、协议类型、目标端口匹配 `10.30.30.30、tcp、telnet` 时，nftables 就会允许该数据包通过。

匿名集合也可以使用级联元素，例如：

```bash
$ nft add rule inet my_table my_filter_chain ip saddr . meta l4proto . udp dport { 10.30.30.30 . udp . bootps } accept
```

现在你应该能体会到 nftables 集合的强大之处了吧。

> nftables 级联类型的集合类似于 ipset 的聚合类型，例如 `hash:ip,port`。

## 字典

字典是 nftables 的一个高级特性，它可以使用不同类型的数据并将匹配条件映射到某一个规则上面，并且由于是哈希映射的方式，可以完美的避免链式规则跳转的性能开销。

例如，为了从逻辑上将对 TCP 和 UDP 数据包的处理规则拆分开来，可以使用字典来实现，这样就可以通过一条规则实现上述需求。

```bash
$ nft add chain inet my_table my_tcp_chain
$ nft add chain inet my_table my_udp_chain
$ nft add rule inet my_table my_filter_chain meta l4proto vmap { tcp : jump my_tcp_chain, udp : jump my_udp_chain }
$ nft list chain inet my_table my_filter_chain
table inet my_table {
    chain my_filter_chain {
    ...
    meta nfproto ipv4 ip saddr . meta l4proto . udp dport { 10.30.30.30 . udp . bootps } accept
    meta l4proto vmap { tcp : jump my_tcp_chain, udp : jump my_udp_chain }
    }
}
```

和集合一样，除了匿名字典之外，还可以创建命名字典：

```bash
$ nft add map inet my_table my_vmap { type inet_proto : verdict \; }
```

向字典中添加元素：

```bash
$ nft add element inet my_table my_vmap { 192.168.0.10 : drop, 192.168.0.11 : accept }
```

后面就可以在规则中引用字典中的元素了：

```bash
$ nft add rule inet my_table my_filter_chain ip saddr vmap @my_vmap
```

## 表与命名空间

在 nftables 中，每个表都是一个独立的命名空间，这就意味着不同的表中的链、集合、字典等都可以有相同的名字。例如：

```bash
$ nft add table inet table_one
$ nft add chain inet table_one my_chain
$ nft add table inet table_two
$ nft add chain inet table_two my_chain
$ nft list ruleset
...
table inet table_one {
    chain my_chain {
    }
}
table inet table_two {
    chain my_chain {
    }
}
```

有了这个特性，不同的应用就可以在相互不影响的情况下管理自己的表中的规则，而使用 `iptables` 就无法做到这一点。

当然，这个特性也有缺陷，由于每个表都被视为独立的防火墙，那么某个数据包必须被所有表中的规则放行，才算真正的放行，即使 `table_one` 允许该数据包通过，该数据包仍然有可能被 `table_two` 拒绝。为了解决这个问题，nftables 引入了优先级，`priority` 值越高的链优先级越低，所以 `priority` 值低的链比 `priority` 值高的链先执行。如果两条链的优先级相同，就会进入竞争状态。

## 备份与恢复

以上所有示例中的规则都是临时的，要想永久生效，我们可以将规则备份，重启后自动加载恢复，其实 nftables 的 `systemd` 服务就是这么工作的。

备份规则：

```bash
$ nft list ruleset > /root/nftables.conf
```

加载恢复：

```bash
$ nft -f /root/nftables.conf
```

在 CentOS 8 中，`nftables.service` 的规则被存储在 `/etc/nftables.conf` 中，其中 include 一些其他的示例规则，一般位于 `/etc/sysconfig/nftables.conf` 文件中，但默认会被注释掉。

## 总结

希望通过本文的讲解，你能对 nftables 的功能和用法有所了解，当然本文只涉及了一些浅显的用法，更高级的用法可以查看 nftables 的官方 `wiki`，或者坐等我接下来的文章。相信有了本文的知识储备，你应该可以愉快地使用 nftables 实现 Linux 的智能分流了，具体参考这篇文章：[Linux全局智能分流方案](/posts/linux-circumvent/)。
