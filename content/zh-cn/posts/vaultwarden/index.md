---
keywords:
- Vaultwarden
- Bitwarden
- Lastpass
- 密码管理
- Docker
- Sealos
title: "使用 Sealos 搭建个人密码管理器 Vaultwarden"
date: 2023-09-08T09:06:37+08:00
lastmod: 2023-09-08T09:06:37+08:00
description: 本文介绍了如何使用 Sealos 来快速部署密码管理器 Vaultwarden。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- Sealos
- Kubernetes
- Docker
- Vaultwarden
- Bitwarden
categories: cloud-native
img: https://images.icloudnative.io/uPic/2023-09-08-15-42-kQdLol.png
meta_image: https://images.icloudnative.io/uPic/2023-09-08-15-40-wGBd19.png
---

## 我与 LastPass 的曲折恋情

超过 8 年网龄的我，注册过很多网站帐号，每个网站的密码我都用不同的复杂密码。一开始我全靠脑力记忆这些密码，后来渐渐觉得记起来很困难，就记录在笔记本上。但是随着时间推移，我发现这种方法既不安全也不可靠。

有一次出差在外，**一个人待在酒店里想登录某考研网站复习英语**，却想不起来密码是啥，笔记本也没带在身上，急得像热锅上的蚂蚁。

后来绕了很多弯路才重置了密码，但整个过程让我无比痛苦，又特么**耽误我学英语！**

果然记在笔记本上也不能解决所有问题，可靠度太低了，而且还存在安全隐患。是时候使用专业的密码管理软件了！

说到密码管理器，大家是不是想起了 LastPass… 我一开始用的确实是 LastPass，但是 LastPass 的价格策略频繁调整，从一开始的免费，到后来逐渐收费，让我开始对其提高警惕。而且，尽管它的安全记录相对来说比较良好，但经历过数次的漏洞曝出，让我对于其中的数据安全产生了疑虑。最让我失望的是，随着其越来越多的商业化操作，一些原本免费的功能也被限制或转移到了付费版本。

