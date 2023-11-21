---
title: "Hugo 集成社交分享插件"
subtitle: "通过 share.js 让你的分享飞起来"
date: 2018-11-07T01:22:31+08:00
draft: false
author: 米开朗基杨
toc: true
categories: "hugo"
tags: ["hugo"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/hugo.jpg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

很多站长开发网站时为了推广页面，或者获得更多的回访和流量，会在网站页面添加 “分享到” 插件，用来发布到某些社交网站。因此社会化分享是很多网站常用的功能之一，国内也有很多专业的公司在做，比较出名的包括 `j*this`，`B*hare` 等。不过很悲伤的是，这些公司的产品，无一例外的具有一个特点：奇丑无比。丑就算了，还不允许别人修改其设计，结果就是，再好的 UI 设计也毁在这些插件手里了。

还好我发现了一款简单高效的社交分享组件，只看一眼便可以确认这就是我要寻找的那个它。直接上预览，你看完一定会喜欢上：

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/yURXT6.jpg)

## <span id="inline-toc">1.</span> 简介

----

[share.js](https://github.com/overtrue/share.js) 是一款简单高效的社交分享组件，直接引入使用即可，无须依赖其他库。它有以下这些特点：

+ 一个标签完成初始化
+ 自定义启用/禁用分享站点
+ 更美观的 UI 体验
+ 基于标签data属性轻松实现分享数据的自定义
+ 支持分别对不同站点设置分享内容
+ 同页面个分享组件
+ 支持npm安装

## <span id="inline-toc">2.</span> 引入 share.js

----

由于我的博客使用的是 [hugo](https://gohugo.io/)，而且使用的主题是 [Jimmy Song](https://jimmysong.io/) 的 [beautifulhugo](https://github.com/rootsongjc/beautifulhugo)，官方文档提供的安装方式不适用，需要稍作改动。

> 如果你使用的是其他主题，安装方式类似，你可以自己研究一下。

### 导入静态资源

首先克隆 share.js 的代码仓库：

```bash
$ git clone https://github.com/overtrue/share.js
```

然后分别将 `css`、`js` 和 `fonts` 拷贝到 beautiful 主题中的相应目录下：

```bash
# <hugo_home> 表示 hugo 的根目录
$ cp share.js/css/share.min.css <hugo_home>/themes/beautifulhugo/static/css/
$ cp share.js/js/social-share.min.js <hugo_home>/themes/beautifulhugo/static/js/
$ cp -r share.js/fonts/* <hugo_home>/themes/beautifulhugo/static/fonts/
```

默认的 css 样式图标太小，我稍微调整了一下，将图标放大一点，修改后的 css 内容如下：

```bash
$ cat <hugo_home>/themes/beautifulhugo/static/css/share.min.css
```
```css
@font-face{font-family:"socialshare";src:url("../fonts/iconfont.eot");src:url("../fonts/iconfont.eot?#iefix") format("embedded-opentype"),url("../fonts/iconfont.woff") format("woff"),url("../fonts/iconfont.ttf") format("truetype"),url("../fonts/iconfont.svg#iconfont") format("svg")}
.social-share{font-family:"socialshare" !important;font-size:16px;font-style:normal;-webkit-font-smoothing:antialiased;-webkit-text-stroke-width:0.2px;-moz-osx-font-smoothing:grayscale}
.social-share *{font-family:"socialshare" !important}
.social-share .icon-tencent:before{content:"\f07a"}
.social-share .icon-qq:before{content:"\f11a"}
.social-share .icon-weibo:before{content:"\f12a"}
.social-share .icon-wechat:before{content:"\f09a"}
.social-share .icon-douban:before{content:"\f10a"}
.social-share .icon-heart:before{content:"\f20a"}
.social-share .icon-like:before{content:"\f00a"}
.social-share .icon-qzone:before{content:"\f08a"}
.social-share .icon-linkedin:before{content:"\f01a"}
.social-share .icon-diandian:before{content:"\f05a"}
.social-share .icon-facebook:before{content:"\f03a"}
.social-share .icon-google:before{content:"\f04a"}
.social-share .icon-twitter:before{content:"\f06a"}
.social-share a{position:relative;text-decoration:none;margin:4px;display:inline-block;outline:none}
.social-share .social-share-icon{position:relative;display:inline-block;width:42px;height:42px;font-size:25px;border-radius:50%;line-height:37px;border:2px solid #666;color:#666;text-align:center;vertical-align:middle;transition:background 0.6s ease-out 0s}
.social-share .social-share-icon:hover{background:#666;color:#fff}
.social-share .icon-weibo{color:#ff763b;border-color:#ff763b}
.social-share .icon-weibo:hover{background:#ff763b}
.social-share .icon-tencent{color:#56b6e7;border-color:#56b6e7}
.social-share .icon-tencent:hover{background:#56b6e7}
.social-share .icon-qq{color:#56b6e7;border-color:#56b6e7}
.social-share .icon-qq:hover{background:#56b6e7}
.social-share .icon-qzone{color:#FDBE3D;border-color:#FDBE3D}
.social-share .icon-qzone:hover{background:#FDBE3D}
.social-share .icon-douban{color:#33b045;border-color:#33b045}
.social-share .icon-douban:hover{background:#33b045}
.social-share .icon-linkedin{color:#0077B5;border-color:#0077B5}
.social-share .icon-linkedin:hover{background:#0077B5}
.social-share .icon-facebook{color:#44619D;border-color:#44619D}
.social-share .icon-facebook:hover{background:#44619D}
.social-share .icon-google{color:#db4437;border-color:#db4437}
.social-share .icon-google:hover{background:#db4437}
.social-share .icon-twitter{color:#55acee;border-color:#55acee}
.social-share .icon-twitter:hover{background:#55acee}
.social-share .icon-diandian{color:#307DCA;border-color:#307DCA}
.social-share .icon-diandian:hover{background:#307DCA}
.social-share .icon-wechat{position:relative;color:#7bc549;border-color:#7bc549}
.social-share .icon-wechat:hover{background:#7bc549}
.social-share .icon-wechat .wechat-qrcode{display:none;border:1px solid #eee;position:absolute;z-index:9;top:-205px;left:-84px;width:200px;height:192px;color:#666;font-size:12px;text-align:center;background-color:#fff;box-shadow:0 2px 10px #aaa;transition:all 200ms;-webkit-tansition:all 350ms;-moz-transition:all 350ms}
.social-share .icon-wechat .wechat-qrcode.bottom{top:40px;left:-84px}
.social-share .icon-wechat .wechat-qrcode.bottom:after{display:none}
.social-share .icon-wechat .wechat-qrcode h4{font-weight:normal;height:26px;line-height:26px;font-size:12px;background-color:#f3f3f3;margin:0;padding:0;color:#777}
.social-share .icon-wechat .wechat-qrcode .qrcode{width:105px;margin:10px auto}
.social-share .icon-wechat .wechat-qrcode .qrcode table{margin:0 !important}
.social-share .icon-wechat .wechat-qrcode .help p{font-weight:normal;line-height:16px;padding:0;margin:0}
.social-share .icon-wechat .wechat-qrcode:after{content:'';position:absolute;left:50%;margin-left:-6px;bottom:-13px;width:0;height:0;border-width:8px 6px 6px 6px;border-style:solid;border-color:#fff transparent transparent transparent}
.social-share .icon-wechat:hover .wechat-qrcode{display:block}
```

主要修改了这一段：

```css
.social-share .social-share-icon{position:relative;display:inline-block;width:42px;height:42px;font-size:25px;border-radius:50%;line-height:37px;border:2px solid #666;color:#666;text-align:center;vertical-align:middle;transition:background 0.6s ease-out 0s}
```

### 将分享插件嵌入到网页中

为了将分享插件嵌入到每篇文章的网页中，我们需要修改一些模板。首先需要引入 css 样式，通过修改文件 `<hugo_home>/themes/beautifulhugo/layouts/partials/head.html`，在其中引入 `share.min.css`。

```html
  ...
  <!-- bootcss cdn 国外访问太慢 -->
  <!--
  <link rel="stylesheet" href="https://cdn.bootcss.com/KaTeX/0.7.1/katex.min.css" />
  <link rel="stylesheet" href="https://cdn.bootcss.com/font-awesome/4.7.0/css/font-awesome.min.css" />
  <link rel="stylesheet" href="https://cdn.bootcss.com/bootstrap/3.3.7/css/bootstrap.min.css" />
  -->
  <link rel="stylesheet" href="{{ "css/main.css" | absURL }}" />
  <link rel="stylesheet" href="{{ "css/share.min.css" | absURL }}" />
  ...
```

然后在 `<hugo_home>/themes/beautifulhugo/layouts/partials/`目录下创建一个 html。

```bash
$ cat <hugo_home>/themes/beautifulhugo/layouts/partials/share.html
```
```html
<div class="social-share" data-initialized="true" data-wechat-qrcode-title="不扫别后悔">
    <center>
    <font style="font-size:18px;color:darkcyan;">分享到：</font>
    <a href="#" class="social-share-icon icon-weibo"></a>
    <a href="#" class="social-share-icon icon-wechat"></a>
    <a href="#" class="social-share-icon icon-twitter"></a>
    <a href="#" class="social-share-icon icon-linkedin"></a>
    <a href="#" class="social-share-icon icon-facebook"></a>
    <a href="#" class="social-share-icon icon-qq"></a>
    <a href="#" class="social-share-icon icon-qzone"></a>
    </center>
</div>

<!--  css & js -->
<script src="https://hugo-picture.oss-cn-beijing.aliyuncs.com/social-share.min.js"></script>
```

修改模板 `<hugo_home>/themes/beautifulhugo/layouts/_default/single.html`，加载 `share.html`。

```html
<div class="container" role="main" itemscope itemtype="http://schema.org/Article">
    <div class="row">
        <div class="col-lg-8 col-lg-offset-2 col-md-10 col-md-offset-1">
            <!-- post metadata-->
            {{ if isset .Params "postmeta" }}
              {{ else }}
            {{ partial "postmeta.html" . }}
            {{ end }}
            <article role="main" class="blog-post" itemprop="articleBody" id="content">
                ...
                {{ .Content }}
                {{ partial "share.html" }}
            </article>
            ...
```

如果你想让某些页面不开启分享插件，可以通过参数 `(.Params.noshare)` 来控制是否加载分享插件。

```html
<div class="container" role="main" itemscope itemtype="http://schema.org/Article">
    <div class="row">
        <div class="col-lg-8 col-lg-offset-2 col-md-10 col-md-offset-1">
            <!-- post metadata-->
            {{ if isset .Params "postmeta" }}
              {{ else }}
            {{ partial "postmeta.html" . }}
            {{ end }}
            <article role="main" class="blog-post" itemprop="articleBody" id="content">
                ...
                {{ .Content }}
                {{ if not (.Params.noshare) }}
                {{ partial "share.html" }}
                {{ end }}
            </article>
            ...
```

这样我们就可以在页面中通过 `noshare` 参数来控制了。如下是不想加载分享插件的文章的 **meta** 信息参数：

```markdown
---
title: xxxxxx
date: xxxxxx
...
noshare: true
---
```

## <span id="inline-toc">3.</span> 更多

----

关于分享插件的更多自定义配置请参考代码仓库的 [README](https://github.com/overtrue/share.js)。
