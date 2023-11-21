---
title: "LVS负载均衡之持久性连接介绍"
subtitle: "如何根据业务场景来设置 lvs 持久性"
date: 2018-04-18T11:18:06Z
draft: false
author: 米开朗基杨
toc: true
categories: "loadbalance"
tags: ["lvs"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191204210441.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

## <span id="inline-toc">1.</span> 前言

----

在实际生产环境中，往往需要根据业务应用场景来设置 <code>lvs</code> 的会话超时时间以及防止 <code>session</code> 连接丢失的问题，如在业务支付环节，如若 <code>session</code> 丢失会导致重复扣款问题，严重影响到安全性，本小节解将会讲到关于 <code>lvs</code> 持久性连接问题。

### 为什么用到持久连接？

在 Web 服务通信中，当用户在一个网站浏览了A网页并跳转到B网页，此时服务器就认为B网页是一个新的用户请求，你之前的登陆的信息就都丢失了。

为了记录用户的会话信息，我们的开发者就在客户端/服务器端软件提供了 `cookie/session` 机制，当你访问网站时，服务器端建立一个 session 会话区，并建立一个 cookie 与这个 session 绑定，将信息发送给你的浏览器。

这样，只要你的 cookie 存在，服务器端的 session 存在，那么当你打开新页面的时候，服务器依然会认识你。

**在做了负载均衡的时候，上面的机制就出现了问题。假设有以下场景 :** 

<p id="div-border-top-red">某电商网站为了实现更多用户的访问，提供了A、B两台服务器，并在前面做了 LVS 负载均衡。于是某用户打开了该购物网站，选中了一件衣服，并加入了购物车(此时背后的操作是：LVS 负载均衡器接受了用户请求，并将其分发到了选中的服务器，并将用户添加了一件衣服记录到这个会话的 session 中)。这时当用户打开了第二个网页，又选中了一件帽子并加入购物车(此时背后的操作是：LVS 负载均衡器接受了用户请求，进行计算，将其发送到选中的服务器上，该服务器将用户添加了一件帽子记录到 session 中)。<br /><br />由于 LVS 是一个四层负载均衡器，仅能根据 <code>IP:Port</code> 对数据报文进行分发，不能确保将同一用户根据 session 发往同一个服务器，也就是用户第一次被分配到了A服务器，而第二次可能分配到了B服务器，但是B服务器并没有A服务器用户的 session 记录，直接导致这个例子里的用户发现自己的购物车没有了之前的衣服，而仅有帽子。这是不可接受的。</p>

为了避免上面的问题，一般站点会有两种方法解决该问题：

<font color="#2780e3">
1. 将来自于同一个用户的请求发往同一个服务器<br />
2. 将 session 信息在服务器集群内共享，每个服务器都保存整个集群的 session 信息<br />
3. 建立一个 session 存储池，所有 session 信息都保存到存储池中
</font>

<br />
当然通过 session 共享解决是比较完美的，但实现起来相对复杂：

+ 一需要额外增加服务器设备
+ 二需要代码改动，在用户操作前，需要先获取该用户的session信息

总结下来，第一种方法是最简单的。

### hash算法与持久连接

LVS 的八种轮询算法中有（Source Hashing）源地址 hash，它和持久连接的作用都是<font color="#df3e3e">将来自同一个IP的请求都转发到同一个 Server</font>，从而保证了 session 会话定位的问题。两者的不同是：

#### Source Hashing 算法

该算法在内核中会自动维护一个哈希表，此哈希表中用每一个请求的源IP地址经过哈希计算得出的值作为键，把请求所到达的 RS 的地址作为值。

在后面的请求中，每一个请求会先经过此哈希表，如果请求在此哈希表中有键值，那么直接定向至特定 RS，如没有，则会新生成一个键值，以便后续请求的定向。

但是此种方法在时间的记录上比较模糊（依据TCP的连接时长计算）。而且通过 hash 算法无法公平均担后端 real server 的请求，即不能与 rr 等算法同时使用。

#### 持久连接

此种方法实现了无论使用哪一种调度方法，持久连接功能都能保证在指定时间范围之内，来自于同一个IP的请求将始终被定向至同一个 RS，还可以把多种服务绑定后统一进行调度。

在 director 内有一个 LVS 持久连接模板，模板中记录了每一个请求的来源、调度至的 RS、维护时长等等，所以，在新的请求进入时，首先在此模板中检查是否有记录（有内置的时间限制，比如限制是300秒，当在到达300秒时依然有用户访问，那么持久连接模板就会将时间增加两分钟，再计数，依次类推，每次只延长2分钟），如果该记录未超时，则使用该记录所指向的 RS，如果是超时记录或者是新请求，则会根据调度算法先调度至特定 RS，再将调度的记录添加至此表中。

这并不与 SH 算法冲突，lvs 持久连接会在新请求达到时，检查后端 RS 的负载状况，这就是比较精细的调度和会话保持方法。

## <span id="inline-toc">2.</span> lvs 的持久性连接有两方面

----

**1、把同一个 `client` 的请求信息记录到 lvs 的 `hash` 表里，保存时间使用 `persistence_timeout` 控制，单位为秒。**

`persistence_granularity` 参数是配合 `persistence_timeout` 的，在某些情况特别有用。他的值是子网掩码，表示持久连接的粒度，默认是 `255.255.255.255`，也就是单独的 client ip，如果改成 `255.255.255.0`，和 client ip 在同一个网段的都会被分配到同一个 `real server`。

**2、一个连接创建后空闲时的超时时间，这个时间为3种。**

+ **tcp:** tcp的空闲超时时间
+ **tcpfin:** lvs收到客户端tcp fin的超时时间
+ **udp:** udp的超时时间

## <span id="inline-toc">3.</span> lvs 相关超时时间查看

----

通过 `ipvsadm -Ln` 可以查看 persistence_timeout 超时时间(默认超时时间 360s)

```bash
$ ipvsadm -Ln

IP Virtual Server version 1.2.1 (size=4096)
Prot LocalAddress:Port Scheduler Flags
  -> RemoteAddress:Port           Forward Weight ActiveConn InActConn
TCP  10.254.66.97:8080 rr persistent 10800
  -> 172.20.104.7:8080            Masq    1      0          0
  -> 172.20.135.6:8080            Masq    1      0          0
  -> 172.20.135.7:8080            Masq    1      0          0
```

通过 `ipvsadm -Ln --timeout` 可以查看 `tcp tcpfin udp` 的超时时间（默认: 900 120 300)

