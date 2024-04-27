---
keywords:
- podman
- hyperkit
- multipass
- systemd
title: "在 macOS 中使用 Podman"
date: 2020-11-08T18:15:23+08:00
lastmod: 2020-11-08T18:15:23+08:00
description: 本文介绍了在 macOS 中使用 podman 的方法，通过 HyperKit 创建 Ubuntu 虚拟机运行 Podman，并建立 Podman Socket，然后客户端通过 SSH 连接服务端的 Socket，以实现通过远程连接来管理容器。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocLevels: ["h2", "h3", "h4"]
tags:
- Podman
- Hyperkit
categories: cloud-native
img: https://images.icloudnative.io/uPic/20201108222714.png
---

`Podman` 是一个无守护程序与 `Docker` 命令兼容的下一代 Linux 容器工具，该项目由 `RedHat` 主导，其他的细节可以参考 [Podman 使用指南](/posts/podman-sidecar/)，本文的重点不是这个。

Podman 一直以来只能跑在 Linux 系统上，`macOS` 和 `Windows` 只能通过 CLI 远程连接 Podman 的 `API` 来管理容器。事实上 Docker 也不支持 macOS 和 Windows，但 Docker 针对 Windows 和 macOS 推出了专门的客户端，客户端里面集成了虚拟化相关的设置，通过嵌套一层虚拟化来支持 Docker。对于 `Podman` 来说，想要在 macOS 上运行也只能通过虚拟化来实现，网上也有不少方案，基本上都是通过 `Virtualbox` 来实现，都不太优雅。本文将介绍一种相对更优雅的方案，虽然不是很完美，但我已经尽力做到接近完美了。。

## HyperKit 介绍

