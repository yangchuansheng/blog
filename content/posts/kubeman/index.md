---
keywords:
- 米开朗基杨
- kubeman
- kubectl
- kubernetes
title: "Kubeman 使用指南"
subtitle: "野心很大的 Kubernetes 集群调试工具"
description: kubeman 励志成为 kubectl 的替代品，用于实时监控和管理 kubernetes 集群，还可以调试与 Istio 相关的问题。
date: 2019-09-08T17:22:38+08:00
draft: false 
author: 米开朗基杨
toc: true
categories: cloud-native
tags: ["kubernetes"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-09-08-osu3xve.jpeg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-09-08-091923.jpg)

周末闲逛 Twitter 时，发现一个很有意思的小工具叫 `kubeman`，野心倒是不小，励志成为 `kubectl` 的替代品，用于实时监控和管理 kubernetes 集群，还可以调试与 Istio 相关的问题。

如果只使用 kubectl，当网格中的服务出现问题时，可能需要运行很多命令，而且要交叉引用来自多个命令的输出信息，这就会导致问题分析的过程很复杂。kubeman 将这些交叉引用和相关信息分析的复杂逻辑隐藏起来，只暴露一个 UI 界面，针对每一种资源对象封装了一些常用的操作项，这样可以简化很多操作流程。

安装很简单，到 [release](https://github.com/walmartlabs/kubeman/releases) 页面下载相应的二进制，然后直接运行就好了。下面通过一个完整的示例来演示它的工作流程：

1、运行 kubeman 二进制文件。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-09-08-081556.jpg)

2、点击 `Select Cluster` 菜单选择集群，还可以在 `NAMESPACES` 对话框中选择一个或多个 namespace，将后面操作项的会话限制在某些 namespace 中。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-09-08-082038.jpg)

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-09-08-082048.jpg)

3、之前选择的集群 context 现在会显示在顶部。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-09-08-082350.jpg)

4、左边一栏是菜单面板，操作项被按照不同的资源类型进行分组，你可以从菜单组中选择一个要执行的操作项。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-09-08-082730.jpg)

5、由于操作项的数量很庞大，从中寻找我们想要的操作项可能会很费劲，还好顶部有一个搜索框，你可以通过搜索来找到你想要的操作项，搜索结果会显示在 `Matching Recipes` 菜单中。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-09-08-083047.jpg)

6、某些操作项会做更进一步的筛选，例如 namesapce，service，pod 等。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-09-08-083218.jpg)

7、右边是输出面板，用来捕获并显示所有操作项的输出。还提供了一些额外的操作：

+ 一旦操作项运行并输出了结果，你就可以在输出面板顶部的搜索框里通过关键词搜索相应的文本。如果想删除搜索的关键词，可以按下键盘上的 `esc` 键。

   ![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-09-08-083948.jpg)

+ 每个操作项的输出会按层级进行分组。最顶部的输出行（深蓝色）显示的是输出结果的标题，单击这一行会将整个输出折叠起来，只显示组和子组，这样就可以看到整个输出的概要。再次单击这一行就会显示整个输出。

   ![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-09-08-084415.jpg)
   
+ 同理，你可以单击某一个组来折叠这个组的输出，只显示子组。同理适用于子组。
+ 不同的子组下的输出都可以展开和折叠，你可以上下滚动来选择感兴趣的子组，然后单击展开输出。

   ![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-09-08-084942.jpg)
   
8、有些操作项需要你在搜索框中输入关键词，然后才会显示输出。例如，操作项 `Find component by IP` 会等待你输入一个或多个 IP 地址，然后输出结果。此时搜索框扮演了两个角色，既作为输出结果的搜索框，也作为操作项的输入框。如果一个操作项支持输入，需要在输入的字符串前面加上 `/` 以表明这是操作项的输入。多个输入关键词可以用 `,` 隔开。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-09-08-085806.jpg)
   
9、有些操作项支持重复运行，一旦这些操作项执行完成，你就能在输出面板的顶部看到一个 `ReRun` 菜单，单击它就可以重新运行。你也可以在搜索框中输入命令 `/r` 来重新运行。

10、有些操作项支持情况输出结果，一旦这些操作项执行完成，你就能在输出面板的顶部看到一个 `Clear` 菜单，单击它就可以清理输出结果。你也可以在搜索框中输入命令 `/clear` 或者 `/c` 来清理输出结果。


11、有些操作项支持自动定期执行，这些操作项的菜单栏中有一个 `Auto Refresh` 选项，还可以自定义执行周期，默认的周期是 15s。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-09-08-090637.jpg)

12、搜索框支持更高级的搜索语法，例如操作符 `or` 表示或，`!` 表示非。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-09-08-091119.jpg)

总的来说，kubeman 还是很强大的，简直是个 k8s 集群调试神器，除了上面提到的功能之外，它支持窗口多开，窗口最大化，还可以选择暗黑主题，赶快试试吧！
