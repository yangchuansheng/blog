---
keywords:
- WireGuard
- kubernetes
- netmaker
- netclient
- coredns
title: "WireGuard 教程：使用 Netmaker 配置 WireGuard 全互联 (full mesh) 模式"
date: 2021-11-09T19:06:37+08:00
lastmod: 2021-11-09T19:06:37+08:00
description: 本文介绍了如何使用 Netmaker 来配置 WireGuard 全互联模式，以及各个操作系统中的 Netclient 安装步骤。
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
- Netmaker
- Kubernetes
categories: 
- Network
- VPN
img: https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting2@main/img/202111101345322.png
---

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting2@main/img/202111101352665.jpeg)

熟悉我的小伙伴都知道我是一名与时俱进的 [WireGuard](/posts/wireguard-docs-theory/) 舔狗，我早就把所有的跨云组网都换成了 WireGuard。

WireGuard 利用内核空间处理来提升性能（更高吞吐和更低延迟），同时避免了不必要的内核和用户空间频繁上下文切换开销。在 Linux 5.6 将 WireGuard 合并入上游之后， **`OpenVPN` 无论做什么，也无法逆转大部队向 WireGuard 迁移之大趋势，所谓历史之潮流**。

不要再跟我提 OpenVPN 了，你们农村人才用 OpenVPN，我们城里人早就换上了 WireGuard！（此处只是开个玩笑，别当真哈😂）

----

言归正传，我在[上篇文章](/posts/configure-a-mesh-network-with-netmaker/)中介绍了 Netmaker 的工作原理和功能解读，本篇文章将会介绍**如何使用 Netmaker 来配置 WireGuard 全互联模式**。

此前我单独用了整篇文章来给大家介绍 Netmaker 是个什么东西，它的架构和工作原理是什么，以及如何部署 Netmaker。所有的这些内容都是为了今天的文章做铺垫，本文要讲的内容才是真正的杀手锏。假定你已经通读了我的[上一篇文章](/posts/configure-a-mesh-network-with-netmaker/)，并且按照文中所述步骤部署好了 Netmaker。如果你还没有做好这些准备工作，建议先去准备一下，再来阅读本篇文章。

好，我们已经部署好了 Netmaker，但它只负责存储和管理各个节点的 WireGuard 配置和状态信息，真正的主角还是通过 WireGuard 私有网络进行通信的节点。节点通常是运行 Linux 的服务器，它需要安装 `netclient` 和 `WireGuard`。这个节点会通过 WireGuard 私有网络和其他所有节点相连。一但节点被添加到私有网络中，Netmaker 管理员就可以操控该节点的配置。

光说不练假把式，为了让大家更容易带入，咱们还是来模拟一下实际场景。假设我有 4 个不同的节点，这 4 个节点的操作系统分别是 `Ubuntu`、`macOS`、`OpenWrt` 和 `Android`，且分别处于不同的局域网中，即每个节点的公网出口都不同。先来看下架构图：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting2@main/img/202111061845425.png)

## 创建网络

加入节点之前，需要先在 Netmaker 中创建一个网络。一般我们会将这个新创建的网络命名为 `default`，但我的环境中已经存在了该网络，所以我将重新创建一个网络为大家演示。

先创建一个网络，命名为 demo。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting2@main/img/202111061929782.png)

创建完成后，还可以继续修改该网络的相关元数据，比如**允许节点在不使用秘钥的情况下加入 VPN 网络**。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting2@main/img/202111062158090.png)

## 加入节点

如果部署 Netmaker 时开启了环境变量 `CLIENT_MODE: "on"`，Netmaker 就会将自身所在的主机也作为一个网络节点，名字默认为 `netmaker`。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting2@main/img/202111062215376.jpg)

其他节点的加入流程也很简单，但不同的操作系统又不尽相同。

### Ubuntu

常规的 Linux 发行版最简单，直接下载二进制文件，赋予可执行权限。