`HyperKit` 是一个具有 hyperisor 能力的轻量级虚拟化工具集，包含了基于 `xhyve`（The BSD Hypervisor）的完整 hypervisor。HyperKit 设计成上层组件诸如 [VPNKit](https://github.com/moby/vpnkit) 和 [DataKit](https://github.com/moby/datakit) 的接口。`xhyve` 是 基于 `bhyve` 的 Mac OS X 移植版本，而 bhyve 又是 FreeBSD 下的虚拟化技术。。。

我们知道，Docker 在 Linux 上利用了 Linux 原生支持的容器方式实现资源和环境的隔离，直接利用宿主内核，性能接近原生。然而，在 macOS 上却仍然需要虚拟化的技术。早期的 Docker 干脆直接在开源的 VirtualBox 中构建虚拟机，性能低下。后期的 Docker 基于轻量化的虚拟化框架 [HyperKit](https://github.com/moby/hyperkit) 开发，据说性能得到很大提升。

本文将介绍如何通过 HyperKit 来使用 Podman。方法也很简单，先通过 Hyperkit 创建一个轻量级虚拟机，然后在虚拟机中安装 Podman，并开启 remote API，最后在本地通过 CLI 连接虚拟机中的 Podman。这和 macOS 中的 Docker 实现原理是一样的，只不过 Podman 是没有 Daemon 的，与 Docker 相比可以节省不少资源。

## 2. 安装 HyperKit

你可以自己下载源代码编译 `HyperKit`，但我不建议这么做，不同的 macOS 版本会遇到各种各样的错误。我这里推荐两种超级简单的方法：

1. 直接通过安装 Docker 来获得 HyperKit，因为 Docker Desktop on Mac 就是基于 HyperKit 实现的，所以安装 Docker Desktop on Mac 就能够获得完整的 HyperKit 运行环境。整个过程会非常顺畅和简单。安装完 Docker 之后可以永远不用打开 Docker，直接使用 HyperKit 就好。或者你可以直接卸载 Docker，卸载之前先把 `hyperkit` 二进制文件备份出来，因为卸载 Docker 也会删掉 `hyperkit` 二进制文件。

2. 直接通过安装 `Multipass` 来获得 HyperKit。Multipass 是 Canonical 公司（Ubuntu）开发的基于不同操作系统内建原生 Hypervisor 实现的工作站。由于 Windows(Hyper-V)，macOS（hyperkit）和 Linux（KVM）都原生支持 hypervisor，这样通过 `multipass shell` 命令就能够在一个 shell 中实现创建运行 Ubuntu 虚拟机。在 macOS 平台，默认的后端是 hyperkit，需要 macOS Yosemite (10.10.3) 以上版本并且需要安装在 2010 以后生产的 Mac 设备。安装方法很简单：

   ```bash
   $ brew cask install multipass
   ```

   安装好了之后可以在 `/Library/Application Support/com.canonical.multipass/bin/` 目录下找到 hyperkit 二进制文件。

## 3. 创建虚拟机

你可以直接通过 hyperkit 来创建虚拟机，但参数比较复杂，有兴趣的自己研究吧。我推荐直接通过 multipass 来创建，命令特别简单：

```bash
$ multipass launch -c 2 -d 10G -m 2G -n podman
```

- -n : 指定启动实例名字
- -c : 分配 CPU 数量
- -d : 设置磁盘容量
- -m : 设置内存容量

第一次启动虚拟机的时候会去拉去镜像，国内网速可能会很慢。

查看已经启动的虚拟机：

```bash
$ multipass list
Name                    State             IPv4             Image
podman                  Running           192.168.64.2     Ubuntu 20.04 LTS
```

进入虚拟机：

```bash
$ multipass shell podman
Welcome to Ubuntu 20.04.1 LTS (GNU/Linux 5.4.0-52-generic x86_64)

 * Documentation:  https://help.ubuntu.com
 * Management:     https://landscape.canonical.com
 * Support:        https://ubuntu.com/advantage

  System information as of Sun Nov  8 19:30:29 CST 2020

  System load:  0.0                Processes:               119
  Usage of /:   13.4% of 11.46GB   Users logged in:         0
  Memory usage: 11%                IPv4 address for enp0s2: 192.168.64.2
  Swap usage:   0%


0 updates can be installed immediately.
0 of these updates are security updates.


Last login: Sun Nov  8 17:38:31 2020 from 192.168.64.1
ubuntu@podman:~$
```

## 4. 安装 Podman

在虚拟机中安装 Podman：

```bash
ubuntu@podman:~$ . /etc/os-release
ubuntu@podman:~$ echo "deb https://download.opensuse.org/repositories/devel:/kubic:/libcontainers:/stable/xUbuntu_${VERSION_ID}/ /" | ubuntu@podman:~$ sudo tee /etc/apt/sources.list.d/devel:kubic:libcontainers:stable.list
ubuntu@podman:~$ curl -L https://download.opensuse.org/repositories/devel:/kubic:/libcontainers:/stable/xUbuntu_${VERSION_ID}/Release.key | sudo apt-key add -
ubuntu@podman:~$ sudo apt-get update
ubuntu@podman:~$ sudo apt-get -y upgrade
ubuntu@podman:~$ sudo apt-get -y install podman
```

## 5. 建立 Podman Socket

Podman 依赖于 systemd 的 [socket activation](http://0pointer.de/blog/projects/socket-activation.html) 特性。假设 Daemon B 依赖于 Daemon A，那么它就必须等到 Daemon A 完成启动后才能启动。`socket activation`的思想就是：Daemon B 启动时其实并不需要 Daemon A 真正运行起来,它只需要 Daemon A 建立的 socket 处于 listen 状态就 OK 了。而这个 socket 不必由 Daemon A 建立, 而是由 systemd 在系统初始化时就建立。当 Daemon B 发起启动时发起连接，systemd 再将 Daemon A 启动，当 Daemon A 启动后，再将 socket 归还给 Daemon A。

Podman 会通过 `podman.socket` 先创建一个处于监听状态的 socket 文件 `/run/podman/podman.sock`，当有进程向该 socket 发起连接时，systemd 会启动同名的 service：`podman.service`，以接管该 socket。先看看 podman.socket 和 podman.service 长啥样：

```bash
ubuntu@podman:~$ sudo systemctl cat podman.socket
# /lib/systemd/system/podman.socket
[Unit]
Description=Podman API Socket
Documentation=man:podman-system-service(1)

[Socket]
ListenStream=%t/podman/podman.sock
SocketMode=0660

[Install]
WantedBy=sockets.target

ubuntu@podman:~$ sudo systemctl cat podman.service
# /lib/systemd/system/podman.service
[Unit]
Description=Podman API Service
Requires=podman.socket
After=podman.socket
Documentation=man:podman-system-service(1)
StartLimitIntervalSec=0

[Service]
Type=notify
KillMode=process
ExecStart=/usr/bin/podman system service
```

设置开机自启 `podman.socket`，并立即启动：

```bash
ubuntu@podman:~$ sudo systemctl enable podman.socket --now
```

确认 socket 是否正处于监听状态：

```bash
ubuntu@podman:~$ podman --remote info
host:
  arch: amd64
  buildahVersion: 1.16.1
  cgroupManager: systemd
  cgroupVersion: v1
  conmon:
    package: 'conmon: /usr/libexec/podman/conmon'
    path: /usr/libexec/podman/conmon
    version: 'conmon version 2.0.20, commit: '
  cpus: 2
  ...
```

## 3. 客户端 CLI 设置

接下来所有的设置，如不作特殊说明，都在 macOS 本地终端执行。

Podman 远程连接依赖 SSH，所以需要设置免密登录，先生成秘钥文件：

```bash
$ ssh-keygen -t rsa   # 一路回车到底
```

然后将本地的公钥 `~/.ssh/id_rsa.pub` 追加到虚拟机的 `/root/.ssh/authorized_keys` 文件中。

安装 Podman CLI：

```bash
$ brew install podman
```

添加远程连接：

```bash
$ podman system connection add ubuntu --identity ~/.ssh/id_rsa ssh://root@192.168.64.2/run/podman/podman.sock
```

查看已经建立的连接：

```bash
$ podman system connection list
Name     Identity                 URI
podman*  /Users/Ryan/.ssh/id_rsa  ssh://root@192.168.64.2:22/run/podman/podman.sock
```

由于这是第一个连接，所以被直接设置为默认连接（podman 后面加了 \*）。

测试远程连接是否可用：

```bash
$ podman ps
CONTAINER ID  IMAGE   COMMAND  CREATED  STATUS  PORTS   NAMES

$ podman pull nginx:alpine
Trying to pull docker.io/library/nginx:alpine...
Getting image source signatures
Copying blob sha256:188c0c94c7c576fff0792aca7ec73d67a2f7f4cb3a6e53a84559337260b36964
Copying blob sha256:9dd8e8e549988a3e2c521f27f805b7a03d909d185bb01cdb4a4029e5a6702919
Copying blob sha256:85defa007a8b33f817a5113210cca4aca6681b721d4b44dc94928c265959d7d5
Copying blob sha256:f2dc206a393cd74df3fea6d4c1d3cefe209979e8dbcceb4893ec9eadcc10bc14
Copying blob sha256:0ca72de6f95718a4bd36e45f03fffa98e53819be7e75cb8cd1bcb0705b845939
Copying config sha256:e5dcd7aa4b5e5d2df8152b9e58aba32a05edd9b269816f5d8b7ced535743d16c
Writing manifest to image destination
Storing signatures
e5dcd7aa4b5e5d2df8152b9e58aba32a05edd9b269816f5d8b7ced535743d16c

$ podman image ls
REPOSITORY                TAG     IMAGE ID      CREATED      SIZE
docker.io/library/nginx   alpine  e5dcd7aa4b5e  2 days ago   23.3 MB
```

现在我们就可以直接在本地用 podman 愉快地玩耍了！

如果你建立了多个连接，可用使用 --connection 参数指定远程连接，或者使用 `podman system connection default <NAME>` 来设置默认的远程连接。

最后，我们来看看 hyperkit 的内存占用：

![](https://images.icloudnative.io/uPic/20201108203444.png)

物理内存只占用了 `921M`，如果你觉得这个内存占用很多，不妨去对比下 Docker Desktop 的内存占用。

## 总结

本文介绍了在 macOS 中使用 podman 的方法，通过 HyperKit 创建 Ubuntu 虚拟机运行 Podman，并建立 Podman Socket，然后客户端通过 SSH 连接服务端的 Socket，以实现通过远程连接来管理容器。