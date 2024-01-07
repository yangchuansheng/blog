---
keywords:
- TikTok
- TikTok 免拔卡
- 安卓
- KernelSU
- Magisk
- Zygisk
- LSposed
- iOS
title: "TikTok 免拔卡安装教程：支持安卓与 iOS"
date: 2023-12-17T14:06:37+08:00
lastmod: 2023-12-17T14:06:37+08:00
description: 揭秘如何在中国大陆境内绕过 TikTok 的限制，在安卓和 iOS 设备上正常使用 TikTok，包括使用 KernelSU、LSposed 等工具。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- TikTok
- English
- Magisk
- Android
categories: 
- tech-social
---

抖音，一个让全中国都痴迷的短视频分享平台，已经成为年轻一代表达自我和探索创意的重要工具。

但你可能不知道的是，抖音在国际市场上有一个 “孪生兄弟”——**TikTok**。虽然两者在核心功能上极为相似，但它们针对的受众和运营策略却有所不同。TikTok 作为抖音的国际版本，不仅继承了抖音的精髓，还融入了全球文化的多样性，吸引了全球范围内的用户。

抖音在国内火得一塌糊涂，但让人想不到的是它的国际版 TikTok 在海外仍然火得一塌糊涂，已连续两年霸榜 App 下载排行榜榜首了。但是中国大陆境内却是无法使用 TikTok 的，这是为什么呢？

## 国内无法使用 TikTok 的原因

尽管 TikTok 是由中国的字节跳动公司开发，但它主要服务于国际市场，与国外的社交平台如 Facebook 和 Instagram 类似。由于其全球定位，TikTok 并没有因为其 “国产” 身份在中国获得特殊待遇。实际上，当国内用户尝试使用 TikTok 时，他们通常会遭遇一个问题：**应用界面显示 “无网络连接”**，就像是进入了一个黑暗的虚拟空间。这种情况的背后有两个主要原因：

**首先**，像 Google 和 Facebook 一样，TikTok 也受到中国大陆的互联网限制。这意味着即使在国内成功下载和安装了 TikTok，用户仍然无法正常访问其服务。更让人无语的是，**TikTok 会检测用户手机中的 SIM 卡信息。如果识别出是中国大陆的三大运营商之一，应用就会自动屏蔽服务**。

其次，从商业战略的角度来看，字节跳动公司并无必要在中国大陆推广 TikTok。他们已经在国内成功运营了抖音，**开放 TikTok 在国内的使用权就会与自家的抖音形成不必要的内部竞争**。

---

那么国内的小伙伴就真的无法使用 TikTok 了么？办法肯定是有的，而且五花八门，比如拔掉 SIM 卡，或者买一个国外的 SIM 卡等等，但这些方法非常不适合**主力手机**，虽然搞个备用机或者 iPad 可以解决 SIM 卡的问题，但我刷 TikTok 是为了干嘛的？**都没法在主力手机上刷，我还用个毛？**

本文将会给你传授如何免拔卡使用 TikTok 的方法，其他的方法都是鸡肋，不用看了。

{{< alert >}}
注意：TikTok 所有的操作都**需要魔法上网**，这是大前提，没有这个大前提，其他所有操作都免谈。
{{< /alert >}}

---

## 国内可以用 TikTok 来干什么？

那当然是学英语啊！

偶然发现 Twitter 上一位大佬的帖子，觉得这个方法甚妙，是**全世界所有人学英语的最佳方案，没有之一**。

没有那么多花里胡哨的理论和步骤，不需要每天强制给自己定什么狗屁计划，没有任何心智负担，就是特么打开 TikTok 开始刷短视频。唯一的计划就是：**只要你想娱乐，只要你想刷手机，就给我打开 TikTok 刷短视频，把烈性海洛因当成药来用，给我以毒攻毒！**

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/2023-12-17-14-35-uR6kNO.png)