```bash
$ wget https://github.com/gravitl/netmaker/releases/download/latest/netclient
$ chmod +x netclient
```

然后执行下面的命令将节点加入网络。

```bash
$ ./netclient join --dnson no --name <HOSTNAME> --network demo --apiserver <Netmaker_IP>:8081 --grpcserver <Netmaker_IP>:50051
```

+ 将 `<HOSTNAME>` 替换成你的节点名称，你也可以设置成别的名字。
+ 将 `<Netmaker_IP>` 替换为 Netmaker Server 的公网 IP。

到 Netmaker UI 中批准加入节点的请求。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting2@main/img/202111062216547.webp)

批准之后就可以看到两个节点之间已经握手成功了。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting2@main/img/202111062246656.png)

如果没有握手成功，你需要检查一下 Netmaker 的防火墙是否放行了 UDP 端口（本文是 `51821` 端口）。

> 对于 WireGuard 而言，一般情况下通信双方只需一个节点开放固定的公网端口即可，另一个节点的防火墙可以不放行 UDP 端口。所以这里只需开启 Netmaker Server 所在主机的 UDP 端口即可。

同时还会设置一个计划任务，来定期（每 15 秒执行一次）启动守护进程执行签到命令，签到的作用是将本地的配置与 Netmaker Server 托管的配置进行比较，根据比较结果进行适当修改，再拉取所有的 Peer 列表，最后重新配置 WireGuard。

```bash
$ cat /etc/systemd/system/netclient.timer
[Unit]
Description=Calls the Netmaker Mesh Client Service
Requires=netclient.service

[Timer]
Unit=netclient.service

OnCalendar=*:*:0/15

[Install]
WantedBy=timers.target
$ systemctl status netclient.timer
● netclient.timer - Calls the Netmaker Mesh Client Service
     Loaded: loaded (/etc/systemd/system/netclient.timer; enabled; vendor preset: enabled)
     Active: active (running) since Sat 2021-10-09 01:34:27 CST; 4 weeks 1 days ago
    Trigger: n/a
   Triggers: ● netclient.service

Oct 09 01:34:27 blog-k3s04 systemd[1]: Started Calls the Netmaker Mesh Client Service.

$ cat /etc/systemd/system/netclient.service
[Unit]
Description=Network Check
Wants=netclient.timer

[Service]
Type=simple
ExecStart=/etc/netclient/netclient checkin -n all

[Install]
WantedBy=multi-user.target
$ systemctl status netclient.service
● netclient.service - Network Check
     Loaded: loaded (/etc/systemd/system/netclient.service; enabled; vendor preset: enabled)
     Active: active (running) since Sun 2021-11-07 15:00:54 CST; 11ms ago
TriggeredBy: ● netclient.timer
   Main PID: 3390236 (netclient)
      Tasks: 5 (limit: 19176)
     Memory: 832.0K
     CGroup: /system.slice/netclient.service
             └─3390236 /etc/netclient/netclient checkin -n all

Nov 07 15:00:54 blog-k3s04 systemd[1]: Started Network Check.
Nov 07 15:00:54 blog-k3s04 netclient[3390236]: 2021/11/07 15:00:54 [netclient] running checkin for all networks
```

### macOS

