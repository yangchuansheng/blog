---
keywords:
- 米开朗基杨
- adguard
- dns
- envoy
title: "AdGuard Home 安装使用教程"
subtitle: "是时候装一套 AdGuard Home 全局挡广告神器了！"
description: 在 MacOS 上自建屏蔽广告的 DNS 服务 AdGuard Home。
date: 2019-09-22T09:02:26+08:00
draft: false
author: 米开朗基杨
toc: true
categories:
- tech-social
tags:
- DNS
- Adguard
- Envoy
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/2019-09-22-%E5%B1%8F%E5%B9%95%E5%BF%AB%E7%85%A7%202019-09-22%20%E4%B8%8A%E5%8D%888.30.34.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

通常我们使用网络时，宽带运营商会为我们分配一个 DNS 服务器。这个 DNS 通常是最快的，距离最近的服务器，但会有很多问题，比如：

1. 访问某些网络服务很缓慢，比如 Apple 的 iCloud 服务。
2. 比较担心安全问题，希望能通过设置 DNS 来保证你访问安全的网站。
3. 厌烦了每当你输入一个不正确的网址，运营商总会给你跳转到一个充满广告的界面。

这个时候我们就需要自定义 DNS，自定义 DNS 不仅能够加快网页开启的速度，还能够提高浏览网页的安全性。更重要的一点是，如果你使用过 `Google Chrome`，应该知道 Google 未来将会限制“拦截广告”的扩展，要想解决此问题只能装个全局的拦截广告软件或者直接从 DNS 服务器层面拦截广告（如果你不想换浏览器）。