TikTok 里的语音非常口语化，也有不少是专门教英语的，口音也更丰富一些，老人的含混，小孩的快速，中东印度的口音也很常见。

## 注册 TikTok 账号

在正式使用手机安装使用 TikTok 之前，你需要注册一个 TikTok 账号，这个非常简单，直接电脑或者手机打开 [TikTok 网页](https://www.tiktok.com/)注册就行。建议使用海外邮箱注册，比如 Gmail 邮箱或者 Outlook 邮箱等。当然，如果你有 Google Voice 等美国虚拟手机号，也可以用手机号注册。

## 安卓免拔卡使用 TikTok

首先我们来介绍如何在安卓手机上免拔卡安装使用 TikTok。

### TikTok 破解版

安卓手机最简单的使用方式就是下载破解版 TikTok，此方法简单无脑，安装完了就可以使用。这个破解版是**俄罗斯人**构建的，支持非常多的功能：

+ 去所有广告、去保存视频水印。
+ 内置自定义全球区域功能向导。
+ 可以自定义视频下载保存位置。
+ 解除国家/地区限制，无视区域封锁。
+ 解除所有下载限制，可以保存任何视频。
+ 解除合拍和拼接限制，移除了调试信息。
+ 添加了播放进度条，支持手机号码登陆。
+ 为下载视频文件的名称添加了作者标签。
+ 修正谷歌授权、Facebook 授权、VK 授权。
+ GIF 和视频保存路径重定向到 Movies/TikTok。
+ 禁用不必要活动控件、禁用所有类型分析、禁用统计分析、对齐优化、极限压缩。
+ 启用观看历史、优化电池消耗、禁用自动启动，隐藏的根权限，删除许多其他限制。
+ 强制启用高画质视频、强制启用高品质音频、强制启用超清分辨率、并启用抗锯齿。

官方频道：[TikTokModCloud](https://t.me/TikTokModCloud)

官方频道的下载链路比较深，你也可以从一些第三方网站或者频道下载：

+ [ROCKMODS](https://www.rockmods.net/2019/02/tiktok.html)
+ [破解软件中文频道](https://t.me/Pjapk)

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/2023-12-16-23-50-COAYY3.jpg)

这个破解版可以配合 **TikTok 插件 (TikTokPlugin)** 使用，该插件**可以自定义设置，用于配合此破解版选择全球区域！**

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/2023-12-17-00-00-X5WbOP.webp)

{{< alert icon="fire" cardColor="#e63946" iconColor="#1d3557" textColor="#f1faee" >}}
友情提醒：破解软件可能含有恶意软件，如病毒、木马、间谍软件等，如果执意要使用破解版，请自行承担一切可能的后果！
{{< /alert >}}

### TikTok 官方版

破解版虽然香，但是它有风险啊。

如果你对破解版不放心，担心它有恶意软件，下面这个方法就是为你准备的。**既不用拔卡，也不用更改手机地区和语言，而且可以安装 TikTok 官方版！**

但是，**这个方案非常的复杂**，如果你不想折腾，建议还是使用破解版。下面言归正传。

这个方案有一个前提条件：**你的手机需要解锁 BootLoader！**

如果你的手机无法解锁 Bootloader，下面的步骤就不用看了。

#### 安装系统修改工具

第一步我们需要安装系统修改工具，顺便获取 root 权限。目前有两款主流的安卓系统修改工具：

+ [Magisk](https://github.com/topjohnwu/Magisk)：开源的 Android 系统修改工具，它主要用于在不破坏系统完整性的情况下进行系统修改和定制。Magisk 的目标是提供一个可靠的方式来实现 Root 权限管理、模块化修改和隐藏 Root 状态等功能。
+ [KernelSU](https://github.com/tiann/KernelSU)：KernelSU 是 Android GKI 设备的 root 解决方案，它工作在内核模式，并直接在内核空间中为用户空间应用程序授予 root 权限。同时还提供了一个基于 overlayfs 的模块系统，允许您加载自定义插件到系统中。

**推荐使用 KernelSU**，毕竟人家工作在内核模式，对于一些强制检测 root 的 App 隐藏效果更好。具体安装方法请参考 [KernelSU 的官方文档](https://kernelsu.org/zh_CN/guide/installation.html)。

如果你更倾向于使用 Magisk，请自己搜索安装教程，网上教程比较多，特别是[酷安](https://www.coolapk.com/)，你可以下载一个酷安 App，这里是安卓发烧友的聚集地。

#### 启用 Zygisk

Zygisk，顾名思义，就是**注入 Zygote 后的 Magisk**。它能为 Magisk 模块，提供**更深入、更强悍**的修改能力。它有一个排除列表，可以撤销 Magisk 做的所有修改。这样你就能手动划定，模块起作用的范围。

有了 Zygisk，我们才可以安装另一个大杀器：LSposed。不过这是后话，下一步我们再介绍 LSposed。

从 Zygisk 的命名就可以看出来，这是 Magisk 的功能，但是 KernelSU 也不用慌，有人已经将其提取为一个独立的项目，为 KernelSU 提供 Zygisk API 支持，并替换 Magisk 内置的 Zygisk。项目名称：[Zygisk Next](https://github.com/Dr-TSNG/ZygiskNext)

KernelSU 用户直接在 [Zygisk Next 的 Release 页面](https://github.com/Dr-TSNG/ZygiskNext/releases)下载 zip 模块包：

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/2023-12-17-12-08-Dr9HXW.jpg)

然后打开 KernelSU 的管理 App，点击右下角的 “安装” 刷入 KernelSU 即可。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/2023-12-17-12-13-9Z3FBi.jpg)

Magisk 用户就更简单了，直接在 Magisk 的设置里打开 Zygisk 即可。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/2023-12-17-12-16-lDe9hn.png)

#### 刷入 LSposed

LSposed 是一个基于 Xposed Framework 的开源项目，用于在 Android 设备上进行系统级的模块化定制和修改。Xposed Framework 允许用户在不修改 Android 系统源代码的情况下，通过模块来实现各种定制和功能增强。

与 KernelSU 和 Magisk 不同，**LSposed 的每个模块都是一个 App，App 是有 GUI 界面的，你可以打开 App 进行各种设置。而 KernelSU 和 Magisk 的模块并不是 App，没有 GUI 界面，就是一堆脚本和文件。**

但是 LSposed 需要作为模块刷入 KernelSU 或者 Magisk，这是为什么呢？因为 LSposed 对系统的修改是不可撤销的，而 Zygisk 可以撤销对系统的修改 (玩过容器的同学应该都懂，所谓的可撤销实际上和容器原理类似，就是挂载一个虚拟的文件系统，你挂载到这个文件系统上随便改，对原来的系统没有任何侵入)，因此有人想出了这个**套娃**的方案！

将 LSposed 套娃到 KernelSU 或者 Magisk，就不会对系统产生任何侵入。

所以 LSposed 和 KernelSU/Magisk 是互补关系，相辅相成。

LSposed 的刷入非常简单，直接下载对应 Zygisk 的 [LSPosed](https://github.com/LSPosed/LSPosed/releases/latest) 版本并在 KernelSU 或者 Magisk 中刷入，然后重启手机。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/2023-12-17-12-32-BiKekC.jpg)

#### 安装 TikTok

直接从 Google Play 应用商店安装官方版本的 TikTok。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/2023-12-17-12-37-VbMqAf.jpg)

如果你的手机没有 Google Play，可以到一些第三方镜像站去下载安装，比如：[apkpure](https://apkpure.com/cn/)

{{< alert icon="fire" cardColor="#e63946" iconColor="#1d3557" textColor="#f1faee" >}}
**切记：安装完 TikTok 之后千万不要打开！千万不要打开！千万不要打开！**
{{< /alert >}}

#### 修改 SIM 卡信息

接下来安装可以修改 SIM 卡信息的相关模块 Guise。直接在 [Guise 的 Release 页面](https://github.com/Houvven/Guise/releases)下载最新的 apk：

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/2023-12-17-12-45-oMEa9p.jpg)

然后在手机中安装即可。安装完成后打开 LSposed，点击 Guise 模块，然后指定模块作用域为 TikTok，并 “启用模块”。**最好再重启一下手机。**

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/2023-12-17-12-49-b8oS9s.webp)

然后打开 Guise 应用，将 SIM 卡运营商伪装成美国的运营商，同时将系统语言伪装成英文。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/2023-12-17-14-05-2INZUI.webp)

#### 打开 TikTok

最终我们就可以打开 TikTok 开始愉快地看视频了，账号登录、点赞、收藏、关注、评论都可正常使用。

| ![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/2023-12-17-14-24-GvHDL8.webp) | ![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/2023-12-17-14-26-oQ1l3c.webp) | ![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/2023-12-17-14-27-w6wXYX.webp) |
| ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |

## iOS 免拔卡使用 TikTok

iOS 免拔卡使用 TikTok 的方案与安卓类似，大致分为两种方案：

一是在线安装破解版，直接在 iOS 上用 Safari 浏览器打开这个页面：**https://jiesuo.tk/**，然后根据说明进行操作即可。

二是直接利用魔法上网软件的 rewrite 规则来绕过 TikTok 的限制，具体可参考这个项目：[TikTok-Unlock](https://github.com/Semporia/TikTok-Unlock)

如果你是 Stash 用户，可以从这里获取规则：[https://github.com/blackmatrix7/ios_rule_script/tree/master/external/Stash/TikTokUnlock](https://github.com/blackmatrix7/ios_rule_script/tree/master/external/Stash/TikTokUnlock)

这个方法有一个难点是需要先安装旧版 TikTok，具体的方法是从 [iTunes for Windows V 12.6.5.3](https://secure-appldnld.apple.com/itunes12/091-87820-20180912-69177170-B085-11E8-B6AB-C1D03409AD2A5/iTunesSetup.exe) 抓包 TikTok Version 21.1.0 进行安装，很多人没有 Windows 操作系统，可能比较麻烦。

有一个比较简单的方法是在这个页面中先在线安装旧版：[https://jiesuo.tk/shadowrocket/](https://jiesuo.tk/shadowrocket/)，然后再使用上面项目中的 rewrite 规则。

## 问题解决

如果你在登录 TikTok 过程中遇到以下提示：

```
Too many attempts, please try again later
```

首先，我们需要知道 TikTok 为何会出现 “频繁访问” 提示。这是因为 TikTok 为了保护用户账号和信息安全，设置了访问频率的限制，一旦用户在短时间内操作频繁，就会认为有异常行为，从而强制停止相关操作。为了避免这种情况，我们可以尝试以下方法。

1. **暂停操作**

    如果您看到频繁访问提示，请暂停您的操作。尝试等待一段时间 (通常为几小时或一天)，然后重新尝试登录或执行其他操作。此外，您还可以尝试更换设备或网络环境，因为可能是因为您操作的设备或网络环境引起了这个问题。

2. **尝试用其他方式登录**

    有时，您可能无法正常登录 TikTok，但可以使用其他方式登录，例如使用您的电话号码或 Facebook 账号登录。如果您遇到这种情况，可以尝试更换登录方式并重新尝试操作。此外，也可能是您的账号受到了安全限制，建议您尝试更改密码或联系 TikTok 客服解决。

3. **减少操作频率**

    如果您经常需要执行一些重复性操作 (如点赞、评论等)，那么建议您减少操作频率并尽量避免连续操作。过度操作容易被 TikTok 检测到异常操作，从而导致频繁访问提示的出现。

4. **重置密码**

    如果以上方法都不起作用，还有一个比较有效的方法，那就是点击「忘记密码」，然后重置密码，就可以登录成功了，我也不知道为什么🤷‍♂️。。。