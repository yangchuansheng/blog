---
keywords:
- 米开朗基杨
- nftables
- 令牌桶
- conntrack
title: "nftables 基础教程：使用 nftables 作为防火墙"
subtitle: "使用 nftables 搭建一个简单的模块化防火墙"
description:
date: 2019-12-19T17:56:09+08:00
draft: false
author: 米开朗基杨
toc: true
categories: "linux"
tags: ["linux","nftables"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/2020-04-24-20191219175915.webp"
---

[上篇文章](https://icloudnative.io/posts/using-nftables/) 给大家介绍了 `nftables` 的优点以及基本的使用方法，它的优点在于直接在用户态把网络规则编译成字节码，然后由内核的虚拟机执行，尽管和 iptables 一样都是基于 `netfilter`，但 nftables 的灵活性更高。

之前用 iptables 匹配大量数据时，还得需要 `ipset` 配合，而 nftables 直接内置了集合和字典，可以直接匹配大量的数据，这一点比 iptables 方便多了，拿来练练魔法真是极好的，不多解释，请直接看 [Linux全局智能分流方案](https://icloudnative.io/posts/linux-circumvent/)。

本文将会教你如何配置 nftables 来为服务器实现一个简单的防火墙，本文以 CentOS 7 为例，其他发行版类似。

## <span id="inline-toc">1.</span> 安装 nftables

----

首先需要安装 nftables：

```bash
$ yum install -y nftables
```

由于 nftables 默认没有内置的链，但提供了一些示例配置，我们可以将其 include 到主配置文件中。主配置文件为 `/etc/sysconfig/nftables.conf`，将下面一行内容取消注释：

```bash
# include "/etc/nftables/inet-filter"
```

然后启动 nftables 服务：

```bash
$ systemctl start nftables
```

现在再次查看规则，就会发现多了一张 `filter` 表和几条链：

```bash
$ nft list ruleset

table inet filter {
	chain input {
		type filter hook input priority 0; policy accept;
	}

	chain forward {
		type filter hook forward priority 0; policy accept;
	}

	chain output {
		type filter hook output priority 0; policy accept;
	}
}
```

在 nftables 中，`ipv4` 和 `ipv6` 协议可以被合并到一个单一的地址簇 `inet` 中，使用了 inet 地址簇，就不需要分别为 ipv4 和 ipv6 指定两个不同的规则了。

## <span id="inline-toc">2.</span> 添加 INPUT 规则

----

和 iptables 一样，`nftables` 的 filter 表包含三条链：`INPUT`、`FORWARD` 和 `OUTPUT`，一般配置防火墙只需要配置 `INPUT` 链就好了。

### 回环接口

首先允许访问 localhost：

```bash
$ nft add rule inet filter input iif "lo" accept
$ nft add rule inet filter input iif != "lo" ip daddr 127.0.0.0/8 drop
```

可以再优化一下，加上注解（comment）和计数器（counter）：

```bash
$ nft add rule inet filter input \
   iif "lo" \
   accept \
   comment \"Accept any localhost traffic\"

$ nft add rule inet filter input \
   iif != "lo" ip daddr 127.0.0.0/8 \
   counter \
   drop \
   comment \"drop connections to loopback not coming from loopback\"
```

查看规则：

```bash
$ nft list chain inet filter input

table inet filter {
	chain input {
		type filter hook input priority 0; policy accept;
		iif "lo" accept comment "Accept any localhost traffic"
		iif != "lo" ip daddr 127.0.0.0/8 counter packets 0 bytes 0 drop comment "drop connections to loopback not coming from loopback"
	}
}
```

### 连接跟踪模块

接下来的规则用到一个内核模块叫 `conntrack（connection tracking）`，它被用来跟踪一个连接的状态。最常见的使用场景是 `NAT`，为什么需要跟踪记录连接的状态呢？因为 nftables 需要记住数据包的目标地址被改成了什么，并且在返回数据包时再将目标地址改回来。

和 iptables 一样，一个 TCP 连接在 nftables 中总共有四种状态：`NEW`，`ESTABLISHED`，`RELATED` 和 `INVALID`。

除了本地产生的包由 `OUTPUT` 链处理外，所有连接跟踪都是在 `PREROUTING` 链里进行处理的，意思就是， iptables 会在 `PREROUTING` 链里从新计算所有的状态。如果我们发送一个流的初始化包，状态就会在 `OUTPUT` 链里被设置为 `NEW`，当我们收到回应的包时，状态就会在 PREROUTING 链里被设置为 `ESTABLISHED`。如果收到回应的第一个包不是本地产生的，那就会在 PREROUTING 链里被设置为 `NEW` 状态。综上，所有状态的改变和计算都是在 nat 表中的 `PREROUTING` 链和 `OUTPUT` 链里完成的。

还有其他两种状态：

+ `RELATED` : RELATED 状态有点复杂，当一个连接与另一个已经是 `ESTABLISHED` 的连接有关时，这个连接就被认为是 RELATED。这意味着，一个连接要想成为 RELATED，必须首先有一个已经是 `ESTABLISHED` 的连接存在。这个 ESTABLISHED 连接再产生一个主连接之外的新连接，这个新连接就是 RELATED 状态了。
+ `INVAILD` : 表示分组对应的连接是未知的，说明数据包不能被识别属于哪个连接或没有任何状态。有几个原因可以产生这种情况，比如，内存溢出，收到不知属于哪个连接的 ICMP 错误信息。我们需要 DROP 这个状态的任何东西，并打印日志：

```bash
$ nft add rule inet filter input \
   ct state invalid \
   log prefix \"Invalid-Input: \" level info flags all \
   counter \
   drop \
   comment \"Drop invalid connections\"
```

查看规则：

```bash
$ nft list chain inet filter input

table inet filter {
	chain input {
		type filter hook input priority 0; policy accept;
		iif "lo" accept comment "Accept any localhost traffic"
		iif != "lo" ip daddr 127.0.0.0/8 counter packets 0 bytes 0 drop comment "drop connections to loopback not coming from loopback"
		ct state invalid log prefix "Invalid-Input: " level info flags all counter packets 0 bytes 0 drop comment "Drop invalid connections"
	}
}
```

### 令牌桶

为了防止有恶意攻击者利用 **ping 泛洪**（ping flood）来进行攻击，可以利用令牌桶模型来对 ping 包限速。ping 泛洪的原理很简单，就是采用多线程的方法一次性发送多个 `ICMP` 请求报文，让目的主机忙于处理大量这些报文而造成速度缓慢甚至宕机。

先来介绍一下令牌桶模型。

熟悉 iptables 的朋友应该知道，iptables 通过 `hashlimit` 模块来实现限速的功能，而 `hashlimit` 的匹配方式就是基于令牌桶（Token bucket）的模型，nftables 也类似，
令牌桶是一种网络通讯中常见的缓冲区工作原理，它有两个重要的参数，`令牌桶容量 n` 和 `令牌产生速率 s` ：

+ `令牌桶容量 n`：可以把令牌当成是门票，而令牌桶则是负责制作和发放门票的管理员，它手里最多有n张令牌。初始时，管理员开始手里有 n 张令牌，每当一个数据包到达后，管理员就看看手里是否还有可用的令牌。如果有，就把令牌发给这个数据包，limit 就告诉nftables，这个数据包被匹配了，而当管理员把手上所有的令牌都发完了，再来的数据包就拿不到令牌了；这时，limit 模块就告诉 nftables ，这个数据包不能被匹配。
+ `令牌产生速率 s`：当令牌桶中的令牌数量少于 n，它就会以速率 s 来产生新的令牌，直到令牌数量到达 n 为止。

通过令牌桶机制，可以有效的控制单位时间内通过（匹配）的数据包数量，又可以容许短时间内突发的大量数据包的通过（只要数据包数量不超过令牌桶 n），真是妙哉啊。

nftables 比 iptables 做的更绝，它不仅可以基于数据包来限速，也可以基于字节来限速。为了更精确地验证令牌桶模型，我们选择基于字节来限速：

```bash
$ nft add rule inet filter input \
   ip protocol icmp icmp type echo-request \
   limit rate 20 bytes/second burst 500 bytes \
   counter \
   accept \
   comment \"No ping floods\"
```

上面的规则表示：

+ 为所有 `echo-request` 类型的 ICMP 包建立一个匹配项；
+ 匹配项对应的令牌桶容量为 `500` 个字节；
+ 令牌产生速率为 `20` 字节/s

再添加一条规则，拒绝不满足上诉条件的数据包：

```bash
$ nft add rule inet filter input \
   ip protocol icmp icmp type echo-request \
   drop \
  comment \"No ping floods\"
```

同时还要接收状态为 ESTABLISHED 和 RELATED 的数据包：

```bash
$ nft add rule inet filter input \
   ct state \{ established, related \} \
   counter \
   accept \
   comment \"Accept traffic originated from us\"
```

下面来做个实验，直接 ping 该服务器的 IP 地址，ping 包大小设置为 100 字节，每秒发送一次：

```bash
$ ping -s 92 192.168.57.53 -i 1

PING 192.168.57.53 (192.168.57.53) 92(120) bytes of data.
100 bytes from 192.168.57.53: icmp_seq=1 ttl=64 time=0.402 ms
100 bytes from 192.168.57.53: icmp_seq=2 ttl=64 time=0.373 ms
100 bytes from 192.168.57.53: icmp_seq=3 ttl=64 time=0.465 ms
100 bytes from 192.168.57.53: icmp_seq=4 ttl=64 time=0.349 ms
100 bytes from 192.168.57.53: icmp_seq=5 ttl=64 time=0.411 ms
100 bytes from 192.168.57.53: icmp_seq=11 ttl=64 time=0.425 ms
100 bytes from 192.168.57.53: icmp_seq=17 ttl=64 time=0.383 ms
100 bytes from 192.168.57.53: icmp_seq=23 ttl=64 time=0.442 ms
100 bytes from 192.168.57.53: icmp_seq=29 ttl=64 time=0.464 ms
...
```

首先我们能看到前 5 个包的回应都非常正常，然后从第 6 个包开始，我们每 6 秒能收到一个正常的回应。这是因为我们设定了令牌桶的容量为 `500` 个字节，令牌产生速率为 `20` 字节/s，而发包的速率是每秒钟 `100` 个字节，即每个包 `100` 个字节，当发完 5 个包后，令牌桶的容量变为 0，这时开始以 `20` 字节/s 的速率产生新令牌（和前面提到的令牌桶算法不太一样，只有当令牌桶容量为 0 才开始产生新的令牌），5 秒钟之后，令牌桶的容量变为 `100` 个字节，所以 6 秒钟后又能收到正常回应。

### ICMP & IGMP

接收其他类型的 `ICMP` 协议数据包：

```bash
$ nft add rule inet filter input \
   ip protocol icmp icmp type \{ destination-unreachable, router-advertisement, router-solicitation, time-exceeded, parameter-problem \} \
   accept \
   comment \"Accept ICMP\"
```

接收 `IGMP` 协议数据包：

```bash
$ nft add rule inet filter input \
   ip protocol igmp \
   accept \
   comment \"Accept IGMP\"
```

### 分别处理 TCP 和 UDP

这一步我们将 TCP 和 UDP 的流量拆分，然后分别处理。先创建两条链：

```bash
$ nft add chain inet filter TCP
$ nft add chain inet filter UDP
```

然后创建一个命名字典：

```bash
$ nft add map inet filter input_vmap \{ type inet_proto : verdict \; \}
```

字典的键表示协议类型，值表示判决动作。

往字典中添加元素：

```bash
$ nft add element inet filter input_vmap \{ tcp : jump TCP, udp : jump UDP \}
```

最后创建一条规则拆分 TCP 和 UDP 的流量：

```bash
$ nft add rule inet filter input meta l4proto vmap @input_vmap
```

其中，`meta l4proto` 用来匹配协议的类型。

最后再瞄一眼规则：

```bash
$ nft list ruleset

table inet filter {
	map input_vmap {
		type inet_proto : verdict
		elements = { tcp : jump TCP, udp : jump UDP }
	}

	chain input {
		type filter hook input priority 0; policy accept;
		iif "lo" accept comment "Accept any localhost traffic"
		iif != "lo" ip daddr 127.0.0.0/8 counter packets 0 bytes 0 drop comment "drop connections to loopback not coming from loopback"
		ct state invalid log prefix "Invalid-Input: " level info flags all counter packets 95 bytes 6479 drop comment "Drop invalid connections"
		icmp type echo-request limit rate 20 bytes/second burst 500 bytes counter packets 17 bytes 2040 accept comment "No ping floods"
		icmp type echo-request drop comment "No ping floods"
		ct state { established, related } counter packets 172135 bytes 99807569 accept comment "Accept traffic originated from us"
		icmp type { destination-unreachable, router-advertisement, router-solicitation, time-exceeded, parameter-problem } accept comment "Accept ICMP"
		ip protocol igmp accept comment "Accept IGMP"
		meta l4proto vmap @input_vmap
	}

	chain forward {
		type filter hook forward priority 0; policy accept;
	}

	chain output {
		type filter hook output priority 0; policy accept;
	}

	chain TCP {
	}

	chain UDP {
	}
}
```

## <span id="inline-toc">3.</span> 处理 TCP 流量

----

这一步我们来处理 TCP 流量，首当其冲的就是 `ssh` 了，必须得给这位大哥放行啊：

```bash
$ nft add rule inet filter TCP \
   tcp dport 22 \
   ct state new \
   limit rate 15/minute \
   log prefix \"New SSH connection: \" \
   counter \
   accept \
   comment \"Avoid brute force on SSH\"
```

其次需要放行 Web 服务，和上面一样，为了易于管理，方便后续动态添加端口，需要先创建一个命名集合：

```bash
$ nft add set inet filter web \{ type inet_service \; flags interval \; \}
```

查看集合：

```bash
$ nft list set inet filter web

table inet filter {
	set web {
		type inet_service
		flags interval
	}
}
```

向集合中添加元素：

```bash
$ nft add element inet filter web \{ 80, 443 \}
```

查看集合：

```bash
$ nft list set inet filter web

table inet filter {
	set web {
		type inet_service
		flags interval
		elements = { http, https }
	}
}
```

放行 Web 服务：

```bash
$ nft add rule inet filter TCP \
   tcp dport @web \
   counter \
   accept \
   comment \"Accept web server\"
```

如果你还有其他不可描述的应用，比如 v-2-r-a-y 之类的代理，可以按照上面的方式添加规则，先创建集合：

```bash
$ nft add set inet filter v-2-r-a-y \{ type inet_service \; flags interval \; \}
```

再添加元素：

```bash
$ nft add element inet filter v-2-r-a-y \{ 9000-9005, 9007 \}
```

查看集合：

```bash
$ nft list set inet filter v-2-r-a-y

table inet filter {
	set v-2-r-a-y {
		type inet_service
		flags interval
		elements = { 9000-9005, 9007 }
	}
}
```

现在体会到 nftables 集合的强大了吧，可以是区间，可以是单个元素组成的集合，也可以混合，iptables 麻烦让一让。

放行不可描述的服务：

```bash
$ nft add rule inet filter TCP \
   tcp dport @v-2-r-a-y \
   counter \
   accept \
   comment \"Accept v-2-r-a-y\"
```

## <span id="inline-toc">4.</span> 处理 UDP 流量

----

这一步我们来处理 UDP 流量，比如上面举例的不可描述的应用，除了 TCP 端口还有 UDP 端口，具体用处我就不解释了，自己面向谷歌找答案吧。

到了这一步，连集合都不用创建， 直接复用之前创建的集合，放行不可描述应用的 UDP 数据：

```bash
$ nft add rule inet filter UDP \
   udp dport @v-2-r-a-y \
   counter \
   accept \
   comment \"Accept v-2-r-a-y\"
``` 

查看规则：

```bash
$ nft list chain inet filter UDP

table inet filter {
	chain UDP {
		udp dport @v-2-r-a-y counter packets 0 bytes 0 accept comment "Accept v-2-r-a-y"
	}
}
```

其他 UDP 数据都可按此套路模块化，简直不要太赏心悦目。

为了使系统或 nftables 重启后能够继续生效，我们需要将这些规则持久化，直接将规则写入 `/etc/nftables/inet-filter`：

```bash
$ echo "#! /usr/sbin/nft -f" > /etc/nftables/inet-filter
$ nft list ruleset >> /etc/nftables/inet-filter
```

开机自动加载 nftables 服务：

```bash
$ systemctl enable nftables
```

## <span id="inline-toc">5.</span> 在 rsyslog 中记录日志

----

默认情况下，开启日志记录后，日志会直接进入 syslog，和系统日志混在一起，不好读取。最好的办法是将 nftables 的日志重定向到单独的文件。

以本文为例，我们只开启了 `ct state invalid` 和 `ssh` 的日志记录，先在 `/var/log` 目录中创建一个名为 `nftables` 的目录，并在其中创建两个名为 `invalid.log` 和 `ssh.log` 的文件，分别存储各自的日志。

```bash
$ mkdir /var/log/nftables
$ touch /var/log/nftables/{ssh.log,invalid.log}
```

确保系统中已安装 rsyslog。现在进入 `/etc/rsyslog.d` 目录并创建一个名为 `nftables.conf` 的文件，其内容如下：

```bash
:msg,regex,"Invalid-Input: " -/var/log/nftables/invalid.log
:msg,regex,"New SSH connection: " -/var/log/nftables/ssh.log
```

最后，为了确保日志是可管理的，需要在 `/etc/logrotate.d` 中创建一个 `nftables` 文件：

```bash
$ cat /etc/logrotate.d/nftables

/var/log/nftables/* { rotate 5 daily maxsize 50M missingok notifempty delaycompress compress postrotate invoke-rc.d rsyslog rotate > /dev/null endscript }
```

重新通过 ssh 连接服务器，就能看到日志了：

```bash
$ tail -f /var/log/nftables/ssh.log

Dec 19 17:15:33 [localhost] kernel: New SSH connection: IN=ens192 OUT= MAC=00:50:56:bd:2f:3d:00:50:56:bd:d7:24:08:00 SRC=192.168.57.2 DST=192.168.57.53 LEN=60 TOS=0x00 PREC=0x00 TTL=64 ID=43312 DF PROTO=TCP SPT=41842 DPT=22 WINDOW=29200 RES=0x00 SYN URGP=0
```

## <span id="inline-toc">6.</span> 总结

----

本文教你如何使用 nftables 搭建一个简单的防火墙，并通过集合和字典将规则集模块化，后续可动态添加端口和 IP 等元素，而不用修改规则。更复杂的规则将会在后面的文章介绍，下篇文章将会教你如何使用 nftables 来防 `DDoS` 攻击，敬请期待。
