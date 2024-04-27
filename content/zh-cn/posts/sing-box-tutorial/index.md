---
keywords:
- sing-box
- 翻墙
- Shadowsocks
- clash
- v2ray
- trojan
- vmess
- 透明网关
- 智能分流
pinned: true
title: "sing-box 基础教程：sing-box 的配置方法和使用教程"
date: 2024-01-14T14:06:37+08:00
lastmod: 2024-01-14T14:06:37+08:00
description: 全面解析 sing-box：超越 *ray core 和 clash 的下一代通用代理工具。了解其支持的丰富协议，免费客户端，以及如何轻松设置全局透明代理。适用于 Android、iOS、macOS，Linux，及更多平台。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- sing-box
categories: 
- GFW
---

## sing-box 是什么

[sing-box](https://github.com/SagerNet/sing-box) 是新一代超强通用代理工具，对标 *ray core 与 clash，而且它的性能以及支持的协议类型已经超过了 *ray core 与 clash。目前支持以下协议：

入站：

- Shadowsocks(including shadowsocks2022)
- Vmess
- Trojan
- Naive
- Hysteria
- ShadowTLS
- Vless
- Tuic
- Tun
- Redirect
- TProxy
- Socks
- HTTP

出站：

- Shadowsocks(including shadowsocks2022)
- Vmess
- Trojan
- Wireguard
- Hysteria
- ShadowTLS
- ShadowsocksR
- VLESS
- Tuic
- Hysteria2
- Tor
- SSH
- DNS

除了命令行客户端以外，还提供了图形界面客户端，图形界面支持 Android、iOS、macOS 以及 Apple tvOS，Windows 暂时不支持，还在施工中 🚧

![](https://images.icloudnative.io/uPic/2023-12-30-17-31-gSoqhd.jpg)

这简直就是魔法上网界的瑞士军刀啊！而且**所有的客户端都是免费的**，iOS 端也不用再买 Shadowrocket 小火箭等付费 App 了。再看看隔壁 Surge 的价格：

![](https://images.icloudnative.io/uPic/2023-12-30-17-37-yTvKLW.jpg)

你玩我呢？？

还是 sing-box 香。本文将会手把手教大家如何使用 sing-box 来实现任意机器的全局透明代理。

## sing-box 客户端下载

第一步先解决客户端下载的问题。

### Android

Android 客户端可以到 [Play Store](https://play.google.com/store/apps/details?id=io.nekohasekai.sfa) 中去下载：

![](https://images.icloudnative.io/uPic/2023-12-30-17-54-a8vZ24.webp)

也可以直接到 [GitHub Releases](https://github.com/SagerNet/sing-box/releases) 页面下载。

如果你是 Android 的 Magisk/KernelSU 玩家，可以选择刷入 [box_for_magisk 模块](https://github.com/taamarin/box_for_magisk)。

### Apple 平台

iOS/macOS/Apple tvOS 用户可以到 [App Store](https://apps.apple.com/us/app/sing-box/id6451272673) 中下载（前提是你得有个美区 ID），也可以使用 Homebrew 直接安装：

```bash
$ brew install sfm
```

除此之外你也可以直接到 [GitHub Releases](https://github.com/SagerNet/sing-box/releases) 页面下载客户端或者命令行版本。

### Windows

Windows 没有图形界面客户端，官方还正在开发中，不过可以直接使用包管理器 Sccop 或者 Chocolatey 安装命令行版本：

```bash
# Sccop
$ scoop install sing-box

# Chocolatey
$ choco install sing-box
```

你也可以选择第三方开发者开发的图形界面客户端：[GUI.for.SingBox](https://github.com/GUI-for-Cores/GUI.for.SingBox)

![](https://images.icloudnative.io/uPic/2024-01-19-17-28-IrwTam.png)

还有一个更加成熟的第三方客户端：[Hiddify-Next](https://github.com/hiddify/hiddify-next)

### Linux

Linux 就很简单了，直接到 [GitHub Releases](https://github.com/SagerNet/sing-box/releases) 页面下载命令行版本即可。

## sing-box 配置解析

sing-box 的核心就是它的配置，所有的配置都在一个 JSON 文件里，每个配置参数的含义可参考 [sing-box 官方文档](https://sing-box.sagernet.org/)。

但是为了能够快速使用起来，我们需要一个示例模板。没问题，我这就给你一个比较完美的透明代理模板：

{{< details title="sing-box 透明代理示例模板" closed="true" >}}
```json
{
  "dns": {
    "servers": [
      {
        "tag": "dns_proxy",
        "address": "https://1.1.1.1/dns-query",
        "address_resolver": "dns_resolver",
        "strategy": "ipv4_only",
        "detour": "select"
      },
      {
        "tag": "dns_direct",
        "address": "h3://dns.alidns.com/dns-query",
        "address_resolver": "dns_resolver",
        "strategy": "ipv4_only",
        "detour": "direct"
      },
      {
        "tag": "dns_block",
        "address": "rcode://refused"
      },
      {
        "tag": "dns_resolver",
        "address": "223.5.5.5",
        "strategy": "ipv4_only",
        "detour": "direct"
      }
    ],
    "rules": [
      {
        "outbound": "any",
        "server": "dns_resolver"
      },
      {
        "clash_mode": "direct",
        "server": "dns_direct"
      },
      {
        "clash_mode": "global",
        "server": "dns_proxy"
      },
      {
        "process_name": [
          "TencentMeeting",
          "NemoDesktop",
          "ToDesk",
          "ToDesk_Service",
          "WeChat",
          "Tailscale",
          "wireguard-go",
          "Tunnelblick",
          "softwareupdated",
          "kubectl"
        ],
        "server": "dns_direct"
      },
      {
        "domain_suffix": [
          "icloudnative.io",
          "fuckcloudnative.io",
          "sealos.io",
          "cdn.jsdelivr.net"
        ],
        "server": "dns_direct"
      },
      {
        "process_name": [
          "DropboxMacUpdate",
          "Dropbox"
        ],
        "server": "dns_proxy"
      },
      {
        "package_name": [
          "com.google.android.youtube",
          "com.android.vending",
          "org.telegram.messenger",
          "org.telegram.plus"
        ],
        "server": "dns_proxy"
      },
      {
        "rule_set": "geosite-geolocation-!cn",
        "server": "dns_proxy"
      },
      {
        "rule_set": "Global",
        "server": "dns_proxy"
      },
      {
        "rule_set": [
          "YouTube",
          "Telegram",
          "Netflix",
          "geoip-google",
          "geoip-telegram",
          "geoip-twitter",
          "geoip-netflix"
        ],
        "server": "dns_proxy"
      }
    ],
    "final": "dns_direct"
  },
  "ntp": {
    "enabled": true,
    "server": "time.apple.com",
    "server_port": 123,
    "interval": "30m0s",
    "detour": "direct"
  },
  "inbounds": [
    {
      "type": "tun",
      "inet4_address": "198.18.0.1/16",
      "auto_route": true,
      "exclude_package": [
        "cmb.pb",
        "cn.gov.pbc.dcep",
        "com.MobileTicket",
        "com.adguard.android",
        "com.ainemo.dragoon",
        "com.alibaba.android.rimet",
        "com.alicloud.databox",
        "com.amazing.cloudisk.tv",
        "com.autonavi.minimap",
        "com.bilibili.app.in",
        "com.bishua666.luxxx1",
        "com.cainiao.wireless",
        "com.chebada",
        "com.chinamworld.main",
        "com.cmbchina.ccd.pluto.cmbActivity",
        "com.coolapk.market",
        "com.ctrip.ct",
        "com.dianping.v1",
        "com.douban.frodo",
        "com.eg.android.AlipayGphone",
        "com.farplace.qingzhuo",
        "com.hanweb.android.zhejiang.activity",
        "com.leoao.fitness",
        "com.lucinhu.bili_you",
        "com.mikrotik.android.tikapp",
        "com.moji.mjweather",
        "com.motorola.cn.calendar",
        "com.motorola.cn.lrhealth",
        "com.netease.cloudmusic",
        "com.sankuai.meituan",
        "com.sina.weibo",
        "com.smartisan.notes",
        "com.sohu.inputmethod.sogou.moto",
        "com.sonelli.juicessh",
        "com.ss.android.article.news",
        "com.ss.android.lark",
        "com.ss.android.ugc.aweme",
        "com.tailscale.ipn",
        "com.taobao.idlefish",
        "com.taobao.taobao",
        "com.tencent.mm",
        "com.tencent.mp",
        "com.tencent.soter.soterserver",
        "com.tencent.wemeet.app",
        "com.tencent.weread",
        "com.tencent.wework",
        "com.ttxapps.wifiadb",
        "com.unionpay",
        "com.unnoo.quan",
        "com.wireguard.android",
        "com.xingin.xhs",
        "com.xunmeng.pinduoduo",
        "com.zui.zhealthy",
        "ctrip.android.view",
        "io.kubenav.kubenav",
        "org.geekbang.geekTime",
        "tv.danmaku.bili"
      ],
      "stack": "mixed",
      "sniff": true
    },
    {
      "type": "socks",
      "tag": "socks-in",
      "listen": "::",
      "listen_port": 5353
    }
  ],
  "outbounds": [
    {
      "type": "selector",
      "tag": "select",
      "outbounds": [
        "trojan-out"
      ],
      "default": "trojan-out"
    },
    {
      "type": "selector",
      "tag": "openai",
      "outbounds": [
        "trojan-out"
      ],
      "default": "trojan-out"
    },
    {
      "type": "selector",
      "tag": "tiktok",
      "outbounds": [
        "trojan-out"
      ],
      "default": "trojan-out"
    },
    {
      "type": "trojan",
      "tag": "trojan-out",
      "server": "199.180.115.155",
      "server_port": 9443,
      "password": "5iFHKMrn9Ez//VKh6zChTA==",
      "tls": {
        "enabled": true,
        "server_name": "ss.icloudnative.io",
        "insecure": true,
        "utls": {
          "fingerprint": "chrome"
        }
      },
      "multiplex": {
        "protocol": "h2mux",
        "max_connections": 4,
        "min_streams": 4
      },
      "transport": {
        "type": "grpc",
        "service_name": "TunService"
      }
    },
    {
      "type": "direct",
      "tag": "direct"
    },
    {
      "type": "block",
      "tag": "block"
    },
    {
      "type": "dns",
      "tag": "dns-out"
    }
  ],
  "route": {
    "rules": [
      {
        "protocol": "dns",
        "outbound": "dns-out"
      },
      {
        "clash_mode": "direct",
        "outbound": "direct"
      },
      {
        "clash_mode": "global",
        "outbound": "select"
      },
      {
        "domain_suffix": [
          "icloudnative.io",
          "fuckcloudnative.io",
          "sealos.io",
          "cdn.jsdelivr.net"
        ],
        "outbound": "direct"
      },
      {
        "process_name": [
          "TencentMeeting",
          "NemoDesktop",
          "ToDesk",
          "ToDesk_Service",
          "WeChat",
          "OpenLens",
          "Tailscale",
          "wireguard-go",
          "Tunnelblick",
          "softwareupdated",
          "kubectl"
        ],
        "outbound": "direct"
      },
      {
        "protocol": "quic",
        "outbound": "block"
      },
      {
        "inbound": "socks-in",
        "outbound": "select"
      },
      {
        "rule_set": [
          "WeChat",
          "Bilibili"
        ],
        "outbound": "direct"
      },
      {
        "rule_set": "OpenAI",
        "outbound": "openai"
      },
      {
        "domain_suffix": [
          "openai.com",
          "oaistatic.com",
          "oaiusercontent.com"
        ],
        "outbound": "openai"
      },
      {
        "package_name": "com.openai.chatgpt",
        "outbound": "openai"
      },
      {
        "rule_set": "TikTok",
        "outbound": "tiktok"
      },
      {
        "package_name": "com.zhiliaoapp.musically",
        "outbound": "tiktok"
      },
      {
        "domain_suffix": [
          "depay.one",
          "orbstack.dev"
        ],
        "outbound": "select"
      },
      {
        "process_name": [
          "DropboxMacUpdate",
          "Dropbox"
        ],
        "outbound": "select"
      },
      {
        "package_name": [
          "com.google.android.youtube",
          "com.android.vending",
          "org.telegram.messenger",
          "org.telegram.plus",
          "com.google.android.googlequicksearchbox",
          "app.rvx.android.youtube",
          "com.mudvod.video",
          "com.fox2code.mmm",
          "com.twitter.android"
        ],
        "outbound": "select"
      },
      {
        "domain": "accounts.google.com",
        "domain_suffix": [
          "sourceforge.net",
          "fhjasokiwq.com"
        ],
        "outbound": "select"
      },
      {
        "domain_suffix": "cloud.sealos.io",
        "outbound": "direct"
      },
      {
        "type": "logical",
        "mode": "and",
        "rules": [
          {
            "rule_set": "geosite-geolocation-!cn"
          },
          {
            "rule_set": "geoip-cn",
            "invert": true
          }
        ],
        "outbound": "select"
      },
      {
        "rule_set": "Global",
        "outbound": "select"
      },
      {
        "rule_set": "geoip-cn",
        "outbound": "direct"
      },
      {
        "ip_is_private": true,
        "outbound": "direct"
      },
      {
        "rule_set": [
          "YouTube",
          "Telegram",
          "Netflix",
          "geoip-google",
          "geoip-telegram",
          "geoip-twitter",
          "geoip-netflix"
        ],
        "outbound": "select"
      }
    ],
    "rule_set": [
      {
        "type": "remote",
        "tag": "geosite-geolocation-!cn",
        "format": "binary",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-geolocation-!cn.srs",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "geoip-cn",
        "format": "binary",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/CHIZI-0618/v2ray-rules-dat/release/singbox_ip_rule_set/geoip-cn.srs",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "geoip-google",
        "format": "binary",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/CHIZI-0618/v2ray-rules-dat/release/singbox_ip_rule_set/geoip-google.srs",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "geoip-telegram",
        "format": "binary",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/CHIZI-0618/v2ray-rules-dat/release/singbox_ip_rule_set/geoip-telegram.srs",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "geoip-twitter",
        "format": "binary",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/CHIZI-0618/v2ray-rules-dat/release/singbox_ip_rule_set/geoip-twitter.srs",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "geoip-netflix",
        "format": "binary",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/CHIZI-0618/v2ray-rules-dat/release/singbox_ip_rule_set/geoip-netflix.srs",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "Global",
        "format": "source",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/yangchuansheng/sing-box-geosite/main/rule/Global.json",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "YouTube",
        "format": "source",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/yangchuansheng/sing-box-geosite/main/rule/YouTube.json",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "OpenAI",
        "format": "source",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/yangchuansheng/sing-box-geosite/main/rule/OpenAI.json",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "TikTok",
        "format": "source",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/yangchuansheng/sing-box-geosite/main/rule/TikTok.json",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "Telegram",
        "format": "source",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/yangchuansheng/sing-box-geosite/main/rule/Telegram.json",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "Netflix",
        "format": "source",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/yangchuansheng/sing-box-geosite/main/rule/Netflix.json",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "WeChat",
        "format": "source",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/yangchuansheng/sing-box-geosite/main/rule/WeChat.json",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "Bilibili",
        "format": "source",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/yangchuansheng/sing-box-geosite/main/rule/Bilibili.json",
        "download_detour": "direct"
      }
    ],
    "final": "direct",
    "find_process": true,
    "auto_detect_interface": true
  },
  "experimental": {
    "cache_file": {
      "enabled": true
    },
    "clash_api": {
      "external_controller": "0.0.0.0:9090",
      "external_ui": "metacubexd",
      "external_ui_download_url": "https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip",
      "external_ui_download_detour": "select",
      "default_mode": "rule"
    }
  }
}
```
{{< /details >}}

下面我来给大家解析一下里面的配置，首先来看 DNS 部分。

{{< alert "bell" >}}
如果你嫌下面的解析太长不看，那就直接使用我的示例模板配置好了。
{{< /alert >}}

### DNS 配置

sing-box 对 DNS 的处理比 Clash 强太多了，支持各种分流规则，结构如下：

```json
{
  "dns": {
    "servers": [],
    "rules": [],
    "final": "",
    "strategy": "",
    "disable_cache": false,
    "disable_expire": false,
    "independent_cache": false,
    "reverse_mapping": false,
    "fakeip": {}
  }
}
```

其中 `servers` 定义了 DNS 服务器，具体参数含义我就不解释了，自己看官方文档。我给出的 DNS 服务器配置是：

```json
{
  "dns": {
    "servers": [
      {
        "tag": "dns_proxy",
        "address": "https://1.1.1.1/dns-query",
        "address_resolver": "dns_resolver",
        "strategy": "ipv4_only",
        "detour": "select"
      },
      {
        "tag": "dns_direct",
        "address": "h3://dns.alidns.com/dns-query",
        "address_resolver": "dns_resolver",
        "strategy": "ipv4_only",
        "detour": "direct"
      },
      {
        "tag": "dns_block",
        "address": "rcode://refused"
      },
      {
        "tag": "dns_resolver",
        "address": "223.5.5.5",
        "strategy": "ipv4_only",
        "detour": "direct"
      }
    ]
  }
}
```

这里定义了 3 个 DNS 服务器，当你发起一个域名解析请求时，这些服务器会被用来查找对应的 IP 地址。同时还定义了一个 RCode 协议用来屏蔽请求。

`rules` 定义了 DNS 规则，这些规则用于定义哪些域名应该使用哪个 DNS 服务器解析。它可以让你根据域名的特定模式选择不同的 DNS 服务器。DNS 规则如下：

```json
{
  "dns": {
    "rules": [
      {
        "outbound": "any",
        "server": "dns_resolver"
        // 注释：对于任何出站连接（不管是直接连接还是通过代理），使用 "dns_resolver" 服务器进行 DNS 解析（这一句主要用来解析代理节点本身的 IP 地址）。
      },
      {
        "clash_mode": "direct",
        "server": "dns_direct"
        // 注释：在直连模式（不经过代理）下，使用 "dns_direct" 服务器进行 DNS 解析。
      },
      {
        "clash_mode": "global",
        "server": "dns_proxy"
        // 注释：在全局代理模式下，使用 "dns_proxy" 服务器进行 DNS 解析。
      },
      {
        "process_name": [
          "TencentMeeting", "NemoDesktop", "ToDesk", "ToDesk_Service",
          "WeChat", "Tailscale", "wireguard-go", "Tunnelblick",
          "softwareupdated", "kubectl"
        ],
        "server": "dns_direct"
        // 注释：当特定的进程（如 TencentMeeting、WeChat 等）发起 DNS 请求时，使用 "dns_direct" 服务器进行直连 DNS 解析。
      },
      {
        "domain_suffix": [
          "icloudnative.io", "fuckcloudnative.io", "sealos.io", "cdn.jsdelivr.net"
        ],
        "server": "dns_direct"
        // 注释：对于特定后缀的域名（如 icloudnative.io 等），使用 "dns_direct" 服务器进行直连 DNS 解析。
      },
      {
        "process_name": ["DropboxMacUpdate", "Dropbox"],
        "server": "dns_proxy"
        // 注释：当 Dropbox 相关进程发起 DNS 请求时，使用 "dns_proxy" 服务器通过代理进行 DNS 解析。
      },
      {
        "package_name": [
          "com.google.android.youtube", "com.android.vending",
          "org.telegram.messenger", "org.telegram.plus"
        ],
        "server": "dns_proxy"
        // 注释：对于特定的 Android 应用包名（如 YouTube、Telegram 等），使用 "dns_proxy" 服务器通过代理进行 DNS 解析。
      },
      {
        "rule_set": "geosite-geolocation-!cn",
        "server": "dns_proxy"
        // 注释：对于 geosite 数据库中定义的非中国地区的地理位置相关的域名，使用 "dns_proxy" 服务器通过代理进行 DNS 解析。
      },
      {
        "rule_set": "Global",
        "server": "dns_proxy"
        // 注释：对于定义在 "Global" 规则集中的域名，使用 "dns_proxy" 服务器通过代理进行 DNS 解析。
      },
      {
        "rule_set": [
          "YouTube", "Telegram", "Netflix", "geoip-google",
          "geoip-telegram", "geoip-twitter", "geoip-netflix"
        ],
        "server": "dns_proxy"
        // 注释：对于特定的服务和地理位置相关的域名（如 YouTube、Netflix、谷歌、Telegram 相关的域名），使用 "dns_proxy" 服务器通过代理进行 DNS 解析。
      }
    ],
    "final": "dns_direct"
    // 注释：如果上述规则都不适用，则默认使用 "dns_direct" 服务器进行直连 DNS 解析。
  }
}
```

### 入站配置

接下来比较重要的就是入站规则了，入站（Inbound）在网络领域，特别是在代理和网络路由配置中，通常指的是进入某个系统或网络的数据流。在 sing-box 中，**入站配置定义了如何处理进入代理服务器的数据**。入站配置示例如下：

```json
{
  "inbounds": [
    {
      "type": "tun",
      "inet4_address": "198.18.0.1/16",
      "auto_route": true,
      "exclude_package": [
        "cmb.pb",
        "cn.gov.pbc.dcep",
        "com.MobileTicket",
        "com.adguard.android",
        "com.ainemo.dragoon",
        "com.alibaba.android.rimet",
        "com.alicloud.databox",
        "com.amazing.cloudisk.tv",
        "com.autonavi.minimap",
        "com.bilibili.app.in",
        "com.bishua666.luxxx1",
        "com.cainiao.wireless",
        "com.chebada",
        "com.chinamworld.main",
        "com.cmbchina.ccd.pluto.cmbActivity",
        "com.coolapk.market",
        "com.ctrip.ct",
        "com.dianping.v1",
        "com.douban.frodo",
        "com.eg.android.AlipayGphone",
        "com.farplace.qingzhuo",
        "com.hanweb.android.zhejiang.activity",
        "com.leoao.fitness",
        "com.lucinhu.bili_you",
        "com.mikrotik.android.tikapp",
        "com.moji.mjweather",
        "com.motorola.cn.calendar",
        "com.motorola.cn.lrhealth",
        "com.netease.cloudmusic",
        "com.sankuai.meituan",
        "com.sina.weibo",
        "com.smartisan.notes",
        "com.sohu.inputmethod.sogou.moto",
        "com.sonelli.juicessh",
        "com.ss.android.article.news",
        "com.ss.android.lark",
        "com.ss.android.ugc.aweme",
        "com.tailscale.ipn",
        "com.taobao.idlefish",
        "com.taobao.taobao",
        "com.tencent.mm",
        "com.tencent.mp",
        "com.tencent.soter.soterserver",
        "com.tencent.wemeet.app",
        "com.tencent.weread",
        "com.tencent.wework",
        "com.ttxapps.wifiadb",
        "com.unionpay",
        "com.unnoo.quan",
        "com.wireguard.android",
        "com.xingin.xhs",
        "com.xunmeng.pinduoduo",
        "com.zui.zhealthy",
        "ctrip.android.view",
        "io.kubenav.kubenav",
        "org.geekbang.geekTime",
        "tv.danmaku.bili"
      ],
      "stack": "mixed",
      "sniff": true
    },
    {
      "type": "socks",
      "tag": "socks-in",
      "listen": "::",
      "listen_port": 5353
    }
  ]
}
```

下面是对每个字段的详细注释：

第一个入站连接的配置：

- **`type`**: `"tun"` 表示这是一个 tun 虚拟网络接口的配置。
- **`inet4_address`**: `"198.18.0.1/16"` 设定了虚拟网络接口的 IPv4 地址和子网掩码。
- **`auto_route`**: `true` 表示将自动处理路由，确保数据包正确传输。
- **`exclude_package`**: 这是一个数组，包含了不通过此虚拟网络接口处理的 Android 应用程序包名列表。**列出的 Android 应用程序将使用常规网络接口而不是虚拟接口**。
- **`stack`**: `"mixed"` 表示混合 `system` TCP 栈与 `gvisor` UDP 栈。
- **`sniff`**: `true` 表示启用流量嗅探功能，以便自动检测和处理传入的数据流类型。

第二个入站连接的配置：

- **`type`**: `"socks"` 表示这是一个 SOCKS 代理配置。
- **`tag`**: `"socks-in"` 为这个入站连接定义了一个标签，方便在其它配置中引用。
- **`listen`**: `"::"` 表示监听所有 IPv6 地址。如果需要监听所有 IPv4 地址，可以使用 `"0.0.0.0"`。
- **`listen_port`**: `5353` 定义了 SOCKS 代理监听的端口号。

其中 tun 接口是核心部分，**我们将利用 tun 接口来实现全局透明代理**。

### 出站配置

出站（Outbound）是指从本地网络或设备发出，向外部网络、服务或互联网发送的数据流量。示例出站配置如下：

```json
{
  "outbounds": [
    {
      "type": "selector", // 类型为选择器，用于在多个出站中选择一个
      "tag": "select", // 标签名为 "select"
      "outbounds": [
        "trojan-out" // 可选择的出站列表，这里只有 "trojan-out"
      ],
      "default": "trojan-out" // 默认选择的出站为 "trojan-out"
    },
    {
      "type": "selector", // 同样是选择器类型
      "tag": "openai", // 标签名为 "openai"
      "outbounds": [
        "trojan-out" // 可选择的出站仍然是 "trojan-out"
      ],
      "default": "trojan-out" // 默认选择的出站同样是 "trojan-out"
    },
    {
      "type": "selector", // 选择器类型
      "tag": "tiktok", // 标签名为 "tiktok"
      "outbounds": [
        "trojan-out" // 可选择的出站是 "trojan-out"
      ],
      "default": "trojan-out" // 默认选择的出站为 "trojan-out"
    },
    {
      "type": "trojan", // 类型为 Trojan
      "tag": "trojan-out", // 标签名为 "trojan-out"
      "server": "xxxxxxxx", // Trojan 服务器地址
      "server_port": 9443, // Trojan 服务器端口
      "password": "xxxxxxxx", // Trojan 连接密码
      "tls": {
        "enabled": true, // 启用 TLS 加密
        "server_name": "xxxxxxxx", // TLS 服务器名称
        "insecure": true, // 不验证 TLS 证书，用于自签名证书
        "utls": {
          "fingerprint": "chrome" // 使用 Chrome 的 TLS 指纹
        }
      },
      "multiplex": {
        "protocol": "h2mux", // 使用 h2mux 多路复用协议
        "max_connections": 4, // 最大连接数为 4
        "min_streams": 4 // 每个连接的最小流数为 4
      },
      "transport": {
        "type": "grpc", // 传输协议为 gRPC
        "service_name": "TunService" // gRPC 服务名称
      }
    },
    {
      "type": "direct", // 直连类型，不通过代理直接访问
      "tag": "direct" // 标签名为 "direct"
    },
    {
      "type": "block", // 阻止类型，用于拦截流量
      "tag": "block" // 标签名为 "block"
    },
    {
      "type": "dns", // DNS 类型，用于 DNS 查询
      "tag": "dns-out" // 标签名为 "dns-out"
    }
  ]
}
```

这个配置定义了不同类型的出站连接方式，包括选择器、Trojan、直连、阻止和 DNS 类型。每种类型都通过标签进行标识，便于在后续的路由规则中引用。

### 路由配置

路由部分才是 sing-box 的核心配置，这个部分定义了一系列规则和参数，用于决定如何处理不同的网络请求。通过这些规则和参数，sing-box 可以非常灵活地处理复杂的路由需求，包括基于地理位置、IP 地址、端口号、域名等多种条件的流量分流。配置结构如下：

```json
{
  "route": {
    "rules": [],
    "rule_set": [],
    "final": "direct", // "final" 字段定义了默认的路由行为。这里设置为 "direct"，意味着如果没有匹配任何规则，流量将直接（不经代理）发送。
    "auto_detect_interface": true // 表示自动检测网络接口。这有助于自动适应网络变化，确保路由正确。
  }
}
```

其中的核心配置：

1. **路由规则 (`rules`)**: 这些规则定义了如何根据不同的条件将流量定向到不同的出站连接。每个规则可以包括多个条件，如域名、IP 地址、端口号、网络协议等。
2. **规则集 (`rule_set`)**: 从 sing-box 1.8.0 版本开始，规则可以组合成规则集，这使得配置更加灵活和模块化。

#### 路由规则

以下是我给出的路由规则示例：

```json
{
  "route": {
    "rules": [
      {
        "protocol": "dns",        // 使用DNS协议的流量
        "outbound": "dns-out"     // 将通过'dns-out'出口转发
      },
      {
        "clash_mode": "direct",   // Clash模式为直连
        "outbound": "direct"      // 将通过'direct'出口直接连接
      },
      {
        "clash_mode": "global",   // Clash模式为全局
        "outbound": "select"      // 将通过'select'出口选择转发
      },
      {
        "domain_suffix": [        // 特定后缀的域名
          "icloudnative.io",
          "fuckcloudnative.io",
          "sealos.io",
          "cdn.jsdelivr.net"
        ],
        "outbound": "direct"      // 将通过'direct'出口直接连接
      },
      {
        "process_name": [         // 特定进程名称
          "TencentMeeting",
          "NemoDesktop",
          ...
        ],
        "outbound": "direct"      // 将通过'direct'出口直接连接
      },
      {
        "rule_set": [             // 特定的规则集
          "WeChat",
          "Bilibili"
        ],
        "outbound": "direct"      // 将通过'direct'出口直接连接
      },
      {
        "protocol": "quic",       // 使用QUIC协议的流量
        "outbound": "block"       // 将被阻止
      },
      {
        "inbound": "socks-in",    // 来自'socks-in'入口的流量
        "outbound": "select"      // 将通过'select'出口选择转发
      },
      {
        "rule_set": "OpenAI",     // OpenAI规则集
        "outbound": "openai"      // 将通过'openai'出口转发
      },
      {
        "domain_suffix": [        // OpenAI相关的域名后缀
          "openai.com",
          "oaistatic.com",
          "oaiusercontent.com"
        ],
        "outbound": "openai"      // 将通过'openai'出口转发
      },
      {
        "package_name": "com.openai.chatgpt", // OpenAI ChatGPT应用包名
        "outbound": "openai"                  // 将通过'openai'出口转发
      },
      {
        "rule_set": "TikTok",     // TikTok规则集
        "outbound": "tiktok"      // 将通过'tiktok'出口转发
      },
      {
        "package_name": "com.zhiliaoapp.musically", // TikTok应用包名
        "outbound": "tiktok"                          // 将通过'tiktok'出口转发
      },
      {
        "domain_suffix": [        // 特定的域名后缀
          "depay.one",
          "orbstack.dev"
        ],
        "outbound": "select"      // 将通过'select'出口选择转发
      },
      {
        "process_name": [         // 特定的进程名称
          "DropboxMacUpdate",
          "Dropbox"
        ],
        "outbound": "select"      // 将通过'select'出口选择转发
      },
      {
        "package_name": [         // 特定应用包名
          "com.google.android.youtube",
          ...
        ],
        "outbound": "select"      // 将通过'select'出口选择转发
      },
      {
        "domain": "accounts.google.com", // 特定的域名
        "domain_suffix": [               // 特定的域名后缀
          "sourceforge.net",
          "fhjasokiwq.com"
        ],
        "outbound": "select"             // 将通过'select'出口选择转发
      },
      {
        "domain_suffix": "cloud.sealos.io", // 特定的域名后缀
        "outbound": "direct"                // 将通过'direct'出口直接连接
      },
      {
        "type": "logical",        // 逻辑类型规则
        "mode": "and",            // 使用'and'模式
        "rules": [                // 组合规则
          {
            "rule_set": "geosite-geolocation-!cn"
          },
          {
            "rule_set": "geoip-cn",
            "invert": true
          }
        ],
        "outbound": "select"      // 将通过'select'出口选择转发
      },
      {
        "rule_set": "Global",     // Global规则集
        "outbound": "select"      // 将通过'select'出口选择转发
      },
      {
        "rule_set": "geoip-cn",   // 中国地理位置IP规则集
        "outbound": "direct"      // 将通过'direct'出口直接连接
      },
      {
        "ip_is_private": true,    // 私有IP地址
        "outbound": "direct"      // 将通过'direct'出口直接连接
      },
      {
        "rule_set": [             // 特定的规则集
          "YouTube",
          "Telegram",
          "Netflix",
          "geoip-google",
          "geoip-telegram",
          "geoip-twitter",
          "geoip-netflix"
        ],
        "outbound": "select"      // 将通过'select'出口选择转发
      }
    ]
  }
}
```

这个配置定义了不同类型的流量（如基于协议、域名后缀、应用包名、进程名称等）如何被路由。每条规则都指定了一种流量类型和相应的“出口”，即流量应该如何被处理或转发。这种灵活的路由配置可以非常精确地控制网络流量。

#### 规则集

以下是我给出的规则集示例：

```json
{
  "route": {
    "rule_set": [
      {
        "type": "remote",
        "tag": "geosite-geolocation-!cn",
        "format": "binary",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-geolocation-!cn.srs",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "geoip-cn",
        "format": "binary",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/CHIZI-0618/v2ray-rules-dat/release/singbox_ip_rule_set/geoip-cn.srs",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "geoip-google",
        "format": "binary",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/CHIZI-0618/v2ray-rules-dat/release/singbox_ip_rule_set/geoip-google.srs",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "geoip-telegram",
        "format": "binary",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/CHIZI-0618/v2ray-rules-dat/release/singbox_ip_rule_set/geoip-telegram.srs",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "geoip-twitter",
        "format": "binary",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/CHIZI-0618/v2ray-rules-dat/release/singbox_ip_rule_set/geoip-twitter.srs",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "geoip-netflix",
        "format": "binary",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/CHIZI-0618/v2ray-rules-dat/release/singbox_ip_rule_set/geoip-netflix.srs",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "Global",
        "format": "source",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/yangchuansheng/sing-box-geosite/main/rule/Global.json",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "YouTube",
        "format": "source",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/yangchuansheng/sing-box-geosite/main/rule/YouTube.json",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "OpenAI",
        "format": "source",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/yangchuansheng/sing-box-geosite/main/rule/OpenAI.json",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "TikTok",
        "format": "source",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/yangchuansheng/sing-box-geosite/main/rule/TikTok.json",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "Telegram",
        "format": "source",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/yangchuansheng/sing-box-geosite/main/rule/Telegram.json",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "Netflix",
        "format": "source",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/yangchuansheng/sing-box-geosite/main/rule/Netflix.json",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "WeChat",
        "format": "source",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/yangchuansheng/sing-box-geosite/main/rule/WeChat.json",
        "download_detour": "direct"
      },
      {
        "type": "remote",
        "tag": "Bilibili",
        "format": "source",
        "url": "https://mirror.ghproxy.com/https://raw.githubusercontent.com/yangchuansheng/sing-box-geosite/main/rule/Bilibili.json",
        "download_detour": "direct"
      }
    ]
  }
}
```

这里有两种不同类型的规则集，一种是 binary，另外一种是 source。binary 规则集一般都是利用 GEOSITE 或者 GEOIP 直接编译好的二进制规则，它们被直接嵌入到应用程序中。而 source 规则集就和 Clash 的 ruleset 比较类似，它是一个文本文件，而不是二进制。

目前已经有相关项目可以自动将网络上的 Clash Ruleset 规则自动转换为 sing-box 的 source 规则集，感兴趣的同学可以参考这个项目：[sing-box-geosite](https://github.com/Toperlock/sing-box-geosite)

### Clash API

最后的实验性配置用来开启 Clash API。没错，sing-box 是兼容 Clash API 滴！那么我们就可以使用 Clash 的 dashboard 来管理 sing-box 了，直接用这个项目好了：[metacubexd](https://github.com/MetaCubeX/metacubexd)

示例配置如下：

```json
{
  "experimental": {
    "cache_file": {
      "enabled": true  // 启用缓存文件功能。当此项设置为true时，启用 DNS 查询的缓存，以便加快后续相同查询的响应速度。
    },
    "clash_api": {
      "external_controller": "0.0.0.0:9090",  // 定义 Clash API 的外部控制器地址。"0.0.0.0:9090" 表示在本机的9090端口上监听外部的连接请求。
      "external_ui": "metacubexd",  // 指定外部用户界面(UI)的名称。这里的 "metacubexd" 是一个自定义 UI 的名称。
      "external_ui_download_url": "https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip",  // 提供外部 UI 的下载 URL。这个 URL 是从 GitHub 上下载 "metacubexd" UI 的压缩包。
      "external_ui_download_detour": "select",  // 定义下载外部 UI 时使用的转发策略。"select" 表示将通过'select'出口选择转发
      "default_mode": "rule"  // 设置 Clash API 的默认模式。"rule" 模式意味着流量将根据用户定义的规则进行路由。
    }
  }
}
```

最终启动 sing-box 之后就可以通过 Clash dashboard 来查看和管理流量啦：

![](https://images.icloudnative.io/uPic/2024-01-14-17-16-2yLPXT.webp)

{{< alert >}}
**注意：** 图形界面客户端会自动把外部控制器相关的配置给屏蔽掉，如果你想使用 Dashboard，只能使用命令行来启动 sing-box。
{{< /alert >}}

## 订阅转换

我想大部分小伙伴使用的还是订阅链接，不可能傻乎乎的自己写配置和规则。但是目前大部分ji场都不提供 sing-box 的配置格式，仅有少量ji场提供支持，其他ji场可使用下面这个项目将常见订阅转换为 sing-box 订阅格式：[sing-box-subscribe](https://github.com/Toperlock/sing-box-subscribe)

你可以将这个项目部署到自己的 Vercel 中，然后使用以下的链接格式来将常见订阅转换为 sing-box 订阅格式：

```bash
<URL>/url=<subscription_url>/&file=<sing-box_template_url>
```

+ `<URL>`：这是你的 sing-box-subscribe 访问链接；
+ `<subscription_url>`：这是你的订阅链接；
+ `<sing-box_template_url>`：这是你的 sing-box 模板配置链接，你可以直接使用[我的模板](https://gist.githubusercontent.com/yangchuansheng/5182974442015feeeeb058de543a00fd/raw/45b11ff08188af021da98e7174923d719dc42dd9/gistfile1.txt)。

例如：

```bash
https://sing-box-subscribe.vercel.app/config/url=https://xxxxxx?clash=1/&file=https://gist.githubusercontent.com/yangchuansheng/5182974442015feeeeb058de543a00fd/raw/45b11ff08188af021da98e7174923d719dc42dd9/gistfile1.txt
```

如果你有多个订阅链接，需要先将订阅链接合并为一个链接，然后再进行转换，具体看参考 [sing-box-subscribe 的官方文档](https://github.com/Toperlock/sing-box-subscribe/blob/main/instructions/README.md)。

## 更多配置示例

更多的配置示例可以参考这个项目：[sing-box-examples](https://github.com/chika0801/sing-box-examples)

这个项目针对每一个代理协议都提供了详细的配置示例，还有很多的骚操作，比如[将 Cloudflare 的 Warp 节点信息直接提取出来加到 sing-box 出站配置中去](https://github.com/chika0801/sing-box-examples/blob/main/wireguard.md)，妙啊！

## 透明网关

如果你想让局域网中的所有机器都能够根据规则智能分流，那就在局域网中找一台机器作为透明网关，在这台机器上运行一个 sing-box 就行了，不需要像 Clash 一样写什么乱七八糟的 iptables 规则，直接一个配置文件就行了，非常简单。通常我们使用软路由来完成这个任务，如果你不想使用软路由，那随便找一台机器就行了，当然最好还是使用 Linux 比较靠谱。

在网关上运行 sing-box 之后，其他机器只需要将网关指向这台机器，便可以无痛开启魔法智能分流了。

{{< alert >}}
**注意：** 其他机器的 DNS 必须是公网 DNS，不能使用内网 DNS！你的 DNS 可以指向任意的公网 DNS，反正只要是公网就行，比如：114.114.114.114，因为 sing-box 会劫持局域网中的所有 DNS 请求。
{{< /alert >}}

当然，如果你不想让 sing-box 劫持局域网中的所有 DNS 请求，可以使用如下的方案：

首先在入站配置中添加一个监听端口：

```json
{
  "inbounds": [
    {
      "type": "direct",
      "tag": "dns-in",
      "listen": "0.0.0.0",
      "listen_port": 53
    }
  ]
}
```

然后在路由规则中将 DNS 的规则改成如下的配置：

```json
{
  "route": {
    "rules": [
      {
        "inbound": "dns-in",
        "outbound": "dns-out"
      }
    ]
  }
}
```

这样就保证了只有从 53 端口进来的流量才会进入 DNS 解析。

重启生效后，将其他机器的网关和 DNS 均指向这台机器就可以了。

如果你使用的是 DHCP，只需要在 DHCP 服务器中将 DHCP 分配的网关和 DNS 改成 sing-box 所在的机器 IP 即可。