![](https://images.icloudnative.io/uPic/2023-09-06-19-49-XHN6Lp.png)

## Bitwarden：密码管理革命者

一次偶然的机会，Bitwarden 闯入了我的视线。作为新一代开源的跨平台密码管理器，Bitwarden 的透明度让我对数据安全有了更大的信心。它使用 AES-256 位加密和 PBKDF2 SHA-256 来保证所有信息的安全，并且拥有丰富的客户端支持，包括 Windows、Mac、Linux、iOS、Android 等多个平台。

![](https://images.icloudnative.io/uPic/2023-09-06-20-06-lhdqCm.jpg)

与 LastPass 相比，Bitwarden 具有以下优势：

- 代码**开源**，经过全球开发者验证更安全可靠。
- 提供免费版本**无限使用基础功能**。
- 使用**端到端加密**，只有用户自己才拥有解密密钥。
- 支持**无限存储**密码条目。
- 允许用户**导入和导出**密码数据。
- 提供优秀的**自动填充**服务，并且可以利用系统的生物识别（指纹、人脸等）进行认证。
- 支持**文件加密分享**，方便地通过 bitwarden send 分享隐私文件、照片等。
- 除了密码之外，还可以存储文件/文本/银行卡/个人信息。

最吸引我的是，Bitwarden 还可以私有化部署，这样可以确保数据完全掌握在自己手中，不必担心官方跑路。不过 [Bit­war­den 官方服务](https://github.com/bitwarden/server)对服务器需要的资源有点多，内存必须**大于 2G**，小内存机器是根本跑不起来的，一般推荐使用第三方开发的 Vaultwarden。

## Vaultwarden：短小精悍

Vaultwarden 是 Bitwarden 的轻量级版本，**原名 bitwarden_rs**，后来为了与“大哥” Bitwarden 区分开来，遂改名为 Vaultwarden。

Logo 完美结合了 Rust 和 Vaultwarden： 

![](https://images.icloudnative.io/uPic/2023-09-06-20-39-ySJr3t.png)

Vaultwarden 使用 Rust 编写，默认使用 SQLite 数据库（同时还支持 MySQL 和 PostgreSQL），实现了 Bit­war­den API 的所有功能，**只需要 10M 内存**便可运行，几乎可以跑在任何硬件之上。

> GitHub 地址：**https://github.com/dani-garcia/vaultwarden**

不用想了，无脑使用 Vaultwarden 吧。

虽然 Vaultwarden 提供了 Docker 镜像，可以无脑梭哈，但是你还得提供一个公网出口，这就需要用到 Nginx 之类的反向代理。同时你还得准备一个域名，以及相应的证书，并且要做好自动续签的工作。这对小白来说还是有点复杂了。

不过有了 Sealos 一键部署模板，这个问题就比较简单了，动动鼠标就行了，**30 秒即可解决战斗**。

## 一键部署 Vaultwarden

首先点击以下按钮打开 Vaultwarden 的应用模板：

<figure><a href="https://bja.sealos.run/?openapp=system-template%3FtemplateName%3Dvaultwarden" target="_blank">
    <img loading="lazy" class="my-0 rounded-md nozoom" src="https://cdn.jsdelivr.net/gh/labring-actions/templates@main/Deploy-on-Sealos.svg" alt="图片描述: Deploy-on-Sealos.svg">
</a></figure>

啥都不用填，直接点击「部署应用」：

![](https://images.icloudnative.io/uPic/2023-09-06-20-51-JxiA1C.jpg)

部署完成后，点击确认跳转到应用详情页面，可以看到应用已经启动成功了。点击外网地址即可直接打开 Vaultwarden 的 Web 界面：

![](https://images.icloudnative.io/uPic/2023-09-06-22-41-Ia2FQ4.png)

创建你的密码管理账户：

![](https://images.icloudnative.io/uPic/2023-09-06-20-57-h2vXcA.png)

创建完成后开始登录：

![](https://images.icloudnative.io/uPic/2023-09-06-21-10-3XBNbR.png)

完结撒花！🎉🎉🎉

客户端使用自定义服务器非常简单，以 macOS 客户端为例，登录时选择「自托管」：

![](https://images.icloudnative.io/uPic/2023-09-06-21-17-EL0dGQ.png)

然后在弹出的界面中输入 Vaultwarden 的地址，并点击保存：

![](https://images.icloudnative.io/uPic/2023-09-06-22-42-Gh3TAt.png)

然后输入邮箱和密码进行登录。

## 修改配置

Vaultwarden 可以通过环境变量来自定义各种配置，它的所有环境变量都在这个文件中：

+ **https://github.com/dani-garcia/vaultwarden/blob/main/.env.template**

感兴趣的可以自己研究。

Sealos 添加环境变量非常简单，在应用详情页面直接点击「变更」：

![](https://images.icloudnative.io/uPic/2023-09-06-22-15-bGzM8D.png)

然后展开「高级配置」，点击「编辑环境变量」：

![](https://images.icloudnative.io/uPic/2023-09-06-22-16-RqfqG4.png)

然后就可以在其中添加环境变量了。

例如，我想设置 Vaultwarden 管理后台密码，就可以加入以下环境变量：

```bash
ADMIN_TOKEN='xxxxx'
```

![](https://images.icloudnative.io/uPic/2023-09-06-22-19-nVVJM4.png)

添加完成之后，点击「确认」，再点击右上角的「变更」就可以了。

在你的域名后面加上 `/admin`，登录 Vaultwarden 管理后台，登陆密码为刚刚设置的 `ADMIN_TOKEN`：

![](https://images.icloudnative.io/uPic/2023-09-06-22-45-gtkvnK.png)

在这里可以根据情况对 Vaultwarden 进行一些可选设置，所有的设置项都可以通过鼠标悬停查看相应的说明，不了解的选项建议保持默认。

这里介绍几个我认为值得关注的设置项：

- **General Settings**
  - **Domain URL**：设置你的网站域名，记得带上 https，如 `https://your.domain`。
  - **Allow new signups**：是否允许用户注册，如果密码库仅仅用于自用，建议在自己注册后关闭此选项。
  - **Admin page token**：在这里更改 Vaultwarden 管理后台的密码。
  - **Invitation organization name**：设置你的网站名字，将出现在自动发送的电子邮件中。
- **SMTP Email Settings**
  - 设置 SMTP 服务，用来发送系统邮件（建议开启）。
  - 根据你的 SMTP 服务提供方填写相关信息即可。
  - 设置保存后，运行一次 Test SMTP 确保邮件可以正常发送。
- **Read-Only Config**：这里可以查看所有只读选项。
- **Backup Database**：这里提供了一个简易的数据库备份功能。

## 费用评估

现在我们来评估一下在 Sealos 上运行 Vaultwarden 大概需要多少钱。点击「变更」：

![](https://images.icloudnative.io/uPic/2023-09-06-22-15-bGzM8D.png)

模板默认使用的 CPU 是 0.2C，内存是 256M，不过 Vaultwarden 只需要 10M 就能跑起来，个人使用完全不需要这么多内存，咱们直接把 CPU 和内存调到最低：

![](https://images.icloudnative.io/uPic/2023-09-06-21-43-sjJXTe.png)

最后点击「变更」。

这下舒服了，每天只需要花费**两毛六分钱**。再加上 Sealos 超给力的充值优惠，折算下来每天只需要花费一毛多一点。

![](https://images.icloudnative.io/uPic/2023-09-07-09-54-fzC7ln.png)

而且**不需要操心什么反向代理，什么域名，什么证书，就是一把梭**，优雅。

## 参考资料

+ [自搭建全平台私有密码库 bitwarden & Vaultwarden](https://www.ottoli.cn/howto/bitwarden-vaultwarden)