---
keywords:
- Windows 95
- 微软
- Windows 3.1
- MS-DOS
- Chicago 项目
- NT
- 用户界面
- 硬件支持
- 网络功能
- Win32 API
- Cougar
- Panther
- Rover
- 32 位计算
- Brad Silverberg
- OS/2
- Linux
- Jaguar
- Cougar/Panther
- VDMs (虚拟 DOS 机)
- VxDs (虚拟设备驱动)
- Windows for Workgroups 3.1
- Internet Explorer
- ISA
- PCI
title: "Windows 95 的诞生历史"
date: 2023-10-14T14:06:37+08:00
lastmod: 2023-10-14T14:06:37+08:00
description: 回到过去，重温 Windows 95 成为传奇的时刻。见证其策略、挑战和创新如何为计算的新时代奠定舞台。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- Windows
- Microsoft
- System
categories: tech-social
img: https://images.icloudnative.io/uPic/2023-10-14-16-05-GfVWZK.jpg
meta_image: https://images.icloudnative.io/uPic/2023-10-14-16-04-yYXPtm.jpg
---

原文链接：[The History of Windows 95](https://www.abortretry.fail/p/the-history-of-windows-95)

译者水平有限，不免存在遗漏或错误之处。如有疑问，敬请查阅原文。

以下是译文。

----

1992 年 2 月，Windows  3.1 的研发即将结束，而 Windows 团队正忙得不亦乐乎地计划他们的下一盘大棋。到了 3 月 5 日，他们终于悠哉悠哉地敲定了战略大计：横扫桌面、笔记本、移动设备以及时髦的触控笔设备。至于那些高大上的服务器和工作站？呵呵，那自然是留给了 NT 团队。此外，他们必须还要重点解决三个“小”问题：用户界面、硬件支持，以及网络功能。

![由 DALL·E 3 配图](https://images.icloudnative.io/uPic/2023-10-14-14-38-JspAuQ.jpg)

<center><small>由 DALL·E 3 配图</small></center>

## Windows 95 的起源与背景

90 年代的微软真是个忙碌的“工作狂”，不停地折腾新项目。仅在那个无所不包的系统部门里就陆续发布了很多产品，Windows 3.1（原名 Janus）于 4 月 6 日发布，MS-DOS 6.0（原名 Astro）于 1993 年 3 月发布，而 Windows for Workgroups 3.1（原名 Winball）于 1992 年 10 月发布。至于 Jaguar，虽然也捣鼓了一阵，但可惜最后并没有独立发布（稍后将详细介绍）。

接下来，微软又搞出了一堆帅气的项目名：Cougar、Panther、Rover、NT 和 Cairo。

+ **Cougar** 是为了搞出一个全新的 32 位 Windows 内核，也就是 Windows 3.x 的 386 模式内核的进化版本。
+ **Panther** 的任务是将 win32 API 引入这个新内核。
+ **Rover** 则是为 Cougar/Panther 设计的移动版本。
+ **NT** 代表了微软走向专业工作站和服务器领域的初步尝试，它于 1993 年 7 月亮相。
+ **Cairo** 是 NT 的升级版，它引入了 Cougar/Panther 的许多创新（反之亦然）。

这俩搭档，Cougar 和 Panther，合在一起就成了大名鼎鼎的 **Chicago**。为了使 Windows 更为稳定和高效，Chicago 的 Cougar 部分非常关键。除了全新的 32 位保护模式，它还能动态地加载或卸载设备驱动。还有，它**能让所有 MS-DOS 程序在 Windows 下愉快玩耍**，解决了 Windows 2 和 3 的“老毛病”。像是 Command and Conquer 游戏里那些大到令人头疼的地图，之前的版本可能会导致 Windows 崩溃，但这一版的 Windows 可以顺利恢复。

这些动作对于 Chicago 和整个微软公司来说都是意义非凡的。要知道，在 1992 年的时候，MS-DOS 才是微软的摇钱树呢。说到这，你们可知道 Brad  Silverberg？虽然他那时候刚刚加入微软，但这小哥的背景可不简单：他在 Apple 搞过 Lisa 项目，在 Borland 也混过。到了 1992 年初，他已经是 Chicago 项目的项目负责人，而且还是微软个个人系统部门的高级副总裁！在微软的一份内部文件中，Silverberg 写到：

> 我想明确一点，ms-dos 是我们公司的核心产品，为微软贡献了大部分的利润（也即股票价格）。而现在，它正面临来自 DR-DOS 和 IBM 的激烈竞争（我更愿意说它正在“被攻击”）。我们必须全力以赴保护这个业务。短期内，这意味着我们需要继续实施积极的营销策略。同时，我们需要每年都推出新版本，让那些竞争对手一直追在我们屁股后面，而不是我们被动地追赶。因此，我们今年计划推出 MS-DOS 的新版本，这将包含很多新功能，与此同时，我们正全力开发 cougar。

之前提到的这个新版本就是 MS-DOS 6。Silverberg 所提及的新功能包括磁盘整理、磁盘压缩、防病毒功能、全新的备份系统以及文件传输工具。MS-DOS 6 在 1993 年 3 月发布，并持续更新至 1994 年 6 月。

我这么说是想呈现出那时的微软和整个计算机行业的情境。那时，IBM 兼容的计算机数量几乎是其他所有计算机数量的 80 倍，达到了近 8000 万台。上面几乎都运行着 MS-DOS 或与之相似的 DOS 系统，而 OS/2 和 Linux 这样的系统都是稀有物种。大多数软件都在 16 位的实模式下运行。大部分的硬件配置都靠一些小开关，设置得非常精确。而要加载驱动，你得懂得 autoexec 和 load-high 这些技术工具。Windows 3 取得了很大的成功，Windows 3.1 更是如日中天。尽管取得了这样的成功，而且由于这些成功导致了微软未来计划的变动，MS-DOS 仍然在 PC 操作系统市场上有着巨大的领先优势。虽然 Windows 3x 解决了一些问题，但旧系统仍然是主流。因此，尽管 Microsoft 已经有了更先进的 NT 系统，但他们绝对不能忽视 MS-DOS 的重要性。再加上大部分家用计算机其实并不适合运行 NT。因此，Chicago 必须在中端硬件上为 win16、win32 和 MS-DOS  应用提供最佳体验，并且其改进必须明显超过 Windows 3。如果微软做不到，他们可能会输给 Digital Research 或 IBM。

![由 DALL·E 3 配图](https://images.icloudnative.io/uPic/2023-10-14-14-48-Eegxvu.jpg)

<center><small>由 DALL·E 3 配图</small></center>

最终，为了保持向后兼容性，Chicago 系统中仍保留了一些 16 位的代码。没有这些代码的话，其向后兼容性就不会这么好了。回首往事，鉴于 IBM 的 OS/2 能够运行 DOS 和 Windows 软件，微软的这个决策可谓英明之至。

## Chicago 的系统架构

Chicago 的架构与 Windows for Workgroups 3.1（增强的 386 版本）相似，但更加先进和完善。其中包括许多在 32 位保护模式下运行的虚拟设备驱动（VxDs），同时也有运行在虚拟真实模式下的虚拟 DOS 机（VDMs）。这些虚拟驱动既用于实际的物理硬件，也模拟为虚拟机提供设备，同时也服务于其他软件。而其中三大核心组件 VxDs，即：虚拟机管理器（VMM32.VXD）、配置管理器（CONFIGMG）以及可安装文件系统管理器（IFM），基本上是 Chicago 的心脏部分。VMM32 主要负责内存管理、处理各种事件、中断处理、加载和初始化设备驱动、创建虚拟机以及任务调度等。CONFIGMG 则是负责即插即用功能，而 IFM 主要协调文件系统的访问，提供磁盘缓冲，并实现了一个 32 位的保护模式 I/O 访问系统，从而无需经过  MS-DOS，这一功能首次出现在 386 Windows 3 的版本中。

对于 Chicago，Win32 API 分为三个独立的模块，每个模块都包含两个组件（一个是 16 位的，另一个是 32  位的）。内存、进程和文件系统的管理都是由它的内核部分 (KRNL386.EXE, KERNEL32.DLL, VWIN32.VXD)  负责的。用户界面及其各种功能由 "User" 部分 (USER.EXE, USER32.DLL) 负责。对于那些与设备无关的图形绘制，它由  Graphics Device Interface（也称为 GDI）(GDI.EXE, GDI32.DLL) 处理，这个功能我们在  Windows 1 版本中就见过了。

与 Microsoft Windows 的其他版本大相径庭（除了 NT 3，因为它早在 Chicago 之前就已经首次亮相了），当启动 Windows 的时候，MS-DOS 不再常驻内存。所有依赖于 DOS 系统调用的 16 位应用都会被重定向到一个 32 位的 Chicago 例程中。而且，运行在 Chicago 中的 DOS 应用程序，不再需要 MS-DOS 的驱动。那些新一点、为 MS-DOS 兼容环境写的 32 位保护模式应用，会在 Chicago 中模拟运行这种保护模式。在早期的 Windows 版本中，你可以看到两个操作系统似乎是在同一台电脑上并行运行。但到了 Chicago，它就像一个拥有三种特性的操作系统：通过 VDMs 来实现的 DOS、win16 和 win32。的确，MS-DOS 在 Chicago 中推出了新版本，但微软并没打算单独销售。最初是有这样的打算，但在某个过程中，这个想法被放弃了。MS-DOS 7 只是作为 Chicago 的一部分，基本上就是个启动器。而 MS-DOS 7.1 随后与 Chicago  的更新一同推出。要是其他公司，我猜这事儿根本不可能。大家都知道，**MS-DOS 曾经是微软的摇钱机器，但微软就这么狠心地把这块金矿扔了，把所有筹码都压在了 Chicago 这匹黑马上**。

在 [硬核软件：个人电脑革命的兴衰](https://www.amazon.com/Hardcore-Software-Inside-Rise-Revolution-ebook/dp/B0BSYF3447/ref=sr_1_1?keywords=hardcore+software+steven+sinofsky) 中，Steven Sinofsky 这样描述：

> 微软针对消费者的核心 Windows 项目叫做 Chicago（最终成为 Windows 95）。Chicago 结合了 Windows 3.1 所享有的广泛兼容性和强大的生态系统支持，同时还加入了全新的 Win32 API。更为关键的是，它成功弥补了 Windows 与 Macintosh 在易用性方面的差距。Chicago 的最终目标，是打造一个既能吊打 Macintosh，又能把 Windows 的那一大堆优点都囊括进去的 PC。

## Chicago 的设计目标

装了 Chicago 系统的 PC 是怎样打败 Macintosh 的？

![Microsoft Chicago 开机动画](https://images.icloudnative.io/uPic/2023-10-14-13-20-emJZBT.jpg)

<center><small>Microsoft Chicago 开机动画</small></center>

![1993 年的 Chicago 系统桌面](https://images.icloudnative.io/uPic/2023-10-14-13-22-ZmfKpj.jpg)

<center><small>1993 年的 Chicago 系统桌面</small></center>

![1993 年 Chicago 系统桌面上展示的文件管理器](https://images.icloudnative.io/uPic/2023-10-14-13-30-mOpsSR.jpg)

<center><small>1993 年 Chicago 系统桌面上展示的文件管理器</small></center>

到 1992 年底，Windows 3x 的销量已破 5000 万，好得让微软几乎快要拍桌子庆祝了。此时微软对熟练用户使用 Windows 的疑难杂症已经了如指掌，但对于新手，他们了解得并不多。刚开始，他们设定的发布日期可谓是勇气十足（计划 18 个月，但没达标），这让负责设计新界面的团队感到压力山大，毕竟他们要打造的是超越 Macintosh 的 PC 系统。这帮人由大约 24 人组成，其中一半是设计师，一半是程序员。他们清楚，按部就班的传统开发方式会拖慢进度，所以选择了迭代开发。他们会提出一个想法，实施它，对其进行用户测试，接收反馈，然后再重复这个过程。团队成员 Kent Sullivan 分享了他们的目标：一是让计算机小白更轻松上手 Windows，二是让经常使用 Windows 3.1 的用户体验更流畅。首批的用户体验研究在 Microsoft 实验室完成，几位初、中级用户来试玩新系统，并给出了各种反馈。例如，他们会回答：“你觉得如何？”或者“十分钟后，你知道怎么操作 X 功能吗？” 最终，他们反复调整，终于才完美呈现开始菜单、任务栏和文件对话框。而打印和帮助功能也被翻来覆去地修改了好几遍。开发后期，微软推出了公测版，吸引更多用户参与反馈。这个 Chicago 公测版售价 49.95$（约等于 2023 年的 103$），内容压缩在 37 张软盘里。因此，Chicago 成为了微软有史以来最受用户热议的产品。

1994 年底，微软终于给 Chicago 版本确定了发布名称：**Windows 95**。当这个版本趋于完善时，它的整体设计和用户体验也已基本确立。

![Windows 95 开机动画](https://images.icloudnative.io/uPic/2023-10-14-13-50-1o6srG.jpg)

<center><small>Windows 95 开机动画</small></center>

![Windows 95 开始菜单](https://images.icloudnative.io/uPic/2023-10-14-13-51-LE4et7.jpg)

<center><small>Windows 95 开始菜单</small></center>

![Windows 95 文件管理器](https://images.icloudnative.io/uPic/2023-10-14-13-51-0pbFjj.jpg)

<center><small>Windows 95 文件管理器</small></center>

微软为了推广这个系统，展开了其有史以来最大规模的宣传活动。他们花了 3 百万美元（相当于 2023 年的 620 万美元）来购买 Rolling Stones 的歌曲“Start Me Up”的版权，用这首歌为背景音乐做了一个与开始菜单相关的广告。而且，他们还邀请了 Jennifer Aniston 和 Mathew Perry 来主演 [一个网络喜剧](https://www.youtube.com/watch?v=vLlWrt-zmTo)，并用 Windows 的标志色彩照亮了整个纽约帝国大厦，更是在加拿大国家电视塔（CN Tower）上挂起了长达 330 英尺的巨大横幅。此外，在各大杂志和电视节目中，他们的广告也是铺天盖地。

![帝国大厦闪耀着 Windows 95 的主题灯光](https://images.icloudnative.io/uPic/2023-10-14-14-06-CjKyZL.jpg)

<center><small>帝国大厦闪耀着 Windows 95 的主题灯光</small></center>

## Windows 95 的市场影响与评价

1995 年 8 月 24 日这一天，微软推出了 Windows 95，当时的售价为 210$ （按照 2023 年的物价，大约为 433$）。《纽约时报》对此次发布盛况如此评价：“**这是计算机产业历史上最引人注目、最疯狂、最昂贵的一次产品发布。**”  早在此之前，Windows 3 就已经让西方社会步入了科技时代（几乎每家大型新闻机构都配备了科技报道记者，同时科技领域也涌现出大量的专业媒体），并在 Windows 95 发布前就已成功售出 1 亿份。而 Windows 95 则进一步加强了这个趋势。

全球各地，人们争相排队，等待零点 Windows 95 的发布。仅仅四天，Windows 95 就卖出了 100 万份。令人震惊的是，第一年的 Windows 95 销量就达到了 4,000 万份。

![发布当天，有张照片捕捉到一名男士手持两份 Windows 95 软件，照片出自 Torsten Blackwood](https://images.icloudnative.io/uPic/2023-10-14-14-15-lyrnKN.jpg)

<center><small>发布当天，有张照片捕捉到一名男士手持两份 Windows 95 软件，照片出自 Torsten Blackwood</small></center>

![新加坡的 Windows 95 零点发布现场，图片来源：Reuters](https://images.icloudnative.io/uPic/2023-10-14-14-15-Djs5yD.jpg)

<center><small>新加坡的 Windows 95 零点发布现场，图片来源：Reuters</small></center>

当时几乎所有人都在讨论 Windows 95，销售数据更是破天荒，那么它到底有多火呢？**Microsoft Windows 95 开启了计算的新纪元，其方式可谓相当革命性**。它支持“即插即用”，且销量史无前例，直接导致老古董 ISA 逐渐被边缘化，成为了历史。而原来复杂的跳线和 dip 开关也消失了，取而代之的是通过图形界面简单安装驱动的 PCI 成为了新标准。那些老旧的应用程序很快就不复存在，而 32 位的 win32 应用程序成为了大家的首选。随着加入了 Internet Explorer 更新（或是通过 Plus! 扩展包）的 Windows 95 版本的推出，微软把互联网带给了每一个人。同时，运行 Windows 95 的个人电脑确立了这个操作系统的统治地位，统一了整个家庭计算领域，让 Amiga、Atari ST、BeBoxes 乃至 Macintosh 这些品牌逐渐淡出了人们的视野 ... 好在微软看在老朋友的份上，帮了 Apple 一把，Apple 才幸存了下来。即使是那些所谓的高端工作站品牌，都没能挡住 Windows 95 的洪荒之力。Windows 95 的 32 位计算推动使得工作站和普通家用电脑之间的技术差距越来越小。。随后，像 SGI、Sun 和 DEC 这些大牌也逐渐被性能相对普通的 Windows 电脑超越。而操作系统的另一个有趣的转变是，**原本的 PC 游戏现在都变成了 Windows 游戏**，不过这又是另一个话题了。