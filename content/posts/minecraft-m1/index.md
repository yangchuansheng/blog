---
keywords:
- Minecraft
- M1
- Apple Silicon
- M1 Max
- HMCL
- LWJGL
- Java
- Zulu
title: "在 M1 Macbook 中使用原生 Java 运行 Minecraft"
date: 2022-02-20T19:06:37+08:00
lastmod: 2022-02-20T19:06:37+08:00
description: 本文介绍了如何在 M1 芯片的 Mac 中不使用 Rosetta 优雅地玩 Minecraft
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- Minecraft
- macOS
categories: tech
img: https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting2@main/uPic/2022-02-22-13-41-fSSeXu.png
---

Apple 在去年年底发布了 M1 Max 芯片，这款芯片的性能在 M1 的基础上又上升了一个等级，作为一名伪果粉，我果断在第一时间入手了一台 32G 的 M1 Max。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting2@main/uPic/2022-02-18-22-40-5jngPI.png)

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting2@main/uPic/2022-02-18-22-41-zwaTz3.png)

收到电脑之后，我当然是装上了世界上最屌炸天的游戏 Minecraft。但 Minecraft 目前只支持 `x86_64` 架构，不支持 ARM，准确地说是只支持 `x86_64` 架构的 Java，因为 macOS 的 Minecraft 是通过 Java 来运行的。

这肯定不行啊，既然已经用 M1 Max 了，我怎么能忍受通过 Rosetta 转译来玩游戏呢，当然是 ARM 架构的原生 Minecraft 更高端大气上档次啦。

经过我的摸索，现已完美解决问题，步骤如下。

## 安装 ARM 版 Java

要想运行 Minecraft 时无需经过 Rosetta 转译，当然是要使用 ARM64 版本的 Java 了。好在 Zulu 提供了 ARM64 版本的 Java，只需要进入其[下载页面](https://www.azul.com/downloads/zulu-community/?version=java-11-lts&os=macos&architecture=arm-64-bit&package=jdk-fx)，依次选择 「Java 17」-「macOS」-「ARM 64-bit」-「JDK FX」，在右侧选择 `.dmg` 文件下载并安装。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting2@main/uPic/2022-02-19-11-40-rkuzV0.png)

安装完成后，可以通过运行命令 `/usr/libexec/java_home -V` 来查看系统中安装的所有 Java 的版本。

```bash
$ /usr/libexec/java_home -V
Matching Java Virtual Machines (3):
    17.0.1 (arm64) "Azul Systems, Inc." - "Zulu 17.30.15" /Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home
    ...
/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home
```

如果你的系统中有多个 Java 版本，这里都会显示出来，其中 17.0.1 这一行就是之前安装的 Zulu JDK 17。我们可以通过修改 `~/.zshrc` 来设置 `JAVA_HOME` 环境变量，改变系统默认的 Java 版本。

将下面的内容添加到 `~/.zshrc` 末尾。

```bash
# ~/.zshrc
export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home
```

执行以下命令使设置生效。

```bash
$ source ~/.zshrc
# 或者
$ . ~/.zshrc
```

## 下载 HMCL Launcher

HMCL Launcher 是一款非常流行的第三方启动器，支持很多自定义的功能，比如快速安装 Fabric 和 Forge、修改运行参数、设置 Java 版本、管理 Mod 等功能。除此之外还支持登录正版的微软账号。

当然，这些都不是最重要的，重点是咱不需要购买账号就可以玩了，简直是白嫖党的福音。

首先到 [HMCL 官方网站](https://hmcl.huangyuhui.net/download)或者 [GitHub Releases 页面](https://github.com/huanghongxun/HMCL/releases)下载启动器，然后建立一个专门的游戏目录（例如`~/Games/Minecraft`），将启动器放到这个目录下。

```bash
$ mkdir -p ~/Games/Minecraft/
$ mv ~/Downloads/HMCL-3.5.2.218.jar ~/Games/Minecraft
$ java -jar HMCL-3.5.2.218.jar # 打开HMCL
```

打开 HMCL Launcher，进 **版本列表** -> **安装新游戏版本**，安装 1.17.1 版本 Minecraft，并同时安装 `Fabric`。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting2@main/uPic/2022-02-19-12-41-LfYYRd.png)

## 获取 LWJGL 库文件

LWJGL 全称为： LightWight Java Game Library，意为轻量级 Java 游戏工具库。包含 OpenGL 、OpenCL、OpenAL、Vulkan API 对 Java 平台的原生绑定。

由于 Apple 发布的 M1 芯片移除了 LWJGL 库所依赖的个别 API，也未提供任何兼容方式，致使 Forge 和 Fabric 均无法正常工作，因此需要从源码编译最新的 LWJGL 库。虽然已经有人编译好了，但版本有点老了，最后更新日期还停留在 2020 年，而且不支持 HMCL 启动器，详情可查看 [m1-multimc-hack 仓库](https://github.com/yusefnapora/m1-multimc-hack)。

好在 Tanmay Bakshi 的 [Gist 教程留言区](https://gist.github.com/tanmayb123/d55b16c493326945385e815453de411a#gistcomment-3960178)有人提供了较新的 3.3.x 版本的 `LWJGL` 库，经过我的测试，可以完美运行，我们可以直接使用他提供的库文件。不过该网友提供的链接是 MediaFire 网盘，如果你无法访问，可以通过我提供的[网盘链接](https://wwi.lanzouv.com/iWDWt00bwn4b)下载。

将下载完成的 `m1_lwjgl_330_nightly.zip` 解压，将解压后文件夹内的 `lwjglfat.jar` 放入 Minecraft 运行目录。

```bash
# 进入游戏目录
$ cd ~/Games/Minecraft
# 将 Minecraft 运行目录内原有库文件删除（或备份）
$ rm .minecraft/libraries/org/lwjgl/lwjgl/3.2.1/lwjgl-3.2.1.jar
# 将下载的 LWJGL 库放入 Minecraft 运行目录
$ mv m1_lwjgl_330_nightly/lwjglfat.jar .minecraft/libraries/org/lwjgl/lwjgl/3.2.1/lwjgl-3.2.1.jar
# 将 m1_lwjgl_330_nightly 文件夹移到 Minecraft 运行目录中
$ mv m1_lwjgl_330_nightly ~/Games/Minecraft
```

## 修改 HMCL 参数

打开『游戏全局设置』，检查 Java 路径是否正确，滑动至页面底部，在「调试选项」-「本地库路径」中，选择自定义库路径为 `m1_lwjgl_330_nightly` 目录内的 `lwjglnatives` 目录（例如，本文的路径是 `~/Games/Minecraft/m1_lwjgl_330_nightly/lwjglnatives`），**开启「不检查游戏完整性」**，同时也需要**开启「不检查 JVM 与游戏的兼容性」**。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting2@main/uPic/2022-02-19-16-04-NlQikz.png)

## 运行游戏

回到启动器首页，点击右下角的『启动游戏』。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting2@main/uPic/2022-02-19-16-05-X0Xil1.jpg)

可以看到 Minecraft 已经可以正常运行了，也能正常加载 Fabric API 和第三方 Mod。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting2@main/uPic/2022-02-19-16-12-zZi3GM.webp)

