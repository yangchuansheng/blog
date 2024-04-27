---
keywords:
- ChatGPT
- OpenAI
- GPT-4
- gpt4free
- gpt4free-ts
- Sealos
- forefront
- RapidAPI
title: "使用 gpt4free-ts 完全免费白嫖 GPT-4"
date: 2023-06-07T22:06:37+08:00
lastmod: 2023-06-07T22:06:37+08:00
description: 完全免费白嫖 GPT-4 的终极方案。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- ChatGPT
- Sealos
- gpt4free
categories: AI
img: https://images.icloudnative.io/uPic/2023-06-07-00-45-IMHpwX.jpg
meta_image: https://images.icloudnative.io/uPic/2023-06-07-00-43-7RAoGE.jpg
---

![](https://images.icloudnative.io/uPic/2023-06-07-00-43-7RAoGE.jpg)

{{< alert >}}
该方案目前已失效！请直接使用👉 [gptgod](https://gptgod.online/#/register?invite_code=46rrqz6qzscsey1jci7sdjw95)
{{< /alert >}}

GPT-4 目前是世界上最强的多模态大模型，能力甩 GPT-3.5 好几条街。

大家都希望早日用上 GPT-4，不过目前体验 GPT-4 的渠道非常有限，要么就是开通 ChatGPT 尊贵的 Plus 会员，即使你开了会员，也是有限制的，**每 3 小时只能发送 25 条消息。。。**

要么就去 OpenAI 官网申请 GPT-4 的 API，但是目前申请到 API 的小伙伴非常少，你以为申请到 API 就可以用了吗？GPT-4 的 API 价格超级无敌贵，**是 GPT-3.5 价格的 30 倍**，你敢用吗？😄

然而，但是，既然我写了这篇文章，肯定是要告诉那一个**惊天大幂幂**的！

现在完全免费白嫖 GPT-4 的机会来了，不仅可以白嫖，还可以直接作为 API 来调用！

不仅能够作为 API 调用，我还接入了公众号给大家白嫖，你说气人不气人？

![](https://images.icloudnative.io/uPic/2023-06-07-12-28-IZ0DLp.jpg)

如果你嫌下面太长不看，可以直接到公众号里去白嫖 GPT-4 👇

<image width="300px" src="https://images.icloudnative.io/uPic/2023-06-07-12-29-imCWj4.jpg">

下面言归正传，开始**手把手教大家如何免费白嫖 GPT-4**。

## gpt4free-ts 介绍

[GPT4Free](https://github.com/xtekky/gpt4free) 大家应该都知道吧？它上线几周就在 GitHub 上揽收了接近 4w 的 Star。原因就在于其提供了对 GPT-4 及 GPT-3.5 免费且几乎无限制的访问。该项目通过对各种调用了 OpenAI API 网站的第三方 API 进行逆向工程，达到使任何人都可以免费访问该流行 AI 模型的目的。

这就相当于什么？**假设地主家有一个粮仓，你往他家的粮仓偷偷插了一根管子，不停地向外抽米，他全然不知，所以你也不用交钱，一切费用由地主承担**。

现在**接入 GPT-4 的第三方网站就相当于那个地主**，懂了吧？

但是这个项目并没有封装 API，而且目前也不太能用了。

作为开发者，我们想要的肯定是 API 啊！这就要提到今天的主角了：[gpt4free-ts](https://github.com/xiangsx/gpt4free-ts)

这个项目是用 TypeScript 写的，相当于 GPT4Free 的 TypeScript 版本，但是更方便部署，而且封装了 API，简直就是开发者的福音，就他了！

这个项目向多个地主家的粮仓插了管子，其中最强大的地主就是 [forefront.ai](https://chat.forefront.ai/)，这个地主家的粮仓里就包含了 GPT-4 这个香饽饽，而且还有 Claude，就嫖他了！

除了 forefront 之外，它接的粮仓还挺多的。。

![](https://images.icloudnative.io/uPic/2023-06-07-12-11-64GVTy.png)

## 大批量注册临时邮箱

forefront 的 GPT-4 模型是有限制的，**每个账号每 3 小时内只能发送 5 条消息**。

所以接下来需要用到一个非常神奇的服务叫 [RapidAPI](https://rapidapi.com/calvinloveland335703-0p6BxLYIH8f/api/temp-mail44)。**你可以通过这个 API 来获取无穷无尽的临时邮箱，然后再用这些无穷无尽的临时邮箱去注册无穷无尽的 forefront 账号。**

这么一说，你是不是就悟了？哈哈哈

首先你需要在这里注册一个账号并登录：**https://rapidapi.com/calvinloveland335703-0p6BxLYIH8f/api/temp-mail44**

然后需要在 Pricing 页面开启订阅：

![](https://images.icloudnative.io/uPic/2023-06-07-12-14-CYBlHv.png)

一般情况下订阅免费套餐即可，一天可以调用 100 次。

如果你有更高的需求，可以考虑订阅更高级的套餐（比如你的用户数量特别多）。

订阅完了之后，你就能看到 API Key 了。这个 Key 我们后面会用到。

![](https://images.icloudnative.io/uPic/2023-06-07-12-14-w7Y94V.png)

## Sealos 云操作系统介绍

单机操作系统大家应该都知道吧？Windows、macOS、Linux 这些都属于单机操作系统，为什么叫单机操作系统呢？因为他的内存啊，CPU 啊，都在一台机器上，你不可能用其他机器的内存和 CPU。

那么什么是云操作系统呢？就是**把一群机器的 CPU 和内存看成一个整体**，然后给用户提供一个交互界面，用户可以通过这个交互界面来操作所有的资源。

懂 K8s 的玩家可能要说了：这个我懂，K8s 就可以！

如果我们的目标愿景是一个云操作系统，**K8s 充其量只能是这个云操作系统的内核**，就像 Linux 内核一样。完整的云操作系统需要一个像 Windows 和 Ubuntu 操作系统那样的交互界面，也就是**操作系统发行版**。

**对于云操作系统来说，Sealos 就是那个发行版。**

> 链接：**https://cloud.sealos.io**

![](https://images.icloudnative.io/uPic/2023-06-07-12-14-RxSEYh.jpg)

有人可能会把云操作系统理解成“**Web 界面**”，但其实不是，Sealos 云操作系统完全是类似于 Windows 和 macOS 桌面的那种逻辑，并不是 Web 界面。我只需要点几下鼠标，一个应用就装好了，老夫并不知道什么容器什么 K8s。

数据库也一样，小鼠标一点，一个分布式数据库就装好了。

我知道，这时候云原生玩家要坐不住了，您别着急，看到桌面上的终端了没？

![](https://images.icloudnative.io/uPic/2023-06-07-12-14-SI9WmQ.jpg)

终端只是这个云操作系统中的一个 App 而已。同理，**容器管理界面仍然可以作为云操作系统的 App，我管你是 Kubernetes Dashboard、Rancher、KubeSphere 还是 Kuboard，都可以作为 App 装在这个云操作系统中**。这时候对于云原生专家而言，仍然可以命令行咔咔秀操作，也可以通过各种管理界面来管理容器。

云操作系统嘛，就是要什么人都能用才行，**不管你是什么角色，都能在这个操作系统里找到你想要的 App 去完成你的使命**。

## 安装 gpt4free-ts

接下来才是这篇文章的重头戏。

我要教大家如何**在 Sealos 中点几下鼠标就能安装一个 gpt4free-ts 集群**。

没错，就是 gpt4free-ts 集群。

什么叫集群？就是说我要运行一群 gpt4free-ts 实例，然后前面加一个负载均衡作为对外的 API 入口。

下面的步骤非常简单，**楼下的老奶奶都会，是真的，当时我就在楼下看她操作**。

首先进入 Sealos 云操作系统的界面：**https://cloud.sealos.io**。

然后打开桌面上的应用管理 App：

![](https://images.icloudnative.io/uPic/2023-06-07-12-14-lrX8qC.jpg)

点击「新建应用」：

![](https://images.icloudnative.io/uPic/2023-06-07-12-14-aovyMy.jpg)

在启动参数中，按照以下方式进行设置：

+ 应用名称随便写，比如 gpt4free。
+ 镜像名称是：**xiangsx/gpt4free-ts:latest**。实际上这个镜像是有问题的，**为了避免 forefront 的追杀，作者故意用最新的镜像来迷惑敌方**，所以一般情况下我们需要使用上一个版本的镜像。如果你还听不懂我在说什么，请跳转到文章末尾加入微信群进行进一步深切友好的交流！
+ CPU 和内存需要根据应用的实际情况来填写。这个应用运行之后默认会启动两个 Chrome 浏览器来模拟登录 forefront，每次对话会从里面取一个账号来使用，次数用完了会自动注册新账号（因为每个账号每 3 小时只能发送 5 条信息）。**我们可以通过环境变量来修改启动的浏览器数量，所以需要根据你的浏览器数量来确定 CPU 和内存。** 我自己把浏览器数量设置为 3，所以需要的内存和 CPU 比较多（后面会告诉你怎么设置环境变量）。
+ 实例数根据自己的实际需求填写，我需要接入公众号，粉丝比较多，一个实例才 3 个账号（因为我一个实例跑了 3 个浏览器），根本不够用，所以我开了 3 个实例。
+ 容器暴露端口指定为 3000。
+ 打开外网访问。

![](https://images.icloudnative.io/uPic/2023-06-07-12-14-UykhCA.png)

继续往下，展开高级设置，点击「编辑环境变量」：

![](https://images.icloudnative.io/uPic/2023-06-07-12-15-Uti7G5.png)

填入以下环境变量：

```bash
rapid_api_key=<rapid_api_key>
DEBUG=0
POOL_SIZE=3
```

> ⚠️注意：请将 <rapid_api_key> 替换为你自己的 key。

其中 POOL_SIZE 就是浏览器数量，每个浏览器会登录一个 forefront 账号。你可以根据自己的需要调整浏览器数量，并根据浏览器数量调整 CPU 和内存。**如果你不知道怎么调整合适，建议无脑跟着本文操作。**

![](https://images.icloudnative.io/uPic/2023-06-07-12-09-efWkQF.png)

继续，点击「新增存储卷」：

![](https://images.icloudnative.io/uPic/2023-06-07-12-15-ecn1g5.png)

容量只需 1G，挂载路径设置为 `/usr/src/app/run`：

![](https://images.icloudnative.io/uPic/2023-06-07-12-15-IAg1bN.png)

> 这个存储的作用是为了保存已登录的账号。已经注册的账号 3 个小时以后还可以重新使用，不用再浪费邮箱去注册新账号。

最终点击右上角的「部署应用」，即可完成部署：

![](https://images.icloudnative.io/uPic/2023-06-07-12-15-Sc2WpV.png)

最终要等待所有的实例都处于 Running 状态，才算是启动成功了。

![](https://images.icloudnative.io/uPic/2023-06-07-12-15-2MaeDA.png)

点击右边的复制按钮，便可复制 API 的外网地址：

![](https://images.icloudnative.io/uPic/2023-06-07-12-17-xuKZje.png)

我们来测一下这个 API：

![](https://images.icloudnative.io/uPic/2023-06-15-14-49-9EEtRo.png)

完美！打完收工！

## 白嫖 Sealos

Sealos 默认会给新注册的用户赠送 5 个大洋，如果你想白嫖更多的额度，可以参加这个活动薅羊毛：[Sealos Grant，开源社区激励](https://forum.laf.run/d/678)。

活动规则很简单，直接看图👇

![](https://images.icloudnative.io/uPic/2023-06-08-12-11-fW6ZYE.jpg)

## Sealos 贵宾交流群

如果您是 Sealos 的用户，欢迎扫码加入 Sealos 的用户交流群👇

<image width="300px" src="https://oss.laf.run/htr4n1-images/sealos-qr-code.jpg">