```bash
$ ipvsadm -Ln --timeout

Timeout (tcp tcpfin udp): 900 120 300
```

## <span id="inline-toc">4.</span> lvs 如何控制这些超时时间工作

----

```bash
$ ipvsadm -Lnc

IPVS connection entries
pro expire state       source             virtual            destination
TCP 01:54  TIME_WAIT   192.168.123.248:35672 10.254.66.97:8080  172.20.135.6:8080
TCP 180:03 NONE        192.168.123.248:0  10.254.66.97:8080  172.20.135.6:8080
```

+ 当一个 client 访问 vip 的时候，这时 ipvs 就会记录一条状态为 `NONE` 的信息，如述上所示，`expire` 初始值为 `persistence_timeout` 的值，然后根据时钟主键变小，在以下记录存在期间，同一 client ip 连接上来，都会被分配到同一个后端。

+ `TIME_WAIT` 的值就是 tcp tcpfin udp 中的 `tcpfin` 的超时时间，当 `NONE` 的值为0时，如果 TIME_WAIT 还存在，那么 NONE 的值会从新变成 `persistence_timeout` 的值，再减少，直到 TIME_WAIT 消失以后，NONE 才会消失，只要 NONE 存在，同一 client 的访问，都会分配到统一 real server。

## <span id="inline-toc">5.</span> lvs 关于相关超时时间的设置

----

`persistence_timeout` 可以通过 `ipvsadm -p timeout` 来设置，默认 360 秒。

```bash
$ ipvsadm -A -t 192.168.20.154:80 -s rr -p 60
```


<p id="div-border-top-purple">上面命令中红色标记的 80 端口，表示如果是同一客户端访问服务器的 80 端口，会被定义到同一个 real server，如果把 80 端口改为 <code>0</code>，那么同一客户端访问服务器的任何服务都会被转发到同一个 real server。</p>

