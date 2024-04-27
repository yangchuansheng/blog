---
keywords:
- iterm2
- trigger
- zmodem
- expect
- iTerm2 美化
- iTerm2 配置
title: "iTerm2 配置与美化：SSH 自动登录，并使用 Zmodem 实现快速传输文件"
subtitle: iTerm2 优化教程
date: 2021-01-09T16:12:11+08:00
lastmod: 2021-01-09T16:12:11+08:00
description: 本文主要介绍了 iTerm2 自身的配置和美化，使用触发器和 expect 来实现 ssh 自动登录远程服务器，以及如何在 macOS 下通过 Zmodem 快速传输文件。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- iTerm2
categories: macOS
img: https://hugo-picture.oss-cn-beijing.aliyuncs.com/2020-04-24-20200310170530.webp
---

[上篇文章](/posts/customize-iterm2-1)我们介绍了 iTerm2 自身的配置和美化，这篇文章我们就来介绍 iTerm2 连接远程服务器的配置和优化。

对于 YAML 工程师来说，我们经常需要 ssh 登录不同的服务器，每次登录时都要经历两个步骤：

1. 输入 `ssh root@host-ip`
2. 输入密码

每次都重复这样的操作，不仅麻烦，还要记忆好多东西。对于 `Windows` 用户来说，可以使用 `Xshell` 来实现自动登录功能，macOS 用户就比较麻烦了。`iTerm2` 是 `macOS` 平台上最强大的终端工具，虽然默认没有提供自动登录的功能，但我们可以尝试通过它提供的其他功能来打造自动登录的功能。

当然，既然我写了这篇文章，就说明我已经找到了方法，下面就直接开门见山放干货。我想提醒你的是，我这里提供的方法绝对是你从来没有见过的，你可能会觉得网上能搜到很多和我类似的方案，但如果你仔细看就能看出区别来，网上的方案都是不完美的，和其他功能同时使用时会出现莫名其妙的问题（具体是什么问题后面我会讲到），我把这些问题都解决了，得到了一个极其完美的方案。

本文将提供两种自动登录方案，首先来看第一种方案。

## 1. 通过触发器自动登录

iTerm2 有一个非常强大的功能叫触发器（Trigger），**触发器是用户可配置的正则表达式，当终端会话接收到与正则表达式相匹配的文本时，会执行相关的操作**。这里的操作包括突出显示匹配的文本，显示警报，发回文本等等。

