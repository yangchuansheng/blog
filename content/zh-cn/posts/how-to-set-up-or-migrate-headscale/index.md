---
keywords:
- Headscale
- Tailscale
- WireGuard
- DERP
- Netmaker
- Full Mesh
- VPN
- Headscale 部署
- Tailscale 教程
- 自建 VPN
title: "Tailscale 基础教程：Headscale 的部署方法和使用教程"
date: 2022-03-21T09:06:37+08:00
lastmod: 2023-12-29T18:01:37+08:00
description: 深入探索如何利用 Tailscale 的开源替代品 Headscale 搭建高效 VPN 网络。本指南详细介绍了 Headscale 的部署和配置步骤，助您轻松构建安全、可靠的虚拟私人网络，实现 Tailscale 的私有化部署。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- WireGuard
- Tailscale
- Headscale
- VPN教程
categories:
- Network
- VPN
series:
- Tailscale 系列教程
img: https://images.icloudnative.io/uPic/2022-03-21-11-15-sM5HES.png
meta_image: https://images.icloudnative.io/uPic/2022-09-02-22-01-WKkKHb.jpg
---

![Headscale 和 Tailscale Logo](https://images.icloudnative.io/uPic/2022-11-29-10-20-bADiKL.png "Headscale 与 Tailscale 图标")

目前国家工信部在大力推动三大运营商发展 IPv6，对家用宽带而言，可以使用的 IPv4 公网 IP 会越来越少。有部分地区即使拿到了公网 IPv4 地址，也可能是运营商大内网下的地址，并非真正的公网 IP，这使得访问家庭内网资源将会变得越来越困难。

部分小伙伴可能会选择使用 frp 等针对特定协议和端口的内网穿透方案，但这类方案在访问家庭内网任意设备的任意端口时仍有局限性。更理想的选择是通过 VPN 来组建一个统一的虚拟大内网。至于该选择哪种 VPN 技术，WireGuard 无疑是当前及未来的主流选择，它在性能和安全性上相较于传统VPN有显著优势。**对于 VPN 方案的选择，我们强烈推荐 WireGuard，其现代化的设计能带来更佳的体验。**

WireGuard 相比于传统 VPN 的核心优势在于其去中心化的特性，所有节点之间都可以点对点（P2P）连接，也就是我之前提到的[全互联模式（full mesh）](/posts/wireguard-full-mesh/#1-全互联模式架构与配置)，这种架构带来了更高的效率、更快的速度和更低的成本。

WireGuard 目前一个尚待完善的方面是上层应用生态。WireGuard 遵循 Unix 哲学，自身专注于内核级别的模块和数据平面功能。更高级的功能（如密钥交换机制、UDP 打洞、ACL 管理等）则需要通过用户空间的应用来实现。

因此，为了基于 WireGuard 实现更完美的 VPN 工具，涌现了许多优秀项目。笔者前段时间一直在推崇 [Netmaker](/posts/configure-a-mesh-network-with-netmaker/)，它通过可视化界面来配置 WireGuard 的全互联模式，支持 UDP 打洞、多租户等高级功能，几乎适配所有平台，功能非常强大。然而，现实网络环境复杂，无法保证所有 NAT 环境都能成功打洞。Netmaker 当时的一个不足是缺乏打洞失败后的 fallback 机制，即无法自动切换到中继节点。Tailscale 在这一点上考虑得更为周全，它支持 fallback 机制，可以尽最大努力实现 P2P 连接，即使部分节点打洞不成功，也能通过其 DERP 中继节点在这个虚拟网络中保持畅通。

没错，基于这些考量，我将目光从 Netmaker 转向了 Tailscale。

## Tailscale 是什么

Tailscale 是一种基于 WireGuard 的虚拟组网工具，与 Netmaker 定位相似。**一个关键区别在于 Tailscale 在用户态实现了 WireGuard 协议，而 Netmaker 直接使用了内核态的 WireGuard**。因此，Tailscale 相比内核态 WireGuard 在性能上可能会有轻微损失，但与 OpenVPN 等传统方案相比，性能依然遥遥领先。Tailscale 虽然在极致性能上做了些许取舍，但在功能和易用性上表现突出：

+   **开箱即用**
    +   通常无需复杂配置防火墙
    +   简化网络配置流程
+   **高安全性/私密性**
    +   自动密钥轮换机制
    +   默认点对点加密连接
    +   支持用户审查端到端的访问记录
+   **强大的NAT穿透能力**：在原有的 ICE、STUN 等 UDP 协议外，实现了 DERP (Detoured Encrypted Routing Protocol) TCP 协议来实现更可靠的 NAT 穿透。
+   基于公网的控制服务器下发 ACL 和配置，实现节点动态更新与权限管理。
+   通过第三方身份提供商（如 Google, Microsoft, GitHub 等）SSO 服务进行用户认证和私钥管理。

简而言之，我们可以将 Tailscale 看成是更为易用、功能更完善的 WireGuard 解决方案。

![Tailscale Admin 控制台](https://images.icloudnative.io/uPic/2022-03-20-14-50-Q4bWmK.png "Tailscale Admin 控制台")

对于个人用户而言，Tailscale 提供了慷慨的免费套餐。在接入设备不超过特定数量（通常是20台，具体请参考官网最新政策）的情况下可以免费使用，尽管免费版在子网路由自定义等方面存在一些限制。除了 Windows 和 macOS 的图形化客户端，其他 Tailscale 客户端组件（包括 Android 客户端）均在 BSD 许可下以开源项目的形式开发，您可以在他们的 [GitHub 仓库](https://github.com/tailscale/)找到各操作系统客户端的源码。

对于大部分用户来说，免费版 Tailscale 已经足够满足需求。如果您有更高的需求，比如自定义子网网段或需要更多高级功能，可以选择其付费服务。

**那么，如果不想付费，又想拥有更多控制权和无限制的设备接入呢？答案是肯定的，请继续往下看。**

## Headscale 是什么

Tailscale 的官方控制服务器是不开源的，并且对免费用户设有一些功能限制，这毕竟是其商业模式的核心。幸运的是，社区出现了一款开源的 Tailscale 控制服务器实现，名为 [Headscale](https://github.com/juanfont/headscale)。这是目前最主流的开源替代方案，并且发展迅速。

Headscale 由欧洲航天局的 Juan Font 使用 Go 语言开发，在 BSD 许可下发布。它实现了 Tailscale 控制服务器的大部分核心功能，允许用户在自己的服务器上部署，从而完全掌控自己的网络流量，并且没有任何设备数量的限制。这对于希望拥有**私有化部署 Tailscale** 方案的企业和个人来说非常有吸引力。

## Headscale 部署教程

### 使用 Sealos 一键部署 Headscale

如果您希望快速体验，可以选择使用 [Sealos 应用商店](https://sealos.run/docs/guides/app-store)进行一键部署，整个过程非常便捷，几乎无需手动配置。

直接点击下面的按钮跳转到 Sealos 的应用商店部署界面：

- SQLite 版：
  
  <figure><a href="https://template.sealos.io/deploy?templateName=headscale" target="_blank">
    <img loading="lazy" class="my-0 rounded-md nozoom" src="https://sealos.io/Deploy-on-Sealos.svg" alt="通过 Sealos 一键部署 Headscale SQLite 版的按钮">
  </a></figure>

- PostgreSQL 版：
  
  <figure><a href="https://template.sealos.io/deploy?templateName=headscale-pg" target="_blank">
    <img loading="lazy" class="my-0 rounded-md nozoom" src="https://sealos.io/Deploy-on-Sealos.svg" alt="通过 Sealos 一键部署 Headscale PostgreSQL 版的按钮">
  </a></figure>

然后点击「去 Sealos 部署」，注册登录 Sealos 账号后，点击「部署应用」。部署完成后，点击 Headscale 应用的「详情」进入详情页面。

![Sealos 应用商店 Headscale 应用界面](https://images.icloudnative.io/uPic/2025-05-26-12-56-N4AiPM.png)

内网端口 8080 对应的外网地址就是您的 Headscale 服务的公网域名。

![Sealos 中 Headscale 应用详情页，高亮显示外网地址](https://images.icloudnative.io/uPic/2025-05-26-12-58-ByVrUN.png "Sealos 中 Headscale 应用详情页，高亮显示外网地址")

点击该公网地址即可打开 Headscale 可视化管理界面。

![Headscale 可视化管理界面登录页](https://images.icloudnative.io/uPic/2025-05-26-13-00-DTBvOB.png "Headscale 可视化管理界面登录页")

### 在 Linux 上部署 Headscale

Headscale 的部署过程相对简单，推荐直接在 Linux 主机上安装。

> 理论上，只要您的 Headscale 服务可以暴露到公网即可。但为了获得最佳的 NAT 穿透效果，建议将 Headscale 部署在具有公网 IP 的云主机上，避免额外的 NAT 层级。

首先，需要到 Headscale 的 GitHub 仓库的 Release 页面下载最新版的二进制文件。

```bash
# 请将 <HEADSCALE_VERSION> 和 <ARCH> 替换为实际的版本号和架构
$ wget --output-document=/usr/local/bin/headscale \
   https://github.com/juanfont/headscale/releases/download/v<HEADSCALE_VERSION>/headscale_<HEADSCALE_VERSION>_linux_<ARCH>

$ chmod +x /usr/local/bin/headscale
```

创建配置目录：

```bash
$ mkdir -p /etc/headscale
```

创建用于存储数据与证书的目录：

```bash
$ mkdir -p /var/lib/headscale
```

创建空的 SQLite 数据库文件：

```bash
$ touch /var/lib/headscale/db.sqlite
```

下载 Headscale 配置文件示例：

```bash
$ wget https://github.com/juanfont/headscale/raw/main/config-example.yaml -O /etc/headscale/config.yaml
```

接下来，修改配置文件 `/etc/headscale/config.yaml`：
*   将 `server_url` 修改为您的公网 IP 或域名。**注意：如果是在中国大陆的服务器上使用域名，该域名必须已备案**。如果域名未备案或不使用域名，可以直接使用公网 IP。
*   如果暂时用不到 DNS 功能（MagicDNS），可以将 `magic_dns` 设为 `false`。
*   `server_url` 示例：`http://<YOUR_PUBLIC_IP_OR_DOMAIN>:8080` （若使用 HTTPS，则为 `https://<YOUR_PUBLIC_IP_OR_DOMAIN>`，并确保正确配置了 TLS 证书）。
*   建议开启随机客户端端口，将 `randomize_client_port` 设为 `true`。
*   可自定义私有网段，也可同时开启 IPv4 和 IPv6：
    ```yaml
    ip_prefixes:
      # - fd7a:115c:a1e0::/48  # 示例 IPv6 前缀
      - 100.64.0.0/10        # Tailscale/Headscale 默认使用的 CGNAT 地址空间一部分
    ```

创建 SystemD service 配置文件：

```bash
# /etc/systemd/system/headscale.service
[Unit]
Description=Headscale Controller - A self-hosted Tailscale coordination server
After=syslog.target
After=network.target

[Service]
Type=simple
User=headscale
Group=headscale
ExecStart=/usr/local/bin/headscale serve
Restart=always
RestartSec=5

# Optional security enhancements
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/headscale /var/run/headscale
AmbientCapabilities=CAP_NET_BIND_SERVICE # Needed if not running as root and binding to privileged ports
RuntimeDirectory=headscale

[Install]
WantedBy=multi-user.target
```

创建 `headscale` 用户：

```bash
$ useradd headscale -d /home/headscale -m
```

修改 `/var/lib/headscale` 目录的属主：

```bash
$ chown -R headscale:headscale /var/lib/headscale
```

修改配置文件 `/etc/headscale/config.yaml` 中的 `unix_socket` 路径：

```yaml
unix_socket: /var/run/headscale/headscale.sock
```

Reload SystemD 以加载新的配置文件：

```bash
$ systemctl daemon-reload
```

启动 Headscale 服务并设置开机自启：

```bash
$ systemctl enable --now headscale
```

查看运行状态：

```bash
$ systemctl status headscale
```

查看 Headscale 占用的端口（默认为 8080 HTTP, 9090 gRPC, 50443 Prometheus metrics，具体取决于您的配置）：

```bash
$ ss -tulnp | grep headscale
# 预期输出可能类似:
# tcp LISTEN 0 1024 *:8080 *:* users:(("headscale",pid=...,fd=...))
# tcp LISTEN 0 1024 *:9090 *:* users:(("headscale",pid=...,fd=...))
```

## 创建用户 (Namespace)

在 Tailscale 中有一个概念叫 "tailnet"，可以理解为一个独立的网络租户，不同 tailnet 之间相互隔离。具体可参考 Tailscale 的官方文档：[What is a tailnet?](https://tailscale.com/kb/1136/tailnet/)。Headscale 中对应的概念是 "user"。我们需要先创建一个 user，以便后续客户端设备接入。

### 命令行创建用户

例如，创建一个名为 `default` 的 user：

```bash
$ headscale users create default 
# 成功后会提示 User created
```

查看已创建的 user列表：

```bash
$ headscale users list
ID | Name | Username | Email | Created            
1  |      | default  |       | 2025-05-26 05:03:48
```

如果您是通过 [Sealos](https://sealos.run) 一键部署的 Headscale，可以在 Headscale 应用的详情页面点击右侧的「终端」按钮进入 Headscale 容器的终端：

![Sealos 容器终端界面，用于执行 Headscale 命令](https://images.icloudnative.io/uPic/2025-05-26-13-06-qckpcY.png "Sealos 容器终端界面，用于执行 Headscale 命令")

然后在终端中执行上述命令创建 user。

### 可视化界面创建用户

[Headplane](https://github.com/tale/headplane) (Headscale 可视化管理界面) 需要通过 API Key 来接入 Headscale 服务。因此，在使用之前我们需要先为 Headplane 创建一个 API key。

在 Headscale 容器的终端中执行以下命令创建 API Key：

```bash
$ headscale apikeys create
# 复制生成的 API Key
```

将上一步生成的 API Key 填入 Headplane 的设置页面，接入成功后，点击顶部的「Users」，然后点击「Add a new user」开始创建用户：

![Headplane 创建用户界面](https://images.icloudnative.io/uPic/2025-05-26-13-10-NXTTgh.png "Headplane 创建用户界面")

## Tailscale 客户端接入 Headscale 设置

目前，除了 iOS 客户端的早期版本配置略有不同外，其他主流平台的 Tailscale 客户端都有办法自定义控制服务器地址以接入自建的 Headscale。

| OS      | 是否支持 Headscale                                           | 备注                                                                 |
| :------ | :----------------------------------------------------------- | :------------------------------------------------------------------- |
| Linux   | Yes                                                          | CLI 和图形界面均支持                                                     |
| OpenBSD | Yes                                                          | CLI                                                                  |
| FreeBSD | Yes                                                          | CLI                                                                  |
| macOS   | Yes                                                          | 图形界面和 CLI 均支持，参考 [macOS 客户端 Headscale 文档](https://github.com/juanfont/headscale/blob/main/docs/usage/connect/apple.md#macos)                                                  |
| Windows | Yes                                                          | 图形界面，参考 [Windows 客户端 Headscale 文档](https://github.com/juanfont/headscale/blob/main/docs/usage/connect/windows.md) |
| Android | Yes                                                          | 图形界面，特定操作后可修改服务器                                           |
| iOS     | Yes                                                          | 图形界面，通过系统设置修改，参考 [iOS 客户端 Headscale 文档](https://github.com/juanfont/headscale/blob/main/docs/usage/connect/apple.md#ios)                                               |

我们先来看下 Linux 平台的接入方法。

### Linux 客户端接入

Tailscale 官方为各种 Linux 发行版提供了软件包，但有时国内网络访问官方软件源可能较慢。幸运的是，官方还提供了[静态编译的二进制文件](https://tailscale.com/download/linux/static)，我们可以直接下载使用。

例如，下载 Tailscale 的静态编译版本：

```bash
# 注意替换为最新的稳定版本号和对应架构
$ wget https://pkgs.tailscale.com/stable/tailscale_1.XX.Y_amd64.tgz
```

解压：

```bash
$ tar zxvf tailscale_1.XX.Y_amd64.tgz
# 会解压出 tailscale_1.XX.Y_amd64/ 目录，内含 tailscale 和 tailscaled 等文件
```

将二进制文件复制到系统路径下：

```bash
$ sudo cp tailscale_1.XX.Y_amd64/tailscaled /usr/sbin/tailscaled
$ sudo cp tailscale_1.XX.Y_amd64/tailscale /usr/bin/tailscale
```

如果需要 systemd 服务，可以将解压出来的 systemd 配置文件复制到系统路径下：

```bash
$ sudo cp tailscale_1.XX.Y_amd64/systemd/tailscaled.service /lib/systemd/system/tailscaled.service
$ sudo cp tailscale_1.XX.Y_amd64/systemd/tailscaled.defaults /etc/default/tailscaled # 环境变量配置文件
```

启动 `tailscaled.service` 并设置开机自启：

```bash
$ sudo systemctl enable --now tailscaled
```

查看服务状态：

```bash
$ sudo systemctl status tailscaled
```

Tailscale 客户端连接到您的 Headscale 服务器：

```bash
# 如果您是在自己的服务器上部署的 Headscale，请将 <HEADSCALE_PUB_ENDPOINT> 替换为您的 Headscale 公网 IP 或域名，并注意协议 (http/https) 和端口
$ sudo tailscale up --login-server=http://<HEADSCALE_PUB_ENDPOINT>:8080 --accept-routes=true --accept-dns=false

# 如果您是使用 Sealos 一键部署的，通常 Sealos 会配置好 HTTPS，请将 <HEADSCALE_PUB_ENDPOINT> 换成上文提到的 Sealos 中的 Headscale 公网域名
$ sudo tailscale up --login-server=https://<SEALOS_HEADSCALE_DOMAIN> --accept-routes=true --accept-dns=false
```

您也可以在 Headplane 的 "Machines" 界面获取针对不同客户端的接入命令：

![Headplane Machines 界面获取 Tailscale 客户端接入命令](https://images.icloudnative.io/uPic/2025-05-26-18-27-CcSwYj.png "Headplane Machines 界面获取 Tailscale 客户端接入命令")

这里推荐将 `--accept-dns=false` 选项加上，以避免 Headscale 的 MagicDNS 设置覆盖系统默认 DNS，除非您确实需要并已正确配置了 Headscale 的 DNS 功能。

执行完上面的 `tailscale up` 命令后，终端会显示一个注册链接：

```bash
To authenticate, visit:

	https://headscale-rewcdzwp.sealoshzh.site/register/xxxxxxxxxxxxxxxxxxxxxxxxxx
```

![浏览器中打开 Headscale 注册链接，提示需要在服务端执行的命令](https://images.icloudnative.io/uPic/2025-05-26-13-31-83GSjk.png "浏览器中打开 Headscale 注册链接，提示需要在服务端执行的命令")

在浏览器中打开该链接，页面会提示您需要在 Headscale 服务器上执行一条命令来注册此节点。将 `--key` 的值复制下来，在 Headplane 中点击顶部的「Machines」，然后点击「Add Device」，将复制的 key 值粘贴到 `Machine Key` 中，选择一个 Owner，然后点击 "Confirm" 即可注册成功。

![](https://images.icloudnative.io/uPic/2025-05-26-13-30-NdgUF8.png)

注册成功后，可以看到该节点的详细信息：

![](https://images.icloudnative.io/uPic/2025-05-26-13-33-WFP5Zh.png)

回到 Tailscale 客户端所在的 Linux 主机，Tailscale 会自动创建相关的网络接口 (如 `tailscale0`)、路由表和 iptables 规则。路由表可通过以下命令查看：

```bash
$ ip route show table 52
```

查看 iptables 规则（如果您使用了iptables防火墙）：

```bash
$ sudo iptables -S | grep tailscale
$ sudo iptables -S -t nat | grep tailscale
```

### macOS 客户端接入

macOS 客户端有以下几种安装方式：

1.  **App Store 安装**: 直接通过 macOS App Store 安装 Tailscale。地址：[https://apps.apple.com/app/tailscale/id1475387142](https://apps.apple.com/app/tailscale/id1475387142)。需要一个美区 Apple ID。
2.  **独立安装包 (Standalone)**: 从 Tailscale 官网下载 `.pkg` 或 `.zip` 安装包直接安装，绕过 App Store。
3.  **命令行工具 (CLI)**: 安装开源的 `tailscale` 和 `tailscaled` 命令行工具。相关链接：[Tailscaled on macOS](https://github.com/tailscale/tailscale/wiki/Tailscaled-on-macOS)。

这三种安装方式的核心数据包处理代码是相同的，主要区别在于打包方式、与系统的交互方式以及部分 GUI 特有功能。

| 特性             | App Store (网络扩展)                                        | 独立应用 (系统扩展)                                         | 命令行版本 (utun)                                             |
| :--------------- | :---------------------------------------------------------- | :----------------------------------------------------------- | :------------------------------------------------------------ |
| **是否可用**     | [Yes](https://apps.apple.com/app/tailscale/id1475387142)    | Yes, [beta/stable](https://tailscale.com/kb/1167/release-stages/) | [Yes](https://github.com/tailscale/tailscale/wiki/Tailscaled-on-macOS) |
| **图形界面**     | Yes                                                         | Yes                                                          | No; CLI only                                                  |
| **macOS 最低版本** | macOS 10.13+ (具体见App Store)                             | macOS 10.15+ (具体见官网)                                   | macOS 10.13+ (具体见文档)                                    |
| **后台运行**     | No (受沙盒限制)                                              | 理论支持 (已实现)                                            | Yes                                                           |
| **密钥存储**     | 用户级 Keychain                                               | 系统级 Keychain                                                | 文件系统                                                      |
| **沙盒隔离**     | Yes                                                         | No                                                           | No                                                            |
| **自动更新**     | Yes (通过 App Store)                                        | Yes (通过 Sparkle)                                           | No (需手动更新)                                               |
| **开源**         | No (UI部分)                                                 | No (UI部分)                                                  | Yes (核心及CLI)                                               |
| **MagicDNS**     | Yes                                                         | Yes                                                          | Yes                                                           |
| **Taildrop**     | Yes                                                         | Yes                                                          | 未实现                                                        |

{{< alert >}}
**重要提示:** 不要同时安装 App Store 版本和独立分发版本，选择其中一种即可。
{{< /alert >}}

安装完 GUI 版应用 (App Store 或 Standalone) 后，需要进行特定操作才能让 Tailscale 使用您的 Headscale 作为控制服务器。Headscale 官方通常会提供指引，您可以在浏览器中打开类似 `https://<HEADSCALE_PUB_ENDPOINT>/apple` 的URL，查看针对您 Headscale 版本的具体步骤。

对于较新版本的 Tailscale (如 1.34.0 及以上)，可以按照下面的方法操作：

1.  按住「Option/ALT」键，然后点击 macOS 顶部菜单栏的 Tailscale 图标。
2.  将鼠标指针悬停在「Debug」菜单上。

    ![macOS 顶部菜单栏 Tailscale Debug 菜单项](https://images.icloudnative.io/uPic/2023-12-29-17-04-fPLtsa.png "macOS 顶部菜单栏 Tailscale Debug 菜单项")

3.  在「Debug」的子菜单中，找到「Custom Login Server」（或类似描述），选择「Add Account...」或「Change server...」。
4.  在打开的弹窗中填入您的 Headscale 公网域名 (例如 `https://<YOUR_HEADSCALE_DOMAIN>`，**确保包含 `http://` 或 `https://` 前缀**)，然后点击「Add Account」或「Save」。

    ![macOS Tailscale 添加自定义登录服务器弹窗](https://images.icloudnative.io/uPic/2023-12-29-17-13-0LVi0S.png "macOS Tailscale 添加自定义登录服务器弹窗")

5.  操作完成后，Tailscale 应用会尝试连接到您的 Headscale 服务器，并通常会自动在浏览器中打开一个注册页面。

6.  接下来的步骤与 Linux 客户端类似：将 `--key` 的值复制下来，在 Headplane 中点击顶部的「Machines」，然后点击「Add Device」，将复制的 key 值粘贴到 `Machine Key` 中，选择一个 Owner，然后点击 "Confirm" 即可注册成功。

    ![Headscale 服务端成功注册 macOS 节点后的提示信息](https://images.icloudnative.io/uPic/2025-05-26-14-15-RlBbWM.png "Headscale 服务端成功注册 macOS 节点后的提示信息")

回到 macOS，测试是否能 ping 通其他 Tailscale 网络中的节点：

```bash
$ ping -c 2 100.64.0.1 # Ping Linux 客户端的 Tailscale IP
# PING 100.64.0.1 (100.64.0.1): 56 data bytes
# 64 bytes from 100.64.0.1: icmp_seq=0 ttl=64 time=37.025 ms
# ...
```

也可以使用 Tailscale CLI (如果安装了) 来测试：

```bash
$ /Applications/Tailscale.app/Contents/MacOS/Tailscale ping 100.64.0.1
# pong from my-linux-client (100.64.0.1) via ... in Xms
```

对于版本号低于 1.32.0 的 Tailscale 客户端，配置方法可能略有不同，请参照 Headscale 官方文档或 `/apple` 页面提供的具体指引。

### Android 客户端接入

Android 版 Tailscale 客户端从 1.30.0 版本开始支持自定义控制服务器 (Coordination Server)。您可以从 [Google Play](https://play.google.com/store/apps/details?id=com.tailscale.ipn) 或者 [F-Droid](https://f-droid.org/packages/com.tailscale.ipn/) 下载最新版本的客户端。

安装完成后打开 Tailscale App，会看到登录界面：

![Android Tailscale 应用初始登录界面](https://images.icloudnative.io/uPic/2022-11-22-18-12-m2IYpv.jpeg "Android Tailscale 应用初始登录界面")

点开右上角的“三个点”菜单，初始状态下你可能只看到 `About` 选项：

![Android Tailscale 应用右上角菜单，初始只显示 About 选项](https://images.icloudnative.io/uPic/2022-11-22-18-14-ghdl4A.jpeg "Android Tailscale 应用右上角菜单，初始只显示 About 选项")

接下来是一个“隐藏技巧”：反复快速地**点开再关闭**右上角的“三个点”菜单（大约连续操作5-7次，具体次数可能因版本而异）。成功后，菜单中会出现一个 `Change server` 选项：

![Android Tailscale 应用多次点击菜单后出现 Change server 选项](https://images.icloudnative.io/uPic/2022-11-22-18-23-mcAexh.jpeg "Android Tailscale 应用多次点击菜单后出现 Change server 选项")

点击 `Change server`，将您的 Headscale 控制服务器的地址 (例如 `https://<YOUR_HEADSCALE_DOMAIN>`，**务必包含 `http://` 或 `https://`** ) 填进去：

![Android Tailscale 应用更改服务器地址为 Headscale URL](https://images.icloudnative.io/uPic/2022-11-22-18-37-fkRIxW.jpeg "Android Tailscale 应用更改服务器地址为 Headscale URL")

然后点击 `Save and restart`。应用重启后，点击 `Sign in with other` (或类似按钮)，会跳转到浏览器并打开 Headscale 的注册页面：

![Android Tailscale 应用使用 Headscale 登录认证页面](https://images.icloudnative.io/uPic/2024-01-07-19-39-fKOCTT.jpg "Android Tailscale 应用使用 Headscale 登录认证页面")

将其中的 `headscale nodes register ...` 命令粘贴到 Headscale 服务器的终端中执行，并将 `USERNAME` 替换为之前创建的 user。注册成功后可关闭浏览器页面，回到 Tailscale App 主页，应显示已连接状态：

![Android Tailscale 应用成功连接 Headscale 后的主界面](https://images.icloudnative.io/uPic/2024-01-07-20-21-2e8CKX.jpg "Android Tailscale 应用成功连接 Headscale 后的主界面")

### Windows 客户端接入

Windows Tailscale 客户端想要使用 Headscale 作为控制服务器，最简单的方法是访问 Headscale 服务器提供的指引页面。在浏览器中打开 URL：`https://<HEADSCALE_PUB_ENDPOINT>/windows` (将 `<HEADSCALE_PUB_ENDPOINT>` 替换为您的 Headscale 公网地址)，通常会看到如下界面，其中包含了修改注册表或使用命令行参数的步骤：

![Headscale 提供的 Windows 客户端配置自定义服务器指引页面](https://images.icloudnative.io/uPic/2023-12-29-17-19-vSqFK9.png "Headscale 提供的 Windows 客户端配置自定义服务器指引页面")

请仔细按照页面上的步骤操作。通常涉及修改注册表项以指定 `ControlURL` 或在安装/启动时使用特定参数。修改后，启动 Tailscale 客户端，它会引导您通过浏览器到 Headscale 进行认证，流程与 Linux/macOS 类似。

### 其他 Linux 发行版 (如 OpenWrt, NAS 系统)

除了常规的 Linux 发行版之外，还有一些特殊场景的 Linux 系统，如 OpenWrt、威联通 (QNAP)、群晖 (Synology) 等。这些平台的 Tailscale 安装和 Headscale 对接方法，社区已经有很多成熟的方案和脚本：

*   **OpenWrt:** [adyanth/openwrt-tailscale-enabler](https://github.com/adyanth/openwrt-tailscale-enabler)
*   **群晖 (Synology):** [tailscale/tailscale-synology](https://github.com/tailscale/tailscale-synology) (官方支持) 或社区方案。
*   **威联通 (QNAP):** [tailscale/tailscale-qpkg](https://github.com/tailscale/tailscale-qpkg) (官方支持) 或社区方案。

请参考对应仓库的文档进行安装和配置，使其连接到您的 Headscale 服务器。

### iOS 客户端接入

iOS 系统需要从 App Store 安装 Tailscale 客户端。通常需要一个美区或其他支持区域的 Apple ID。

1. 从 App Store 安装官方 Tailscale iOS 客户端。
2. 打开 Tailscale 应用。
3. 点击右上角的账户图标，选择「Log in…」。
   
   ![](https://images.icloudnative.io/uPic/2025-05-26-15-22-rkTD7z.png)

4. 点击右上角的选项菜单按钮，选择「Use custom coordination server」。
   
   ![](https://images.icloudnative.io/uPic/2025-05-26-15-24-6pQeUX.png)

5. 输入您的 Headscale 实例 URL，然后选择「Log in」(或类似按钮)，此时应该会弹出一个指向您 Headscale 服务器的身份认证页面。
6. 接下来的步骤与 Linux 客户端类似：将 `--key` 的值复制下来，在 Headplane 中点击顶部的「Machines」，然后点击「Add Device」，将复制的 key 值粘贴到 `Machine Key` 中，选择一个 Owner，然后点击 "Confirm" 即可注册成功。注册成功后，iOS 上的 Tailscale 应用会显示已连接和分配的 IP 地址。
   
   ![](https://images.icloudnative.io/uPic/2025-05-26-15-30-GRkcPG.png)

### 通过 Pre-Authkeys (预授权密钥) 接入

Headscale 提供了 Pre-Authkeys 功能，可以生成一个预授权密钥，允许新节点使用此密钥自动注册加入指定的 user，无需服务端再次确认。

首先，在 Headscale 服务端为特定的 user 生成一个 pre-authkey。您可以设置其有效期。

```bash
# 创建一个属于 default 用户，有效期为 24 小时的预授权密钥
$ headscale preauthkeys create --user default --expiration 24h
# Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

查看已生成的 key：

```bash
$ headscale preauthkeys list --user default
# ID | Key                                              | Reusable | Ephemeral | Used  | Expiration          | Created
# ---|--------------------------------------------------|----------|-----------|-------|---------------------|--------------------
# 1  | xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx | false    | false     | false | 2024-05-27T08:00:00Z| 2024-05-26T08:00:00Z
```

您也可以在 Headplane 可视化界面中生成 PreAuth Key。

![](https://images.icloudnative.io/uPic/2025-05-26-15-33-PLkUmf.png)

这里可以设置一个过期时间。如果希望这个 Key 可以被多个设备重复使用，请勾选 `Reusable`。最后点击 "Confirm" 保存。

![](https://images.icloudnative.io/uPic/2025-05-26-15-34-9l5p0S.png)

查看已生成的 key：

![](https://images.icloudnative.io/uPic/2025-05-26-15-35-tcCORl.png)

现在，新节点可以使用 `--authkey` 参数直接加入，无需服务端手动同意：

```bash
# 将 $KEY 替换为您生成的 PreAuth Key
# 将 <HEADSCALE_PUB_ENDPOINT> 替换为您的 Headscale 服务器地址
$ sudo tailscale up --login-server=http://<HEADSCALE_PUB_ENDPOINT>:8080 --accept-routes=true --accept-dns=false --authkey $KEY
```

设备会自动注册到生成该 PreAuth Key 时指定的 user 下。

## 打通局域网 (Subnet Routing)

到目前为止，我们已经构建了一个点对点的 Mesh 网络，各个 Tailscale 节点之间可以通过其 Tailscale 私有网络 IP (通常是 `100.x.x.x` 段) 进行直连。但我们可以实现更强大的功能：让 Tailscale 网络中的任何一个节点都能访问到某个节点所在地的整个局域网。这个使用场景非常广泛，例如：

*   在外部访问家庭内网的 NAS、打印机或其他智能设备。
*   远程访问公司内网的开发服务器或内部服务。
*   **更高级的用法：使用此方法从任何地方访问云上 Kubernetes 集群的 Pod IP 和 Service IP (将 K8s 节点作为路由节点)。**

假设您的家庭内网有一台 Linux 主机 (比如一台 OpenWrt 路由器或树莓派) 已经安装并运行了 Tailscale 客户端。我们希望其他连接到您 Headscale 的 Tailscale 客户端，能够直接通过家中的局域网 IP (例如 `192.168.100.0/24`) 访问家庭内网中的任何一台设备。

配置方法如下：

1.  **在作为路由的节点上开启 IP 转发：**
    在这台 Linux 主机 (例如 OpenWrt) 上，需要开启内核的 IP 转发功能。

    ```bash
    $ echo 'net.ipv4.ip_forward = 1' | sudo tee /etc/sysctl.d/ipforwarding.conf
    $ echo 'net.ipv6.conf.all.forwarding = 1' | sudo tee -a /etc/sysctl.d/ipforwarding.conf # 如果需要 IPv6 路由
    $ sudo sysctl -p /etc/sysctl.d/ipforwarding.conf
    ```

2.  **在作为路由的节点上宣告 (Advertise) 局域网路由：**
    修改该 Linux 主机上 Tailscale 客户端的启动命令，在原来的基础上加上 `--advertise-routes=192.168.100.0/24` 参数，告知 Headscale 服务器“我这个节点可以作为访问 `192.168.100.0/24` 网段的路由出口”。如果之前已运行，可以加上 `--reset` 参数重新配置。

    ```bash
    # 将 <HEADSCALE_PUB_ENDPOINT> 替换为您的 Headscale 服务器地址
    $ sudo tailscale up --login-server=http://<HEADSCALE_PUB_ENDPOINT>:8080 --accept-routes=true --accept-dns=false --advertise-routes=192.168.100.0/24 --reset
    ```
    如果您有多个局域网段需要宣告，可以用逗号分隔，例如 `--advertise-routes=192.168.100.0/24,10.0.0.0/8`。

3.  **在 Headscale 服务端启用宣告的路由：**
    
    在 Headplane 中查看刚才宣告的路由。首先进入宣告路由的客户端详情页面，然后依次点击「Machine Settings」-->「Edit route settings」。

    ![](https://images.icloudnative.io/uPic/2025-05-26-15-49-b51DzH.png)

    然后启用该路由即可。

    ![](https://images.icloudnative.io/uPic/2025-05-26-15-50-SAPxRd.png)

    如果使用 Headscale 命令行操作，可以先找到路由节点的 ID 或名称。

    ```bash
    $ headscale nodes list | grep openwrt # 假设路由节点主机名为 openwrt
    # ID | Hostname | ...
    # 6  | openwrt  | ...

    $ headscale routes list --node-id 6 # 或者 headscale routes list -i 6 (早期版本)
    # Route            | Enabled | Node
    #------------------|---------|-------
    # 192.168.100.0/24 | false   | openwrt
    ```
    可以看到相关路由是关闭的 (`Enabled: false`)。现在启用它：

    ```bash
    $ headscale routes enable --node-id 6 --route "192.168.100.0/24" # 或者 headscale routes enable -i 6 -r "192.168.100.0/24"
    # Route enabled
    ```
    再次查看，应显示 `Enabled: true`。

    如果有多条路由需要启用，可以重复执行命令。
    也可以使用 `-a` (all) 参数一次性启用该节点宣告的所有路由：
    ```bash
    $ headscale routes enable --node-id 6 -a
    ```

4.  **在其他客户端节点上接受路由：**
   
    确保其他希望访问该局域网的 Tailscale 客户端在启动时也包含了 `--accept-routes=true` 选项。如果它们之前未使用此选项启动，也需要使用 `--reset` 重新配置：

    ```bash
    $ sudo tailscale up --login-server=http://<HEADSCALE_PUB_ENDPOINT>:8080 --accept-routes=true --accept-dns=false --reset
    ```

    配置完成后，在这些客户端上查看路由表，应该能看到指向 `192.168.100.0/24` 的路由是通过 `tailscale0` 接口经由 OpenWrt 节点的 Tailscale IP 转发的。

    ```bash
    $ ip route show table 52 | grep "192.168.100.0/24"
    # 192.168.100.0/24 dev tailscale0 scope link # 具体下一跳可能不同
    ```

现在，您在任何一个接受了路由的 Tailscale 客户端节点上，都可以直接 ping 通或访问您家庭内网 `192.168.100.0/24` 网段中的任何设备了。无论您身在公司还是咖啡馆，都可以像在家里一样使用相同的局域网 IP 访问家中的资源，非常便捷和强大。

## 总结

目前从稳定性和 NAT 穿透的成熟度来看，Tailscale (以及其开源实现 Headscale) 相较于一些早期或配置更复杂的方案，表现得相当出色。这很大程度上得益于 Tailscale 团队在用户态对 NAT 穿透技术所做的深度优化和工程实践。他们还专门撰写了一篇非常精彩的文章详细介绍 [NAT 穿透的工作原理 (How NAT traversal works)](https://tailscale.com/blog/how-nat-traversal-works/)，国内的 eBPF 技术专家赵亚楠也翻译了[中文版](https://arthurchiao.art/blog/how-nat-traversal-works-zh/)，强烈推荐大家阅读，深入理解其背后的技术细节。

放一张图给大家感受一下：

![](https://images.icloudnative.io/uPic/2022-03-21-10-52-TzXGEZ.png)

希望这篇详尽的 **Tailscale 及 Headscale 使用教程**能帮助您成功搭建自己的私有、安全、便捷的虚拟私人网络。

下一篇文章将会给大家介绍[如何让 Tailscale 使用自定义的 DERP Servers (中继服务器)](/posts/custom-derp-servers/)，进一步提升网络连接质量和自主可控性。敬请期待！
