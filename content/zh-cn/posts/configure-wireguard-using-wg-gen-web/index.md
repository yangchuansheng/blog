---
keywords:
- WireGuard
- wg-gen-web
- wg-api
title: "WireGuard 配置教程：使用 wg-gen-web 来管理 WireGuard 的配置"
date: 2021-01-19T21:43:17+08:00
lastmod: 2021-01-19T21:43:17+08:00
description: 本文介绍了如何使用 wg-gen-web 来管理 WireGuard 的配置，并针对动态 IP 进行优化。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- WireGuard
categories: Network
img: https://images.icloudnative.io/uPic/20210121152522.png
---

之前花了很大的篇幅介绍了 WireGuard 的[工作原理](/posts/wireguard-docs-theory/)和[配置详解](/posts/wireguard-docs-practice/)，可这里面的内容实在太多了，大部分人根本没兴趣深究，只是将其当成参考书来看。WireGuard 虽然组网逻辑很简洁明了，但秘钥和配置文件的管理是个麻烦事，需要手工配置。为了让大部分读者能够快速上手 WireGuard，体验 WireGuard 的优雅和强大，我决定新开一个 WireGuard 快速上手系列，第一篇之前已经发出来了：

+ [WireGuard 快速安装教程](/posts/wireguard-install/)

这篇文章仅仅介绍了如何快速安装 WireGuard，并没有涉及到如何配置使其正常工作。本文主要介绍如何方便优雅地管理 WireGuard 的配置和秘钥。当然了，这里不会详细解读各个配置参数的含义，也不会告诉你通过哪个命令来创建公钥私钥，如果你对此部分感兴趣，可以查看我之前发布的 [WireGuard 配置详解](/posts/wireguard-docs-practice/)。

## 1. wg-gen-web 配置

对于新手来说，如何才能快速把 WireGuard 用起来呢？当然是通过图形管理界面啦，填几个参数，生成个二维码，再拿客户端扫下二维码就连上了，简直是比爽姐还爽~