[AdGuard Home](https://github.com/AdguardTeam/AdGuardHome) 是一款全网广告拦截与反跟踪软件，可以将广告与追踪相关的域名屏蔽，指向空的主机（DNS 黑洞）。简单来说它就是一个开源的公共 DNS 服务，使用 Go 语言开发，支持家长控制和广告过滤！关键是它还支持 `DNS over TLS` 和 `DNS over HTTPS`，可以运行在 x86 Linux，树莓派上，也可以通过 `Docker` 部署在群晖 NAS 上。

## AdGuard Home 安装

----

AdGuard Home 的安装方法根据你所使用的平台而有所不同，它的二进制文件位于 [https://github.com/AdguardTeam/AdGuardHome/releases](https://github.com/AdguardTeam/AdGuardHome/releases)，可以根据自己的平台下载最新版本。MacOS 的安装方法如下：

```bash
# 下载 AdGuard Home
$ wget https://github.com/AdguardTeam/AdGuardHome/releases/download/v0.98.1/AdGuardHome_MacOS.zip

# 解压并进入 AdGuardHome_MacOS 目录
$ unzip AdGuardHome_MacOS.zip && cd AdGuardHome_MacOS

# 将二进制文件拷贝到 $PATH
$ cp ./AdGuardHome /usr/local/bin/

# 创建 Launch Daemon 的 plist 文件并启动服务
$ AdGuardHome -s install
```

现在就可以看到服务的配置和状态信息了：

```bash
$ sudo launchctl list AdGuardHome

{
	"StandardOutPath" = "/var/log/AdGuardHome.stdout.log";
	"LimitLoadToSessionType" = "System";
	"StandardErrorPath" = "/var/log/AdGuardHome.stderr.log";
	"Label" = "AdGuardHome";
	"TimeOut" = 30;
	"OnDemand" = false;
	"LastExitStatus" = 0;
	"PID" = 1464;
	"Program" = "/usr/local/bin/AdGuardHome";
	"ProgramArguments" = (
		"/usr/local/bin/AdGuardHome";
		"-s";
		"run";
	);
};
```

plist 文件位于 `/Library/LaunchDaemons/` 目录下：

```xml
$ cat /Library/LaunchDaemons/AdGuardHome.plist

<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN"
"http://www.apple.com/DTDs/PropertyList-1.0.dtd" >
<plist version='1.0'>
<dict>
<key>Label</key><string>AdGuardHome</string>
<key>ProgramArguments</key>
<array>
        <string>/usr/local/bin/AdGuardHome</string>

        <string>-s</string>

        <string>run</string>

</array>


<key>WorkingDirectory</key><string>/Users/freya/Downloads/Compressed/AdGuardHome_MacOS</string>
<key>SessionCreate</key><false/>
<key>KeepAlive</key><true/>
<key>RunAtLoad</key><true/>
<key>Disabled</key><false/>
<key>StandardOutPath</key>
<string>/var/log/AdGuardHome.stdout.log</string>
<key>StandardErrorPath</key>
<string>/var/log/AdGuardHome.stderr.log</string>
</dict>
</plist>
```

对 Launch Daemon 不熟悉的同学可以参考 [Mac OS X 的 Launch Daemon / Agent](https://blog.yorkxin.org/2011/08/04/osx-launch-daemon-agent.html)。

查看端口号：

```bash
$ sudo lsof -iTCP -sTCP:LISTEN -P -n|grep AdGuard
AdGuardHo 9990  root    3u  IPv6 0xb76d091ec878f951      0t0  TCP *:3000 (LISTEN)
```

打开浏览器，输入网址 `http://127.0.0.1:3000/` 即可访问 AdGuard Home 的管理界面。

![](https://images.icloudnative.io/uPic/2019-09-21-114450.png)

点击“开始配置”，然后设定网页管理界面和 DNS 服务的端口。

![](https://images.icloudnative.io/uPic/2019-09-21-114514.png)

点击“下一步”设置用户名和密码。

![](https://images.icloudnative.io/uPic/2019-09-21-114541.png)

最后点击“下一步”就大功告成了。

![](https://images.icloudnative.io/uPic/2019-09-21-114614.png)

在仪表盘上，我们可以看到 DNS 查询次数、被过滤器拦截的网站、查询 DNS 请求的客户端地址等等信息。

![](https://images.icloudnative.io/uPic/2019-09-21-adguard_home-1.png)

现在再查看端口号，管理界面会变成你刚刚设定的端口，另外还会多出一个 DNS 服务的端口：

```bash
$ sudo lsof -iTCP -sTCP:LISTEN -P -n|grep AdGuard
AdGuardHo 10619  root   11u  IPv6 0xb76d091eb6671751      0t0  TCP *:53 (LISTEN)
AdGuardHo 10619  root   12u  IPv6 0xb76d091ebc3c7751      0t0  TCP *:5300 (LISTEN)

$ sudo lsof -iUDP -P -n|grep AdGuard
AdGuardHo 10619           root   10u  IPv6 0xb76d091eb89601c1      0t0  UDP *:53
```

## 配置优化

----

默认的配置比较简单，为了更强力地拦截广告，我们可以对配置进行优化。

### 常规设置

勾选【使用过滤器和 Hosts 文件以拦截指定域名】、【使用 AdGuard 浏览安全网页服务】、【强制安全搜索】。如果你想拦截成人网站，也可以勾选【使用 AdGuard 家长控制服务】。

![](https://images.icloudnative.io/uPic/2019-09-21-135135.png)

### 过滤器

虽然 AdGuard 本身提供了 `AdGuard`、`AdAway` 的广告过滤规则，但在中国有点水土不服，如果要想更完美的实现广告屏蔽还需要自己添加规则，AdGuard 可以兼容 `Adblock` 的语法。最知名的过滤规则 **EasyList** 就是由 Adblock Plus 团队维护，过滤规则往往是一个 `txt` 文件，在文件的开头部分会显示规则的最后更新日期。

![](https://images.icloudnative.io/uPic/2019-09-21-133041.png)

推荐广告过滤规则：

+ [EasyList China](https://www.runningcheese.com/go?url=https://easylist-downloads.adblockplus.org/easylistchina.txt) : 国内网站广告过滤的主规则。
+ [EasyPrivacy](https://www.runningcheese.com/go?url=https://easylist-downloads.adblockplus.org/easyprivacy.txt) : EasyPrivacy 是隐私保护，不被跟踪。
+ [CJX's Annoyance List](https://www.runningcheese.com/go?url=https://raw.githubusercontent.com/cjx82630/cjxlist/master/cjx-annoyance.txt) : 过滤烦人的自我推广，并补充EasyPrivacy隐私规则。
+ [ 广告净化器规则](https://www.runningcheese.com/go?url=http://tools.yiclear.com/ChinaList2.0.txt) : 国内大部分视频网站的广告过滤。
+ [I don't care about cookies](https://www.runningcheese.com/go?url=https://www.i-dont-care-about-cookies.eu/abp/) : 我不关心 Cookie 的问题，屏蔽网站的 cookies 相关的警告。

优酷网如果播放无限加载，那在自定义静态规则里加入一条规则 `@@mp4.ts` （参考下图）。

![](https://images.icloudnative.io/uPic/2019-09-21-adguard_filter.png)

### 上游 DNS 设置

官方默认使用 `Cloudflare` 的 DNS over HTTPS 作为上游服务器，在国内可能请求上游 DNS 延迟比较高，可以加上或替换国内的 DNS。我自己另外加了中科大的两组无污染 DNS，每次查询的时候会对所有的上游 DNS 同时查询，加速解析。

![](https://images.icloudnative.io/uPic/2019-09-21-135051.png)

### 查询日志

在这个界面里可以看见所有设备的 DNS 查询日志，可以下载整个日志文件，也可以针对某个域名进行快速拦截和放行。

![](https://images.icloudnative.io/uPic/2019-09-21-135204.png)

### 提升 QPS

有两个参数可以明显提升 QPS：

+ `ratelimit` : DDoS 保护，客户端每秒接收的数据包数。建议禁用该参数（将值改为 0），默认值是 20。
+ `blocked_response_ttl` : TTL 缓存时间，建议设置为 60

配置文件默认路径是 `/usr/local/bin/AdGuardHome.yaml`

![](https://images.icloudnative.io/uPic/2019-09-21-%E5%B1%8F%E5%B9%95%E5%BF%AB%E7%85%A7%202019-09-21%20%E4%B8%8B%E5%8D%8810.04.05.png)

## 使用 Envoy 作为前端代理

----

其实到这里已经算是结束了，但本人有强迫症，我可不想将应用的管理界面设置为一些奇奇怪怪的非标准端口。有人或许会说：那你为什么不将管理界面设置为 80 或 443 端口啊？问得好，因为我的电脑上部署了各种奇奇怪怪的应用，80 端口只有一个，不够用的，只能考虑加个前端代理了。

作为一名云原生狂热信徒，当然是选 `Envoy` 了，虽然 Envoy 很难编译，但 Tetrate 的工程师（包括 Envoy 的核心贡献者和维护者）发起了一个 [GetEnvoy](https://www.getenvoy.io/) 项目，目标是利用一套经过验证的构建工具来构建 Envoy，并通过常用的软件包管理器来分发，其中就包括 `Homebrew`。我们可以直接通过 Homebrew 来安装：

```bash
$ brew tap tetratelabs/getenvoy
==> Tapping tetratelabs/getenvoy
Cloning into '/usr/local/Homebrew/Library/Taps/tetratelabs/homebrew-getenvoy'...
Tapped 1 formula.

$ brew install envoy
==> Installing envoy from tetratelabs/getenvoy
==> Downloading ...
######################################################################## 100.0%
🍺  /usr/local/Cellar/envoy/1.10.0: 3 files, 27.9MB, built in 13 seconds

$ envoy --version
envoy  version: e349fb6139e4b7a59a9a359be0ea45dd61e589c5/1.11.1/clean-getenvoy-930d4a5/RELEASE/BoringSSL
```

这是我的 envoy 配置文件：

```yaml
static_resources:
  listeners:
  - address:
      # Tells Envoy to listen on 0.0.0.0:80
      socket_address:
        address: 0.0.0.0
        port_value: 80
    filter_chains:
    # Any requests received on this address are sent through this chain of filters
    - filters:
      # If the request is HTTP it will pass through this HTTP filter
      - name: envoy.http_connection_manager
        typed_config:
          "@type": type.googleapis.com/envoy.config.filter.network.http_connection_manager.v2.HttpConnectionManager
          codec_type: auto
          stat_prefix: http
          access_log:
            name: envoy.file_access_log
            typed_config:
              "@type": type.googleapis.com/envoy.config.accesslog.v2.FileAccessLog
              path: /dev/stdout
          route_config:
            name: search_route
            virtual_hosts:
            - name: backend
              domains:
              - "*"
              routes:
              - match:
                  prefix: "/"
                route:
                  cluster: adguard
          http_filters:
          - name: envoy.router
            typed_config: {}
  clusters:
  - name: adguard
    connect_timeout: 1s
    type: strict_dns
    dns_lookup_family: V4_ONLY
    lb_policy: round_robin
    load_assignment:
      cluster_name: adguard
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: 127.0.0.1
                port_value: 5300
admin:
  access_log_path: "/dev/stdout"
  address:
    socket_address:
      address: 0.0.0.0
      port_value: 15001
```

创建 Launch Agent 的 plist 文件：

```xml
$ cat /Library/LaunchAgents/envoy.plist

<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>envoy</string>
    <key>ProgramArguments</key>
    <array>
      <string>/usr/local/bin/envoy</string>
      <string>--config-path</string>
      <string>/Users/freya/bin/front-proxy.yaml</string>
    </array>
    <key>StandardOutPath</key>
    <string>/var/log/envoy.stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/envoy.stderr.log</string>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>Disabled</key>
    <false/>
  </dict>
</plist>
```

加载 envoy 服务：

```bash
$ sudo launchctl load /Library/LaunchAgents/envoy.plist
```

现在就可以在浏览器中通过 url `http://127.0.0.1/` 来访问 AdGuard Home 的管理界面啦~

![](https://images.icloudnative.io/uPic/2019-09-21-235711.png)

后续如果还有其他不可描述的应用，它们的管理界面都可以根据不同的 url 路径加到 envoy 的后端中。更高级的玩法还可以接入 `Prometheus` 监控，envoy 的 metrics 路径是 `/stats/prometheus`。

![](https://images.icloudnative.io/uPic/2019-09-22-000220.png)

如果你很好奇为什么我的浏览器能够输出彩色的 metrics，请在公众号后台回复◉prometheus◉

最后，别忘了将 MacOS 的 DNS 设为 `127.0.0.1`，这个就不用我教了吧？
