---
keywords:
- clash
- clash tracing
- Grafana
- Loki
- Vector
- Bywave
- Clash Premium
- Kubernetes
title: "使用 Grafana 和 Loki 监控 Clash"
date: 2022-05-15T09:19:37+08:00
lastmod: 2022-05-15T09:19:37+08:00
description: 本文给介绍了如何利用 Clash Tracing 功能收集 Clash 流量数据，并使用 Vector 将其转为日志推送给 Loki，并使用 Grafana 的可视化监控面板来展示数据。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- Clash
- Grafana
- Loki
categories: GFW
img: https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-05-15-11-10-nOYkzx.png
---

众所周知，科学上网，又称番茄 / 魔法 / 武当纵云梯，是当代青年的必备技能。而想要科学上网，需要两个必备条件：

+ 需要有一个服务商提供的服务器订阅地址
+ 需要安装对应的软件

服务商（机场）有很多，价格、节点、带宽和稳定性都丰俭由人，我现在的主要机场是 [易帆云加速](https://yifancloud.online/auth/register?code=Lmsv)。Bywave 是一家走高端全内网中转线路的 v2ray 优质机场，不仅拥有阿里云 / WTT / HKT 等线路，还且还有全内网中转节点和 IPLC 专线（内网中转线路及 IPLC 专线成本极高，所以质量极佳，网络很流畅稳定，历次受到供给也无影响）ByWave 不像其他机场提供非常多的节点，需要频繁订阅更新和维护。没有注册的朋友可以点击[此链接](https://yifancloud.online/auth/register?code=Lmsv)注册体验。

而代理软件也有多种选择，抛开收费产品不谈，免费代理软件目前最强大的是 Clash，Clash 是一个跨平台、支持 SS/V2ray/Trojan 协议、基于规则的网络代理软件，功能强大、界面美观、支持订阅，尤其适合机场和付费服务使用。基于 Clash 的图形界面客户端也非常多，比较流行的有 Clash for Windows、Clash X、Clash X Pro 以及 OpenWrt 使用的 OpenClash，区别都不大。

Clash 核心也有很多变种，比如 Clash Premium，与 Clash 都是同一个作者所写，区别仅在于闭源并提供了更高级的功能。

Clash Premium 内核有一个比较新的、还在实验中的功能叫 Tracing，可以方便的采集经过 Clash 核心的流量数据。**本文将会介绍如何对 Clash Premium 的流量进行监控，并使用 Grafana 的可视化面板展示监控数据。** 先上图：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-05-14-21-22-08VGjd.jpeg)

为了方便监控，Clash 的开发者新建了个项目叫 [clash-tracing](https://github.com/Dreamacro/clash-tracing)，利用 Clash Premium 的 Websocket Tracing API 收集数据，然后使用 Vector 将其转为日志，并 Push 到 Loki 中，最终使用 Grafana 的可视化监控面板来展示数据，非常实用。在监控之前，首先需要修改 Clash Premium 的配置文件开启 Tracing 功能：

```yaml
profile:
  # open tracing exporter API
  tracing: true
```

如果你是使用 OpenClash，那么需要在〖配置文件管理〗的〖您可以在下方直接修改配置文件: config.yaml ，仅支持未被接管的设置〗中直接在顶部添加上面的内容，然后重启 OpenClash 即可。

开发者已经提供了 `docker-compose.yml`，容器玩家可以直接通过该编排文件一条命令拉起所有服务，然后就没有然后了，完结撒花！

等等，先别急着撒花，哪个云原生玩家没有一套自己的 Kubernetes 环境呢？**能不能快速将这套监控服务部署到 Kubernetes 环境中呢？**

为了能够在 K8s 中一键部署这套监控服务，我 [Fork 了该项目](https://github.com/yangchuansheng/clash-tracing)，添加了 GitHub Action 自动构建 Docker 镜像，并添加了 Kubernetes 编排文件，使用方法非常简单，就这么几条命令：

```bash
# 先克隆仓库
$ git clone https://github.com/yangchuansheng/clash-tracing
$ cd clash-tracing
$ kubectl create ns monitoring
# 修改 deployment.yaml 中的环境变量，然后执行如下命令：
$ kubectl apply -f deployment.yaml
$ kubectl apply -f vector
$ kubectl apply -f loki
```

然后在你的 Grafana 可视化界面中添加 Loki 数据源，数据源的地址为 `http://loki.monitoring:3100`，名称为 `loki`。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-05-14-21-45-5sF7Mm.png)

如果你的集群中没有 Grafana，自己部署一个就是了，本文就不赘述了。

接下来执行以下命令将监控面板的 JSON 模板中的数据源改为 loki：

```bash
$ bash hack.sh
```

最后将 `panels/dashboard.json` 和 `panels/logs.json` 导入 Grafana 即可。

最终效果：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-05-14-21-52-PSUG7g.jpeg)

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-05-14-21-22-08VGjd.jpeg)