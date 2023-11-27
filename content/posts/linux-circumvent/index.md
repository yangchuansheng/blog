---
pinned: true
title: "Linux全局智能分流方案"
date: 2018-01-23T08:26:58Z
draft: false
author: 米开朗基杨
toc: true
weight: 101 
categories: "GFW"
tags: ["Linux", "Iptables"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/2020-04-24-gfw.webp"
---

<p id="div-border-left-red">Github 地址：<a href="https://github.com/yangchuansheng/love-gfw" target="_blank">Linux 和 MacOS 设备智能分流方案</a></p>

**本来我是决定不再写这样的文章了的。但是呢，最近连续配置了两次 `ArchLinux`，在配置这种东西的时候连续撞到了同样的坑，加上这段时间经常有人问我关于 `Linux` 下的 `shadowsocks` 的问题，所以我想了想还是写一篇记录一下吧，也免得自己以后再忘记了。**

------
这里有两种方案，都可以实现全局智能分流。第一种方案的思路是使用 `ipset` 载入 `chnroute` 的 `IP` 列表并使用 `iptables` 实现带自动分流国内外流量的全局代理。为什么不用 `PAC` 呢？因为 `PAC` 这种东西只对浏览器有用。难道你在浏览器之外就不需要科学上网了吗？反正我是不信的……

**本教程所用系统为 `Archlinux`，其他发型版类似，请自行参考相关资料。**

## 通过 iptables 实现智能分流

----

### 安装相关软件

* shadowsocks-libev
* ipset

```bash
$ pacman -S shadowsocks-libev ipset
```

### 配置shadowsocks-libev（略过）

假设shadowsocks配置文件为/etc/shadowsocks.json
 
### 获取中国IP段

将以下命令写入脚本保存执行（假设保存在/home/yang/bin/路由表/目录下）：

```bash
#!/bin/sh
wget -c http://ftp.apnic.net/stats/apnic/delegated-apnic-latest
cat delegated-apnic-latest | awk -F '|' '/CN/&&/ipv4/ {print $4 "/" 32-log($5)/log(2)}' | cat > /home/yang/bin/路由表/cn_rules.conf
```

### 创建启动和关闭脚本

```bash
$ vim /home/yang/bin/shadowsocks/ss-up.sh
```

```bash
#!/bin/bash

SOCKS_SERVER=$SERVER_IP # SOCKS 服务器的 IP 地址
# Setup the ipset
ipset -N chnroute hash:net maxelem 65536

for ip in $(cat '/home/yang/bin/路由表/cn_rules.conf'); do
  ipset add chnroute $ip
done

# 在nat表中新增一个链，名叫：SHADOWSOCKS
iptables -t nat -N SHADOWSOCKS

# Allow connection to the server
iptables -t nat -A SHADOWSOCKS -d $SOCKS_SERVER -j RETURN

# Allow connection to reserved networks
iptables -t nat -A SHADOWSOCKS -d 0.0.0.0/8 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 10.0.0.0/8 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 127.0.0.0/8 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 169.254.0.0/16 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 172.16.0.0/12 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 192.168.0.0/16 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 224.0.0.0/4 -j RETURN
iptables -t nat -A SHADOWSOCKS -d 240.0.0.0/4 -j RETURN

# Allow connection to chinese IPs
iptables -t nat -A SHADOWSOCKS -p tcp -m set --match-set chnroute dst -j RETURN
# 如果你想对 icmp 协议也实现智能分流，可以加上下面这一条
# iptables -t nat -A SHADOWSOCKS -p icmp -m set --match-set chnroute dst -j RETURN

# Redirect to Shadowsocks
# 把1081改成你的shadowsocks本地端口
iptables -t nat -A SHADOWSOCKS -p tcp -j REDIRECT --to-port 1081
# 如果你想对 icmp 协议也实现智能分流，可以加上下面这一条
# iptables -t nat -A SHADOWSOCKS -p icmp -j REDIRECT --to-port 1081

# 将SHADOWSOCKS链中所有的规则追加到OUTPUT链中
iptables -t nat -A OUTPUT -p tcp -j SHADOWSOCKS
# 如果你想对 icmp 协议也实现智能分流，可以加上下面这一条
# iptables -t nat -A OUTPUT -p icmp -j SHADOWSOCKS

# 内网流量流经 shadowsocks 规则链
iptables -t nat -A PREROUTING -s 192.168/16 -j SHADOWSOCKS
# 内网流量源NAT
iptables -t nat -A POSTROUTING -s 192.168/16 -j MASQUERADE
```
这是在启动 `shadowsocks` 之前执行的脚本，用来设置 `iptables` 规则，对全局应用代理并将 `chnroute` 导入 `ipset` 来实现自动分流。注意要把服务器 `IP` 和本地端口相关的代码全部替换成你自己的。

这里就有一个坑了，就是在把 `chnroute.txt` 加入 `ipset` 的时候。因为 `chnroute.txt` 是一个 `IP` 段列表，而中国持有的 `IP` 数量上还是比较大的，所以如果使用 `hash:ip` 来导入的话会使内存溢出。我在第二次重新配置的时候就撞进了这个大坑……

但是你也不能尝试把整个列表导入 `iptables`。虽然导入 `iptables` 不会导致内存溢出，但是 `iptables` 是线性查表，即使你全部导入进去，也会因为低下的性能而抓狂。

然后再创建 `/home/yang/bin/shadowsocks/ss-down.sh`, 这是用来清除上述规则的脚本，比较简单

```bash
#!/bin/bash

# iptables -t nat -D OUTPUT -p icmp -j SHADOWSOCKS
iptables -t nat -D OUTPUT -p tcp -j SHADOWSOCKS
iptables -t nat -F SHADOWSOCKS
iptables -t nat -X SHADOWSOCKS
ipset destroy chnroute
```

接着执行

```bash
$ chmod +x ss-up.sh
$ chmod +x ss-down.sh
```

### 配置ss-redir服务

首先，默认的 `ss-local` 并不能用来作为 `iptables` 流量转发的目标，因为它是 `socks5` 代理而非透明代理。我们至少要把 `systemd` 执行的程序改成 `ss-redir`。其次，上述两个脚本还不能自动执行，必须让 `systemd` 分别在启动 `shadowsocks` 之前和关闭之后将脚本执行，这样才能自动配置好 `iptables` 规则。

```bash
$ vim /usr/lib/systemd/system/shadowsocks-libev@.service
```

```bash
[Unit]
Description=Shadowsocks-Libev Client Service
After=network.target

[Service]
User=root
CapabilityBoundingSet=~CAP_SYS_ADMIN
ExecStart=
ExecStartPre=/home/yang/bin/shadowsocks/ss-up.sh
ExecStart=/usr/bin/ss-redir -u -c /etc/%i.json
ExecStopPost=/home/yang/bin/shadowsocks/ss-down.sh

[Install]
WantedBy=multi-user.target
```

然后启动服务

```bash
$ systemctl start shadowsocks-libev@shadowsocks
```

开机自启

```bash
$ systemctl enable shadowsocks-libev@shadowsocks
```

### 配置智能 DNS 服务

完成了以上工作之后是不是就可以实现全局科学上网了呢？答案是否定的，我们还有最后一项工作需要完成，那就是解决 `DNS` 污染问题。如果你不知道什么是 `DNS` 污染，我可以简单地给你普及一下：

> `DNS` 污染是一种让一般用户由于得到虚假目标主机 `IP` 而不能与其通信的方法，是一种 `DNS` 缓存投毒攻击（DNS cache poisoning）。其工作方式是：由于通常的 `DNS` 查询没有任何认证机制，而且 `DNS` 查询通常基于的 `UDP` 是无连接不可靠的协议，因此 `DNS` 的查询非常容易被篡改，通过对 `UDP` 端口 53 上的 `DNS` 查询进行入侵检测，一经发现与关键词相匹配的请求则立即伪装成目标域名的解析服务器（NS，Name Server）给查询者返回虚假结果。

`DNS` 污染症状：目前一些被禁止访问的网站很多就是通过 `DNS` 污染来实现的，例如 `YouTube`、`Facebook` 等网站。

**应对dns污染的方法**

- 对于 `DNS` 污染，可以说，个人用户很难单单靠设置解决，通常可以使用 `VPN` 或者域名远程解析的方法解决，但这大多需要购买付费的 `VPN` 或 `SSH` 等
- 修改 `Hosts` 的方法，手动设置域名正确的 `IP` 地址
- `dns` 加密解析：[DNSCrypt](https://dnscrypt.org/)
- 忽略 `DNS` 投毒污染小工具：[Pcap_DNSProxy](https://github.com/chengr28/Pcap_DNSProxy)

我们选择用 `Pcap_DNSProxy` 来解决这个问题，以前用的是 `Pdnsd + Dnsmasq` 组合， 后来发现 `TCP` 请求效率太低加上家里网络与那些国外的 `DNS` 丢包实在是严重， 所以打算用 `Pcap_DNSProxy` 代替 `Pdnsd`。

关于 `Pcap_DNSProxy` 的详细介绍，可以参考:
[https://github.com/chengr28/Pcap_DNSProxy](https://github.com/chengr28/Pcap_DNSProxy)

安装过程可以参考：
[https://github.com/chengr28/Pcap_DNSProxy/blob/master/Documents/ReadMe_Linux.zh-Hans.txt](https://github.com/chengr28/Pcap_DNSProxy/blob/master/Documents/ReadMe_Linux.zh-Hans.txt)

更详细的使用说明可以参考：
[https://github.com/chengr28/Pcap_DNSProxy/blob/master/Documents/ReadMe.zh-Hans.txt](https://github.com/chengr28/Pcap_DNSProxy/blob/master/Documents/ReadMe.zh-Hans.txt)

这里主要重点强调一些需要注意的配置项：

- `DNS` - 境外域名解析参数区域（这是最关键的一项配置）

```bash
[DNS]
# 这里一定要填 IPv4 + TCP！！！表示只使用 TCP 协议向境外远程 DNS 服务器发出请求
Outgoing Protocol = IPv4 + TCP
# 建议当系统使用全局代理功能时启用，程序将除境内服务器外的所有请求直接交给系统而不作任何过滤等处理，系统会将请求自动发往远程服务器进行解析
Direct Request = IPv4
...
...
```

- `Local DNS` - 境内域名解析参数区域

```bash
[Local DNS]
# 发送请求到境内 DNS 服务器时所使用的协议
Local Protocol = IPv4 + UDP
...
...
```

- `Addresses` - 普通模式地址区域

```bash
[Addresses]
...
...
# IPv4 主要境外 DNS 服务器地址
IPv4 Main DNS Address = 8.8.4.4:53
# IPv4 备用境外 DNS 服务器地址
IPv4 Alternate DNS Address = 8.8.8.8:53|208.67.220.220:443|208.67.222.222:5353
# IPv4 主要境内 DNS 服务器地址，用于境内域名解析，推荐使用 onedns
IPv4 Local Main DNS Address = 112.124.47.27:53
# IPv4 备用境内 DNS 服务器地址，用于境内域名解析
IPv4 Local Alternate DNS Address = 114.215.126.16:53
...
...
```

### 配置系统 DNS 服务器设置

* 可参见 [https://developers.google.com/speed/public-dns/docs/using](https://developers.google.com/speed/public-dns/docs/using) 中 `Changing your DNS servers settings` 中 `Linux` 一节

* 图形界面以 `GNOME 3` 为例：

* 打开所有程序列表，并 -> 设置 – 硬件分类 – 网络

* 如果要对当前的网络配置进行编辑 -&gt; 单击齿轮按钮

* 选中 `IPv4`

* `DNS` 栏目中，将自动拨向关闭

* 在服务器中填入 `127.0.0.1` （或103.214.195.99:7300）并应用

* 选中 `IPv6`

* `DNS` 栏目中，将自动拨向关闭

* 在服务器中填入 ::1 并应用

* 请务必确保只填入这两个地址，填入其它地址可能会导致系统选择其它 DNS 服务器绕过程序的代理

* 重启网络连接

* 直接修改系统文件修改 DNS 服务器设置：

* 自动获取地址(DHCP)时：

* 以 `root` 权限进入 `/etc/dhcp` 或 `/etc/dhcp3` 目录（视乎 dhclient.conf 文件位置）

* 直接修改 `dhclient.conf` 文件，修改或添加 `prepend domain-name-servers` 一项即可

* 如果 `prepend domain-name-servers` 一项被 # 注释则需要把注释去掉以使配置生效，不需要添加新的条目

* `dhclient.conf` 文件可能存在多个 `prepend domain-name-servers` 项，是各个网络接口的配置项目，直接修改总的配置项目即可

* 使用 `service network(/networking) restart` 或 `ifdown/ifup` 或 `ifconfig stop/start` 重启网络服务/网络端口

* 非自动获取地址(DHCP)时：

* 以 `root` 权限进入 `/etc` 目录

* 直接修改 `resolv.conf` 文件里的 `nameserver` 即可

* 如果重启后配置被覆盖，则需要修改或新建 `/etc/resolvconf/resolv.conf.d` 文件，内容和 `resolv.conf` 一样

* 使用 `service network(/networking) restart` 或 `ifdown/ifup` 或 `ifconfig stop/start` 重启网络服务/网络端口

### 打开流量转发

```bash
$ cat /etc/sysctl.d/30-ipforward.conf
```

```bash
net.ipv4.ip_forward=1

net.ipv6.conf.all.forwarding = 1

net.ipv4.tcp_congestion_control=westwood

net.ipv4.tcp_syn_retries = 5

net.ipv4.tcp_synack_retries = 5
```
编辑完成后，执行以下命令使变动立即生效

```bash
$ sysctl -p
```

## 通过 nftables 实现智能分流

----

### 安装相关软件

* shadowsocks-libev
* nftables

```bash
$ pacman -S shadowsocks-libev nftables
```

### 配置shadowsocks-libev（略过）

假设shadowsocks配置文件为/etc/shadowsocks.json
 
### 获取中国IP段

将以下命令写入脚本保存执行（假设保存在/home/yang/bin/路由表/目录下）：

```bash
#!/bin/sh
wget -c http://ftp.apnic.net/stats/apnic/delegated-apnic-latest
cat delegated-apnic-latest | awk -F '|' '/CN/&&/ipv4/ {print $4 "/" 32-log($5)/log(2)}' | cat > /home/yang/bin/路由表/cn_rules.conf
cat cn_rules.conf|sed ':label;N;s/\n/, /;b label'|sed 's/$/& }/g'|sed 's/^/{ &/g' > /home/yang/bin/路由表/cn_rules1.conf
```

### 创建启动和关闭脚本

```bash
$ vim /home/yang/bin/shadowsocks/nftables-up.sh
```

```bash
#! /bin/bash

nft_pre="/usr/sbin/nft add rule nat prerouting"
nft_out="/usr/sbin/nft add rule nat output"
chnroute=$(cat '/home/yang/bin/路由表/cn_rules1.conf')

/usr/bin/nft -f /etc/nftables.conf

${nft_pre} tcp dport 8385 return
${nft_pre} ip daddr 139.162.87.98 return
${nft_pre} ip daddr { 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 224.0.0.0/4, 240.0.0.0/4, 172.16.39.0/24} return
${nft_pre} ip daddr $chnroute return
${nft_pre} tcp sport { 32768-61000} redirect to 1081
#${nft_pre} ip protocol icmp redirect to 1081
# 内网流量源NAT
nft add rule nat postrouting ip saddr 192.168.0.0/12 masquerade

${nft_out} tcp dport 8385 return
${nft_out} ip daddr 139.162.87.98 return
${nft_out} ip daddr { 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 224.0.0.0/4, 240.0.0.0/4, 172.16.39.0/24} return
${nft_out} ip daddr $chnroute return
# /proc/sys/net/ipv4/ip_local_port_range，本地发起的连接的端口范围
${nft_out} tcp sport { 32768-61000} redirect to 1081
${nft_out} ip protocol icmp redirect to 1081
```

&emsp;&emsp;这是在启动 `shadowsocks` 之前执行的脚本，用来设置 `nftables` 规则。
然后再创建 `/home/yang/bin/shadowsocks/nftables-down.sh`, 这是用来清除上述规则的脚本，比较简单

```bash
#!/bin/bash

sudo nft flush table nat
#sudo nft flush table filter
```

接着执行

```bash
$ chmod +x nftables-up.sh
$ chmod +x nftables-down.sh
```

### 配置ss-redir服务

首先，默认的 `ss-local` 并不能用来作为 `nftables` 流量转发的目标，因为它是 `socks5` 代理而非透明代理。我们至少要把 `systemd` 执行的程序改成 `ss-redir`。其次，上述两个脚本还不能自动执行，必须让 `systemd` 分别在启动 `shadowsocks` 之前和关闭之后将脚本执行，这样才能自动配置好 `nftables` 规则。

```bash
$ vim /usr/lib/systemd/system/shadowsocks-libev@.service
```

```bash
[Unit]
Description=Shadowsocks-Libev Client Service
After=network.target

[Service]
User=root
CapabilityBoundingSet=~CAP_SYS_ADMIN
ExecStart=
ExecStartPre=/home/yang/bin/shadowsocks/nftables-up.sh
ExecStart=/usr/bin/ss-redir -u -c /etc/%i.json
ExecStopPost=/home/yang/bin/shadowsocks/nftables-down.sh

[Install]
WantedBy=multi-user.target
```

然后启动服务

```bash
$ systemctl start nftables
$ systemctl start shadowsocks-libev@shadowsocks
```

开机自启

```bash
$ systemctl enable nftables
$ systemctl enable shadowsocks-libev@shadowsocks
```

### 配置智能 DNS 服务

同上

### 配置系统 DNS 服务器设置

同上

### 打开流量转发

同上

## 通过策略路由实现智能分流

----

### 安装相关软件

* badvpn
* shadowsocks

```bash
$ pacman -S badvpn shadowsocks
```

### 配置shadowsocks（略过）
假设shadowsocks配置文件为/etc/shadowsocks.json
 
### 获取中国IP段

将以下命令写入脚本保存执行（假设保存在/home/yang/bin/路由表/目录下）：

```bash
#!/bin/sh
wget -c http://ftp.apnic.net/stats/apnic/delegated-apnic-latest
cat delegated-apnic-latest | awk -F '|' '/CN/&&/ipv4/ {print $4 "/" 32-log($5)/log(2)}' | cat > /home/yang/bin/路由表/cn_rules.conf
```

### 配置智能 DNS 服务

同上

### 配置系统 DNS 服务器设置

同上

### 编写路由表启动和终止脚本

```bash
$ vim /usr/local/bin/socksfwd
```

```bash
#!/bin/bash
SOCKS_SERVER=$SERVER_IP # SOCKS 服务器的 IP 地址
SOCKS_PORT=1081 # 本地SOCKS 服务器的端口
GATEWAY_IP=$(ip route|grep "default"|awk '{print $3}') # 家用网关（路由器）的 IP 地址，你也可以手动指定
TUN_NETWORK_DEV=tun0 # 选一个不冲突的 tun 设备号
TUN_NETWORK_PREFIX=10.0.0 # 选一个不冲突的内网 IP 段的前缀


start_fwd() {
ip tuntap del dev "$TUN_NETWORK_DEV" mode tun
# 添加虚拟网卡
ip tuntap add dev "$TUN_NETWORK_DEV" mode tun
# 给虚拟网卡绑定IP地址
ip addr add "$TUN_NETWORK_PREFIX.1/24" dev "$TUN_NETWORK_DEV"
# 启动虚拟网卡
ip link set "$TUN_NETWORK_DEV" up
ip route del default via "$GATEWAY_IP"
ip route add "$SOCKS_SERVER" via "$GATEWAY_IP"
# 特殊ip段走家用网关（路由器）的 IP 地址（如局域网联机）
# ip route add "172.16.39.0/24" via "$GATEWAY_IP"
# 国内网段走家用网关（路由器）的 IP 地址
for i in $(cat /home/yang/bin/路由表/cn_rules.conf)
do
ip route add "$i" via "$GATEWAY_IP"
done
# 将默认网关设为虚拟网卡的IP地址
ip route add 0.0.0.0/1 via "$TUN_NETWORK_PREFIX.1"
ip route add 128.0.0.0/1 via "$TUN_NETWORK_PREFIX.1"
# 将socks5转为vpn
badvpn-tun2socks --tundev "$TUN_NETWORK_DEV" --netif-ipaddr "$TUN_NETWORK_PREFIX.2" --netif-netmask 255.255.255.0 --socks-server-addr "127.0.0.1:$SOCKS_PORT"
TUN2SOCKS_PID="$!"
}


stop_fwd() {
ip route del 128.0.0.0/1 via "$TUN_NETWORK_PREFIX.1"
ip route del 0.0.0.0/1 via "$TUN_NETWORK_PREFIX.1"
for i in $(cat /home/yang/bin/路由表/cn_rules.conf)
do
ip route del "$i" via "$GATEWAY_IP"
done
ip route del "172.16.39.0/24" via "$GATEWAY_IP"
ip route del "$SOCKS_SERVER" via "$GATEWAY_IP"
ip route add default via "$GATEWAY_IP"
ip link set "$TUN_NETWORK_DEV" down
ip addr del "$TUN_NETWORK_PREFIX.1/24" dev "$TUN_NETWORK_DEV"
ip tuntap del dev "$TUN_NETWORK_DEV" mode tun
}



start_fwd
trap stop_fwd INT TERM
wait "$TUN2SOCKS_PID"
```

```bash
$ vim /etc/systemd/system/socksfwd.service
```

```bash
[Unit]

Description=Transparent SOCKS5 forwarding

After=network-online.target

[Service]

Type=simple

ExecStart=/usr/local/bin/socksfwd

LimitNOFILE=1048576


[Install]

WantedBy=multi-user.target
```

启动服务

```bash
$ systemctl start socksfwd
```

开机自启

```bash
$ systemctl enable socksfwd
```

### 打开流量转发

```bash
$ cat /etc/sysctl.d/30-ipforward.conf
```

```bash
net.ipv4.ip_forward=1

net.ipv6.conf.all.forwarding = 1

net.ipv4.tcp_congestion_control=westwood

net.ipv4.tcp_syn_retries = 5

net.ipv4.tcp_synack_retries = 5
```

编辑完成后，执行以下命令使变动立即生效

```bash
$ sysctl -p
```

