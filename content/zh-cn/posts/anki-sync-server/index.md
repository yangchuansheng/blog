---
keywords:
- Anki
- Kubernetes
- Docker
- K3s
- KubeSphere
- anki-sync-server
title: "Anki 自定义同步服务器部署与使用"
date: 2022-04-10T09:06:37+08:00
lastmod: 2024-01-02T18:06:37+08:00
description: 本文介绍了如何使用 Docker 或 Kubernetes 部署 Anki 同步服务器并配置客户端正确使用。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- Anki
- kubernetes
- Sealos
categories: tech-social
img: https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting3@main/uPic/2022-04-10-14-21-uFy94B.jpg
---

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting3@main/uPic/2022-04-10-14-07-WURNlT.png)

## Anki 介绍

Anki是一款基于间隔重复（Spaced Repetition）原理的学习软件，想象一下，你的大脑就像是一个需要定期维护的精密仪器。间隔重复就好比是一种精准的维护计划，它通过在最佳时刻复习信息，来确保知识在你的脑海中牢固地扎根。

Anki 软件使用这个原理，帮助用户通过创建“卡片”来学习和记忆信息。所谓的卡片，专业说法叫 Flash Card（抽认卡或闪卡），是一小块纸片，分为正反两面，将问题和提示写在一面，将答案写在另一面。使用方法就是先看正面的问题与提示，在脑中回想答案，然后翻出反面进行对照验证。如果你很容易记住某张卡片的内容，Anki会增加下次复习这张卡片的时间间隔；反之，如果你觉得某张卡片比较难记，Anki会缩短这张卡片的复习间隔。

这种方法特别适用于需要记忆大量信息的领域，如语言学习、医学、法律等。

给大家看下我制作的闪卡：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting3@main/uPic/2022-04-10-10-52-H2ZWUZ.png)

每张卡片只有一个英文单词，与之配套的是该单词的音标、发音、图片、英文解释、例句。**所有的版块都是英文，绝对不要出现中文！** 卡片的核心是图片和例句，通过图片可以猜到这个单词大概是什么意思，通过例句可以验证自己对单词意思的猜测是否正确，如果还不放心，可以看下英文解释，这一套流程下来绝对可以正确理解单词的意思，**完全不需要中文的干涉，这才是学习英文单词最完美的方式**。

即便如此，大家在熟悉单词的过程中可能还会有一个误区，比如上面这个单词，你在学习的过程中可能会忍不住去想这个单词在中文里究竟是什么意思，甚至可能会在心里默念它的中文意思，即使你看了图片和英文解释，你心里可能还会忍不住去想：哦，这是转瞬即逝的意思。建议大家最好不要这么做，而是直接看这张图片，然后用心去体会：**哦，大概就是这么一种感觉，对对对**。你能 get 到这个单词所表达的那种感觉就行了，不要再去思考如何用中文来描述它，那样反而吃力不讨好。

----

下面言归正传，相信有很多小伙伴和我一样在使用 Anki 来学习英文单词或者其他的知识，但是 Anki 的同步服务器在国外，还是一个个人项目，带宽很小，同步速度很慢，如果我们想在多个客户端之间同步学习进度和新增的知识点，那将非常痛苦。

为了解决这个问题，我们需要部署一个自定义的同步服务器，然后让客户端去使用这个同步服务器。

## Anki 同步服务器部署

自从 2023 年 2 月份，Anki 发布了 PC 端 2.1.57 版本以后，Anki 的 PC 端，安卓端，iOS 端用户都可以自定义同步服务器了，并且不再需要安装插件。从此 Anki 小伙伴再也不用担心 Anki 同步的问题了，困扰 Anki 用户多年的同步问题终于得到彻底解决。

自 PC 端 2.1.57 版本以后，Anki 官方推出了镶嵌在 Anki 客户端的同步服务端和通过 Python 安装的同步服务端。

我选择使用镶嵌在 Anki 客户端中的同步服务端，因为它是用 Rust 写的啊，**人生苦短，我不用 Python**。

但是官方并没有提供 Docker 镜像，于是我选择自己构建 Docker 镜像，项目地址：