触发器的一种高级用法是捕获与正则表达式匹配的输出，并在工具栏中显示这些匹配线。 例如，您可以创建一个匹配编译器错误的触发器。 当你运行时，错误会出现在你的窗口一侧，你可以点击每一个跳到它的右边。 更多信息可在 [Captured Output](https://link.jianshu.com?t=https%3A%2F%2Fwww.iterm2.com%2Fcaptured_output.html) 手册中找到。

本文将利用触发器来实现 ssh 自动登录的功能。首先点击 `Preference -> Profiles`，选中你要登录的服务器，`Command` 这里填写你的 ssh 登录的 ip 和用户名，如果端口不是 22 还要指定端口：

![](https://images.icloudnative.io/uPic/20210109164441.png)

然后点击 `Advanced`,找到 Trriggers,点击 `edit`：

![](https://images.icloudnative.io/uPic/20210109164721.png)

在 Regular Eexpression 中，填写你要匹配的正则表达式。由于这里是要在看到 `password` 的提示后输入密码，所以这里填写  `password`，如果你服务器的密码提示是 `passwd`，你要改成匹配这个正则，当然还有些服务器提示的是 `Password`，所以我们可以用正则 `(p|P)ass(word|wd):` 全部匹配。在 `Action` 中选择 `Send Text`，在 `Parameters` 中填写你的密码，最后增加一个 `\r` 字符。`\r` 是回车，这就相当于你输入了密码，并按了下回车。最后，要把 `Instant` 的复选框选中。

![](https://images.icloudnative.io/uPic/20210109171503.png)

我这里多加了一个正则表达式，因为第一次登录服务器时会提示 `Are you sure you want to continue connecting (yes/no)?`。

现在在你的终端会话中双指轻按触控板，或者鼠标右击，就可以选择你的 Profile 自动登录了：

![](https://images.icloudnative.io/uPic/20210109165837.png)

到了这一步还没有结束，这个方法看似完美，其实是有问题的。假设你在这台服务器上再通过 ssh 去登录其他服务器，仍然会触发 Triggers；再假设其他服务器的密码和这台服务器的密码是不同的，这时候就会陷入尴尬的境地，不管你尝试多少次，触发器都会自动输入之前设置的密码，你将永远登录不上另一台服务器。

还有一些其他的问题，比如你在终端中输入的任何命令只要匹配了触发器的正则，就会自动输入密码，使用体验非常不好：

![](https://images.icloudnative.io/uPic/20210109171420.png)

解决这个问题其实也很简单，只需要提高正则匹配的准确度就行了，直接看图：

![](https://images.icloudnative.io/uPic/20210109171246.png)

现在再通过 ssh 登录其他服务器，触发器再也不会自动输入密码了：

![](https://images.icloudnative.io/uPic/20210109171948.png)

在终端中输入的命令也不会匹配到 password 和 Password 等这些单词了：

![](https://images.icloudnative.io/uPic/20210109172103.png)

到这一步算是完美解决了自动登录的需求。但还是有一点小瑕疵，每台服务器的触发器正则表达式都是不一样的，如果你要登录的服务器很多，这个工作量将非常大，要不要用这种方法可以自己取舍。

下面我将介绍另外一种方案，相比之前的方案，下面的方案需要编写脚本，但它是可复用的，每台服务器都可以使用同一个脚本。如果你要登录的服务器数量很多，相比之下之前的方案工作量更大。

## 2. 通过 expect 自动登录

expect 是一个自动化交互套件，主要应用于执行命令和程序时，系统以交互形式要求输入指定字符串，实现交互通信。它的自动交互流程如下：

`spawn` 启动指定进程 ---> `expect` 获取指定关键字 ---> `send` 向指定程序发送指定字符 ---> 执行完成退出

接下来我们将利用 expect 来实现 ssh 自动登录。首先新建一个文件 `/usr/local/bin/iterm2Login.sh`，内容如下：

```bash
#!/usr/bin/expect

set timeout 30
set host [lindex $argv 0]
# 这一行是设置一个变量的意思，变量名随便起，尽量有意义，后面表示的是传入的参数，0 表示第一个参数，后面会用到。
set port [lindex $argv 1]
set user [lindex $argv 2]
set pswd [lindex $argv 3]

spawn ssh -p $port $user@$host 
# spawn 是 expect 环境的内部命令，它主要的功能是给 ssh 运行进程加个壳，用来传递交互指令。

expect {
        "(yes/no)?"
        {send "yes\n";exp_continue;}
	      -re "(p|P)ass(word|wd):"
        {send "$pswd\n"}
}
# expect 也是 expect 环境的一个内部命令，用来判断上一个指令输入之后的得到输出结果是否包含 "" 双引号里的字符串，-re 表示通过正则来匹配。
# 如果是第一次登录，会出现 "yes/no" 的字符串，就发送（send）指令 "yes\r"，然后继续（exp_continue）。

interact
# interact：执行完成后保持交互状态，把控制权交给控制台。
```

`argv 0`, `argv 1`, `argv 2`, `argv 3` 三个参数依次为 ip、端口号、用户名、密码。

赋予脚本执行权限：

```bash
$ sudo chmod +x /usr/local/bin/iterm2Login.sh
```

将 Profile 中的 Command 部分替换成通过上面的脚本来登录：

![](https://images.icloudnative.io/uPic/20210109175137.png)

最后将触发器中的所有规则都删掉，只留下一个：

![](https://images.icloudnative.io/uPic/20210109175338.png)

大功告成！

看来这个方法比上面的方法更加完美，因为 `expect` 只针对当前登录的服务器，后续再通过当前服务器 ssh 登录其他服务器，不会再自动输入密码什么的。如果服务器数量很多，也不用再一个一个去改触发器规则，简直太爽了。

当然，expect 也会遇到一些问题，比如无法正常使用 `lrzsz`，而这些问题在使用触发器时是不存在的。当然，这些问题是可以解决的，解决之后，expect 将变成彻底完美的方案，触发器的方案就可以抛之脑后了。

下面我将详细介绍 `expect` 和 `lrzsz` 一起使用的问题，及其解决方案。

## 3. 使用 Zmodem 实现快速传输文件

很多时候我们需要在本机和远端服务器间进行文件传输，通常都是使用 `scp` 命令进行传输，但其实通过 `Zmodem` 传输起来更方便。

### 什么是 Zmodem

`Zmodem` 是针对 `modem` 的一种支持错误校验的文件传输协议。`Zmodem` 是 `Ymodem` 的改进版，后者又是 `Xmodem` 的改进版。`Zmodem` 不仅能传输更大的数据，而且错误率更小。

利用 `Zmodem` 协议，可以在 `modem` 上发送 512 字节的数据块。`Zmodem` 包含一种名为检查点重启的特性，如果通信链接在数据传输过程中中断，能从断点处而不是从开始处恢复传输。

### 配置 iTerm2 支持 Zmodem

要让 `iTerm2` 在远端服务器上支持通过 `Zmodem` 协议传输，需要分别在服务端和客户端进行相应配置。网上大多数文档都只提到客户端部分。因为收发方都必须有支持 `Zmodem` 协议的工具，才能进行正常收发。下面我们就来看看是如何进行配置的：

#### 服务端配置

`lrzsz` 软件包是 支持 `Zmodem` 协议的工具包。 其包含的 `rz`、`sz` 命令是通过 `ZModem` 协议在远程服务器和终端机器间上传下载文件的利器。

为了正确通过 `sz`、`rz` 命令传输文件，服务端需要安装 `lrzsz` 软件包的。

- Ubuntu 或 Debian

```bash
$ apt-get install lrzsz
```

- RHEL 或 CentOS

```bash
$ yum install lrzsz
```

#### 客户端配置

和服务器端一样，客户端同样需要安装 `lrzsz` 软件包。这里通过 `Homebrew` 进行 `lrzsz` 软件包安装：

```bash
$ brew install lrzsz
```

#### 配置 iTerm2

在全球最大同性交友网站 `Github` 上，已经有人共享了一个叫 “ZModem integration for iTerm 2” 的项目。我们只需下载其相应脚本，并进行简单配置就可以很容易的在 `iTerm2` 上实现对 `Zmodem` 的支持。

项目地址：[https://github.com/kuoruan/iterm2-zmodem](https://github.com/kuoruan/iterm2-zmodem)

+ 下载并安装脚本

```bash
$ wget -qO /usr/local/bin/iterm2-zmodem.sh https://github.com/kuoruan/iterm2-zmodem/raw/master/iterm2-zmodem.sh
$ chmod +x /usr/local/bin/iterm2-zmodem.sh
```

+ 配置 iTerm2 上的触发器

打开 `iTerm2` ，点击 `Preferences` → `Profiles` 选择指定的 `Profile`。然后继续选择 `Advanced` → `Triggers`，并点击 `Edit` 添加两个触发器。

![](https://images.icloudnative.io/uPic/20210109164721.png)

按如下内容添加两个触发器，首先增加 `sz` 指令的触发器：

```bash
Regular expression: rz waiting to receive.\*\*B0100
Action: Run Silent Coprocess
Parameters: /usr/local/bin/iterm2-zmodem.sh send
Instant: checked
```

其次增加 `rz` 指令的触发器：

```bash
Regular expression: \*\*B00000000000000
Action: Run Silent Coprocess
Parameters: /usr/local/bin/iterm2-zmodem.sh recv
Instant: checked
```

成功增加完成后的效果，类似下图：

![](https://images.icloudnative.io/uPic/20210109181319.png)

配置这两个触发器的作用就是让 `iTerm2` 根据终端上显示的字符通过指定的触发器调用相应的发送和接收脚本。

### 使用 Zmodem 传输文件

#### 发送文件到远端服务器

- 在远端服务器执行 `rz` 命令
- 本地选择文件传输
- 等待传输指示消失

#### 接收远端服务器的文件

- 在远端服务器执行 `sz filename1 filename2 … filenameN` 命令
- 本地选择目录保存
- 等待传输指示消失

### Zmodem 与 expect 结合

如果你真的按照我提供的步骤操作了，最后你会发现根本无法传输文件。其实这个问题不在于 `Zmodem` 本身，而是 expect 的问题，如果你将 `Profile` 的 `Command` 换成 `ssh root@host` 这种形式，就可以正常传输文件了。

难道 expect 真的就没有办法了吗？那之前的工作岂不是都化为乌有了？别慌，不但有办法，而且这个办法非常简单，简单的让你想笑。只需要在 Profile 的 Command 命令前面加上一句 `export LC_CTYPE=en_US` 就行了：

![](https://images.icloudnative.io/uPic/20210109182714.png)

收工！

## 4. 总结

本文详细介绍了 macOS 平台中的 `iTerm2` 如何使用触发器和 `expect` 来实现 ssh 自动登录远程服务器，以及如何在 `macOS` 下通过 `Zmodem`快速传输文件。当 expect 和 Zmodem 一起使用时，会出现一些莫名其妙的问题，本文最后也给出了解决方案。

## 参考

+ [在 iTerm2 中使用 Zmodem 实现快速传输文件](https://www.hi-linux.com/posts/9916.html)