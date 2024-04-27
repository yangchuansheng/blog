---
keywords:
- HTTPie
- GitHub
- Watcher
- Star
- 八爪鱼
- 微软
title: "HTTPie 是如何丢失 5.4 万 Star 的"
date: 2022-04-17T09:06:37+08:00
lastmod: 2022-04-17T09:06:37+08:00
description: HTTPie 作者因为失误导致 HTTPie 项目的 Star 数量归零了，本文介绍了本次事件的来龙去脉。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- HTTPie
- GitHub
categories: tech-social
img: https://images.icloudnative.io/uPic/2022-04-17-13-12-8VgFHO.png
---

> 原文链接：[How we lost 54k GitHub stars](https://httpie.io/blog/stardust)

**出大事了，一个非常知名的开源项目 Star 数量一夜之间归零了**🤣

这个项目就是 [HTTPie](https://github.com/httpie/httpie)。

HTTPie 官方专门写了一篇博客反省这次的操作，介绍了本次事件的来龙去脉。原文翻译如下：

----

[本人于 2012 年在 GitHub 上第一次提交 HTTPie 项目代码](https://github.com/httpie/httpie/commit/b966efa17)，如今已过去了 10 个年头。

HTTPie 是一款开源的命令行 HTTP 客户端，没有借助第三方库，从头开始构建，旨在使终端工具与 API 的交互更加人性化。

## 获得 5.4 万 Star

2012 年 2 月 25 日，我当时在哥本哈根，那天下着大雨，我在 GitHub 上公开发布了 HTTPie 的第一个版本。

自从几年前我加入 GitHub 的会员后，我就一直是它的粉丝（**经常穿八爪鱼 logo 的 T 恤到处晃荡的那种**）。那一天 [GitHub 的 about 页面](https://web.archive.org/web/20120202143615/https:/github.com/about)大张旗鼓地宣称他们获得了 0.00 美元的风险投资基金，并表示他们的旧金山办公室里准备了很多美味的啤酒来欢庆此事。

因此，当我意识到可能会有很多开发者像我一样需要经常和 API 或者 Web 服务器进行交互时，把 HTTPie 的代码开源在 GitHub 上是一个明智的选择。

当 HTTPie 第一次成为 Hacker News 热门链接时，我的心情无比激动，那一天至今还历历在目。后来我又见证了 GitHub 社区的成立。随着我们不断对项目进行优化，吸引到的用户越来越多，以至于 HTTPie 变成了 GitHub 上最受欢迎的 API 工具，鼎盛时收获了 **54k** 的 Star 和 **1000+** 的 Watcher。

![](https://images.icloudnative.io/uPic/2022-04-16-21-12-f8Nw3R.png)

你想想，**GitHub 上总共有 [2.89 亿个公共仓库](https://github.com/search)，要想在其中闯出一片天地是多么地艰难**。可 HTTPie 还是凭借自身的实力变成了 GitHub 上最受欢迎的**前 80** 个公共仓库之一，处于 99.99997203 百分位。简而言之，看到这个不起眼的命令行工具吸引了如此庞大的用户群体，真是难以置信，而 GitHub 肯定在这个过程中发挥了举足轻重的作用。

虽然我们从 GitHub 的“通过同性交友来协作编程”功能中受益良多，但 GitHub 也从 HTTPie 项目中捞到了很多好处，过去十年可能有数百万的开发者访问了我们的 GitHub 页面，这对于 GitHub（微软）这样一家非常关心开源和社区的公司来说，无异于如虎添翼。我们与 GitHub 是互惠互助的关系。

## 痛失 5.4 万 Star

然而意想不到的悲剧发生了，如果你之前是该项目的 Watcher，很遗憾，从几周前开始您就不是了。如果您之前给该项目点过小星星（Star），现在应该也失效了。万万没想到啊，你猜发生了什么？

### 发生了什么？

**由于一连串不幸的操作，我一不小心就把项目的仓库设为私有仓库，这个骚操作让 GitHub 连带删除了我们花 10 年时间建立起来的社区！心碎至极 💔**

![](https://images.icloudnative.io/uPic/2022-04-16-21-36-8FESWs.png)

### 什么后果？

这意味着什么呢？如果您是下游的维护者（maintainer）或者以前 watch 过 HTTPie 项目以及时获取通知的人，现在需要重新 Watch 该项目。如果您之前给该项目点过小星星（Star），现在也需要重新关注一遍。

### 我怎么就把仓库设为私有了？？

说句不好听的，GitHub 有一个让人无法理解的特性，你只要将公共仓库设为私有，该仓库的 Watcher 和 Star 就会被永久删除。当然重点不在这里，我肯定是知道 GitHub 的这个特性的，我也并没有打算把该仓库设为私有，但是悲剧还是发生了，为啥呢？

![](https://images.icloudnative.io/uPic/2022-04-16-21-51-ZCfZsc.png)

事情的经过是这样的，前段时间 GitHub 不是推出了“**个人主页**”功能嘛，要想激活此功能，只需要新建一个与自己 ID 同名的仓库，这个新仓库的 `README.md` 的内容便会显示在你的个人首页。我也创建了一个这样的仓库 `jakubroztocil/jakubroztocil`，然后我做了一个骚操作：**把这个仓库从公共仓库设为私有仓库**。

这个操作看起来也没有什么问题，问题还在后面。

**然后我的大脑就开始意淫，想着将 httpie 这个组织的主页仓库也设置成私有仓库。我的 ID 是 jakubroztocil，那我的个人主页仓库就是 `jakubroztocil/jakubroztocil`；我创建的这个组织是 httpie，那这个组织的首页仓库就是 `httpie/httpie`，我脑中这么思量着，手也没停下，就将 `httpie/httpie` 设为了私有仓库。。。我被自己蠢哭了**😭

我这么意淫是有原因的，当涉及到配置文件和仓库时，GitHub 的概念模型会将用户和组织视为非常相似的实体。我已经在个人仓库中做过这种操作，然后我带着这种认知想要在组织中也这么操作，于是我的大脑就开启了自动驾驶模式。。。

现在我知道了，要想自定义 GitHub 组织的主页，需要新建的仓库名称是 `name/.github`，而不是 `name/name`。对于 httpie 组织而言，这个仓库是 `httpie/.github`，而不是 `httpie/httpie` 🤣

### 有没有最终确认的选项？

**确实有一个最终确认的选项。**

这个选项就是为了防止我这样的用户脑子一热做傻事而设计的。它会警告你 “**You will permanently lose all stars and watchers of this repository.**”，即你将失去该仓库的所有 Watcher 和 Star。

问题在于，无论是没有任何 Watcher 和 Star 的仓库，还是拥有 55k Star 和 Watcher 的仓库，这个最终确认的提示框都是一模一样的。

这就好比什么呢？打个比方，假设你要拆一座房子，然后出现一个提示框警告你：**你将要拆掉这座房子，如果房子有人，他们都会死的**。问题来了，如果你混淆了地址，把这个“里面有人”的房子当成你另外一个地方的空房子，就不会重视这个提示，心想：反正里面没人，拆就拆呗。

下面的两个提示中，你能看出哪一个是提示你即将删除一个活跃了 10 年的社区吗？

![](https://images.icloudnative.io/uPic/2022-04-16-22-26-wWLsir.png)

完全看不出来呀。我觉得 GitHub 的这个提示框应该设计地更人性化一点，如果你警告我说：**你即将干掉 55000 个人**，那我肯定会被吓到，并停止我的愚蠢操作。

### 追悔莫及

我做完这个骚操作后回到组织的首页仍然能看到一个空的 README（因为没有将 `httpie/.github` 这个仓库设为私有，且该仓库是空的），而且 HTTPie 仓库也不见了，你可以想象到我当时有多懵逼。过了好半天我才真正意识到发生了什么，于是重新回到 HTTPie 仓库将其设置为公共仓库，但 GitHub 在接下来的半个小时内都不允许我这样做。

![](https://images.icloudnative.io/uPic/2022-04-16-22-35-wcN0QV.png)

**原因是 GitHub 正在“帮助”我级联删除该仓库的 Star 和 Watcher，在 Star 和 Watcher 归零之前，我都无法停止这个操作。**

我当时那个后悔呀，急忙给 GitHub 的支持团队写邮件，并不停刷新页面等待 Star 和 Watcher 数量归零，然后才能再次将其设为公共仓库。

### 为什么 GitHub 不愿意帮我？

**我敢肯定，GitHub 肯定是有备份的**。这个备份可以挽回因为不小心将仓库设为私有的损失。GitHub 团队曾经就不小心把 [GitHub 桌面应用的仓库](https://github.com/desktop/desktop)设为私有仓库，然后在短短几个小时内便恢复如初。以下是 [GitHub 的 CEO 对此次乌龙事件的解释](https://twitter.com/natfriedman/status/1328410589291446274)。

![](https://images.icloudnative.io/uPic/2022-04-16-22-45-LJ8jVW.png)

然而对于我的项目他们却拒绝了这么做，理由是会有一定的副作用和资源成本。我们甚至向 GitHub 提出对任何所需资源提供经济补偿，但他们还是拒绝了。

所以，很遗憾，GitHub 明确表示：**虽然他们可以将误设为私有仓库的项目恢复如初，但仅限于 GitHub 自己的项目**。其他的项目最多会发个[这样的推文](https://twitter.com/github/status/1493329046708670475)来号召大家重新关注该项目。

![](https://images.icloudnative.io/uPic/2022-04-16-22-52-9WneCI.jpg)

## 吸取到的教训

这次意外让我吸取了很多教训，在此分享给大家，希望大家以后不要遇到我这样的情况。

### 教训一：UI/UX 设计

**要把用户看成“白痴”，以一种不需要让用户思考的方式来设计确认提示框**。也就是说，当用户要毁掉某样东西时，不要用抽象的词语来描述这种潜在的情况，这会让用户自然而然地翻译成自己的理解。特别是当删除操作会产生很多“级联删除”的副作用时。例如，在 [HTTPie for Desktop](https://httpie.io/product) 中，我们是这样处理的。

![](https://images.icloudnative.io/uPic/2022-04-16-23-01-DyWkkn.png)

当然，提示框要能清晰地表达出该操作产生的副作用的严重程度。如果完全没有副作用，就不要写一大堆有的没的，提示保持简洁就好。否则就会浪费用户有限的注意力，从而降低用户的敏感程度。

![](https://images.icloudnative.io/uPic/2022-04-16-23-07-95XHGi.png)

### 教训二：数据库设计

数据库尽量使用软删除（soft delete），也就是使用标记将数据标为不可用，而不从数据库删除数据本身。只要是人都会犯错误，如果实在要硬删除，那就想办法延迟删除操作的时间，给用户一点后悔的时间。

![](https://images.icloudnative.io/uPic/2022-04-16-23-12-d3s5J3.png)

### 教训三：不要过度信任 GitHub

这个失误是我们自己导致的，GitHub 明确表示他们在法律上没有义务帮助我们，我们十年来的互惠互利关系的基调是由 GitHub 的服务条款确定的，如果你还有其他的奢望，那就是痴人说梦。毕竟 [GitHub 曾经采取过有争议的行动](https://news.ycombinator.com/item?id=24872911)，违背了开源和社区的精神，公众愤怒了之后才不得不[将其恢复](https://github.blog/2020-11-16-standing-up-for-developers-youtube-dl-is-back/)。而微软（买下了 GitHub）虽然最近在拥抱开源，但[它的声誉总是不太好](https://www.reddit.com/r/OutOfTheLoop/comments/2v4ses/why_is_microsoft_so_widely_considered_evil/)，不得不让人担心。

## 更多期望

我们希望 GitHub（微软） 能改变他们的强硬态度，利用他们所有的数据库和技术手段来恢复我们这个项目的社区。同时我也期望他们能改进用户界面和数据库的设计，以防止这种悲剧发生在其他团队身上。作为读者，您也可以通过分享转载这篇文章以及重新 Star 和 Watch 我们的仓库来帮助我们。

至于我自己嘛，我可能要面壁思过一段时间了，**并且不会再穿八爪鱼 Logo 的 T 恤**。

## 后记

尽管我们的 GitHub Star 数量一夜回到了解放前，但 HTTPie 从未像现在这样做得更好。它最初只是别的项目的子项目，最近却为此成立了一家公司，我们的团队正在渐渐将 HTTPie 发展成一个 API 开发平台，这一点与用户对我们的期待完全吻合。目前 [HTTPie for Web & Desktop](https://httpie.io/product) 的私人测试版已经收到了非常积极的反馈，我们已经迫不及待想在接下来的几周内推出正式版了。

如果你想获取该项目的最新信息，欢迎加入我们的 [Discord 社区](https://httpie.io/discord)或者在 Twitter 上关注 [@httpie](https://twitter.com/httpie)。

----

截止本文完稿，HTTPie 已重新获得了 **11k** 的 Star 数量。