+ [https://github.com/yangchuansheng/anki-sync-server](https://github.com/yangchuansheng/anki-sync-server)

部署方法就非常简单了，你可以选择使用 Docker 部署，也可以直接使用 Sealos 应用模板一键部署，**不用操心域名和证书等各种乱七八糟的事情，有手就行**。

直接点击下面的按钮跳转到 Sealos 的应用模板部署界面：

<figure><a href="https://bja.sealos.run/?openapp=system-template%3FtemplateName%3Danki-sync-server" target="_blank">
    <img loading="lazy" class="my-0 rounded-md nozoom" src="https://cdn.jsdelivr.net/gh/labring-actions/templates@main/Deploy-on-Sealos.svg" alt="图片描述: Deploy-on-Sealos.svg">
</a></figure>

> 如果您是第一次打开 [Sealos](https://sealos.run)，需要先注册登录账号。

然后点击「部署应用」按钮开始部署。部署完成后，点击「详情」进入应用的详情页面。

这里可以看到实例的运行状态，一定要等到状态是 running 才算是部署成功。如果一段时间以后状态还不是 running，可以点击「详情」查看故障原因：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/2024-01-02-20-43-L7tjlP.png)

部署成功后，可以看到应用的运行情况，包括 CPU 占用、内存占用等。外网地址就是同步服务器的公网域名。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting5@main/uPic/2023-06-26-13-09-YFHPYc.png)

## 客户端设置

### 桌面端

桌面客户端（macOS/Windows/Linux）配置方法如下：

1. 先打开「首选项」

   ![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting5@main/uPic/2023-06-26-12-24-QHYKZt.png)

2. 点击「**网络**」，往下看，可以看到标有 `self-hosted sync server(自定义同步服务器)` 的方框，在里面填写您的服务端的地址：

   ![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting5@main/uPic/2023-06-26-12-26-HYOaBJ.png)

3. 重启 Anki，然后点击「**同步**」：

   ![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting5@main/uPic/2023-06-26-12-28-ccnUOj.png)

4. 这时候会弹出一个输入框让你输入用户名和密码，你需要将你之前设置的用户名和密码输入进去：

   ![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting5@main/uPic/2023-06-26-12-29-z5E9gi.png)

5. 点击确认后，就会开始同步了。


### 安卓端

安卓端也是直接配置即可，我的 AnkiDroid 版本是 `2.15.6`。你可以通过「设置 -> 高级设置 -> 自定义同步服务器」找到配置页面。

<img style="width: 400px;" src="https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting3@main/uPic/2022-04-10-14-31-vrNHJU.png">

再填写用户名和密码：

> 设置 -> 常用设置 -> AnkiWeb账户

这样就算配置完成了，所有的牌组都同步过来了。

<table><tr>
<td><img style="width: 400px;" src="https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting3@main/uPic/2022-04-10-14-32-ADfk8T.png"></td>
<td><img style="width: 400px;" src="https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting3@main/uPic/2022-04-10-14-32-1iudM0.png"></td>
</tr></table>
官方的版本实在是太老了，如果你想使用更激进的社区版本，可以到这个页面下载最新的 Beta 版：

+ [https://github.com/ankidroid/Anki-Android/releases](https://github.com/ankidroid/Anki-Android/releases)

建议下载 **arm64-v8a** 版本。

安装完成后，可以通过「设置 -> 同步 -> 自定义同步服务器」找到配置页面：

<img style="width: 400px;" src="https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting5@main/uPic/2023-06-26-12-39-1jsF0t.jpeg">

再填写用户名和密码：

> 设置 -> 同步 -> AnkiWeb账户

### iOS 端

AnkiMobile 也已经支持和自建的同步服务器同步了。至少对于版本 Ankimobile 2.0.90(20090.2) 来说，似乎是可行的，这是一位 iOS 系统用户[在 Anki 论坛报告的](https://forums.ankiweb.net/t/ankimobile-self-sync-server-failure-the-one-bundled-in-version-2-1-60-qt6/27862)。

如果设置完成后发现不能同步可以参考下面的内容再试一次：

> If you're using AnkiMobile and are unable to connect to a  server on your local network, please go into the iOS settings, locate  Anki near the bottom, and toggle "Allow Anki to access local network"  off and then on again.

上面的内容摘自 [ANki tutorial](https://docs.ankiweb.net/sync-server.html#client-setup)

## 题外话

大家如果对我的卡片模板比较感兴趣，可以扫码关注公众号：

<img style="width: 200px;" src="https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting5@main/uPic/00022-1916295141.jpg">

后台聊天框发送暗号 **anki**，即可获取我的卡片+模板。