如果是 Intel CPU，可以直接到 [Releases 页面](https://github.com/gravitl/netmaker/releases)下载可执行文件。如果是 M1 系列芯片（包含 M1 Pro 和 M1 Max），需要自己从源码编译：

```bash
$ git clone https://github.com/gravitl/netmaker
$ cd netmaker/netclient
$ go build -a -ldflags="-s -w" .
```

安装 WireGuard 命令行工具：

```bash
$ brew install wireguard-tools
```

下面的步骤就和 Ubuntu 一样了，执行以下命令将节点加入网络。

```bash
$ sudo ./netclient join --dnson no --name <HOSTNAME> --network demo --apiserver <Netmaker_IP>:8081 --grpcserver <Netmaker_IP>:50051
```

再到 Netmaker UI 中批准加入节点的请求，批准之后就可以看到各个节点之间已经握手成功了。

```bash
$ sudo wg
interface: utun5
  public key: 2sGnrXTY1xb+cWMR+ZXfBLZqmpDtYCNtKdQ3Cm6gBAs=
  private key: (hidden)
  listening port: 61259

peer: X2LTMBX8fyXyCrCVFcJMDKVBtPcfJHT24lwkQQRSykg=
  endpoint: 121.36.134.95:51821
  allowed ips: 10.8.0.1/32
  latest handshake: 37 seconds ago
  transfer: 216 B received, 732 B sent
  persistent keepalive: every 20 seconds

peer: Z6oCQdV5k4/AVXsUhhGNW69D2hnqcgJe7i3w8qzGJBY=
  endpoint: 103.61.37.238:55730
  allowed ips: 10.8.0.2/32
  latest handshake: 1 minute, 47 seconds ago
  transfer: 1.30 KiB received, 2.99 KiB sent
  persistent keepalive: every 20 seconds
```

除了 Netmaker Server 节点之外，Ubuntu 节点和 macOS 节点的 UDP 监听端口都是随机的，而且他们的防火墙都没有放行相应的 UDP 端口，竟然也握手成功了！那是因为他们都**开启了 UDP 打洞**，这就是 UDP 打洞的神奇之处。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting2@main/img/202111071706395.png)

我们可以来验证下 macOS 和 Ubuntu 之间的连通性：

```bash
$ ping 10.8.0.2 -c 2                                              
PING 10.8.0.2 [局域网 IP] (10.8.0.2 [局域网 IP]): 56 data bytes
64 bytes from 10.8.0.2 [局域网 IP]: icmp_seq=0 ttl=64 time=44.368 ms
64 bytes from 10.8.0.2 [局域网 IP]: icmp_seq=1 ttl=64 time=44.065 ms

--- 10.8.0.2 [局域网 IP] ping statistics ---
2 packets transmitted, 2 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 44.065/44.216/44.368/0.152 ms
```

完美，**即使 macOS 位于 NAT 后面，防火墙没有配置 UDP 端口转发，对等节点也没有放行相应 UDP 端口，双方仍然能够握手成功。**

macOS 的守护进程是通过 launchctl 来配置的，netclient 在 macOS 中也会创建一个守护进程来定时同步配置。

```bash
$ sudo launchctl list com.gravitl.netclient
{
	"StandardOutPath" = "/etc/netclient/com.gravitl.netclient.log";
	"LimitLoadToSessionType" = "System";
	"StandardErrorPath" = "/etc/netclient/com.gravitl.netclient.log";
	"Label" = "com.gravitl.netclient";
	"OnDemand" = true;
	"LastExitStatus" = 0;
	"Program" = "/etc/netclient/netclient";
	"ProgramArguments" = (
		"/etc/netclient/netclient";
		"checkin";
		"-n";
		"all";
	);
};
```

守护进程的配置文件在 `/Library/LaunchDaemons/com.gravitl.netclient.plist` 目录下：

```xml
$ sudo cat /Library/LaunchDaemons/com.gravitl.netclient.plist
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE plist PUBLIC \"-//Apple Computer//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\" >
<plist version='1.0'>
<dict>
	<key>Label</key><string>com.gravitl.netclient</string>
	<key>ProgramArguments</key>
		<array>
			<string>/etc/netclient/netclient</string>
			<string>checkin</string>
			<string>-n</string>
			<string>all</string>
		</array>
	<key>StandardOutPath</key><string>/etc/netclient/com.gravitl.netclient.log</string>
	<key>StandardErrorPath</key><string>/etc/netclient/com.gravitl.netclient.log</string>
	<key>AbandonProcessGroup</key><true/>
	<key>StartInterval</key>
	    <integer>15</integer>
	<key>EnvironmentVariables</key>
		<dict>
			<key>PATH</key>
			<string>/usr/local/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
		</dict>
</dict>
</plist>
```

