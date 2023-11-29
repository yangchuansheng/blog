---
keywords:
- WireGuard
- wg
title: "WireGuard 快速安装教程"
date: 2020-11-18T13:19:35+08:00
lastmod: 2020-11-18T13:19:35+08:00
description: 使用一键安装脚本来安装 WireGuard。
draft: false 
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocLevels: ["h2", "h3", "h4"]
tags:
- WireGuard
categories: Network
img: https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200704105149.png
---

WireGuard 的安装和使用条件**非常苛刻**，对内核版本要求极高，不仅如此，在不同的系统中，**内核，内核源码包，内核头文件**必须存在且这三者版本要一致。所以一般不建议在生成环境中安装，除非你对自己的操作很有把握。Red Hat、CentOS、Fedora 等系统的**内核，内核源码包，内核头文件**包名分别为 `kernel`、`kernel-devel`、`kernel-headers`，Debian、Ubuntu 等系统的**内核，内核源码包，内核头文件**包名分别为 `kernel`、`linux-headers`。

果这三者任一条件不满足的话，则不管是从代码编译安装还是从 repository 直接安装，也只是安装了 `wireguard-tools` 而已。而 WireGuard 真正工作的部分，是 `wireguard-dkms`，也就是动态内核模块支持(DKMS)，是它将 WireGuard 编译到系统内核中。因此，在某些 VPS 商家，是需要你先自主更换系统内核，并事先将这三者安装好，才有可能不会出现编译或安装失败。

当然，目前 WireGuard 已经被合并到 `Linux 5.6` 内核中了，如果你的内核版本 >= 5.6，就可以用上原生的 WireGuard 了，只需要安装 wireguard-tools 即可。例如，对于 Ubuntu 20.04 来说，它的内核版本是 5.4，虽然小于 5.6，但经过我的测试发现它已经将 WireGuard 合并到了内核中，我们只需要安装 wireguard-tools 即可：

```bash
$ sudo apt install wireguard -y
```

下面讨论 WireGuard 在低版本内核中的安装方法。

## 1. 升级内核

对于 Ubuntu 等 apt 系的发行版来说，不需要升级内核即可安装 WireGuard，可以略过此步骤。

如果你使用的是 CentOS 等 rpm 系的发行版，必须要升级内核，步骤如下：

① 载入公钥

```bash
$ rpm --import https://www.elrepo.org/RPM-GPG-KEY-elrepo.org
```

② 升级安装 elrepo

```bash
$ rpm -Uvh http://www.elrepo.org/elrepo-release-7.0-3.el7.elrepo.noarch.rpm
```

③ 载入 elrepo-kernel 元数据

```bash
$ yum --disablerepo=\* --enablerepo=elrepo-kernel repolist
```

④ 安装最新版本的内核

```bash
$ yum --disablerepo=\* --enablerepo=elrepo-kernel install  kernel-ml.x86_64  -y
```

⑤ 删除旧版本工具包

```bash
$ yum remove kernel-tools-libs.x86_64 kernel-tools.x86_64  -y
```

⑥ 安装新版本工具包

```bash
$ yum --disablerepo=\* --enablerepo=elrepo-kernel install kernel-ml-tools kernel-ml-devel kernel-ml-headers -y
```

⑦ 查看内核插入顺序

```bash
$ grep "^menuentry" /boot/grub2/grub.cfg | cut -d "'" -f2

CentOS Linux (3.10.0-1127.10.1.el7.x86_64) 7 (Core)
CentOS Linux (5.7.2-1.el7.elrepo.x86_64) 7 (Core)
CentOS Linux (0-rescue-96820b9851c24560b5f942f2496b9aeb) 7 (Core)
```

默认新内核是从头插入，默认启动顺序也是从 0 开始。

⑧ 查看当前实际启动顺序

```bash
$ grub2-editenv list

saved_entry=CentOS Linux (3.10.0-1127.10.1.el7.x86_64) 7 (Core)
```

⑨ 设置默认启动

```bash
$ grub2-set-default 'CentOS Linux (5.7.2-1.el7.elrepo.x86_64) 7 (Core)'
```

最后重启检查：

```bash
$ reboot
$ uname -r
```

## 2. 安装 WireGuard

升级内核之后，就可以根据[官方文档](https://www.wireguard.com/install/)来安装 WireGuard 了。不过这里我要介绍一个更狂野的安装方法，它更高效，也更不容易出错，那就是通过源代码编译安装。先别急着反驳，我知道从源代码编译看起来一点都不容易，但请听我说完。你以为我会教你如何从头开始编译吗？那不可能，有违我这篇文章的初衷，我要推荐一位大佬——秋水逸冰的[一键安装脚本](https://github.com/teddysun/across)，它可以让你哼着小曲就能从源码编译安装 WireGuard，只需一条命令即可。

脚本的使用方法超级简单，先下载脚本，然后赋予执行权限，最后执行一条命令搞定：

```bash
$ wget --no-check-certificate -O /opt/wireguard.sh https://raw.githubusercontent.com/teddysun/across/master/wireguard.sh
$ chmod 755 /opt/wireguard.sh

$ /opt/wireguard.sh -s
```

关于该脚本需要说明几点：

+ 支持两种安装方式：既支持从源代码编译安装，也支持从包管理器直接安装。
+ 脚本会创建默认的 wg0 设备，以及 wg0 的客户端配置，并生成客户端配置对应的二维码 png 图片。
+ 脚本会修改本机防火墙设置，如果未启用防火墙，则会出现警告提示，需要手动去设置。
+ 脚本会从 1024 到 20480 随机生成监听端口。
+ 脚本支持新增，删除，列出客户端功能。
+ 脚本支持查看已安装的 WireGuard 的版本号。
+ 脚本支持从代码编译安装的方式升级 WireGuard 到当前最新版本。

对于咱手艺人来说，肯定是不想用它自动生成的配置的，如果你想自己生成配置文件，请直接将配置文件目录清空：

```bash
$ rm -rf /etc/wireguard/*
```

然后手动生成秘钥和配置文件，具体的流程请参考：[WireGuard 的搭建使用与配置详解](/posts/wireguard-docs-practice/)。

如果你想通过 Web UI 来管理 WireGuard 的配置文件，可以看看这个项目：[Wg Gen Web](https://github.com/vx3r/wg-gen-web)

最后，公众号后台回复 wg 即可获取一键安装脚本。

## 参考文档

+ [WireGuard 一键安装脚本](https://teddysun.com/554.html)