[wg-gen-web](https://github.com/vx3r/wg-gen-web) 就是这样一款图形管理界面，主要包含以下这些功能：

+ 根据 `CIDR` 自动分配 IP 地址给客户端；
+ 每个客户端会生成 QR 二维码，方便移动客户端扫描使用；
+ 支持通过邮件发送二维码和配置文件；
+ 支持启用和禁用某个客户端；
+ 支持 IPv6；
+ 支持使用 GitHub 和 Oauth2 OIDC 来进行用户认证；
+ 颜值还比较高。

![](https://images.icloudnative.io/uPic/20210120100538.png)

wg-gen-web 支持直接通过容器来运行，如果你是在本地运行，可以准备一份 docker-compose 文件：

**docker-compose.yaml**

```yaml
version: '3.6'
services:
  wg-gen-web:
    image: vx3r/wg-gen-web:latest
    container_name: wg-gen-web
    restart: always
    expose:
      - "8080/tcp"
    ports:
      - 80:8080
    environment:
      - WG_CONF_DIR=/data
      - WG_INTERFACE_NAME=wg0.conf
      - OAUTH2_PROVIDER_NAME=fake
      - WG_STATS_API=http://<API_LISTEN_IP>:8182
    volumes:
      - /etc/wireguard:/data
    network_mode: bridge
  wg-json-api:
    image: james/wg-api:latest
    container_name: wg-json-api
    restart: always
    cap_add:
      - NET_ADMIN
    network_mode: "host"
    command: wg-api --device wg0 --listen <API_LISTEN_IP>:8182
```

这里还用到了另外一个项目 [wg-api](https://github.com/jamescun/wg-api)，该项目提供了一个 `JSON-RPC` 接口，用来暴露 WireGuard 的网络状态信息。其中 `<API_LISTEN_IP>` 可以直接替换成 `docker0` 的 IP。

执行以下命令运行 wg-gen-web：

```bash
🐳  → docker-compose up -d
```

在浏览器中输入 URL `<hostIP>` 打开图形管理界面，点击 “SERVER” 开始填写服务端和客户端的配置信息：

![](https://images.icloudnative.io/uPic/20210120115544.png)

各项配置的含义我就不解释了，都很好理解，实在不理解的请查看 [WireGuard 配置详解](/posts/wireguard-docs-practice/)。

填写好配置信息后，直接点击 `UPDATE SERVER CONFIGURATION` 保存，同时会生成配置文件 `wg0.conf`：

```bash
🐳  → cat /etc/wireguard/wg0.conf
# Updated: 2021-01-20 03:59:37.718655459 +0000 UTC / Created: 2021-01-20 03:32:28.045982181 +0000 UTC
[Interface]
Address = 10.6.6.1/24
ListenPort = 51820
PrivateKey = iLPeSYaKYERfyrOX/YcAam4AIIHCNEBXnqL2oRedAWQ=

PreUp = echo WireGuard PreUp
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -A FORWARD -o wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PreDown = echo WireGuard PreDown
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
```

接下来点击 `CLIENTS`，然后点击 `ADD NEW CLIENT` 开始新增客户端配置：

![](https://images.icloudnative.io/uPic/20210120120513.png)

填写客户端配置信息：

![](https://images.icloudnative.io/uPic/20210120130016.png)

点击 SUBMIT，就会在 `/etc/wireguard` 目录下生成客户端的 json 配置文件：

```json
🐳  → cat /etc/wireguard/f5fcc1e7-e03a-48bb-acd9-8d5214c6cb1f
{
  "id": "f5fcc1e7-e03a-48bb-acd9-8d5214c6cb1f",
  "name": "test",
  "email": "yangchuansheng33@gmail.com",
  "enable": true,
  "ignorePersistentKeepalive": false,
  "presharedKey": "8QkkeXGt4D/lnLDA1jfJUhB3oiShhRWp/GC8GFQtgKs=",
  "allowedIPs": [
    "10.6.6.0/24"
  ],
  "address": [
    "10.6.6.2/32"
  ],
  "tags": [],
  "privateKey": "ODN2xN12p5lwcEuj20C4uZV9kJE9yHz4eAHB/4czPEM=",
  "publicKey": "k2Ut15aQn7+mNHqEd4bwdNx3WcvA4F7SPmETYuWdSjM=",
  "createdBy": "Unknown",
  "updatedBy": "",
  "created": "2021-01-20T05:19:16.659225991Z",
  "updated": "2021-01-20T05:19:16.659225991Z"
}
```

如果勾选了 “Enable client after creation”，还会将 peer 的配置加入 `wg0.conf`：

```bash
🐳  → cat /etc/wireguard/wg0.conf
# Updated: 2021-01-20 03:59:37.718655459 +0000 UTC / Created: 2021-01-20 03:32:28.045982181 +0000 UTC
[Interface]
Address = 10.6.6.1/24
ListenPort = 51820
PrivateKey = iLPeSYaKYERfyrOX/YcAam4AIIHCNEBXnqL2oRedAWQ=

PreUp = echo WireGuard PreUp
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -A FORWARD -o wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PreDown = echo WireGuard PreDown
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
# test / yangchuansheng33@gmail.com / Updated: 2021-01-20 05:19:16.659225991 +0000 UTC / Created: 2021-01-20 05:19:16.659225991 +0000 UTC
[Peer]
PublicKey = k2Ut15aQn7+mNHqEd4bwdNx3WcvA4F7SPmETYuWdSjM=
PresharedKey = 8QkkeXGt4D/lnLDA1jfJUhB3oiShhRWp/GC8GFQtgKs=
AllowedIPs = 10.6.6.2/32
```

 最后直接启动 wg-quick 服务就行了：

```bash
🐳  → systemctl start wg-quick@wg0
```

如果你之前已经启动过该服务，现在只需要重启就行了：

```bash
🐳  → systemctl restart wg-quick@wg0
```

重启之后 WireGuard 会断开重连，体验不太好。事实上 WireGuard 可以做到在不中断活跃连接的情况下重新加载配置文件，命令如下：

```bash
🐳  → wg syncconf wg0 <(wg-quick strip wg0)
```

我们可以将这个命令作为 systemd 服务的 `reload` 命令：

```bash
# /usr/lib/systemd/system/wg-quick@.service
[Unit]
Description=WireGuard via wg-quick(8) for %I
After=network-online.target nss-lookup.target
Wants=network-online.target nss-lookup.target
PartOf=wg-quick.target
Documentation=man:wg-quick(8)
Documentation=man:wg(8)
Documentation=https://www.wireguard.com/
Documentation=https://www.wireguard.com/quickstart/
Documentation=https://git.zx2c4.com/wireguard-tools/about/src/man/wg-quick.8
Documentation=https://git.zx2c4.com/wireguard-tools/about/src/man/wg.8

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/wg-quick up %i
ExecStop=/usr/bin/wg-quick down %i
ExecReload=/bin/bash -c 'exec /usr/bin/wg syncconf %i <(exec /usr/bin/wg-quick strip %i)'
Environment=WG_ENDPOINT_RESOLUTION_RETRIES=infinity

[Install]
WantedBy=multi-user.target
```

如果你按照 [WireGuard 快速安装教程](/posts/wireguard-install/) 这篇文章的步骤来安装 WireGuard，`ExecReload` 默认已经被加进去了，到这一步不需要做任何改动。后面再更新配置文件时，直接 reload 就行了：

```bash
🐳  → systemctl reload wg-quick@wg0
```

每次更新配置后都要手动 reload 还是很麻烦的，我们可以通过 systemd 来监听配置文件的实时变化，一但配置文件有所改动，就立即触发 reload。方法也很简单，先创建一个 `wg-gen-web.service` 用来 reload：

```bash
# /etc/systemd/system/wg-gen-web.service
[Unit]
Description=Restart WireGuard
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/systemctl reload wg-quick@wg0.service

[Install]
WantedBy=multi-user.target
```

然后再创建一个同名的 `wg-gen-web.path` 用来监听文件变化：

```bash
# /etc/systemd/system/wg-gen-web.path
[Unit]
Description=Watch /etc/wireguard for changes

[Path]
PathModified=/etc/wireguard

[Install]
WantedBy=multi-user.target
```

设置开机自启：

```bash
🐳  → systemctl enable wg-gen-web.service wg-gen-web.path --now
```

后面如果再到 Web 页面上更新配置信息，会立即触发 reload，不需要再自己手动 reload 了。

查看接口信息：

```bash
🐳  → wg show wg0
interface: wg0
  public key: dG5xPA7Q6X7ByeNl5pasI/8ZPhiTOsfsy0NUX4w2wmI=
  private key: (hidden)
  listening port: 51820

peer: k2Ut15aQn7+mNHqEd4bwdNx3WcvA4F7SPmETYuWdSjM=
  preshared key: (hidden)
  allowed ips: 10.6.6.2/32
```

目前还没有客户端与之连接，所以还看不到连接信息。下面以 macOS 为例演示连接过程。

## 2. 客户端建立连接

macOS 目前只有两种客户端软件，一个是图形界面，一个是命令行工具。图形界面只上架了 App Store，而且需要美区 Apple ID，比较麻烦。

![](https://images.icloudnative.io/uPic/20210120135143.png)

我推荐直接安装命令行工具：

```bash
🐳  → brew install wireguard-tools
```

macOS 中的 `wg-quick` 默认也是读取的 `/etc/wireguard` 目录，所以需要先创建该目录：

```bash
🐳  → sudo mkdir /etc/wireguard
```

然后直接下载配置文件：

![](https://images.icloudnative.io/uPic/20210120135905.png)

将其移动到 /etc/wireguard 目录，并重命名为 `wg0.conf`：

```bash
🐳  → sudo mv ~/Downloads/test.conf /etc/wireguard/wg0.conf
```

查看配置文件内容：

```bash
🐳  → cat /etc/wireguard/wg0.conf
[Interface]
Address = 10.6.6.2/32
PrivateKey = ODN2xN12p5lwcEuj20C4uZV9kJE9yHz4eAHB/4czPEM=


[Peer]
PublicKey = dG5xPA7Q6X7ByeNl5pasI/8ZPhiTOsfsy0NUX4w2wmI=
PresharedKey = 8QkkeXGt4D/lnLDA1jfJUhB3oiShhRWp/GC8GFQtgKs=
AllowedIPs = 10.6.6.0/24
Endpoint = 172.16.7.3:51820
PersistentKeepalive = 25
```

直接启动：

```bash
🐳  → sudo wg-quick up wg0
```

查看连接信息：

```bash
🐳  → sudo wg
interface: utun2
  public key: k2Ut15aQn7+mNHqEd4bwdNx3WcvA4F7SPmETYuWdSjM=
  private key: (hidden)
  listening port: 60082

peer: dG5xPA7Q6X7ByeNl5pasI/8ZPhiTOsfsy0NUX4w2wmI=
  preshared key: (hidden)
  endpoint: 172.16.7.3:51820
  allowed ips: 10.6.6.0/24
  latest handshake: 7 seconds ago
  transfer: 840 B received, 840 B sent
  persistent keepalive: every 25 seconds
```

可以看到输出中有两行重要的信息：

```bash
transfer: 840 B received, 840 B sent
persistent keepalive: every 25 seconds
```

表示和服务端已经握手成功了，并且开始传输数据。

到服务端所在的机器查看连接信息：

```bash
🐳  → wg show wg0
interface: wg0
  public key: dG5xPA7Q6X7ByeNl5pasI/8ZPhiTOsfsy0NUX4w2wmI=
  private key: (hidden)
  listening port: 51820

peer: k2Ut15aQn7+mNHqEd4bwdNx3WcvA4F7SPmETYuWdSjM=
  preshared key: (hidden)
  endpoint: 10.2.0.2:60082
  allowed ips: 10.6.6.2/32
  latest handshake: 25 seconds ago
  transfer: 1.64 KiB received, 1.61 KiB sent
```

可以看到握手成功了。

Web 页面也能看到连接信息：

![](https://images.icloudnative.io/uPic/20210120141437.png)

如果想增加更多的客户端，直接在 Web 页面新增客户端配置就行了，不需要做任何额外的操作，解放了双手。手机客户端直接扫描二维码就能连接，还是挺爽的。

## 3. 优化

最后一部分主要介绍 WireGuard 的优化。

### 动态 IP

对于 WireGuard 而言，只需要一端具有公网 IP 地址便可建立连接，哪怕这一端的 IP 是动态变化的也没问题，可以使用 DDNS 来解决这个问题，WireGuard 会在启动时解析域名的 IP 地址，然后将该 IP 地址作为 peer 的 `Endpoint`。但这里有一个小瑕疵，WireGuard 只会在启动时解析配置文件中域名的 IP 地址，后续如果域名对应的 IP 地址有更新，也不会重新解析。

[wireguard-tools](https://git.zx2c4.com/wireguard-tools) 项目中提供了一个脚本 [reresolve-dns.sh](https://git.zx2c4.com/wireguard-tools/tree/contrib/reresolve-dns) 可以用来解决这个问题，该脚本会解析 WireGuard 的配置文件并更新 Endpoint 的 IP 地址。同时，我们还需要创建一个定时任务来定期触发该脚本更新配置，比如每 30 秒执行一次。具体操作步骤如下：

首先克隆 wireguard-tools 仓库：

```bash
🐳  → git clone https://git.zx2c4.com/wireguard-tools /usr/share/wireguard-tools
```

脚本内容：

```bash
🐳  → cat /usr/share/wireguard-tools/contrib/reresolve-dns/reresolve-dns.sh

#!/bin/bash
# SPDX-License-Identifier: GPL-2.0
#
# Copyright (C) 2015-2020 Jason A. Donenfeld <Jason@zx2c4.com>. All Rights Reserved.

set -e
shopt -s nocasematch
shopt -s extglob
export LC_ALL=C

CONFIG_FILE="$1"
[[ $CONFIG_FILE =~ ^[a-zA-Z0-9_=+.-]{1,15}$ ]] && CONFIG_FILE="/etc/wireguard/$CONFIG_FILE.conf"
[[ $CONFIG_FILE =~ /?([a-zA-Z0-9_=+.-]{1,15})\.conf$ ]]
INTERFACE="${BASH_REMATCH[1]}"

process_peer() {
	[[ $PEER_SECTION -ne 1 || -z $PUBLIC_KEY || -z $ENDPOINT ]] && return 0
	[[ $(wg show "$INTERFACE" latest-handshakes) =~ ${PUBLIC_KEY//+/\\+}\	([0-9]+) ]] || return 0
	(( ($(date +%s) - ${BASH_REMATCH[1]}) > 135 )) || return 0
	wg set "$INTERFACE" peer "$PUBLIC_KEY" endpoint "$ENDPOINT"
	reset_peer_section
}

reset_peer_section() {
	PEER_SECTION=0
	PUBLIC_KEY=""
	ENDPOINT=""
}

reset_peer_section
while read -r line || [[ -n $line ]]; do
	stripped="${line%%\#*}"
	key="${stripped%%=*}"; key="${key##*([[:space:]])}"; key="${key%%*([[:space:]])}"
	value="${stripped#*=}"; value="${value##*([[:space:]])}"; value="${value%%*([[:space:]])}"
	[[ $key == "["* ]] && { process_peer; reset_peer_section; }
	[[ $key == "[Peer]" ]] && PEER_SECTION=1
	if [[ $PEER_SECTION -eq 1 ]]; then
		case "$key" in
		PublicKey) PUBLIC_KEY="$value"; continue ;;
		Endpoint) ENDPOINT="$value"; continue ;;
		esac
	fi
done < "$CONFIG_FILE"
process_peer
```



然后创建一个 Service 文件：

```bash
# /etc/systemd/system/wireguard_reresolve-dns.service
[Unit]
Description=Reresolve DNS of all WireGuard endpoints
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'for i in /etc/wireguard/*.conf; do /usr/share/wireguard-tools/contrib/reresolve-dns/reresolve-dns.sh "$i"; done'
```

再创建一个同名的 `wireguard_reresolve-dns.timer` 实现定时任务：

```bash
# /etc/systemd/system/wireguard_reresolve-dns.timer
[Unit]
Description=Periodically reresolve DNS of all WireGuard endpoints

[Timer]
OnCalendar=*:*:0/30

[Install]
WantedBy=timers.target
```

设置开机自启动：

```bash
🐳  → systemctl enable wireguard_reresolve-dns.service wireguard_reresolve-dns.timer --now
```

### 打印 debug 日志

在支持动态调试的内核上使用 Linux 内核模块时，可以将 WireGuard 的调试信息写入内核环形缓冲区中：

```bash
🐳  → modprobe wireguard 
🐳  → echo module wireguard +p > /sys/kernel/debug/dynamic_debug/control
```

然后就可以使用 journalctl 或者 dmesg 来查看调试信息了：

```bash
🐳  → journalctl -xf|grep wireguard
Jan 20 15:07:00 k8s03 kernel: wireguard: wg0: Receiving keepalive packet from peer 25 (125.122.107.150:52647)
Jan 20 15:07:00 k8s03 kernel: wireguard: wg0: Receiving handshake initiation from peer 25 (125.122.107.150:52647)
Jan 20 15:07:00 k8s03 kernel: wireguard: wg0: Sending handshake response to peer 25 (125.122.107.150:52647)
Jan 20 15:07:00 k8s03 kernel: wireguard: wg0: Keypair 83096 destroyed for peer 25
Jan 20 15:07:00 k8s03 kernel: wireguard: wg0: Keypair 83112 created for peer 25

🐳  → dmesg|tail -20|grep wireguard
[4222650.389928] wireguard: wg0: Receiving keepalive packet from peer 23 (125.122.107.150:50904)
[4222652.081319] wireguard: wg0: Receiving keepalive packet from peer 22 (125.122.107.150:58715)
[4222654.802308] wireguard: wg0: Receiving keepalive packet from peer 25 (125.122.107.150:53533)
[4222675.389578] wireguard: wg0: Receiving keepalive packet from peer 23 (125.122.107.150:50904)
```

接下来的文章将会介绍 WireGuard 的全互联模式，以及使用 WireGuard 作为 `Kubernetes` 的 CNI 插件，大家搓搓小手等着吧。