其中有一段配置内容如下：

```xml
	<key>StartInterval</key>
	    <integer>15</integer>
```

表示每过 15 秒执行签到命令来同步配置。

### OpenWrt

虽然 OpenWrt 也是 Linux 发行版，但目前 netclient 的可执行文件还不能在 OpenWrt 中运行，这和 C 语言的动态链接库有关，OpenWrt 中缺失了很多 C 语言动态链接库。为了解决这个问题，我们可以关闭对 C 语言外部依赖的调用，手动编译出纯静态的可执行文件。

你可以找一台常规的 Linux 发行版或者 macOS 来编译：

```bash
$ git clone https://github.com/gravitl/netmaker
$ cd netmaker/netclient
$ CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -ldflags="-s -w" .
```

> 如果你的 OpenWrt 跑在其他 CPU 架构上，需要将 `GOARCH` 的值替换为相应的 CPU 架构。

编译成功后，可以检查一下可执行文件的类型和 CPU 架构：

```bash
$ file netclient
netclient: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), statically linked, Go BuildID=QWXj97OoEpN-Sm97lim2/ZtJJHaG77M3fYSMqtFGK/YPVj2xx-KdNyYT8YEZ8W/i9CliPF-AqUNcTy2ZKpA, stripped
```

如果确认无误，就可以将其拷贝到 OpenWrt 主机上了，例如：

```bash
$ scp netclient root@<Openwrt_IP>:/root/
```

接下来就可以登录到 OpenWrt 将节点加入网络了：

```bash
$ ./netclient join --dnson no --name <HOSTNAME> --daemon off --network demo --apiserver <Netmaker_IP>:8081 --grpcserver <Netmaker_IP>:50051
```

这里相比于之前的节点多了一个参数 `--daemon off`，禁用了守护进程，因为 OpenWrt 不支持 Systemd。如果你坚持开启守护进程，那么加入网络时就会报错，所以必须要加这个参数。

和之前的步骤一样，到 Netmaker UI 中批准加入节点的请求，批准之后就可以看到各个节点之间已经握手成功了。

```bash
$ wg
interface: nm-demo
  public key: sfrfimG++xk7X0AU5PrZs9p6PYith392ulhmL2OhPR8=
  private key: (hidden)
  listening port: 42655

peer: Z6oCQdV5k4/AVXsUhhGNW69D2hnqcgJe7i3w8qzGJBY=
  endpoint: 103.61.37.238:55730
  allowed ips: 10.8.0.2/32
  latest handshake: 5 seconds ago
  transfer: 488 B received, 1.39 KiB sent
  persistent keepalive: every 20 seconds

peer: X2LTMBX8fyXyCrCVFcJMDKVBtPcfJHT24lwkQQRSykg=
  endpoint: 121.36.134.95:51821
  allowed ips: 10.8.0.1/32
  latest handshake: 7 seconds ago
  transfer: 568 B received, 488 B sent
  persistent keepalive: every 20 seconds

peer: 2sGnrXTY1xb+cWMR+ZXfBLZqmpDtYCNtKdQ3Cm6gBAs=
  endpoint: 192.168.100.90:57183
  allowed ips: 10.8.0.3/32
  latest handshake: 1 minute, 35 seconds ago
  transfer: 1.38 KiB received, 3.46 KiB sent
  persistent keepalive: every 20 seconds
```

由于我的 macOS 和 OpenWrt 在同一个局域网中，所以他们之间的 endpoint 都自动设置成了内网地址，太神奇啦！

到这里还没完，要想让 OpenWrt 动态更新配置，还需要手动实现一个计划任务来定期签到。我们选择使用 Crontab 来实现这个目的，直接添加两个计划任务：

