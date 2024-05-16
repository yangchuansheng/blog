---
keywords:
    - Rust
    - RustDesk
    - teamviewer
    - 远程桌面
    - ToDesk
pinned: false
title: "RustDesk 自建服务器部署和使用教程"
date: 2024-05-11T05:04:19.191Z
lastmod: 2024-05-11T05:04:19.191Z
description: RustDesk 是功能强大的开源远程桌面软件。本文深入剖析其架构，手把手教你自建 ID Server 和 Relay Server，摆脱地域限制，享受量身定制的安全私密的远程访问体验。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels:
    - h2
    - h3
    - h4
tags:
    - RustDesk
categories:
    - tech-social
---

[RustDesk](https://github.com/rustdesk/rustdesk) 是一个强大的开源远程桌面软件，是**中国开发者**的作品，它使用 Rust 编程语言构建，提供安全、高效、跨平台的远程访问体验。可以说是目前全球最火的开源远程桌面软件了，**GitHub 星星数量达到了惊人的 64k！**

![](https://images.icloudnative.io/uPic/2024-05-11-13-25-gNBjJ6.jpg)

与 TeamViewer、ToDesk 等专有远程访问解决方案相比，RustDesk 作为一个开源软件，提供了几个显著的优势：

1. RustDesk 完全免费使用，没有任何隐藏费用或订阅计划。
2. 由于其开源特性，RustDesk 的代码是透明的，可以由社区审计，从而提供更高的安全性和可信度。
3. RustDesk 使用 Rust 语言开发，从根本上确保了程序的内存安全和高性能。

然而现在有一个坏消息：**由于被诈骗分子频繁使用，该项目现已暂停国内服务。**

作者原话：

> **为了进一步应对诈骗，我们暂时决定停止中国地区的服务，如果用户现在通过公共服务器访问国内主机，将会收到被禁止的消息。**

官网首页也挂出了警告信息：

![](https://images.icloudnative.io/uPic/2024-05-11-13-25-r2xpdA.jpg)

[作者在开源中国上发布了公告](https://www.oschina.net/news/291123)，主要是因为**诈骗分子通过短信链接的方式让老人下载 App，然后实施手机银行的指挥操控**，受害者被骗金额巨大，对家庭造成极大的损害。

![](https://images.icloudnative.io/uPic/2024-05-11-13-26-mtWGiM.jpg)

**为了进一步应对诈骗，他们暂时决定停止中国地区的服务，如果用户现在通过公共服务器访问国内主机，将会收到被禁止的消息**。

只能说很无奈。

好在 RustDesk 有一个很关键的特性就是它**允许用户自建服务器**，从而在使用 RustDesk 时获得更多的控制权和隐私保护。所谓自建服务器，也就是自建 ID Server 和 Relay Server，至于什么是 ID Server 和 Relay Server，下面我们会给大家详细介绍，并提供一步步的指南来帮助你设置自己的 ID Server 和 Relay Server。

## RustDesk 架构概述

要理解自建服务器的重要性，首先需要对 RustDesk 的架构有一个全面的了解。RustDesk 采用了经典的客户端-服务器模型，其中涉及三个主要组件：RustDesk 客户端、RustDesk 服务器和 ID Server。

![](https://images.icloudnative.io/uPic/2024-05-11-13-26-hLxirr.png)

1. **客户端-服务器模型**

     在 RustDesk 的架构中，客户端是运行在用户设备 (如笔记本电脑、平板电脑或智能手机) 上的应用程序。它提供了一个图形界面，允许用户发起远程访问请求并与远程计算机进行交互。另一方面，服务器组件运行在要远程访问的目标计算机上。它负责监听来自客户端的连接请求，并在建立连接后向客户端发送屏幕更新和接收输入事件。

2. **ID Server 的角色**

     ID Server 在 RustDesk 的生态系统中扮演着重要的角色。它的主要职责是促进客户端和服务器之间的初始连接建立。**当 RustDesk 服务器启动时，它会连接到 ID Server 并注册自己，提供如服务器 ID 和公网 IP 地址等信息**。类似地，当客户端想要连接到特定的 RustDesk 服务器时，它会向 ID Server 查询目标服务器的连接信息。

    **ID Server 维护了一个已注册的 RustDesk 服务器目录，并充当客户端和服务器之间的中介，帮助它们建立直接的点对点 (P2P) 连接**。一旦客户端从 ID Server 获得了服务器的连接信息，它就可以尝试直接连接到服务器，而无需进一步通过 ID Server 中继数据。

3. **Relay Server 的角色**

   在某些网络环境下，RustDesk 客户端和服务器可能**无法直接建立 P2P 连接**，例如当它们位于 NAT (网络地址转换) 或防火墙后时。为了克服这一挑战，RustDesk 引入了 Relay Server。

   **如果客户端无法直接连接到服务器，它会向 ID Server 请求一个 Relay Server。然后，客户端和服务器都连接到指定的 Relay Server，并通过它来中继所有的网络通信**。Relay Server 在这种情况下充当客户端和服务器之间的桥梁，转发来自一方的数据包到另一方。

   值得注意的是，即使通过 Relay Server 进行通信，RustDesk 也会维护端到端加密，确保中继服务器无法访问明文数据。Relay Server 只是盲目地转发加密的数据包，而不能查看或修改其内容。

## 自建服务器

RustDesk ID Server 与 Relay Server 目前支持多种方式部署，可以在 Linux 和 Windows 中使用二进制直接部署，也可以使用 Docker 部署，具体可参考 [RustDesk 的官方文档](https://rustdesk.com/docs/zh-cn/self-host/rustdesk-server-oss/install/)。

如果您不想折腾，或者不懂什么 Docker 之类的，那也没关系，[Sealos 应用商店](https://sealos.run/docs/guides/templates/)提供了一键部署的应用模板，点一下鼠标即可完成部署，非常丝滑。

由于 RustDesk 是使用 Rust 编写的，所以非常高效，并发也很强，实际测试下来，**1C1G 的配置就可以给一整个小型团队使用了**。Sealos 的应用模板**默认给了最小配置 0.2C128M，个人使用完全足够了**。如果您需要给多个人使用，可以随时调整配置，因为 Sealos 是按量付费的，你想怎么调就怎么调，想什么时候调就什么时候调，非常酸爽。

我们再来看看大家比较关心的价格：

![](https://images.icloudnative.io/uPic/2024-05-11-13-26-G71qc7.png)

默认最小配置每天只需要 0.12 元，根据按量付费的机制我们还可以更省钱。所谓按量付费，就是用多少付多少，这里的 “用多少” 指的是你用了多少 CPU、内存、存储等资源，那么如果我不用的时候把它暂停，用的时候再启动，**每天只需要 0.01 元** (因为暂停状态下不占用 CPU 和内存，只占用存储)。

如果你是整个团队在使用，不想频繁的暂停和启动，也可以通过别的办法来省钱，比如**设置一个定时任务，白天开启，夜里暂停**，也可以省一半的钱。

再加上外网端口的费用，**每天预计花费在 0.1~0.2 元之间**。

好，说完了价格，如果你心动了，或者觉得可以一试，那么接着往下看教程。

直接打开 RustDesk 应用模板：

<figure><a href="https://bja.sealos.run/?openapp=system-template%3FtemplateName%3Drustdesk" target="_blank">
    <img loading="lazy" class="my-0 rounded-md nozoom" src="https://cdn.jsdelivr.net/gh/labring-actions/templates@main/Deploy-on-Sealos.svg" alt="图片描述: Deploy-on-Sealos.svg">
</a></figure>

然后点击右上角的 “去 Sealos 部署”。

> 如果您是第一次使用 [Sealos](https://sealos.run/)，则需要注册登录 Sealos 公有云账号，登录之后会立即跳转到模板的部署页面。

跳转进来之后，你会看到有一个变量 ENCRYPTED_ONLY，你可以选择 1 或者 0。为了隐私和安全，强烈建议选择 1，这样就**开启了强制加密，只允许建立加密连接，不容易被别人白嫖**。

设置完成后，点击右上角的 “部署应用” 开始部署，部署完成后，直接点击应用的 “详情” 进入该应用的详情页面。

![](https://images.icloudnative.io/uPic/2024-05-11-13-26-nEh2CF.jpg)

点击 “日志” 按钮查看日志：

![](https://images.icloudnative.io/uPic/2024-05-11-15-35-tiNvMe.jpg)

日志中可以找到两个关键信息：**外网域名**和**公钥**。后面需要用到。

![](https://images.icloudnative.io/uPic/2024-05-11-15-35-xSvMgE.jpg)

在 “应用商店”-> “我的应用” 中找到 RustDesk，点进去：

![](https://images.icloudnative.io/uPic/2024-05-11-15-45-qGNFy8.jpg)

在 Others 中分别找到 21116 端口和 21117 端口映射的外网端口，21116 是 ID Server 的端口，21117 是 Relay Server 的端口。例如我这里的 ID Server 外网端口就是 30032，Relay Server 外网端口是 30325。

![](https://images.icloudnative.io/uPic/2024-05-11-15-45-8BIGtu.jpg)

## 客户端设置

分别在控制端和被控制端的电脑安装 RustDesk，下载地址：**https://rustdesk.com/zh/**

安装完成后，打开 RustDesk，点击上面的三个点，进入配置：

![](https://images.icloudnative.io/uPic/2024-05-11-15-46-68yCUy.png)

找到网络配置：

![](https://images.icloudnative.io/uPic/2024-05-11-15-47-T4rsP6.jpg)

先解锁网络设置，然后在 ID 服务器中输入你的 `<外网域名>:<ID Server 外网端口>`，在中继服务器中输入你的 `<外网域名>:<Relay Server 外网端口>`，在 Key 中输入你的公钥。

例如我这里的 ID 服务器就是 `brffleiu.bja.sealos.run:30032`，中继服务器是 `brffleiu.bja.sealos.run:30325`，Key 是 `LNS+q8OA02k7CH+TbzO1EzikNYsFS52YiMNi3pmz56k=`。

![](https://images.icloudnative.io/uPic/2024-05-11-15-47-kpMfPV.jpg)

最后点击 “应用” 就可以了。

> ⚠️ 注意：**控制端和被控制端都设置使用相同的 ID 服务器、中继服务器和 Key**，才能正常进行远程控制。

## 总结

本文深入探讨了 RustDesk 的架构、自建 RustDesk 服务器（ID Server 和 Relay Server）的好处以及具体的自建步骤，虽然需要一点额外的工作，但收获了很多好处，比如安全性和隐私性。

随着远程工作和协作变得越来越普遍，拥有一个安全、高效、灵活的远程访问解决方案变得至关重要。通过自建 RustDesk ID Server 和 Relay Server，你可以获得一个量身定制的解决方案，以满足你独特的需求。