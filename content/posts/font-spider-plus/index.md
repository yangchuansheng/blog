---
keywords:
- 米开朗基杨
- font-spider
- font-spider-plus
- webfont
title: "使用 font-spider 对 webfont 网页字体进行压缩"
subtitle: "让你的网站用上炫酷的中文字体"
description: 本文将会告诉你如何使用 font-spider-plus 对网页字体进行压缩，并使用 base64 进行编码。
date: 2019-12-08T16:42:03+08:00
draft: false
author: 米开朗基杨
toc: true
categories:
- Blog
tags:
- Hugo
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/2020-04-24-20191208145932.webp"
---

随着当前 Web 技术的日新月异，网页界面内容越来越丰富，让人眼花缭乱，其中就包括了网页中的各种自定义字体。

例如，个人博客的首页字体：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/20191208000933.png)

CSS3 引入的 `@font-face ` 这一属性可以很好的解决这个问题，可以帮助我们非常灵活的使用一些特殊的字体，即使用户电脑里面没有安装这个字体，网页也可以显示。

`EOT` 字体是 IE 浏览器的首选格式，其他浏览器都不支持；其他浏览器更钟爱常见的 `TTF`、`SVG`、`WOFF`。

基本语法如下：

```css
@font-face {
    font-family: <自定义一个字体的名称>;
    src: url('<下载好的字体，在电脑中保存的路径>');
    font-variant: <font-variant>; 
    font-stretch: <font-stretch>;
    font-style: <style>;
    font-weight: <weight>;
```
例如：

```css
@font-face {
    font-family: 'Lora';
    src: url('../fonts/STKaiti.eot'); /* IE9 Compat Modes */
    src: url('../fonts/STKaiti.eot?#iefix') format('embedded-opentype'), /* IE6-IE8 */
           url('../fonts/STKaiti.woff2') format('woff2'), /* Super Modern Browsers */
           url('../fonts/STKaiti.woff') format('woff'), /* Modern Browsers */
           url('../fonts/STKaiti.ttf') format('truetype'), /* Safari, Android, iOS */
           url('../fonts/STKaiti.svg#STKaiti') format('svg'); /* Legacy iOS */
    font-style: normal;
    font-weight: normal;
}

body {
  font-family: STKaiti;
  ...
}
```

测试效果：Chrome，Firefox，IE7-IE11 均可以实现

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/20191208004937.png)

## 字体难题

----

自定义中文字体虽炫酷，但有一个弊端，那就是中文字体太大了，很耗费资源，具体的原因其实很简单：英文只有 26 个字母，一张 ASCII 码表上 128 个字符集几乎可以表示任何英文语句。由于字符集小，字体文件也可以做的非常小；中文字体就完全不同，单单 `GB2313` 编码的中文字符（含符号）就达到 7445 个，字符数量是 `ASCII` 码表的 58 倍，而字体设计师需要为每一个中文字符设计字体，简单计算下，中文字体文件大小也几乎达到英文字体文件的数十倍。

## 解决思路

----

解决思路其实也很简单，只在字库中保留页面中出现的文字，将其他大量不用的文字删掉，生成一个只包含特定字符的小字体文件，便可以大大减少字体文件，从而提高访问速度。现在思路有了，那么有没有现成的工具呢？

## 裁剪工具

----

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/20191208145932.png)