```bash
$ cat <<EOF >> /etc/crontabs/root
* * * * * /etc/netclient/netclient checkin --network all &> /dev/null
* * * * * sleep 15; /etc/netclient/netclient checkin --network all &> /dev/null
EOF
```

这两个计划任务变相实现了 **“每隔 15 秒执行一次签到”** 的目的。

### Android

Netclient 目前只支持 Linux、macOS 和 Windows，如果 Android 和 iOS 端想要加入 VPN  私有网络，只能通过 WireGuard 原生客户端来进行连接。要想做到这一点，需要管理员事先创建一个 External  Client，它会生成一个 WireGuard 配置文件，WireGuard 客户端可以下载该配置文件或者扫描二维码进行连接。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting2@main/img/202111071940467.png)

当然，在创建 External Client 之前，需要先设置其中一个节点为 Ingress Gateway。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting2@main/img/202111071937462.png)

**需要说明的是，目前移动设备通过 External Client 接入只是权宜之计，随着 Netclient 对更多操作系统的支持，最终所有的客户端都应该使用 netclient 来连接。**

最终所有的节点之间实现了全互联模式，每个节点都和其他节点直连，不需要第三方节点进行中转。当然，目前移动设备还是要通过 Ingress Gateway 进行中转。

## 打通内网

到目前为止我们只是打造了一个点对点的 Mesh 网络，各个节点之间都可以通过 WireGuard 的私有网络 IP 进行直连。但我们可以更大胆一点，让每个节点都能访问其他节点的局域网 IP。以 OpenWrt 为例，假设 OpenWrt 跑在家中，家中的局域网 IP 为 `192.168.100.0/24`，如何让其他所有节点都能访问这个局域网呢？

其实也很简单，可以将某个节点设置为 Egress Gateway（出口网关），允许将**内部**网络的流量转发到**外部**指定的 IP 范围。这里的**内部**指的是 WireGuard 私有网络，本文中就是 `10.8.0.0/16`；**外部**网络指的是其他网段，比如局域网 IP。

操作步骤很傻瓜化，先点击 OpenWrt 节点左边的 **“MAKE openwrt AN EGRESS GATEWAY MODE?”**：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting2@main/img/202111071820971.png)

填写局域网的网段和出口网卡，如果你有多个网段需要打通（比如 OpenWrt 上的容器网段），可以用 "," 隔开。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting2@main/img/202111071828160.png)

配置完成后，就会在 OpenWrt 节点配置的 Postup 和 Postdown 中添加相关的 iptables 规则。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting2@main/img/202111071836056.png)

具体的规则为：

```bash
# Postup
iptables -A FORWARD -i nm-demo -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

# Postdown
iptables -D FORWARD -i nm-demo -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
```

很简单，想必就不用我再解释了。

除了添加 Postup 和 Postdown 之外，还会在其他节点 WireGuard 配置的 `AllowedIps` 中添加 OpenWrt 的局域网网段：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting2@main/img/202111071842208.png)

除此之外还会在其他所有节点中添加相关路由表：

```bash
$ ip route|grep "192.168.100.0/24"
192.168.100.0/24 dev wg0 scope nm-demo
```

最终所有的节点都可以访问 OpenWrt 的局域网 IP 了。

大家可以根据我的例子举一反三，比如你用几台云主机搭建了 K8s 集群，**如何在本地客户端和家中访问云上 K8s 集群的 Pod IP 和 Service IP 呢**？不用我再解释了吧，相信你悟了。

## 总结

本文详细介绍了如何使用 Netmaker 来配置 WireGuard 全互联模式，并打通指定节点的局域网，你也可以根据此方法来访问远程 K8s 集群中的 Pod。下一篇文章将会介绍如何使用 Cilium + Netmaker 来打造跨公有云的 K8s 集群。