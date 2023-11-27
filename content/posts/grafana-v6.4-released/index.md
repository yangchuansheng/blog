---
keywords:
- 米开朗基杨 
title: "Grafana 6.4 正式发布！"
subtitle: "新增日志面板，基础镜像改为 Alpine"
description: Grafana 6.4 主要围绕数据模型和指标查询对原有的功能进行增强，同时增加了一些新特性。
date: 2019-10-08T01:49:41+08:00
draft: false
author: 米开朗基杨
toc: true
categories: "monitoring"
tags: ["grafana","prometheus"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/2020-04-24-EFTIScWsAAqbvF.webp"
---

<p id="div-border-left-red">英文原文：<a href="https://grafana.com/blog/2019/10/02/grafana-v6.4-released/" target="_blank">Grafana v6.4 Released</a></p>

2019 年 10 月 2 日，也就是中国的国庆期间，`Grafana` 实验室正式发布了 Grafana 6.4 版本。这个版本主要围绕数据模型和指标查询对原有的功能进行增强，同时增加了一些新特性。

## Grafana 6.4 新特性

----

+ **Explore** : 支持跳转到仪表盘面板
+ **Explore** : 改进日志的实时查看功能
+ **Loki** : 在仪表盘中将日志显示为注释
+ **Loki** : 支持在仪表盘面板中使用 Loki
+ **面板** : 新增日志面板
+ **面板** : [Data Link](https://grafana.com/blog/2019/08/27/new-in-grafana-6.3-easy-to-use-data-links/) 功能增强
+ **图形** : 借助 [Series Override](https://grafana.com/docs/features/panels/graph/#series-overrides) 将点变成线
+ **仪表盘** : 支持在不同面板间共享查询结果
+ **插件** : grafana-toolkit 发布 Alpha 版
+ **图形渲染** : 弃用 PhantomJS
+ **Docker** : 基础镜像改为 Alpine
+ **LDAP** : 新增 LDAP Debug UI

## 从 Explore 回到仪表盘

----

为了让使用者能够在 Explore 和仪表盘之间来回快速切换，Grafana 6.4 新增了一个功能，当你从仪表盘的下拉菜单中跳转到 Explore 后，还可以回到先前的仪表盘。

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/2019-10-04-164638.jpg)

当你从仪表盘跳转到 Explore 之后，你会看到 Explore 工具栏中有一个“返回”箭头。

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/2019-10-04-164926.jpg)

直接点击这个箭头就会回到先前的仪表盘。如果你想在回到仪表盘的同时保存 Explore 中的变更，只需要单击箭头旁边的倒三角即可显示 “Return to panel with changes” 菜单项。

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/2019-10-04-165254.jpg)

## 日志实时查看功能改进

----

新版本在日志查看面板中增加了一个暂停按钮，只要点击该按钮，就会暂停显示新日志。或者当你向上滚动查看日志时，也会自动暂停显示新日志。如果想恢复日志实时显示，只需重新点击暂停按钮。

此外，还引入了一些性能优化，以允许实时跟踪更高吞吐量的日志流。还有各种 UI 的修复和改进，例如更一致的样式和新日志的高亮显示。

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/explore_live_tailing.gif)

## 新增日志面板

----

日志面板可以显示来自其他数据源的日志（例如 Elastic，Influx 和 Loki）。通常日志面板显示在监控面板旁边，以展示相关进程的日志输出。

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/2019-10-04-174102.jpg)

> 尽管日志面板也支持查看实时日志，但通常建议只在 Explore 中使用此功能。日志面板最好通过页面顶部的刷新按钮来同步日志数据。日志面板现在处于 Beta 阶段，慎用。

## Data Link 功能改进

----

Grafana 6.3 引入了一种新的方式来更进一步研究监控数据，即 [Data Link](https://grafana.com/blog/2019/08/27/new-in-grafana-6.3-easy-to-use-data-links/)。Data link 会帮您创建一个到外部仪表盘或外部系统的动态链接，它主要由标题和 URL 两部分组成，其中 URL 可以引用模板变量和指标查询的结果，例如时间序列的名称和标签，字段的名称、值和时间等。关于 Data link 的更多信息请参考[官方文档](https://grafana.com/docs/features/panels/graph/#data-link)。

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/2019-10-07-155127.jpg)

在 Grafana 6.3 中，Data link 只支持 `Graph` 面板，Grafana 6.4 增强了该功能，使其支持 `Guage` 面板和 `Bar Guage` 面板。

## 借助 Series Override 将点变成线

----

某些指标的查询结果比较特殊，每个时间序列仅由一个点组成，无法显示在 `Graph` 面板中。Grafana 6.4 可以借助 [series overrides](https://grafana.com/features/panels/graph/#series-overrides) 将点变成一条平行于 X 轴的线，只需要依次选择 `Transform > constant` 就可以了。

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/2019-10-07-%E5%B1%8F%E5%B9%95%E5%BF%AB%E7%85%A7%202019-10-08%20%E4%B8%8A%E5%8D%8812.01.32.png)

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/2019-10-07-160353.jpg)

## 在不同面板间共享查询结果

----

如果某些指标的查询很耗费资源，你可以在不同的面板之间共享同一个查询结果，以此来避免重复查询。具体的操作方法是在新面板的数据源中选择 `-- Dashboard --`，然后选择相应的面板。

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/2019-10-07-%E5%B1%8F%E5%B9%95%E5%BF%AB%E7%85%A7%202019-10-08%20%E4%B8%8A%E5%8D%8812.09.37.png)

除了共享某个面板所有的查询结果之外，还可以选择共享面板的部分查询结果。该功能目前处于 `Alpha` 阶段，需要在配置文件中显式启用。

## grafana-toolkit 发布 Alpha 版

----

[grafana-toolkit](https://www.npmjs.com/package/@grafana/toolkit/v/6.4.0-beta.1) 的目标是简化插件开发人员的工作，它可以使开发人员专注于插件的核心价值，不用关心环境和配置，也不用关心测试和打包流程。

关于 grafana-toolkit 的更多信息请参考[官方文档](https://github.com/grafana/grafana/blob/master/packages/grafana-toolkit/README.md)。

## 弃用 PhantomJS

----

之前 Grafana 使用 [PhantomJS](https://phantomjs.org/) 来渲染面板中的图像，现在已被弃用，在未来的版本中将会彻底删除。如果你仍然在使用 PhantomJS，每次 Grafana 启动时都会向你发出 PhantomJS 已被弃用的警告。

从 Grafana 6.4 开始，建议从 PhantomJS 迁移到 [Grafana 图像渲染插件](https://grafana.com/grafana/plugins/grafana-image-renderer)。

## 基础镜像改为 Alpine

----

从 Grafana 6.4 将基础镜像改为 Alpine 3.10，现在再用镜像扫描工具来扫描镜像中的安全漏洞，应该会显示零漏洞了。

## 升级

----

请查看[升级说明](https://grafana.com/docs/installation/upgrading/#upgrading-to-v6-4)

## 更新日志

----

更新日志请查看 [CHANGELOG.md 文件](https://github.com/grafana/grafana/blob/master/CHANGELOG.md)。

## 下载

----

下载页面：[https://grafana.com/grafana/download](https://grafana.com/grafana/download)
