---
keywords:
- lens
- kubernetes
- kubernetes dashboard
title: "Lens —— Kubernetes 桌面客户端"
date: 2020-06-16T22:29:28+08:00
lastmod: 2020-06-16T22:29:28+08:00
description: 本文介绍了 lens 的功能和特点。
draft: false
author: 米开朗基杨 
hideToc: false
enableToc: true
enableTocContent: false
tocLevels: ["h2", "h3", "h4"]
tags:
- kubernetes
categories: cloud-native
img: https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200617151854.png
---

Kubernetes 的桌面客户端有那么几个，曾经 [Kubernetic](https://kubernetic.com/) 应该是最好用的，但最近有个叫 [Lens](https://github.com/lensapp/lens) 的 APP 改变了这个格局，功能比 `Kubernetic` 多，使用体验更好，**适合广大系统重启工程师装逼**。它有以下几个亮点：

① `Lens` 就是一个强大的 IDE，可以实时查看集群状态，实时查看日志流，方便排查故障。有了 `Lens`，你可以更方便快捷地使用你的集群，从根本上提高工作效率和业务迭代速度。

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200616233929.png)

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200616234001.png)

日志流界面可以选择显示或隐藏时间戳，也可以指定显示的行数：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200616234511.png)

② `Lens` 可以管理多集群，它使用内置的 `kubectl` 通过 kubeconfig 来访问集群，支持本地集群和外部集群（如EKS、AKS、GKE、Pharos、UCP、Rancher 等），甚至连 Openshift 也支持：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200616232741.png)

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200616232934.png)

只是与 `Openshift` 的监控还不太兼容。也可以很轻松地查看并编辑 CR：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200616233755.png)

有了 Lens，你就可以统一管理所有的集群。

③ Lens 内置了资源利用率的仪表板，支持多种对接 Prometheus 的方式：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200616235516.png)

④ Lens 内置了 `kubectl`，它的内置终端会确保集群的 API Server 版本与 `kubectl` 版本兼容，所以你不需要在本地安装 `kubectl`。可以验证一下：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200617000257.png)

你会看到本地安装的 kubectl 版本和 `Lens` 里面打开的终端里的 kubectl 版本信息是不一样的，`Lens` 确实内置了 kubectl。

⑤ Lens 内置了 helm 模板商店，可直接点击安装：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200617000954.png)

现在 Lens 迎来了最新版 `3.5.0`，换上了全新的 `Logo`：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200617001224.png)

稳定性也提升了很多，快去试试吧。