我总共开了 40 个模组。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting2@main/uPic/2022-02-19-16-21-GMRH4I.png)

经过测试，启动时间在 20s 之内，游戏内也很顺畅，我用到至今还没有出现过崩溃现象。CPU 占用 50%，内存设置为自动分配，实际占用 5.48G。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting2@main/uPic/2022-02-19-16-25-Lr3z2d.png)

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting2@main/uPic/2022-02-19-16-26-byDrxK.png)

## 结语

Minecraft 中文名又叫《我的世界》，**它提供了一个和现实世界物理规律高度一致的虚拟世界**，你可以在这个世界里为所欲为，利用这个世界里的资源和物理规律创造一切。举个例子，有人在这个世界里创造了计算机，有人在这个世界里以 1:1 的比例还原了现实世界的故宫，**还有人在这个世界里创造了一部手机，然后和现实世界的自己视频通话**。。。我每每想到这个视频通话的例子，心中就喊出一句卧槽，无法用语言来形容，自己体会。

最近元宇宙的概念非常火热，成为了众多国内外科技巨头的抢手货，他们纷纷在各自领域布局未来的元宇宙计划。Minecraft 其实就非常有可能发展为元宇宙的载体，它有着非常高的用户基础，共识性强，而且背靠微软老爹，前不久疫情期间，伯克利学院还在 Minecraft 中举办了毕业典礼，看看这阵仗，妥妥的元宇宙啊。

{{< bilibili BV1Ct4y117FW >}}

## 参考资料

+ [在 M1 Macbook 上不使用 Rosetta 优雅地游玩 Minecraft+Forge](https://www.wannaexpresso.com/2021/02/20/m1-macbook-minecraft/)
+ [在 M1 Mac 设备中解决 Minecraft Error 255](https://pwa.sspai.com/post/68830)