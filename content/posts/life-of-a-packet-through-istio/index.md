---
keywords:
- 米开朗基杨
- istio
- service mesh
- data plane
title: "数据包在 Istio 网格中的生命周期"
subtitle: "从数据包的角度来剖析 Istio 的架构"
description: 通过跟踪一个网络包进入 Istio 网格，完成一系列的交互，然后再从网格出来的整个过程，以此来探索数据包在 Istio 网格中的生命周期。
date: 2018-12-17T16:05:24+08:00
draft: false
author: 米开朗基杨
categories: service-mesh
tags: ["istio", "service mesh"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/EKgExxzUcAABNfM.jpeg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

<!--more-->

众所周知，当我们讨论 Istio 时，性能并不是它最大的痛点，最大的痛点是有时候会出现一些莫名其妙的问题，而我们根本不知道问题出在哪里，也无从下手，在很多方面它仍然是一个谜。你可能已经看过它的官方文档，有的人可能已经尝试使用了，但你真的理解它了吗？

今天就为大家推荐一个高质量的视频，视频中的演讲内容主要通过跟踪一个网络包进入 Istio 网格，完成一系列的交互，然后再从网格出来的整个过程，以此来探索数据包在 Istio 网格中的生命周期。你将会了解到当数据包遇到每个组件时，会如何调用这些组件，这些组件为什么存在，它可以为数据包做些什么，其中还会涉及到数据包在进出网格的过程中是如何调用控制平面的，最后还会告诉你一些调试 Istio 的套路。

{{< bilibili BV18J411z7DL >}}

视频中的 PPT 下载：<a id="download" href="https://www.lanzous.com/i7scz1i" target="_blank"><i class="fa fa-download"></i><span> Download Now</span>
</a>
