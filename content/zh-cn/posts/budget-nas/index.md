---
keywords:
- NAS
- TrueNAS
- 群晖
- 威联通
- Synology
- QNAP
- ZFS
- Homelab
title: "组装一台 22TB 容量的 NAS（家庭存储服务器）"
date: 2022-06-10T09:06:37+08:00
lastmod: 2022-06-10T09:06:37+08:00
description: 本文介绍了如何组装一个 22TB 容量的 NAS，并使用 TrueNAS 作为操作系统。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- NAS
- TrueNAS
- ZFS
categories: tech
img: https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-19-15-9buRzP.png
---

> 原文链接：[https://mtlynch.io/budget-nas/](https://mtlynch.io/budget-nas/)
> **本文已获取原作者的翻译授权**

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-09-09-40-ecfeoN.png)

今年我决定给自己量身定制一台家庭网络存储服务器（也就是 NAS），预计存储容量有 32TB，并使用开源的操作系统，用来存储我的个人和商业数据。

服务器本身花了 $531，额外花了 $732 买了四块硬盘，总成本达到了 $1,263。这个价格与购买现成的 NAS 服务器差不多，但我的方案提供了更多的功能和可定制性。

本文我将会给大家介绍自己当初是如何选择硬件的，中间犯了哪些错误，最后会给有兴趣构建个人 NAS 服务器的小伙伴提供一些有参考价值的建议。

<table style="margin-bottom:-2.5em;"><tr>
<td><img style="width: 400px;" src="https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-03-11-19-eVso8i.jpg"></td>
<td><img style="width: 400px;" src="https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-03-11-27-IPEJKe.jpg"></td>
</tr></table>

<figcaption>组装 TrueNAS 服务器前后对比</figcaption>

我还录制了一个视频，欢迎观看：

{{< bilibili BV1Hr4y137CG >}}

## 背景

### 为什么需要 NAS 服务器？