`tcp tcpfin udp` 可以通过 `ipvsadm --set 对应超时时间` 来设置。

```bash
$ ipvsadm --set tcp tcpfin udp
```

{{< notice note >}}
<code>tcpfin</code> 的值最好小于 <code>persistence_timeout</code> 的值，这样比较方便计算，也有利于 <code>tcpfin</code> 回收
{{< /notice >}}

## <span id="inline-toc">6.</span> 持久连接定义与原理

----

### 定义

> 持久连接是指无论使用什么算法，LVS 持久都能实现在一定时间内，将来自同一个客户端请求派发至此前选定的 `RS`。

### 原理

当使用 LVS 持久性的时候，Director 在内部使用一个连接根据记录称之为 `持久连接模板` 来确保所有来自同一个客户端的请求被分发到同一台 `Real Server` 上。

{{< notice note >}}
持久连接模板是指每一个客户端及分配给它的 <code>RS</code> 的映射关系。
{{< /notice >}}

### 持久连接分类

**1、 <font color="red">持久端口连接，</font>简称 PPC（Persistent Port Connections）**：将来自于同一个客户端对同一个集群某个服务的请求，始终定向至此前选定的 `RS`

**例如 :** `client---->LVS(80)---->RS1 或 client---->LVS(23)---->RS2`<br />
**缺陷 :** 期望访问不同的端口到同一台 `RS` 上，无法实现。

配置：

```bash
$ ipvsadm -A -t 172.16.100.1:80 -s rr -p 3600
$ ipvsadm -a -t 172.16.100.1:80 -r 172.16.100.10 -g -w 2
$ ipvsadm -a -t 172.16.100.1:80 -r 172.16.100.11 -g -w 2
```

**2、<font color="red">持久客户端连接，</font>简称 PCC（Persistent Client Connections） :** 将来自于同一个客户端对所有端口的请求，始终定向至此前选定的 `RS`

**说明 :** `PCC` 是一个虚拟服务没有端口号（或者端口号为 0），以 `-p` 来标识服务。<br />
**缺陷 :** 定向所有服务，期望访问不同的 Real Server 无法实现。

配置：

```bash
$ ipvsadm -A -t 172.16.100.1:0 -s rr -p 3600
$ ipvsadm -a -t 172.16.100.1:0 -r 172.16.100.10 -g -w 2
$ ipvsadm -a -t 172.16.100.1:0 -r 172.16.100.11 -g -w 2
```

**3、<font color="red">基于防火墙设置端口绑定的持久连接，</font>简称 PNMPP（Persistent Netfilter Marked Packet Persistence） :** 例如后台 real server 同时提供 `80` 和 `443` 端口的服务，并且两个服务之间有联系，这时就要用到 PNMPC

先对某一特定类型的数据包打上标记，然后再将基于某一类标记的服务送到后台的 `Real Server` 上去，后台的 Real Server 并不识别这些标记。将`持久连接`和`防火墙标记`结合起来就能够实现端口姻亲功能，只要是来自某一客户端的对某一特定服务（需要不同的端口）的访问都定义到同一台 Real Server 上去。

**案例 :** 一个用户在访问购物网站时同时使用 `HTTP（80）`和 `HTTPS（443）`两种协议，我们需要将其定义到同一台 Real Server 上，而其他的服务不受限制。

配置：

```bash
$ iptables -t mangle -A PREROUTING -d 172.16.100.1 -i eth0 -p tcp --dport 80 -j MARK --set-mark 8
$ iptables -t mangle -A PREROUTING -d 172.16.100.1 -i eth0 -p tcp --dport 443 -j MARK --set-mark 8
$ ipvsadm -A -f 8 -s rr -p 600
$ ipvsadm -a -f 8 -r 172.16.100.10 -g -w 2
$ ipvsadm -a -f 8 -r 172.16.100.11 -g -w 1
```

## <span id="inline-toc">7.</span> 总结

----

如何设置 `lvs` 持久性连接需要根据业务场景来选择，比如电商平台，对应的持久性连接应该是 `PNMPP`，另外还需要根据连接类型，比如长连接和短连接，来设置相关超时时间，总之,根据应用场景来选择！