还真有。经过我一番搜寻，找到了两款工具：一个是华人开发的「[字蛛](http://font-spider.org/)」，英文名 `font-spider`，依赖 Node.js 环境，是一款命令行工具。主要思路是采集线上网页使用到的字体，从字体文件中分离出来，完成大幅度压缩。另一个是腾讯的大佬改版后的 font-soider，叫 [font-spider-plus](https://github.com/allanguys/font-spider-plus)。它们的工作原理如下：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/20191208150540.png)

我选择使用 font-spider-plus，毕竟改版过的，bug 更少，功能更多，还支持线上动态渲染的页面。唯一的不足就是官方文档写的太含糊了，许多人看了根本不知道怎么用。下面我将给我一个详细的范例，手把手教你如何使用 font-spider-plus。

## font-spider-plus 使用方法

----

根据官方文档，要想使用 font-spider-plus，首先要在 `CSS` 文件中通过 `@font-face` 引入全量大小的特殊字体。具体怎么做呢？并没有说，我来告诉你。

### 书写 HTML 文件

首先我们新建一个文件夹用来放 html 文件：

```bash
$ mkdir index
```

然后在 index 目录中创建一个 `index.html` 文件，内容如下：

```html
<div class="test">
米开朗基杨
</div>
<style>
  @font-face {
    font-family: 'font';
    src: url('../fonts/<font>.eot');
    src:
      url('../fonts/<font>.eot?#font-spider') format('embedded-opentype'),
      url('../fonts/<font>.woff2') format('woff2'),
      url('../fonts/<font>.woff') format('woff'),
      url('../fonts/<font>.ttf') format('truetype'),
      url('../fonts/<font>.svg') format('svg');
    font-weight: normal;
    font-style: normal;
  }
  .test{
      font-family: 'font';
  }
</style>
```

+ 请将`<div class="test"> </div>` 中的文字换成你自己的网站的文字。你可以选择将你的博客所有文章内容全选，然后粘贴到此处。
+ 下载你想使用的字体到 `fonts` 文件夹，然后将 index.html 中的 `<font>` 换成你下载的字体的前缀。

{{< alert >}}
特别说明： `@font-face` 中的 `src` 定义的 .ttf 文件必须存在，其余的格式将由工具自动生成
{{< /alert >}}

下面是中文字体对应的英文名称：

```bash
新细明体：PMingLiU 
细明体：MingLiU 
标楷体：DFKai-SB 
黑体：SimHei 
宋体：SimSun 
新宋体：NSimSun 
仿宋：FangSong 
楷体：KaiTi 
仿宋_GB2312：FangSong_GB2312 
楷体_GB2312：KaiTi_GB2312 
微软正黑体：Microsoft JhengHei 
微软雅黑体：Microsoft YaHei 

装Office会多出来的一些字体： 
隶书：LiSu 
幼圆：YouYuan 
华文细黑：STXihei 
华文楷体：STKaiti 
华文宋体：STSong 
华文中宋：STZhongsong 
华文仿宋：STFangsong 
方正舒体：FZShuTi 
方正姚体：FZYaoti 
华文彩云：STCaiyun 
华文琥珀：STHupo 
华文隶书：STLiti 
华文行楷：STXingkai 
华文新魏：STXinwei 

苹果电脑中的字体： 
华文细黑：STHeiti Light [STXihei] 
华文黑体：STHeiti 
华文楷体：STKaiti 
华文宋体：STSong 
华文仿宋：STFangsong 
丽黑 Pro：LiHei Pro Medium 
丽宋 Pro：LiSong Pro Light 
标楷体：BiauKai 
苹果丽中黑：Apple LiGothic Medium 
苹果丽细宋：Apple LiSung Light
```

### 压缩本地 WebFont

然后执行下面的命令来压缩本地 WebFont：

```bash
$ fsp local index/index.html
```

哦对了，你需要先通过 npm 安装 fsp 命令：

```bash
$ npm i font-spider-plus -g
```

压缩完成后，就会在 fonts 目录下生成压缩后的字体文件：

```bash
$ ll fonts/

total 41328
-rw-rw-rw-  1 cnsgyg  staff   7.7K 11 21 01:08 STKaiti.eot
-rw-rw-rw-  1 cnsgyg  staff   8.2K 11 21 01:08 STKaiti.svg
-rw-rw-rw-  1 cnsgyg  staff   7.6K 11 21 01:08 STKaiti.ttf
-rw-rw-rw-  1 cnsgyg  staff   7.7K 11 21 01:08 STKaiti.woff
-rw-rw-rw-  1 cnsgyg  staff   3.9K 11 21 01:08 STKaiti.woff2
```

压缩之前的字体文件会被移到 `fonts` 目录下的 `.font-spider` 目录：

```bash
$ ll fonts/.font-spider

total 24880
-rw-rw-rw-  1 cnsgyg  staff    12M 11 21 01:08 STKaiti.ttf
```

### 书写 CSS

现在字体压缩完了，怎么应用到自己的网站中呢？也很简单，先写个 CSS 通过 `@font-faxe` 引入压缩后的字体，格式与第一步中的 index.html 类似：

```css
/* fonts-zh.css */
@font-face {
  font-family: 'font';
  src: url('../fonts/<font>.eot');
  src: url('../fonts/<font>.eot?#font-spider') format('embedded-opentype'),
         url('../fonts/<font>.woff2') format('woff2'),
         url('../fonts/<font>.woff') format('woff'),
         url('../fonts/<font>.ttf') format('truetype'),
         url('../fonts/<font>.svg') format('svg');
  font-weight: normal;
  font-style: normal;
  }
```

这样还不行，你还需要将压缩后的字体文件拷贝你的网站中，CSS 中通过相对路径要能找到这些字体文件。可我不想这么做，太麻烦了，我还想更简单点。

### base64 编码

灵机一动，想到了 base64，编码之后可以不用拷贝这些字体文件，还能减少网站字体的加载体积，真是一箭双雕啊！具体的步骤我就不解释了，直接把所有步骤放到脚本中：

```bash
#!/bin/bash

font=STKaiti

eot=$(cat fonts/$font.eot|base64|tr -d '\n')
woff=$(cat fonts/$font.woff|base64|tr -d '\n')
woff2=$(cat fonts/$font.woff2|base64|tr -d '\n')
ttf=$(cat fonts/$font.ttf|base64|tr -d '\n')
svg=$(cat fonts/$font.svg|base64|tr -d '\n')

cat > fonts-zh.css <<EOF
@font-face {
    font-family: '$font';
    src: url(data:application/font-eot;charset=utf-8;base64,$eot) format('eot');
    font-weight: normal;
    font-style: normal;
}
@font-face {
    font-family: '$font';
    src: url(data:application/font-woff2;charset=utf-8;base64,$woff2) format('woff2'),
         url(data:application/font-woff;charset=utf-8;base64,$woff) format('woff'),
	 url(data:application/font-ttf;charset=utf-8;base64,$ttf) format('truetype'),
	 url(data:application/font-svg;charset=utf-8;base64,$svg) format('svg');
    font-weight: normal;
    font-style: normal;
}
EOF
```

执行完上面的脚本后，就生成了一个 `fonts-zh.css`，这是我们唯一需要的东西，不再需要任何额外的文件。

### 引入 CSS

最后一步就是在你的网站中引入该 CSS，具体的做法大同小异，以 hugo 为例，先将 `fonts-zh.css` 复制到网站主题目录的 `static/css/` 目录下，然后在 `<head></head>` 中引入该 css，以 [beatifulhugo](https://github.com/halogenica/beautifulhugo) 主题为例，直接在 `layouts/partials/head_custom.html` 中加上下面一行：

```html
<link rel="stylesheet" href="{{ "css/fonts-zh.css" | absURL }}" />
```

最后让网站的 body 使用该中文字体，具体的做法是修改 body 的 css，以 hugo 的 [beatifulhugo](https://github.com/halogenica/beautifulhugo) 主题为例，修改 `static/css/main.css` 中的 body 属性：

```css
body {
  font-family: STKaiti;
  ...
}
```

可以再加上备用字体，例如：

```css
body {
  font-family: STKaiti,Cambria;
  ...
}
```

表示如果 `STKaiti` 字体不可用，将使用 `Cambria` 字体。到这里就大功告成了，具体的效果可以参考我的网站：[https://icloudnative.io/](https://icloudnative.io/)。

## 总结

----

如果你没有强迫症，到这一步就大功告成了，可我还觉得不够简单，那么多步骤实在是太繁琐了，我要让它们全部自动化，把所有的步骤放到一个自动化脚本中。这还不够，为了造福大众，我在 GitHUb 中新建了一个仓库，所有的脚本和步骤都在上面，有需求的小伙伴可以拿去 happy 啦~~ 

项目地址：[https://github.com/yangchuansheng/font-spider-plus](https://github.com/yangchuansheng/font-spider-plus)

## 参考资料

----

+ [如何优雅的在网页里使用中文字体](https://juejin.im/entry/59780ba6f265da6c4c501f61)
+ [字蛛（font-spider）让你爱上 @font-face 网页自定义字体](https://blog.51cto.com/dapengtalk/1854181)