NAS 即[网络附加存储（Network-attached storage）](https://en.wikipedia.org/wiki/Network-attached_storage)，NAS 服务器的主要工作就是存储数据，并将其提供给你网络上的其他计算机使用。

那么，为什么一定要使用一个完整的专用服务器来存储数据呢？毕竟每台计算机都可以存储数据。

我认为将数据与其他系统解耦是有益的，我本人每隔两到三年就会升级我的工作站和笔记本电脑，而在不同电脑之间迁移数据非常麻烦。使用专门的 NAS 服务器就可以免去大多数不必要的数据迁移工作，而且各个系统之间还可以共享文件。

除此之外，我还是一个[数据囤积狂](https://www.reddit.com/r/DataHoarder/)，我保留了之前拍摄的每一张数码照片，以及过去 20 年里收发的所有电子邮件，再加上所有个人项目的源代码，总共有 8.5TB。

我最大的数据来源是自己收藏的 DVD 和蓝光碟片，本人不太喜欢依赖流媒体服务来保存喜欢的影视作品，所以我至今仍然会购买影视作品的实体拷贝，一旦买到一张新的光盘，我就会将原影像翻录出来，并制作成一个可流式传输的视频文件。在原始 ISO 拷贝和可流式传输的 MP4 之间，一张光盘可以占用 60GB 的硬盘空间。

![我仍然会为需要多次观看的影视作品购买 DVD 或蓝光碟片](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-03-11-58-cC78q3.jpg "我仍然会为需要多次观看的影视作品购买 DVD 或蓝光碟片")

### 什么是 Homelab？

"Homelab" 是一个口语化的术语，最近几年越来越受欢迎。

一个 Homelab 其实就是你家里的一片区域，你可以像在办公室或者数据中心一样在这个区域中试验 IT 硬件或软件。它可以作为练习专业技能的实践环境，也可以用来把玩一些有趣的技术。

### 为什么要自己组装 NAS？

**如果你是 Homelab 新手，或者没有组装 PC 的经验，建议不要尝试自己组装 NAS**。你可以选择一体化的解决方案（比如群晖、威联通这种），这样学习曲线会比较平缓。

在组装自己的 Homelab NAS 之前，我已经使用了 7 年的 4 盘位[群晖 DS412+](https://www.newegg.com/synology-ds412/p/N82E16822108113)。我觉得群晖很好，性价比很高，如果你是 NAS 小白，建议直接买群晖吧。

![为我服务了七年之久的 10TB 群晖 DS412+](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-03-12-10-zWiFAo.jpg "为我服务了七年之久的 10TB 群晖 DS412+")

几个月前，我的群晖启动失败了，并开始发出咔咔的声音。这时我开始意识到自己对这台设备的依赖程度如此之重，想到这里后背就一阵发凉。因为群晖的服务器是不可修复的，如果其中一个零件在保修期之后出故障了，你只能更换整台服务器。如果你跟我一样不是技术大拿，而且使用了群晖专属的存储格式，也没有额外的群晖服务器，~~那么此时你就无法访问这台服务器上的数据，也无法恢复~~（[Hacker News 上的一位大佬](https://news.ycombinator.com/item?id=31549755)告诉我可以[从一个非群晖系统中恢复群晖的混合 RAID 卷](https://kb.synology.com/en-us/DSM/tutorial/How_can_I_recover_data_from_my_DiskStation_using_a_PC)）。

万幸的是，在我清理并重置了硬盘之后，数据就恢复了。这件事也给我敲响了警钟，我决定改用 TrueNAS，因为它提供了一个开放存储格式的开源实现。

### TrueNAS 和 ZFS

[TrueNAS](https://truenas.com/)（前身叫 FreeNAS）是存储服务器最流行的操作系统之一，完全开源，而且已经存在了将近 20 年，看起来是一个靠谱的 NAS 系统。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-03-12-28-NA2Wy3.svg)

TrueNAS 使用的文件系统是 ZFS，这是一个专门为存储服务器设计的文件系统。NTFS 或 ext4 等传统文件系统运行在管理低级磁盘 I/O 的数据卷之上。ZFS 可以管理从文件级别逻辑到磁盘 I/O 的一切内容，相比于其他文件系统，ZFS 的控制更全面，拥有更多的功能和更强的性能。

ZFS 的亮点：

+ 将多个物理硬盘聚合到一个文件系统中；
+ 数据完整性验证和自动修复；
+ 创建磁盘中数据的时间点快照（类似于 macOS 的 Time Machine 功能）；
+ 可选择加密或压缩硬盘中的数据。

在使用 TrueNAS 之前，我对 ZFS 的经验是零，所以我非常想尝试一下这个新奇的文件系统。

## 存储规划

### 预估所需存储容量

之前我使用群晖时，插入了三个 4TB 的硬盘，并将第四个插槽留空。然后通过群晖的混合 Raid 来构建文件系统，总容量是 7TB。使用了三年之后容量不足，于是又增加了第四块硬盘，总容量达到了 10TB。

对于这个全新的 NAS，我决定采取和之前类似的策略，我需要这个系统的存储容量能满足我当前的需求，并且能留有一定的增长空间。粗略估计当前需要 20TB 存储容量，如果以后再增加硬盘，最高可达 30TB 存储容量。

ZFS 目前还不允许向现有的存储池中添加新的硬盘驱动器，但该功能[正在积极开发中](https://github.com/openzfs/zfs/pull/12225)，希望在我需要扩展存储的时候，TrueNAS 会俱备这个功能。

### 多个小硬盘还是少量大硬盘？

ZFS 的设初衷是抵御硬盘故障，它会以冗余的方式存储每个数据块。这个特点使存储容量规划变得很复杂，因为可用存储的总容量不仅仅是每个硬盘容量的总和。

ZFS 会从硬盘组成的存储池中创建文件系统，存储池中的硬盘数量越多，存储容量的利用率越高。例如，如果给 ZFS 提供两个 10 TB 的硬盘，则只能使用总硬盘容量的一半。如果改用 5 个 4TB 硬盘，ZFS 将会提供 14TB 的可用存储容量。虽然这两种情况下硬盘的总容量相同，但后一种方案比前一种方案增加了 40% 的可用容量。

在组装 NAS 时，我们需要思考到底是使用多个小容量的硬盘还是使用少量的大容量硬盘。这个问题要辨证地看，小容量的硬盘通常性价比更高，但是运行成本会更高，例如两个 4 TB 硬盘需要的电力是单个 8TB 硬盘的两倍。

我还是想减少服务器的占用的物理空间，因此我选择了容量大的硬盘。

### 选择 raidz 1, 2, 还是 3?

ZFS 提供了 3 种不同的磁盘阵列：raidz1，raidz2 和 raidz3，它们的主要区别在于健壮性。raidz1可以承受一个磁盘故障而不丢失数据， raidz2 可以承受两个硬盘同时发生故障，而 raidz3 可以承受三个。

健壮性越强，可用的存储容量越少，毕竟能量守恒嘛。我有 5 个 4TB 硬盘，下面列出了每个 ZFS 磁盘阵列的可用存储容量：

| ZFS 磁盘阵列类型 | 可用存储容量 | 存储利用率 |
| ---------------- | ------------ | ---------- |
| raidz1           | 15.4 TB      | 77.2%      |
| raidz2           | 11.4 TB      | 57.2%      |
| raidz3           | 7.7 TB       | 38.6%      |

最终我选择了 raidz1，因为我的硬盘数量不多，两个硬盘同时发生故障的概率比较低。

{{< alert >}}
注意：[ZFS 不是一种备份策略](https://www.raidisnotabackup.com/)。ZFS 可以保护你免受磁盘故障的影响，但还是有很多威胁是 ZFS 无能为力的，比如意外删除数据、恶意软件攻击或者物理盗窃。我选择使用 [restic](https://restic.net/) 将所有重要的东西备份到加密的云存储中。
{{< /alert >}}

ZFS 的价值在于，如果其中一块硬盘坏了，可以直接换掉，不必求助于云备份。如果同时有两块硬盘坏了，我才会选择从云备份恢复（因为我使用的是 raidz1）。这个选择过程非常痛苦，但我仍然选择 raidz1，因为我觉得不值得为了 raidz2 而放弃服务器 20% 的可用存储空间。

一般来说，硬盘数量越多，对磁盘阵列的健壮性要求就更高。如果我的存储池是由 20 快硬盘组成的，我可能会使用 raidz2 或 raidz3。

### 防止多个硬盘同时故障

从概率上来看，两块硬盘同时发生故障的概率几乎为零。根据 [Backblaze](https://www.backblaze.com/blog/backblaze-hard-drive-stats-for-2020/) 的统计，质量比较高的硬盘每年发生故障的概率为 0.5-4%，就算是 4% 吧，每 48 年至多才会遇到一次两块硬盘同时发生故障，这个概率已经很低了，几乎不用担心。

但从实际情况来看，这种统计方式并不科学，如果其中一块硬盘出现了故障，那么其他硬盘在这个时刻出现故障的风险将大大增加，因为你的硬盘很可能是同一型号，来自同一制造批次，并且处理着相同的工作负载，一旦出故障，很可能就是同时出故障。

除此之外，发生故障后重建 ZFS 存储池也不是个好办法，这会给正常工作的硬盘带来更多的压力，正常情况下可以使用几个月的硬盘可能会在重建存储池时直接挂掉。

考虑到上述这些风险，我需要采取一些措施来减少两块硬盘同时发生故障的风险，办法也很简单粗暴，直接从两个不同的厂商那里购买两种相同型号的硬盘即可。这种方案虽然没有科学论证，但也没啥附加的成本，还能图个心理安慰，何乐而不为呢？😂

![我从两个不同的厂商那里购买了两种相同型号的硬盘](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-07-11-52-t7b8im.jpg "我从两个不同的厂商那里购买了两种相同型号的硬盘")

## 如何挑选硬件

### 主板

首先要明确主板的尺寸。我之前一直比较欣赏群晖 DS412+ 的紧凑外形，还从来没有用过 mini-ITX 主板来组装电脑，机会难得。

最终我选择了 [ASUS Prime A320I-K](https://www.asus.com/Motherboards-Components/Motherboards/PRIME/PRIME-A320I-K/)，原因如下：

+ 有四个 SATA 接口，我可以直接将四块硬盘接到主板上；
+ 支持 Radeon 图像处理技术，这样我就不用再单独购买显卡了；
+ 价格实惠，只需 $98。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-07-12-03-0xss7M.jpg)

> ⚠️警告：我现在有点后悔选择了这个主板，参考[下面的讨论](/posts/budget-nas/#%E4%B8%BB%E6%9D%BF-1)。
> 

[B450](https://www.newegg.com/asus-rog-strix-b450-i-gaming/p/N82E16813119143) 这个主板也不错，与 [ASUS Prime A320I-K](https://www.asus.com/Motherboards-Components/Motherboards/PRIME/PRIME-A320I-K/) 很相似，但价格却翻了一倍，目测对超频的支持更好，但我对这方面没什么需求。

### CPU

以我的了解，ZFS 对 CPU 的要求并不高。我之前在一台廉价的戴尔 OptiPlex 7040 迷你 PC 上安装过 TrueNAS，并做过一些基本测试，结果表明 ZFS 并没有怎么使用 CPU，所以选择低功率的 CPU 应该没啥问题。

我选择 CPU 的主要标准是必须要支持 Radeon 图像处理技术，这样我就可以使用 A320 主板的板载 HDMI 输出。

![AMD Athlon 3000G价格低廉，并且原生支持 Radeon 图像处理技术](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-07-12-30-vQkYi2.jpg "AMD Athlon 3000G价格低廉，并且原生支持 Radeon 图像处理技术")

最终我选择了 AMD Athlon 3000G，仅售 $105，物超所值，还支持 Radeon 图像处理技术，[CPU 基准测试](https://www.cpubenchmark.net/cpu.php?cpu=AMD+Athlon+3000G&id=3614)也表现良好。

### 机箱

我最喜欢的电脑机箱是 Fractal Design，所以我选择了 Fractal Design Node 304 Black。这是一个紧凑的迷你 ITX 机箱，不像传统的塔式机箱，它的设计样式更接近于立方体，而且有 6 个硬盘托架，不管是目前使用还是将来增加硬盘都够用了。

![The Fractal Design Node 304 Black 是一款迷你 ITX 机箱，有 6 个硬盘托架](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-07-12-44-dn646B.jpg "The Fractal Design Node 304 Black 是一款迷你 ITX 机箱，有 6 个硬盘托架")

### 数据盘

我的机箱有 6 个硬盘托架，所以我决定购买四块 8TB 的硬盘作为数据盘。使用 raidz1 时可用存储容量可达 22.5TB；将来如果增加第五块硬盘，可用存储容量将达到 30.9TB；如果再增加第六块硬盘，可用存储容量将达到 37TB。

8TB 的硬盘 RPM（revolutions per minute，即转/每分钟） 基本上都不会低于 7200，最高可达 10k RPM。RPM 高于 7200 对我来说并没有什么影响，因为主要瓶颈在于网络。也没必要选择 10k RPM 的硬盘，性能并不会强多少，性价比不高。

根据 [Backblaze 的硬盘统计数据](https://www.backblaze.com/blog/backblaze-drive-stats-for-2021/)，硬盘价格越高，越不容易发生故障。我也考虑过购买 $400 的硬盘，因为它们的故障率非常低，但后来仔细一想，花两倍的钱将故障率降低几个百分点是不划算的。

最后强调一点：不要购买[使用 SMR（Shingled Magnetic Recording，叠瓦式磁记录）技术的硬盘](https://www.truenas.com/community/resources/list-of-known-smr-drives.141/)，因为 [ZFS 在 SMR 硬盘上的表现非常差](https://www.servethehome.com/wd-red-smr-vs-cmr-tested-avoid-red-smr/)。建议直接购买传统的使用 CMR（Conventional Magnetic Recording，传统式磁记录）技术的硬盘。

最终我选择了[东芝 N300](https://www.newegg.com/toshiba-n300-hdwg480xzsta-8tb/p/N82E16822149793) 和[希捷 IronWolf](https://www.newegg.com/seagate-ironwolf-st8000vn004-8tb/p/N82E16822184796)，主要是因为 TrueNAS 论坛和 Reddit 上面对这两款硬盘的评价都比较积极，而且价格也很合理，都在 $180-190 之间。

<table style="margin-bottom:-2.5em;"><tr>
<td><img style="width: 400px;" src="https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-09-09-25-Bck3ps.jpg"></td>
<td><img style="width: 400px;" src="https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-09-09-26-INfHLg.jpg"></td>
</tr></table>
<figcaption>东芝 N300（左） 和希捷 IronWolf（右）</figcaption>

### 系统盘

TrueNAS 需要将系统安装在独立的硬盘中，但是对硬盘要求不高，只需要 2GB 的空间，而且不会经常读写。

![金士顿 A400 固态硬盘，容量 120GB，价格 $32](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-09-09-33-wbaeWm.jpg "金士顿 A400 固态硬盘，容量 120GB，价格 $32")

最终我选择了[金士顿 A400](https://www.newegg.com/kingston-a400-120gb/p/N82E16820242474)，因为价格便宜，120GB 只要 $32，而且是 M.2 固态硬盘。M.2 好啊，不需要连数据线也不需要连电源线，而且外形小巧纤薄，几乎不占用任何空间。

### 内存条

经过我的研究发现，很多人会提到 ZFS 的一条法则：系统中每 TB 的硬盘空间需要 1GB 的内存。但 ZFS 研发人员 Richard Yao 又说[根本没有这种规则](https://www.reddit.com/r/DataHoarder/comments/5u3385/linus_tech_tips_unboxes_1_pb_of_seagate/ddrngar/)，ZFS 的确有部分功能对内存的要求比较高（比如删除重复数据），其他情况下 [ZFS 只需要很少的内存](https://www.reddit.com/r/DataHoarder/comments/3s7vrd/so_you_think_zfs_needs_a_ton_of_ram_for_a_simple/)。

内存的选购非常无聊，根本找不到可信的基准测试和用户报告，我的选购过程是这样的：

+ 查看有哪些内存条[与华硕 A320I-K 主板兼容](https://www.asus.com/Motherboards-Components/Motherboards/CSM/PRIME-A320I-K-CSM/HelpDesk_QVL/)。
+ 筛选出 16GB 和 32GB 的内存条，因为我需要两根内存条来组成 32GB 或 64GB内存。
+ 筛选出值得信任的品牌（Corsair, Crucial, G.SKILL, Kingston, Samsung, Patriot, Mushkin, HyperX）。
+ 筛选出价格低于 $150 的内存条。

最终我选择了 [CORSAIR Vengeance LPX 32GB CMK32GX4M2A2400C14 (2 x 16GB)](https://www.newegg.com/corsair-32gb-288-pin-ddr4-sdram/p/N82E16820233854)，价格只有 $128。

![CORSAIR Vengeance LPX 32GB CMK32GX4M2A2400C14 (2 x 16GB) 与 A320I-K 主板兼容，价格合理](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-09-09-53-hMdypj.jpg "CORSAIR Vengeance LPX 32GB CMK32GX4M2A2400C14 (2 x 16GB) 与 A320I-K 主板兼容，价格合理")

### 电源（power supply unit，PSU）

如果只看电源功率，基本上选择任何消费级 PSU 都够用了。根据 [PCPartPicker 的数据](https://pcpartpicker.com/)，我的系统只需要 218 瓦的电源。本来我想买的是 300-400 瓦的 PSU，但市面上没有这个功率的半模组 PSU，最终只能选择 500 瓦的 [EVGA 110-BQ-0500-K1](https://www.newegg.com/evga-500-bq-110-bq-0500-k1-500w/p/N82E16817438101)。

![EVGA 110-BQ-0500-K1 是一款半模组 PSU，功率为 500 瓦，完全够用](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-09-27-Rq6Zh4.jpg "EVGA 110-BQ-0500-K1 是一款半模组 PSU，功率为 500 瓦，完全够用")

### 90 度角 SATA 电缆

![由于机箱空间限制，我需要一个 90 度角 SATA 电缆](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-09-31-jhLwIW.jpg "由于机箱空间限制，我需要一个 90 度角 SATA 电缆")

在这之前我从来没有用过 90 度角 SATA 电缆，但我的主板和 PSU 之间的空间太小了，放不下标准的 SATA 电缆，只能使用 90 度角的 SATA 电缆来解决这个问题。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-09-35-wJPZRy.jpg)

## 暂不考虑的硬件

由于价格、复杂性或物理空间的原因，有几个硬件不在我的考虑范围之内。

### 显卡（GPU）

由于物理空间限制，再加上主板接口有限，我就不使用专用显卡了，直接使用支持 Radeon 图像处理技术的主板即可。

### 主机总线适配器（HBA）

NAS 一般都需要一个[主机总线适配器](https://www.truenas.com/community/threads/whats-all-the-noise-about-hbas-and-why-cant-i-use-a-raid-controller.81931/)（HBA），HBA 是一个可以放入主板 PCI 插槽的芯片，用来增加主板可以支持的硬盘数量。

我暂时还不需要 HBA，华硕 A320I-K 主板的 4 个 SATA 接口足以满足我当下的需求，我只需留出一个 PCI 插槽为将来的 HBA 做准备即可。

### ECC 内存

在研究不同的 TrueNAS 组装方案时，我看到了一部分贴子说 ECC 内存（使用了能够实现错误检查和纠正技术的内存条）是防止数据损坏的必备条件，但最终我还是选择了普通的内存条。虽然我也不希望内存数据被破坏，但我在过去 30 年中一直用的都是普通的内存条，并没有遇到过内存数据损坏的情况，而且我只是家用而已，普通内存条应该够用了。

### 单独的 SLOG 硬盘

许多人使用 ZFS 会用到一块单独的专用 SSD，这块单独的 SSD 被称为 [SLOG (separate intent log)](https://www.truenas.com/docs/references/slog/)。

系统向文件系统写入数据时，会产生很多的日志文件，这些日志文件写到专门的 SSD 比直接写到多个数据盘中要快好几个数量级。这样可以[显著提高写入速度](https://www.servethehome.com/exploring-best-zfs-zil-slog-ssd-intel-optane-nand/)，因为当应用向数据盘写入数据时，ZFS 可以快速将对数据写入操作的意图的日志文件写入专门的 SSD，然后直接告诉应用写入成功了，接下来再根据日志文件异步地将数据转移到存储池中。

受硬盘托架和接口的限制，最终我没有选择专门的 SLOG 硬盘，因为增加一个 SLOG 硬盘就需要放弃唯一的 PCI 插槽或者浪费其中一个硬盘托架，不划算。我宁愿把这部分空间留出来给以后增加数据盘使用。

## 我的硬件列表

| 硬件类别  | 型号                                                         | 价格           |
| --------- | ------------------------------------------------------------ | -------------- |
| CPU       | [AMD Athlon 3000G](https://www.newegg.com/amd-athlon-3000g/p/274-000M-001B8) | $105.13        |
| 主板      | [华硕 Prime A320I-K](https://www.asus.com/Motherboards-Components/Motherboards/PRIME/PRIME-A320I-K/) | $97.99         |
| 显卡      | 不需要，主板自带                                             | $0             |
| 系统盘    | [金士顿 A400 120GB](https://www.newegg.com/kingston-a400-120gb/p/N82E16820242474) | $31.90         |
| 内存条    | [CORSAIR Vengeance LPX 32GB CMK32GX4M2A2400C14 (2 x 16GB)](https://www.newegg.com/corsair-32gb-288-pin-ddr4-sdram/p/N82E16820233854) | $127.99        |
| 电源      | [EVGA 110-BQ-0500-K1 500W 80+ Bronze Semi-Modular](https://www.newegg.com/evga-500-bq-110-bq-0500-k1-500w/p/N82E16817438101) | $44.99         |
| 机箱      | [Fractal Design Node 304 Black](hhttps://www.newegg.com/black-fractal-design-node-304-mini-itx-tower/p/N82E16811352027) | $99.99         |
| SATA 电缆 | [Silverstone Tek Ultra Thin Lateral 90 Degree SATA Cables](https://www.newegg.com/p/N82E16812162042) (x2) | $22.30         |
| 总价      |                                                              | $530.29 |
| 数据盘    | [东芝 N300 HDWG480XZSTA 8TB 7200 RPM](https://www.newegg.com/toshiba-n300-hdwg480xzsta-8tb/p/N82E16822149793) (x2) | $372.79        |
| 数据盘    | [希捷 IronWolf 8TB NAS Hard Drive 7200 RPM](https://www.newegg.com/seagate-ironwolf-st8000vn004-8tb/p/N82E16822184796) (x2) | $359.98        |
| 总价      |                                                              | $1,263.06  |

> 注意：该主板可能与 AMD Athlon 3000G CPU 不兼容，参考下文。

## 与商业 NAS 产品对比

| Product      | 2022 年自己组装的 NAS                                        | 群晖 DS920+                                                  | 威联通 TS-473A-8G-US                                         |
| ------------ | ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| 硬盘托架数量 | 6                                                            | 4                                                            | 4                                                            |
| 内存容量     | 32 GB                                                        | 4 GB                                                         | 4 GB                                                         |
| 最高内存容量 | 32 GB                                                        | 8 GB                                                         | 8 GB                                                         |
| CPU 跑分     | [4479](https://www.cpubenchmark.net/cpu.php?cpu=AMD+Athlon+3000G&id=3614) | [3002](https://www.cpubenchmark.net/cpu.php?cpu=Intel+Celeron+J4125+%40+2.00GHz&id=3667) | [4588](https://www.cpubenchmark.net/cpu.php?cpu=AMD+Ryzen+Embedded+V1500B&id=4304) |
| 总价         | $530.29                                                      | $549.99                                                      | $549                                                         |

从上述表格来看，我自己组装的 NAS 总成本与商业 NAS 产品差不多，但性价比更高，因为内存是他们的 8 倍，而且操作系统是开源的，没有所谓的供应商锁定。

## 组装花絮

![所有零部件](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-03-11-19-eVso8i.jpg "所有零部件")

![在 Fractal Design 迷你 ITX 机箱中安装主板](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-10-39-sH6D1y.jpg "在 Fractal Design 迷你 ITX 机箱中安装主板")

![我太喜欢 M.2 SSD 了，不需要数据线，拧个螺丝就完了](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-10-40-Kcbhdk.jpg "我太喜欢 M.2 SSD 了，不需要数据线，拧个螺丝就完了")

![这是我组装的第一个不把 PSU 的背面暴露在机箱外的系统，机箱有一条很短的 NEMA 延长线，将内部 PSU 引向机箱自身的外部电源输入。](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-10-42-IrkT0q.jpg "这是我组装的第一个不把 PSU 的背面暴露在机箱外的系统，机箱有一条很短的 NEMA 延长线，将内部 PSU 引向机箱自身的外部电源输入。")

<table style="margin-bottom:-2.5em;"><tr>
<td><img style="width: 400px;" src="https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-10-44-Gw48KA.jpg"></td>
<td><img style="width: 400px;" src="https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-10-45-KAgBmk.jpg"></td>
</tr></table>
<figcaption>主板的 SATA 接口和 PSU 之间的空间非常狭窄，只能使用特殊的 90 度角 SATA 电缆。</figcaption>

![将所有东西都接到主板后面（CPU 风扇除外）](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-10-57-Lrpf3x.jpg "将所有东西都接到主板后面（CPU 风扇除外）")

![大功告成](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-11-02-V7U8gD.jpg "大功告成")

## 使用 TinyPilot 管理服务器

老读者应该还记得，我用 Raspberry Pi 创建了一个专门用于初始化和管理服务器的工具叫 [TinyPilot](https://mtlynch.io/tinypilot/)。这台 NAS 是我用 TinyPilot 搭建的第三个服务器，也是我用 TinyPilot 最新版本 [TinyPilot Voyager 2](https://tinypilotkvm.com/product/tinypilot-voyager2?ref=mtlynch.io) 搭建的第一台服务器。

![TinyPilot Voyager 2 可以在无需键盘、鼠标和显示器的情况下给服务器安装操作系统](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-11-13-EAs9bG.jpg "TinyPilot Voyager 2 可以在无需键盘、鼠标和显示器的情况下给服务器安装操作系统")

TinyPilot Voyager 2 真是太方便了！无需将键盘或显示器连接到服务器上，就可以启动 BIOS 并安装 TrueNAS 操作系统，所有的这一切都在我的浏览器中完成。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-11-18-msIybY.jpg)

TinyPilot 还是有一些小问题的，不过无伤大雅。比如它虽然可以加载 `.img` 和 `.iso` 等镜像文件，但它还不知道如何与目标计算机共享原始文件。当我需要为华硕的 BIOS 升级加载 `.CAP` 文件时，我将这些文件放到了 USB 中，这样 TinyPilot 就找不到了。希望 TinyPilot 能尽快支持这种场景，下次我就好升级 BIOS 了。

## 是 BIOS 版本不兼容？还是我傻？

当我把所有零部件都组装好，接通电源之后傻眼了，显示器（TinyPilot）上没有看到任何图像输出。

什么鬼？难道我误解了主板的兼容性要求？重新安装内存，重新安装 CPU，并检查所有电缆，结果还是一样。。。

最后不得不搬出祖传秘籍：谷歌搜索。一番搜索之后，看到有人提到华硕 Prime A320I-K 主板需要升级 BIOS 才能与 AMD Athlon 3000G 兼容。虽然我之前挑选主板的时候看到过这个警告，但被我忽视了。

现在就比较尴尬了，这是一个先有鸡还是先有蛋的问题。。。因为只有 CPU 正常工作，我才好升级 BIOS。不过问题不大，我 [2017 年 Homelab 服务器](https://mtlynch.io/building-a-vm-homelab-2017/)中使用的 [Ryzen 7 CPU 和华硕 Prime A320 主板是兼容的](https://www.asus.com/us/Motherboards-Components/Motherboards/PRIME/PRIME-A320I-K/HelpDesk_CPU/)，我将那台服务器的 CPU 和 GPU 拿下来插到 NAS 服务器上，终于成功开机了！

![使用旧的 Homelab 服务器 CPU 来升级 NAS 的 BIOS](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-14-23-KWLTRR.jpg "使用旧的 Homelab 服务器 CPU 来升级 NAS 的 BIOS")

最让我无语的是，系统启动之后，主板显示我的 BIOS 版本仍然是 2203，也就是华硕声称它与 AMD Athlon 3000G CPU 兼容的 BIOS 版本。可是我明明已经将 BIOS 更新到了最新的 5862 版本，不管它了。。

![华硕 Prime A320I-K 主板的 CPU 兼容性页面声称兼容 AMD Athlon 3000G CPU 的最低 BIOS 版本为 2203](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-14-27-ZMtbhc.png "华硕 Prime A320I-K 主板的 CPU 兼容性页面声称兼容 AMD Athlon 3000G CPU 的最低 BIOS 版本为 2203")

到这里问题还没有解决，系统启动后仍然看不到启动画面。排查了一通后发现我把 HDMI 线插到了 DisplayPort 接口中，我被自己蠢哭了😂

![DisplayPort 接口为啥和 HDMI 这么像？很容易让人插错线诶](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-14-38-NqULSp.jpg "DisplayPort 接口为啥和 HDMI 这么像？很容易让人插错线诶")

现在在回过头来看一下之前的问题，细思极恐，问题真的是 BIOS 和 CPU 不兼容吗？现在没法验证了，我想大概有两种可能：

1. 我太蠢了，将 HDMI 线插到 DisplayPort 接口里了，直到我升级了 BIOS 之后才发现这个问题。
2. 华硕才是蠢货，误导大众，AMD Athlon 3000G CPU 与 BIOS 2203 版本根本就不兼容。

不管如何，现在终于启动成功了，而且不需要再借助外部的硬件了，可以松一口气了。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-14-49-mP0z2x.png)

## 性能测试

目前还找不到较好的基准测试工具来测试 NAS 的性能，因为大部分测试工具都是对本地磁盘 I/O 进行测试，而真实世界的使用场景是通过网络访问的，所以这种测试结果是没有参考价值的。

我是这么测试的：先[生成两组带有随机数据的文件](https://github.com/mtlynch/dummy_file_generator)，然后使用 [robocopy](https://docs.microsoft.com/en-us/windows-server/administration/windows-commands/robocopy) 来测试本地客户端和 NAS 之间的传输速度。这种测试方法也不是很严格，因为我没有使用完全独立的网络进行测试，测试时也没有关闭桌面上的其他进程。作为对照，我对旧的群晖 DS412+ 也进行了测试。

每一个 NAS 测试了两组不同的文件。第一组文件总共有 20 GiB，每个文件大小是 1 GiB；第二组文件总共有 3 GiB，每个文件大小是 1 MiB。而且我对加密卷和非加密卷分别进行了测试，每一组测试 3 次，取平均值。

### 读取性能

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-16-10-ISm3oD.png)

非加密卷的测试结果显示，已经使用 7 年开始生锈的群晖比全新的 TrueNAS 性能更好。群晖读取小文件比 TrueNAS 快 31%，读取大文件比 TrueNAS 快 10%。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-16-13-5AxhV6.png)

到加密卷测试部分，群晖就不行了，被 TrueNAS 碾压。群晖对加密卷的读取速度比非加密卷下降了 67-75%，而 TrueNAS 却几乎没有变化。最终结果表明 TrueNAS 对加密卷小文件的读取速度是群晖的 2.3 倍，对加密卷大文件的读取速度是群晖的 3 倍。我的大部分数据都是加密的，所以这个测试结果更能代表我的使用场景。

### 写入性能

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-16-21-A9Fnlk.png)

尽管群晖读取非加密卷的速度超越了 TrueNAS，在写入方面却不尽人意。即便是非加密卷，TrueNAS 对小文件的写入速度也比群晖快了 77%，对大文件的写入速度和群晖不相上下。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-16-26-Xq2cWp.png)

加密卷就更离谱了，TrueNAS 对加密卷小文件的写入速度是群晖的 5.2 倍，对加密卷大文件的写入速度是群晖的 3.2 倍。

### 功耗测试

我使用 [Kill A Watt P4460 电力使用监控器](http://www.p3international.com/products/p4460.html)来测量 TrueNAS 和群晖的功耗情况：

|      | 群晖 DS412+ | 2022 NAS |
| ---- | ----------- | -------- |
| Idle | 38 W        | 60 W     |
| Load | 43 W        | 67 W     |

测试结果表明新服务器的功耗比旧的群晖多了 60%，这让我有点懵逼，我这边的电费是 $0.17/千瓦时，这么一算**服务器每个月的成本是 $7.20**。

具体什么原因还不太清楚，可能是 PSU 的缘故。群晖的 PSU 和其他组件的功耗完全匹配，而 TrueNAS 的 500W PSU 可能利用率只有 15%，系统不需要这么大的功率。

## 使用感受

### 主板

我对华硕 Prime A320I-K 主板最大的意见就是兼容性，也有可能是我搞错了（前面解释过）。

即便是我搞错了，我还是要吐槽一下它的 BIOS 升级体验，按道理应该可以直接下载升级最新的 BIOS 固件，但是我升级了之后它还是提示我需要升级，最后我不得不手动下载固件并上传到 USB 进行手动升级。

<table><tr>
<td><img style="width: 400px;" src="https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-17-00-XkMGcS.png"></td>
<td><img style="width: 400px;" src="https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-17-00-pd2SWu.png"></td>
</tr></table>

### 修复 Realtek 网络驱动

当我的系统网络负载很高时，主板上的以太网适配器经常会挂掉。Reddit 论坛上的一位网友帮我找到了原因，FreeBSD 针对 A320I-K 主板的 Realtek 网卡的驱动不稳定，我们可以将其替换为官方的驱动，步骤如下：

1. 打开 TrueNAS 可视化界面，依次进入 System > Tunables；
2. 添加下面两个选项：

| 变量         | 值                       | 类型   |
| ------------ | ------------------------ | ------ |
| `if_re_load` | `YES`                    | loader |
| `if_re_name` | `/boot/modules/if_re.ko` | loader |

### 机箱

说实话，整体使用下来，我对 Fractal Design Node 304 这个机箱很失望，[我还是比较喜欢之前使用的 Fractal Design Meshify C](https://mtlynch.io/building-a-vm-homelab/#my-2020-server-build)，因为它有一部分功能是我在其他机箱身上从来没见过的。

虽然 Fractal Design Node 304 看起来还不错，但实际使用时却是非常尴尬，没有任何文档可供参考，官方提供的案例也是不痛不痒的。

当然了，我知道机箱设计师为了缩小机箱的体积必须在其他方面有所牺牲，或许是我太苛刻了。

### CPU

CPU 我非常满意，Athlon 3000G 对我来说性能过剩，过去一个月的 CPU 负载一直都是 99% 空闲。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-17-21-pjRq8j.png)

这个 CPU 最吸引我的一点是支持 AMD 的 Radeon 图像处理技术，这样就不需要单独的显卡了。价格只有 $105，很划算。

### 数据盘

数据盘暂时不作评判，目前一切安好，五年后再看。

一开始我担心数据盘噪声太大，可结果表明，只有在性能测试期间删除文件的时候，才会听到硬盘的声音。

### 电源（PSU）

我的系统空转功率是 60 瓦，明显用不到这么大功率的电源，当时要是多花点精力挑选功率更低的电源就好了，实际上我只需要一个 300-400 瓦的电源。

### 系统盘

系统盘选择金士顿 A400 是明智的，非常稳定，容量用来承载 TrueNAS 操作系统绰绰有余。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-17-40-k0RAHh.png)

### TrueNAS

我安装的是 TrueNAS Core 13，使用的 FreeBSD 版本相对而言比较成熟。你也可以安装 TrueNAS Scale，它基于 Debian，具有更广泛的硬件和软件兼容性。

如果要比较用户界面，群晖是很难被打败的，这是见过的 NAS 中最优雅直观的界面，非常简洁，用户无需了解地层文件系统的技术细节。而 TrueNAS 有一股黑客风，**它的界面似乎是由一个对命令行以外的东西不屑一顾的人设计的**。

<table><tr>
<td><img style="width: 400px;" src="https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-17-46-mh0Qto.png"></td>
<td><img style="width: 400px;" src="https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting4@main/uPic/2022-06-10-17-46-8gQbuX.png"></td>
</tr></table>

TrueNAS 想要创建一个新卷，并通过 SAMBA 共享出去，需要在几个毫不相干的菜单之间来回切换，而且没有任何提示告诉我接下来该怎么操作。群晖就比较简单了，它会一步一步地引导我完成所需的设置。

TrueNAS 安装第三方应该也比较麻烦，就拿 Plex 举例，虽然 Plex 是 TrueNAS 的预装插件，但我还是花了一个小时的时间来搜索文档。相比之下，在群晖上安装 Plex 就是点两下鼠标的事情，两分钟就可以搞定。

即便如此，我还是坚持使用 TrueNAS，因为我更关心的是厂商和平台锁定，而且我喜欢开源软件。如果我要给不在乎意识形态的朋友推荐 NAS，我一定会推荐群晖。

### ZFS

ZFS 功能很强大，但目前我只用到了 RAID 功能，其他功能暂时没有需求。

很多人喜欢 ZFS 的快照功能，但我的 restic 备份方案中已经有快照功能了，所以暂时也用不到 ZFS 的快照功能。我已经使用 restic 两年了，印象中只一次需要从快照中恢复数据。

还有一个功能是为加密数据创建快照，这个功能比较有趣，它可以在不解密数据的情况下直接创建快照。我有很多不需要经常访问的加密数据，使用这个功能就能够在无需解密的情况下进行定期备份。

### 总结

总的来说，我还是很喜欢这个新 NAS 的，折腾的过程中也学到了很多东西。毕竟这不是我第一次使用 NAS，之前使用群晖已经储备了相关的技术能力，切换到 TrueNAS 之后也就没有那么吃力。当然了，该学还是要学的，我已经准备好恶补 ZFS 和 TrueNAS 的相关知识了。