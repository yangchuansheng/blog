---
keywords:
- Red Hat
- 红帽
- Linux
- 开源
- 红帽公司
- 开源软件
- IBM
- Bob Young
- 企业级市场
- Red Hat Enterprise Linux
- RHEL
- 开源运动
- CentOS
title: "Red Hat 公司的起源与发展：十亿美金开源巨头的崛起"
date: 2023-11-10T14:06:37+08:00
lastmod: 2023-11-10T14:06:37+08:00
description: 探索估值超过10亿美金的红帽公司如何从小型创业企业成长为开源软件的巨头，揭秘其背后的创始人故事和历史里程碑。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- RedHat
- Linux
categories: tech-social
img: https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-11-12-01-32-1peciH.png
meta_image: https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-11-12-01-27-WFsnff.jpg
---

### 译者序

原文链接：[The History of Red Hat](https://www.abortretry.fail/p/the-history-of-red-hat)

译者水平有限，不免存在遗漏或错误之处。如有疑问，敬请查阅原文。

以下是译文。

----

## Bob Young 的创业之路

### 成长背景

Bob Young 于 1954 年出生于加拿大安大略的汉密尔顿。他与祖母住得很近，与他的父母和兄弟姐妹一同成长。放学后，他祖母家的阿姨都会给他和他三个兄弟准备好刚出炉的杯子蛋糕。虽然他小时候很喜欢运动，但自己坦言运动天赋一般。初中毕业后，他进入了位于加拿大安大略小镇 Port Hope 的著名私立学校 Trinity College School，后来在多伦多大学的维多利亚学院主修历史并获得文学学士学位。不过，Young 曾表示自己的学习成绩并不是很理想。

<img width="350px" src="https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-10-22-15-09-eZmYMs.jpg" alt="Bob Young">

Young 曾感慨，手握历史学学位在职场上并没让他多少占到便宜，尤其是在他的成绩并非特别优秀的情况下。他觉得，或许自己搞个创业项目更有戏。他曾半开玩笑地称自己为 “找不到工作的高材生”，于是他就搞了个打字机租赁的小生意。他将营业点选在了多伦多郊外，隔壁恰好是个特色的养鱼虫农场。但随着计算机的普及，打字机市场逐渐被计算机侵蚀。不甘失败，Young 又快速转型，创立了一个名为 Vernon Computer Rentals 的计算机租赁公司。这个公司一直保持良好的势头，直到 1989 年的经济衰退。最终，他以约 2000 万美元的价格将公司卖给了 Greyvest Capital，并从中获得约 400 万美元的收入。但事情没那么简单，由于交易中的某些条款因素，Young 还需要继续为新公司投入资金。接下来的剧情有点儿戏剧化，没多久 Greyvest 的股价就像过山车一样跌到谷底，使得 Young 手中的股票变得一文不值。最终，他也被公司裁员了。

### 创办 ACC Corporation

1993 年 3 月，Young **处于 “失业+家庭” 双重双压下，有妻小、有房贷，口袋里几乎没什么钱**了。虽说他自己也不是啥技术高手，但之前摸爬滚打的经历让他对这个行业颇有了解。他灵机一动，觉得**开源软件和 Linux 似乎是个不错的商机**。于是，他创办了 ACC Corporation (这个名字是为了在电话簿中排名靠前)。他开始通过打印产品目录的方式展示并销售 CD 上的软件，包括了 Slackware 和其他开源软件，并且还有 UNIX 及其他专有软件。那个时代下载 Linux 可不是吃饭喝水那么简单，网速慢得像蜗牛，想买个便宜点的 CD 刻录机？那你得再等等，1993 年的 CD 刻录机价格还是高得吓人。这为那些卖预装开源软件 CD 的商家提供了一定的市场空间。而 Young，就是在康涅狄格州的家中，用妻子的缝纫间作为指挥中心，开始了他的商业冒险。

尽管 Young 将 Linux 刻录在 CD 上销售，但他对于自己所销售的产品尚未完全理解。在 Don Becker 的邀请下，他前往位于马里兰州格林贝尔特的 Goddard 太空飞行中心进行了访问。

![这是一张 NASA 的 Goddard 太空飞行中心照片，摄影者：NASA Goddard/Bill Hrybyk, 日期：2010-06-29](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-10-15-00-17-6t2Ari.jpg "这是一张 NASA 的 Goddard 太空飞行中心照片，摄影者：NASA Goddard/Bill Hrybyk, 日期：2010-06-29")

当时 Becker 大佬正在搞一个叫 [Beowulf](https://ntrs.nasa.gov/api/citations/20150001285/downloads/20150001285.pdf) 的项目，这是历史上第一台运行 Linux 的超级计算机。这款计算机实际上就是把一堆市面上的普通电脑拼在一起组成的一个集群。这款 “原始版” 超级计算机，用了十六台 486DX4 计算机，然后用双通道以太网给它们都串联起来。美国国家航空航天局 (NASA) 有个需求：一个能够进行吉浮点运算的工作站，预算不能超过 $50000 (按 2023 年的价值是 $105000)，同时，他们需要能够随意修改的软件。Beowulf 完美地满足了这两个需求。在此背景下，Linux 的开源特性显得至关重要。**尽管 Becker 和他的团队都认为 Solaris 是更为优秀的 UNIX 系统，但因为不能随心所欲地修改它，所以最终选择了 Linux**。Young 在看到 Beowulf 后，深刻地意识到 Linux 的潜力，它并不仅仅是 UNIX 的一个分支而已。

## Marc Ewing 的 Linux 之旅

### 成长背景

Marc Ewing 出生于 1969 年 3 月 9 日，他的父亲是 IBM 的一名程序员。年仅 10 岁的他已经显露出了敏锐的商业嗅觉：他将购买的 Bubble Yum 和 Bubblicious 口香糖 (每片四分之一美元) 放入他的萨克斯风盒子中，并在学校里以一美元的价格卖出。因此，在纽约波基普西的 Hagen 小学，大家都称他为 “口香糖小贩”。他还参加了计算机夏令营，学会了为 Apollo 和 Commodore 计算机编写程序。1992 年，他从卡内基梅隆大学毕业。**在校期间，他常常戴著一顶红色的康乃尔大学长曲棍球帽子 (这是他的祖父赠送给他的)，并且经常出没在计算机实验室。由于他技术高超，又经常待在实验室，同学们总是来找他请教问题。他待人友好，乐于助人，久而久之，大家开始口口相传：“有技术难题？找那个戴红帽子的帅小伙吧！”**

![由 DALL·E 3 配图](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-10-22-15-12-xpxjYJ.jpg "由 DALL·E 3 配图")

### 创办红帽公司

大学毕业后，Ewing 在 IBM 混了一段时间，他自认为这段经历没啥意思。后来，他离职了，但房租还得交啊，于是决定研究研究计算机技术，需要一个经济实惠的 UNIX 系统，那时 Linux 正崭露头角。因此，1993 年，他在北卡罗来纳州达勒姆的公寓里创办了红帽公司 (Red Hat Software)。在这个公寓里，与他同住的还有他的新婚妻子 Lisa。有趣的是，**他的新婚妻子不仅是他的 “合伙人”，小学时代还从他手里买过口香糖**。

## Red Hat Linux 的诞生

他发布的第一个 Linux 版本叫 Red Hat Software Linux，通常简称为 **RHS Linux**，这在相关手册和文档中都有注明。此版本主要基于 RPP 包管理器进行开发，并通过一张纯红色标签的 CD 提供给用户。每当产品发货时，都会夹带着一封感谢信，里面充满了对客户支持测试版的暖心感谢，还有两位大佬 Marc Ewing 和 Damien Neil (该公司的第一个员工，当时还是实习生) 的亲笔签名。此预览版于 1994 年 7 月 29 日发布，Linux 内核版本为 1.1.18，但并没有指定的版本号。

第二个版本是首次大范围传播的版本，并被命名为 “万圣节版本”，发布日期是 1994 年 10 月 31 日，版本号为 0.9。虽然这还是一个测试版，但用户已经可以选择 1.0.9 或 1.1.54 作为他们的 Linux 内核版本，其中 1.1.54 是正在开发中的内核版本。当时官方文档建议用户使用一款名为 **LIM** (Linux 安装管理器) 的图形界面包管理前端工具，该工具是基于 TCL/TK 开发的，并用于 RPP。这个版本之所以受到欢迎，大概是因为它带有很多用户体验极佳的图形化系统管理工具，从管理用户、群组，到设置时间、日期、网络等等，都是小菜一碟！

## 两位创始人的邂逅

在 Linux 圈子里，大家都在聊这个新发布的 Linux 发行版，这让 Young 也来了兴趣。当时 Young 管理着 “**New York Unix and Linux Journal**” 的几个邮件列表，并利用这些列表来宣传自己的产品目录。目录中有如 Yggdrasil、InfoMagic 和 Slackware 等品牌，售价介于 $20 到 $50 之间 (按 2023 年的汇率，大约是 $42 到 $105 之间)，并给他带来了约 50% 的利润。最近生意突然开始火爆起来，越来越多的客户开始讨论红帽 (Red Hat)。到了 1994 年秋，Young 从新闻组和客户中频繁听到关于 Red Hat 的讨论，于是决定与 Ewing 联系一下。他每月卖出约一千份 Linux，心里琢磨着或许有 10% 的人会对 Red Hat 感兴趣。因此，他希望向 Ewing 订购三百份，足够三个月的供应存货。但等到他 9 月打电话给 Ewing，提议把 Red Hat Software Linux 加到他的 “小金库” “ACC PC Unix and Linux Catalog” 时，Ewing 显然被这个数字吓了一跳。经过一段尴尬的沉默，Ewing 终于开口了，他原本只想制作三百份而已。

Ewing 急需财务和市场推广的支持，而 Young 则在寻找一款能代表自己进行销售的产品。经过一系列的协商，他们在 1995 年 1 月达成了合作协议。Young 获取了相关的版权、品牌和商标；作为回报，Ewing 获得了 ACC Corp 的股份，这家公司现在就是大名鼎鼎的红帽公司 Red Hat Software，Inc (在此之前，RHS 只是 Ewing 的个体经营企业)。Ewing 高兴地把销售的烦恼扔给了 Young，而 Young 倒是很开心接手这一职责。但别高兴太早，他们此时都迫切需要经济援助。为了维持公司的运营，他们选择了申请信用卡并刷爆其额度。部分信用额度用于偿还已有的债务，其余的则为公司注入资金。由于 Young 的信用额度不足，只好找他妻子 Nancy 出马，因为她的信用更好。

> 要不是我妻子 Nancy 的信用很高，我可能早就撤退求生了，哪还有机会看到公司赚大钱呢？

他们成立新公司后，仍选择在 Ewing 的公寓里办公，并且经常组队去山姆超市囤点汽水，生活也算是轻松有趣。但是，一个清晨，公寓的厕所不争气地溢水了，还影响到了楼下的房间。当物业维修人员走进公寓，只见满屋的电脑却不见人影，因此强烈要求他们搬离这里。好在，公司很快就在附近找到了一个小型办公室，重新启航。

![由 DALL·E 3 配图](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-10-22-15-16-3yrpim.jpg "由 DALL·E 3 配图")

RHS Linux 在新公司成立后的首发版本是在 1995 年 5 月，被命名为 “Mother’s Day” 版本。版本号为 1.0，并搭载了 1.2.8 版本的 Linux 内核。它的新名称是 “Red Hat Commercial Linux”。logo 也进行了创新设计，从那个经典的红色高顶帽，变成了一个**手拎公文包，另一手高高举着红帽的潇洒男士**。

![RHS 旧版 LOGO](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-10-15-13-06-oNku3W.jpg "RHS 旧版 LOGO")

![RHS Inc 1995 年的 LOGO](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-10-15-13-07-tsWpcy.jpg "RHS Inc 1995 年的 LOGO")

在那个炎炎夏日，RHS 出其不意地推出了一个名为 “母亲节加一” 的 bug 修复版本。根据购买时间，这个版本可能搭载了 1.2.11 或 1.2.13 的 Linux 内核。

## Red Hat Linux 的演进历程

### 逐步完善用户体验

那时，尽管红帽的规模还不算大，但 Red Hat 在 Linux 领域的影响力正在稳步上升。Slackware 仍旧是市场的领头羊，据 Young 的估计，它占据了近 90% 的市场份额。他还猜测 Yggdrasil 占了约 5%，而 SuSE (基本上是 Slackware 的一个变种) 也是一个不可忽视的玩家。Young 分析了背后的原因：虽然通过 CD 分发系统对网络速度慢的用户是个福音，但对于软件更新来说，这种方式存在明显的缺陷。当用户收到 CD 时，上面的内容可能已经不是最新的了。因此，Red Hat 的 Linux 需要进行改造，以支持 FTP 分发，而 Slackware 从一开始就已经实现了这一点。**为了实现这一目标，Ewing 和 Erik Troan 用 Perl 编写了著名的包管理工具 RPM**。

1995 年夏末，Red Hat 推出了 2.0 beta 版本，这是第一个采用 Red Hat Package Manager (RPM) 的版本。有趣的是，他们这次放弃了 a.out 格式，转而拥抱了 ELF 二进制格式。当 1995 年初秋来临，2.0 正式版本发布，并换了个新名字叫做 “**Red Hat LiNUX**”。

那段时间，Red Hat 如日中天，不仅市场份额逐渐攀升，其品牌知名度也随之上升。1995 年末，他们推出了 2.1 版本，并命名为 “**Bluesky**”。为此，DEC 制作了一个针对 x86 的宣传 CD，为即将在 1996 年 1 月发布的 “**Red Hat Linux/Alpha 2.1**” 造势。

然而，到了年末，Young 背负了近 $50000 的信用卡债务 (按 2023 年的价值约为 $98000)，幸好，他们终于开始挣钱了。我相信 Nancy 看到 Red Hat 还清了那堆信用卡债务，心里一定乐开了花。

1996 年 3 月 15 日，Red Hat 发布了 3.0.3 版本，并命名为 “**Picasso**”。这是其首次为多种硬件架构同时发布的版本，同时兼容了 DEC Alpha 和 Intel x86。Alpha 版本采用了 a.out 格式，而 x86 则采用了 ELF 格式；且 Alpha 版本是完全静态链接，不涉及共享库。这个版本还有一个亮点，那就是首次在 Red Hat Linux 中集成了来自 Metro Link Inc 的 Metro-X。那个时代，配置 Linux 的 X Windows 服务器简直就是个体力活，非常繁琐。Metro-X 大大简化了这一过程，提供了一个图形化的配置工具帮助用户轻松设置 X 环境。但这个版本在命名上存在些许混乱，有的叫官方 Red Hat LiNUX，有的叫 Red Hat™ Software Inc LiNUX，还有 RED HAT LINUX 和 Red Hat Linux。估计是因为当时市面上已经泛滥了各种低价和免费版本，红帽公司急需做点区分，标明自己的官方版本。

![预装了 FVWM 界面的 Red Hat Linux 3.0.3](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-10-15-13-39-NgdGkc.jpg "预装了 FVWM 界面的 Red Hat Linux 3.0.3")

1996 年 3 月至 8 月对于 Red Hat Linux 来说是转变与进化的关键时期。这段时间里，Red Hat Linux 像蜕变的蝴蝶一样，逐渐进化成了一个现代化的 Linux 发行版。为了 4.0 版本的推出，Red Hat 采用 C 语言重新设计了 RPM，并开始研发 Pluggable Authentication Modules (PAM)。此外，他们也用 Python/TK 工具替换了之前的 TCL/TK，首先从网络配置开始更新。当然，这还不算完，他们将 Linux 内核也升级到了 2.0 版本，引入了新的内核模块功能。这个期待已久的 4.0 测试版被赋予了一个时髦的名字——“**Rembrandt**”，并在 1996 年 8 月正式亮相。

### ShadowmanTM 品牌形象问世

1996 年 10 月 3 日，Red Hat 发布了面向 Intel x86、DEC Alpha 和 Sun SPARC 的 4.0 版本，名为 “**Colgate**”。在这个版本中，Alpha 首次支持了 ELF 二进制格式和动态链接功能。这一版本的系统内核升级到了 2.0.18 版本，并搭载了基于 Spyglass 开发的 Red Baron 浏览器。这一次，Red Hat 不仅提供了传统的纸质说明书，还额外给用户提供了免费的电子文档。在品牌形象方面，这个版本也是 **Shadowman™** 标志的首次亮相。这个版本受到广泛好评，甚至还**被 Info World 评为 1996 年的最佳操作系统**。

> 译者注：Shadowman™ 是 Red Hat 的商标和品牌形象，表现为一个带有礼帽的剪影人像。这个标志从 1996 年开始出现在 Red Hat 的产品和宣传材料上，后来逐渐成为该公司的标志性形象。Shadowman 的设计旨在传达红帽公司的核心价值观和精神，它代表了开放、社区驱动和革新的理念。

![Red Hat Shadowman™ LOGO](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-10-15-14-03-aotSps.jpg "Red Hat Shadowman™ LOGO")

### 转型为服务型公司

在创业初期，Red Hat 还没有一个清晰的商业模式。他们的做法很直接：把软件装进一个大包装盒中，这些包装盒既可以在实体店的货架上找到，也可以直接从 Red Hat 那里购买，还可以选择通过产品目录选购。在书店或电脑专卖店，这样的盒装软件通常的售价是 $29.95 (相当于 2023 年的 $58)。购买这种盒装软件的主要是一些不想亲自下载操作系统和相关软件，并进行手动安装的用户。有了这么一个神奇的盒子，只需要插入光盘，跟着指引走就行。另外，包装盒中还贴心地附上了使用说明，让用户可以更加轻松地上手和使用。

在 Cincinnati 的 MicroCenter 商电脑零售店，我和我爸因为 Red Hat 闹了个小别扭。家里那台二手电脑上，我装的是 Slackware，虽说运行得还不错，但说实话，我对这系统知之甚少，更别提那像蜗牛一样慢的网速，下载这些软盘耗费了我大量时间。我跟爸说，买个 Red Hat 怎么样？他有些疑惑：“**为何要花钱购买免费的东西？**” 我说：“可以获得详细的使用文档和节省下载时间啊！”，并重点强调了**文档对学习的价值**。之后的日子里，每次逛店，我都会 “顺便” 提一下 Red Hat。最后，老爸终于同意了。这件事看似微不足道，但没想到，那本 Red Hat 手册竟然变成了我职业生涯的开端，只是当时我们都没有意识到它的重要性。

与此同时，Red Hat 也为一小部分客户提供了付费电话支持服务。虽说在 1990 年代，这玩意儿只是他们众多业务中的一小部分，但 Red Hat 仍旧坚信这玩意在市场上还是挺有竞争力的。与此同时，他们也明白这种模式要想扩展可能会有点困难。再给大家科普下当时的背景，到 1996 年为止，NT 仍然是个新产品，还没有展现出其后来的市场影响力。那时 Red Hat 的主要竞争对手就是那些商业 UNIX 厂家，相较于这些 UNIX 厂家，Red Hat 的价格更具竞争力，但在技术支持、专业硬件和人力资源上却稍显逊色。虽然 Red Hat 已经开始盈利了，但它出售的产品实际上用户是可以免费获取的。因此，他们所能提供的附加服务与价值相对有限。虽然有自家的浏览器、使用手册和电话支持这些小福利，但要完全依赖这些，长期看来可能不太行。

1997 年 2 月 3 日，Red Hat 发布了 4.1 版 “**Vanderbilt**”，该版本搭载了 2.0.27 版本的 Linux 内核。5 月，Red Hat 又推出了 4.2 版 “Biltmore”，这是最后一个内置 Red Baron 浏览器的版本。在同年后续的版本中，从 4.8 到 4.96，Red Hat 将其发行版本基于 glibc 2.0 进行了重大更新，并在更大程度上采用了公开的 beta 测试模式。

1997 年 12 月 1 日，Red Hat 发布了新的版本 5，并命名为 “**Hurricane**”。这个名字是为了纪念一场飓风，该飓风曾经席卷 Red Hat 的家乡，对周边造成了很大的损害，但 Red Hat 的总部却安然无恙。此版本不仅集成了 Real Audio™ 客户端和服务器软件，而且还荣获了 Info World 1997 年的年度最佳产品奖。

![内置 Netscape Communicator 和 FVWM 的 Red Hat Linux 5，图片来源于 toastytech.com](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-10-15-14-56-oKiQJL.jpg "内置 Netscape Communicator 和 FVWM 的 Red Hat Linux 5，图片来源于 toastytech.com")

1998 年 6 月 1 日，Red Hat Linux 5.1 版本 (代号 Manhattan) 正式发布。该版本进一步强化了对专有软件的支持，甚至专门为这些软件推出了一个独立的 CD。此外，GNU Network Object Model Environment (GNOME) 的预览版也被整合在安装媒介的一个特定文件夹中。“Manhattan” 版本也首次引入了 linuxconf 作为集中式的配置工具。至于荣誉，它**不仅摘下了《PC Magazine》的技术创新奖，更是从澳大利亚个人电脑杂志那里斩获了编辑之选奖和那个酷到没朋友的 Just Plain Cool 奖**。

1998 年 9 月，Red Hat 取得了令人瞩目的业绩，年销售额达到 500 万美元，相当于 2023 年的 940 万美元。对于专注于 Linux 和开源软件的公司，这个数字已经相当给力了。这么亮眼的业绩，连 Intel 和 Netscape 都忍不住要投资了。紧接着，Benchmark Capital 和 Greylock Management 对其进行了风险投资，而 IBM、Novell、Oracle 和 SAP 则选择了小规模投资。与此同时，Red Hat 加强了其技术支持服务，使之成为了公司业务新的增长点。1998 年 11 月，红帽将总部搬到了位于北卡罗来纳州[三角研究园](https://en.wikipedia.org/wiki/Research_Triangle_Park)的 Meridian Business Complex 办公室。

> 译者注：三角研究园 (Research Triangle Park，简称 **RTP**) 是美国北卡罗来纳州的一个著名高科技研究和开发园区，它是全美同类型研究园中规模最大的科研园。

1999 年初，红帽公司的命运来到了转折点，突然成了行业的焦点。该公司与行业巨头 [Dell](https://www.abortretry.fail/p/dude-youre-gettin-a-dell) 和 IBM 签订了战略合作协议，决定将 Red Hat 的 Linux 系统安装在他们的服务器和工作站上，作为对付昂贵的 UNIX 系统的开源解决方案。具体来说，IBM 将 Red Hat Linux 引入到其 Netfinity 服务器、PC 300 工作站、Intellistations 和 ThinkPads 中，而 Red Hat 则为这些产品的用户提供了强大的技术支持。对 Dell 而言，其 PowerEdge 服务器是最为畅销的产品，因此，Dell 不仅为 Red Hat 进行了股权投资，还承诺其 PowerEdge 服务器都会预装 Red Hat Linux。此外，两家公司还达成了全球服务和支持协议。Gateway 也紧跟潮流，开始按照客户需求预装 Red Hat。**那一年，Red Hat 的收入飙升到了前所未有的 1000 万美元，按照 2023 年的价值，相当于 1840 万美元**。

在获得大量投资和实现增长的同时，Red Hat 的团队可没闲着。1998 年，他们精心打造了 5.2 版本 (代号 Apollo)，紧接着在 1999 年推出了 5.9 版本 (代号 Starbuck)。更厉害的是，他们在 1999 年打破常规，推出了 6.0 版本 (代号 **Hedwig**)。这是一个里程碑式的版本。从技术角度看，该版本采用了 glibc 2.1、EGCS、2.2 版 Linux 内核，并集成了 GNOME 桌面环境。EGCS 实际上是多个 GCC 的分支合并而成，为 GCC 带来了更多的扩展功能，如 g77 (fortran)、P5 Pentium 的优化、更出色的 C++ 支持，以及对更多体系结构和操作系统的支持。此外，新版内核在多个平台 (包括 Intel 的 Pentium 系列、Cyrix 和 AMD 芯片) 上表现优异，并解决了之前 Linux 启动时遇到的一些问题。此版本还进一步加强了硬件驱动支持，并提高了系统性能。但更让人惊喜的是，6.0 版本被 Dell 看上并预装在他们的电脑上，这为 Red Hat 带来了丰厚的收入。

![集成了 GNOME 桌面环境的 Red Hat 6.0，图片选自 Linux Journal 杂志](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-10-15-16-37-TKgKPK.jpg "集成了 GNOME 桌面环境的 Red Hat 6.0，图片选自 Linux Journal 杂志")

## 首次公开募股与收购狂潮

Red Hat 正式更名为 Red Hat，Inc。并在 1999 年 8 月 11 日闪亮上市，发行价格设定为 $14 (折合到 2023 年差不多是 $26)。当时公司内部的员工心里都有点慌，Marc Ewing 如是说：

> 考虑到当时的市场形势，的确有点手心冒汗，但我们坚信我们的故事独具一格、足够吸引眼球，因此我们勇敢地选择了上市。当然，这个决定是有风险的，我们都感到有些紧张。

开盘第一天，股票的收盘价格是 $52 (折合到 2023 年差不多是 $95)，**上涨了 227%，成为了 Wall Street 历史上单日涨幅第八名**，使 Red Hat 的市值飙升至 35 亿美元 (折合到 2023 年差不多是 64 亿美元)。

公司甚至还稍微修改了一下他们的 LOGO：

![自 1999 年开始使用的 Red Hat Shadowman™ LOGO](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-10-15-16-53-Hlc6nD.jpg "自 1999 年开始使用的 Red Hat Shadowman™ LOGO")

红帽在首次公开募股 (IPO) 后，如同开启了超级加速模式，飞速在全球多个角落如英国、德国、法国、意大利和日本插上了旗帜，新办公室一个接一个地开设起来。他们不只是单纯地扩张，还收购了多家公司：首先是 Cygnus Solutions，一家专门为嵌入式系统制作编译器和调试器的公司，其前总裁 Michael Tieman 还出任了红帽的首席技术官 (CTO)；此外，Marc Ewing 也拿起了指挥棒，带领 Red Hat Center for Open Source 这个红帽的非营利部队，准备在开源世界大放异彩。

红帽就像一台永不停歇的机器，又相继收购了 Hell’s Kitchen Systems (专门为电商行业提供支付处理软件的公司)、Bluecurve (开发交易模拟软件的公司)、WireSpeed Communications (专门研发嵌入式无线软件的公司) 和 C2Net Software (一家网络安全软件公司)。这一连串的动作，不仅展示了红帽雄厚的技术实力，更突显了他们在市场拓展上的智慧和策略，看来红帽是要在科技圈掀起一番新风暴了！

## 版本更新不停歇

1999年9月6日，Red Hat Linux 带着一丝神秘的面纱，发布了一个新版本 6.0.50 (代号 Lorax)。该版本的一项重大更新是其系统安装器 Anaconda。Anaconda 非常灵活，可以根据用户的偏好和计算机的硬件配置，选择图形界面或文本模式进行安装，而且，它还是用优雅的 Python 语言编写的。时光飞逝，转眼到了 1999 年 10 月 4 日，Red Hat 再次发布了一个更新版本，版本号为 6.1，代号则是 “Cartman”。

Bob Young 在 1999 年 11 月离开了红帽。他觉得自己更适合做一个引领公司走向成功道路的创业者，而不是坐在成功公司 CEO 的位置上。他的强项在于创立公司并指导他们走向正确的发展方向。看到红帽已经发展得如火如荼，他认为是时候让 Matthew Szulik 这样的人接手了。没过多久，Marc Ewing 也选择了退出，并卖掉了他的股份。Merrill Lynch 的顾问送给他一个铜制的公牛头，以此祝贺他跻身亿万富翁之列，而那时他只有 30 岁。随后，Ewing 选择将他的财富和时间投入到慈善事业中，并且还联合创办了 [Aplinist](http://www.alpinist.com/)，继续开启了他的新征程。

2000年2月9日，Red Hat Linux 发布了 6.1.92 版本 (代号 Piglet)。不久之后，具有划时代意义的 Red Hat Linux 6.2 (代号 Zoot) 随之诞生。这不仅仅是一个版本的更新，还标志着红帽首次在公共 FTP 上提供了 ISO 镜像，为用户的下载和安装提供了极大的便利。

![Red Hat Linux 6.2 的包装盒及其内容](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-10-19-14-59-YDVS4z.jpg "Red Hat Linux 6.2 的包装盒及其内容")


![这个版本附带了一本内容翔实的手册，长达 300 余页](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-10-19-15-00-ETtGCR.jpg "这个版本附带了一本内容翔实的手册，长达 300 余页")

2000 年 7 月 31 日，Red Hat Linux 发布了 6.9.5 版本，代号 “Pinstripe”。

2000 年 9 月，红帽开启了新的篇章，推出了红帽网络服务。这标志着红帽从一个盒装 Linux 发行版供应商，演变成了一个提供综合性服务的公司，特别是在 “软件即服务” (SaaS) 领域。红帽网络作为一种订阅服务，为用户提供了包括技术支持和系统更新在内的多种服务，并按月收费。Red Hat Linux 7.0 (代号 Guinness) 在 2000 年 9 月 25 日发布，这个版本已经支持红帽网络服务。到了 2001 年 1 月 31 日，红帽发布了一个重要的更新版本 7.0.90 (代号 Fisher)，带来了全新的 2.4 版本 Linux 内核，内核的更新为 Linux 系统带来了许多新的特性和优化，例如自旋锁、多线程 I/O 和网络、日志文件系统、多 CPU 支持和 USB 设备支持等。接着，在 2001 年 4 月 16 日，红帽发布了 7.1 版本 (代号 Seawolf)，这是首次集成了 Mozilla 套件的版本。

2002年春，红帽迎着和煦的春风，将其总部迁至了北卡罗莱纳州立大学的 Centennial Campus，那里位于风景如画的西罗利。这个时候，红帽已经汇聚了 630 名充满激情和创意的员工，他们共同创造了 7900 万美元的年收入，而到了2023年，这个数字已经增长到了 1 亿 3400 万美元。

## RHEL 的诞生

2002年的5月6日，红帽发布了两个版本。其中，7.3 版本成为了携带 Netscape 的最后版本。而在同一天，红帽又发布了 Red Hat Linux Advanced Server 2.1，这个版本后来被更名为 Red Hat Enterprise Linux。它不仅继承了 7.2 版本的基础，还融入了 7.3 版本的诸多优化和改进。红帽特别重视这个版本，在商业市场上进行了全方位的推广和支持，也因此赢得了许多独立软件供应商的坚定支持。

2002 年 9 月 30 日，Red Hat Linux 8.0 (代号 Psyche) 发布。这一版本不仅标志着红帽最后一次在零售盒中推出 Linux 发行版，也是第一次采用了 “Bluecurve” 这种全新的视觉感受和操作体验。就像是开启了一个新世界的大门，该版本还首次搭载了 GNOME 2、KDE 3.0.3、OpenOffice.org 1.0.1、GCC 3.2、Glibc 2.3 和内核版本 2.4.18-14。

![内置 Bluecurve 主题的 Red Hat Linux 8](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting5@main/uPic/2023-10-19-15-25-o7qJWg.jpg "内置 Bluecurve 主题的 Red Hat Linux 8")

2003 年 3 月 31 日，Red Hat Linux 悄悄发布了 9.0 版本 (代号 Shrike)，这是 Red Hat Linux 系列的最后一个主要版本。该版本没有 CD，只能通过网络下载，仿佛是 Red Hat Linux 系列的告别信。它不仅代表着一个时代的结束，也铺垫了红帽企业级 Linux 3 的未来。这个版本引入了一个技术叫做 Native POSIX Thread Library (NPTL) 的功能。这项技术原先存在于 2.5 版本的内核，经过精心设计，被回溯移植到了 2.4.20 版本的内核中。该版本之后只有一次小规模的补丁更新，然后 Red Hat Linux 便优雅地退出了历史舞台。

从这个时间节点开始，红帽公司将推出两款各具特色的 Linux 系统。一个是 Fedora Core (现在简称为 Fedora)，该版本会频繁地更新并且采用最新的技术。另一个则是 Red Hat Enterprise Linux，这个版本开发节奏缓慢但支持时间更长，并成为公司提供优先技术支持和资源的产品，采用订阅模式进行销售。在这场技术与艺术的结合中，红帽也赢得了业界巨头如戴尔、IBM、惠普和甲骨文的全力支持。

## 红帽的影响力不断扩大

2004年3月19日，一群对开源软件满怀热情的开发者推出了 CentOS 版本 3。这个版本成为了 Red Hat Enterprise Linux 的精准复刻，无论优点还是缺点，都一一照搬。虽然它不是第一个尝试这么做的发行版，但很快，它就成了同类发行版中最常见和最受欢迎的版本。

红帽公司于2005年12月19日被纳入了 NASDAQ-100 指数，进一步证明了其行业地位。随后几年，该公司维持了高速的增长势头，不断刷新业绩纪录。2012年，红帽成了第一家年收入破十亿美元的开源公司。其后，公司的收入持续攀升，2015年达到二十亿美元，并在2018年突破三十亿美元。

2014 年，红帽收购了 CentOS 项目，并为其精心设立了一个管理委员会。该项目的主要开发者也加入了红帽旗下的开放源码与标准 (Open Source and Standards) 团队。

凭借其雄厚的财力，红帽创建或支持了多个开源软件项目，其中主要包括：KVM、GNOME、systemd、PulseAudio、Dogtail、MRG、Ceph、OpenShift、OpenStack、LibreOffice、Xorg、Disk Druid、rpm、SystemTap 和 NetworkManager。

## 被 IBM 收购与业界争议

2018年10月28日，IBM 宣布以 340 亿美元的天价收购红帽，并将其纳入自己的混合云业务部门，经过漫长的反垄断调查，2019年5月3日美国司法部终于批准了这笔天价收购案。两个月后，也就是2019年7月9日，红帽正式加入 IBM 这个 IT 巨头的麾下。这场交易不仅对红帽和其客户产生了深远的影响，更标志着开源和 Linux 在企业界的胜利。Linux 在服务器市场上展现了无可匹敌的实力，这也是这家企业级计算巨头选择收购最大的 Linux 和开源公司的主要原因。

IBM 一贯的作风是在企业产品上不允许有竞争对手存在。2020年12月8日，它宣判了 CentOS 的死刑，最后一个版本定格在 CentOS 8。取而代之，IBM 推出了 CentOS Stream，本质其实是 RHEL 的滚动更新预览版。2023年6月中旬，IBM 宣布 CentOS Stream 源代码是 RHEL 唯一的公开源代码，意图切断 RHEL 的开源分支产品如 AlmaLinux、Rocky Linux 和 Oracle Linux 的生路。IBM 明确表示，RHEL 客户不能再分发 RHEL 的源代码。这一举措在开源界和 Linux 界引发了热烈讨论。争论焦点在于：RHEL 中的大部分软件并非由 IBM 创造或所有，而且大部分都是在 GNU 通用公共许可证 (GPLv3) 下发布的。根据 GPLv3 第 2 条，不允许再授权。第 3 条和第 4 条还明确规定，任何人不能限制该软件的运行或修改，可以按原样重新分发软件。

即便面临仿制品制造商的挑战，红帽还是成功地站在了开源领域的顶峰。在我看来，IBM 的一些行动是缺乏远见的。软件自由保护协会的 Bradley Kuhn 对此持以下观点：

> 我们把这种商业模式称为 “**如果你行使了 GPL 赋予你的权利，那么你的钱在这里将一文不值。**” 这种 RHEL 商业模式是否符合 GPL，是个备受争议的话题，观点多种多样。但除了红帽，几乎没有人认为这种商业模型能真正体现 GPL 和 FOSS 的核心精神。

在我看来，虽然 RHEL 这个产品依然存在，但红帽这家公司实际上已经名存实亡。RHEL 不过是 IBM 旗下的一个品牌。就像 IBM 在尝试对其个人电脑产品线进行独有改动后逐渐走向衰落一样，红帽在被 IBM 收购后也可能会逐渐失去市场份额。

红帽是一家对软件行业做出了巨大贡献、推动了开源软件的发展、以及奠定现代世界软件基础的公司。所有曾参与 Red Hat Linux 相关工作的人都应该为自己的成就感到自豪。