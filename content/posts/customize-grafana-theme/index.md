---
keywords:
- 米开朗基杨
- grafana
- grafana theme
title: "Grafana 自定义主题"
subtitle: "优雅地魔改 Grafana 主题"
description: 本文展示了如何在不修改源码的情况下自定义 Grafana 主题。
date: 2020-02-29T16:31:23+08:00
draft: false
author: 米开朗基杨
toc: true
categories: "monitoring"
tags: ["grafana"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/2020-04-24-20200229183341.webp"
---

Grafana 自带两款主题 `Light` 和 `Dark`，都还不错，Light 有点刺眼，不建议使用。Dark 还马马虎虎，不过时间长了总会产生审美疲劳，anyway 还是有很多人需要自定义主题的，前几天我在票圈分享了魔改的 Grafana 界面之后，一大批童鞋让我分享主题。可是 Grafana 默认情况下是不支持自定义主题的，你想改变主题样式或新增主题只能修改源码重新编译。

难道没有别的办法了？办法还是有的，只不过稍微有点繁琐，但不复杂。今天就来给大家分享一种不需要改源码的方法，老少皆宜，按照我的步骤来，最后一定能搞定。这里不得不提一句，很多事情都是没有什么技术含量的，靠的是敏锐的嗅觉、强大的信息收集能力和变通能力，有很多技术大神思维都很僵化，解决问题容易钻进死胡同，这里我就不多说了。

就拿今天的主题来说，自定义 `Grafana` 主题的方法真的没有什么技术含量，当你知道了之后就会觉得它非常简单，但是为什么你搞不定呢？可以自己思考一下。

下面我来演示一下我解决这个问题的思路和方法，最后给出结果。

一开始我想到 Grafana 可以通过插件机制来扩展和自定义自身的功能，那就可以从这里入手，首先打开 `Google` 搜索，从 Grafana 官网搜索关于 `theme` 的插件：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@master/img/20200723165421.png)

找了一圈发现只有 `Boom theme plugin` 符合要求，点进去发现这是一个 `Panel` 插件，这就意味着由于插件自身的局限性，不管你做了什么它只会对当前的仪表盘生效。如果你想改变当前仪表盘的样式，需要添加一个面板：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@master/img/20200723165422.png)

点击 ”Choose Visualization“ 选择可视化类型，然后选择 `<Boom Theme>`，然后你就可以添加自定义主题了。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@master/img/20200723165423.png)

但是现在问题又来了，我太懒了，不想自己写 CSS，怎么办？有没有别人写好的主题呢？`Github` 是一个宝库，可以去那里找找。通过关键词 `grafana theme` 搜索过去一年内活跃过的项目：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@master/img/20200723165424.png)

最终选择了 [theme.pak](https://github.com/gilbN/theme.park)。找到自己心仪的主题添加到上面的面板中，就大功告成了：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@master/img/20200723165425.png)

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@master/img/20200723165426.png)

你可以将其中一个主题设为默认主题，这样每次打开当前仪表盘都会使用你设置的默认主题。自定义主题后的仪表盘是这个样子的：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@master/img/20200723165427.png)

最上面的菜单是我们刚刚添加的主题，可以直接点击不同主题实时切换：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@master/img/20200723165428.png)

如果想让所有的仪表盘都使用自定义主题，需要在所有的仪表盘上新增一个 `Boom Theme Panel`，为了避免重复的配置工作，可以直接复制 Panel，操作步骤如下：

首先点击 Panel 上的到三角，鼠标悬停在选项 `More` 上：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@master/img/20200723165429.png)

然后选择 `Copy`：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@master/img/20200723165430.png)

到下一个仪表盘中新建一个面板，选择 `Paste copied panel`：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@master/img/20200723165431.png)

搞定。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@master/img/20200723165432.png)
![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@master/img/20200723165433.png)

怎么样，没什么技术含量吧？
