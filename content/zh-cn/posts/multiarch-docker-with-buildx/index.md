---
keywords:
- 米开朗基杨 
- docker
- buildx
- multiarch
- qemu
- binfmt_misc
title: "使用 buildx 构建多平台 Docker 镜像"
subtitle: "跨平台构建 Docker 镜像的新姿势"
description: 本文带大家了解了在不同的 CPU 架构上运行软件的挑战性，以及 buildx 如何帮助我们解决了其中的一些挑战。
date: 2019-11-17T13:54:43-05:00
draft: false
author: 米开朗基杨
toc: true
categories:
- cloud-native
tags:
- Docker
series:
- Docker 镜像制作系列
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/2020-04-24-2019-07-09-1_ItqXfSouNVV3yoePD4pCug.webp"
---

在工作和生活中，我们可能经常需要将某个程序跑在不同的 CPU 架构上，比如让某些不可描述的软件运行在树莓派或嵌入式路由器设备上。特别是 Docker 席卷全球之后，我们可以轻松地在 ARM 设备上通过容器部署各种好玩的应用，而不用在意各种系统的差异性。

但是想要跨平台构建 Docker 镜像可不是一件轻松的活，要么到不同 CPU 架构的系统上全部构建一遍，要么就得在当前系统上通过虚拟化技术模拟不同的 CPU 架构，最后可能还要想办法合并镜像，费力不讨好。

不过值得庆幸的是，`Docker 19.03` 引入了一个新的实验性插件，该插件使得跨平台构建 Docker 镜像比以往更加容易了。在介绍这个新特性之前，我们先来了解一下跨 CPU 架构构建程序的基础知识。

## 跨 CPU 架构编译程序的方法

先来快速回顾一下当前跨 CPU 架构编译程序的不同方法。

### 方法一：直接在目标硬件上编译

如果你能够访问目标 CPU 架构的系统，并且该操作系统支持运行构建所需的各种工具，那么你可以直接在目标系统上编译程序。

以构建 Docker 镜像为例，你可以在树莓派上安装 Docker，然后在树莓派上通过 `Dockerfile` 直接构建 arm 平台的镜像。

如果无法访问目标 CPU 架构的系统该怎么办？有没有办法通过某种方式直接在当前系统上构建目标 CPU 架构的程序？请看下文...

### 方法二：模拟目标硬件

还记得我们小时候在各种网吧台球室之类的场合玩的街机游戏吗？放张图给你们回忆一下：

![](https://images.icloudnative.io/uPic/20200723163206.jpg)

如果现在我们想重新体验以前玩过的街机游戏该怎么办？这时候就需要用到模拟器（Emulator）了。借助模拟器，我们可以让时光倒流，体验经典游戏的乐趣。

模拟器除了可以用来玩游戏之外，还可以用来跨 CPU 架构构建程序。最常用的模拟器是开源的 [QEMU](https://www.wikiwand.com/zh-hans/QEMU)，QEMU 支持许多常见的 CPU 架构，包括 `ARM`、`Power-PC` 和 `RISC-V` 等。通过模拟一个完整的操作系统，可以创建通用的 ARM 虚拟机，该虚拟机可以引导 Linux，设置开发环境，也可以在虚拟机内编译程序。

然而，模拟整个操作系统还是有点浪费，因为在这种模式下，QEMU 将会模拟整个系统，包括计时器、内存控制器、总线控制器等硬件。但编译程序根本不需要关心这些，还可以再精简些。

### 方法三：通过 binfmt_misc 模拟目标硬件的用户空间

在 Linux 上，`QEMU` 除了可以模拟完整的操作系统之外，还有另外一种模式叫 `用户态模式`（User mod）。该模式下 QEMU 将通过 [binfmt_misc](https://en.wikipedia.org/wiki/Binfmt_misc) 在 Linux 内核中注册一个二进制转换处理程序，并在程序运行时动态翻译二进制文件，根据需要将系统调用从目标 CPU 架构转换为当前系统的 CPU 架构。最终的效果看起来就像在本地运行目标 CPU 架构的二进制文件。

通过 QEMU 的用户态模式，我们可以创建轻量级的虚拟机（[chroot](https://en.wikipedia.org/wiki/Chroot) 或容器），然后在虚拟机系统中编译程序，和本地编译一样简单轻松。后面我们就会看到，跨平台构建 Docker 镜像用的就是这个方法。

### 方法四：使用交叉编译器

最后介绍一种嵌入式系统社区常用的方法：交叉编译（cross-compilation）。

交叉编译器是专门为在给定的系统平台上运行而设计的编译器，但是可以编译出另一个系统平台的可执行文件。例如，`amd64` 架构的 Linux 系统上的 C++ 交叉编译器可以编译出运行在 `aarch64`(64-bit ARM) 架构的嵌入式设备上的可执行文件。再举个真实的例子，安卓设备的 APP 基本上都是通过这种方法来编译的。

从性能角度来看，该方法与方法一没什么区别，因为不需要模拟器的参与，几乎没有性能损耗。但交叉编译不具有通用性，它的复杂度取决于程序使用的语言，如果使用 Golang 的话，那就超级容易了。

在全民容器时代，我们讨论构建时不仅包括构建单个可执行文件，还包括构建容器镜像。而且构建容器镜像比上面说的方法更复杂，再加上 Docker 本身的复杂性，这几乎是一个老大难的问题。

但引入了新的实验性插件之后，构建多平台架构的 Docker 镜像就比以前容易多了，至于这个插件到底是啥，下文会详细介绍。

## 构建多平台 Docker 镜像

利用 Docker 19.03 引入的插件 [buildx](https://github.com/docker/buildx)，可以很轻松地构建多平台 Docker 镜像。buildx 是 `docker build ...` 命令的下一代替代品，它利用 [BuildKit](https://github.com/moby/buildkit) 的全部功能扩展了 `docker build` 的功能。

下面就来演示一下如何在短短几分钟内使用 `buildx` 构建出不同平台的 Docker 镜像。步骤如下：

### 启用 buildx 插件

要想使用 `buildx`，首先要确保 Docker 版本不低于 `19.03`，同时还要通过设置环境变量 `DOCKER_CLI_EXPERIMENTAL` 来启用。可以通过下面的命令来为当前终端启用 buildx 插件：

```bash
🐳  → export DOCKER_CLI_EXPERIMENTAL=enabled
```

验证是否开启：

```bash
🐳 → docker buildx version
github.com/docker/buildx v0.3.1-tp-docker 6db68d029599c6710a32aa7adcba8e5a344795a7
```

如果在某些系统上设置环境变量 `DOCKER_CLI_EXPERIMENTAL` 不生效（比如 **Arch Linux**）,你可以选择从源代码编译：

```bash
🐳 → export DOCKER_BUILDKIT=1
🐳 → docker build --platform=local -o . git://github.com/docker/buildx
🐳 → mkdir -p ~/.docker/cli-plugins && mv buildx ~/.docker/cli-plugins/docker-buildx
```

### 启用 binfmt_misc

{{< alert >}}
如果你使用的是 Docker 桌面版（MacOS 和 Windows），默认已经启用了 `binfmt_misc`，可以跳过这一步。
{{< /alert >}}

如果你使用的是 Linux，需要手动启用 `binfmt_misc`。大多数 Linux 发行版都很容易启用，不过还有一个更容易的办法，直接运行一个特权容器，容器里面写好了设置脚本：

```bash
🐳 → docker run --privileged --rm tonistiigi/binfmt --install all
```

{{< alert >}}
建议将 Linux 内核版本升级到 4.x 以上，特别是 CentOS 用户，你可能会遇到错误。
{{< /alert >}}

验证是 binfmt_misc 否开启：

```bash
🐳 → ls -al /proc/sys/fs/binfmt_misc/
总用量 0
总用量 0
-rw-r--r-- 1 root root 0 11月 18 00:12 qemu-aarch64
-rw-r--r-- 1 root root 0 11月 18 00:12 qemu-arm
-rw-r--r-- 1 root root 0 11月 18 00:12 qemu-ppc64le
-rw-r--r-- 1 root root 0 11月 18 00:12 qemu-s390x
--w------- 1 root root 0 11月 18 00:09 register
-rw-r--r-- 1 root root 0 11月 18 00:12 status
```

验证是否启用了相应的处理器：

```bash
🐳 → cat /proc/sys/fs/binfmt_misc/qemu-aarch64
enabled
interpreter /usr/bin/qemu-aarch64
flags: OCF
offset 0
magic 7f454c460201010000000000000000000200b7
mask ffffffffffffff00fffffffffffffffffeffff
```

### 从默认的构建器切换到多平台构建器

Docker 默认会使用不支持多 CPU 架构的构建器，我们需要手动切换。

先创建一个新的构建器：

```bash
🐳 → docker buildx create --use --name mybuilder
```

启动构建器：

```bash
🐳 → docker buildx inspect mybuilder --bootstrap

[+] Building 5.0s (1/1) FINISHED
 => [internal] booting buildkit                                                                                                                          5.0s
 => => pulling image moby/buildkit:buildx-stable-1                                                                                                       4.4s
 => => creating container buildx_buildkit_mybuilder0                                                                                                     0.6s
Name:   mybuilder
Driver: docker-container

Nodes:
Name:      mybuilder0
Endpoint:  unix:///var/run/docker.sock
Status:    running
Platforms: linux/amd64, linux/arm64, linux/ppc64le, linux/s390x, linux/386, linux/arm/v7, linux/arm/v6
```

查看当前使用的构建器及构建器支持的 CPU 架构，可以看到支持很多 CPU 架构：

```bash
🐳 → docker buildx ls

NAME/NODE    DRIVER/ENDPOINT             STATUS  PLATFORMS
mybuilder *  docker-container
  mybuilder0 unix:///var/run/docker.sock running linux/amd64, linux/arm64, linux/ppc64le, linux/s390x, linux/386, linux/arm/v7, linux/arm/v6
default      docker
  default    default                     running linux/amd64, linux/386
```

### 构建多平台镜像

现在我们就可以构建支持多 CPU 架构的镜像了！假设有一个简单的 golang 程序源码：

```bash
🐳 → cat hello.go
package main

import (
        "fmt"
        "runtime"
)

func main() {
        fmt.Printf("Hello, %s!\n", runtime.GOARCH)
}
```

创建一个 Dockerfile 将该应用容器化：

```dockerfile
🐳 → cat Dockerfile
FROM golang:alpine AS builder
RUN mkdir /app
ADD . /app/
WORKDIR /app
RUN go build -o hello .

FROM alpine
RUN mkdir /app
WORKDIR /app
COPY --from=builder /app/hello .
CMD ["./hello"]
```

这是一个多阶段构建 Dockerfile，使用 Go 编译器来构建应用，并将构建好的二进制文件拷贝到 alpine 镜像中。

现在就可以使用 buildx 构建一个支持 arm、arm64 和 amd64 多架构的 Docker 镜像了，同时将其推送到 [Docker Hub](https://hub.docker.com/)：

```bash
🐳 → docker buildx build -t yangchuansheng/hello-arch --platform=linux/arm,linux/arm64,linux/amd64 . --push
```

{{< alert >}}
需要提前通过 `docker login` 命令登录认证 Docker Hub。
{{< /alert >}}

现在就可以通过 `docker pull mirailabs/hello-arch` 拉取刚刚创建的镜像了，Docker 将会根据你的 CPU 架构拉取匹配的镜像。

背后的原理也很简单，之前已经提到过了，buildx 会通过 `QEMU` 和 `binfmt_misc` 分别为 3 个不同的 CPU 架构（arm，arm64 和 amd64）构建 3 个不同的镜像。构建完成后，就会创建一个 [manifest list](https://docs.docker.com/engine/reference/commandline/manifest/)，其中包含了指向这 3 个镜像的指针。

如果想将构建好的镜像保存在本地，可以将 `type` 指定为 `docker`，但必须分别为不同的 CPU 架构构建不同的镜像，不能合并成一个镜像，即：

```bash
🐳 → docker buildx build -t yangchuansheng/hello-arch --platform=linux/arm -o type=docker .
🐳 → docker buildx build -t yangchuansheng/hello-arch --platform=linux/arm64 -o type=docker .
🐳 → docker buildx build -t yangchuansheng/hello-arch --platform=linux/amd64 -o type=docker .
```

### 测试多平台镜像

由于之前已经启用了 `binfmt_misc`，现在我们就可以运行任何 CPU 架构的 Docker 镜像了，因此可以在本地系统上测试之前生成的 3 个镜像是否有问题。

首先列出每个镜像的 `digests`：

```bash
🐳 → docker buildx imagetools inspect yangchuansheng/hello-arch

Name:      docker.io/yangchuansheng/hello-arch:latest
MediaType: application/vnd.docker.distribution.manifest.list.v2+json
Digest:    sha256:ec55f5ece9a12db0c6c367acda8fd1214f50ee502902f97b72f7bff268ebc35a

Manifests:
  Name:      docker.io/yangchuansheng/hello-arch:latest@sha256:38e083870044cfde7f23a2eec91e307ec645282e76fd0356a29b32122b11c639
  MediaType: application/vnd.docker.distribution.manifest.v2+json
  Platform:  linux/arm/v7

  Name:      docker.io/yangchuansheng/hello-arch:latest@sha256:de273a2a3ce92a5dc1e6f2d796bb85a81fe1a61f82c4caaf08efed9cf05af66d
  MediaType: application/vnd.docker.distribution.manifest.v2+json
  Platform:  linux/arm64

  Name:      docker.io/yangchuansheng/hello-arch:latest@sha256:8b735708d7d30e9cd6eb993449b1047b7229e53fbcebe940217cb36194e9e3a2
  MediaType: application/vnd.docker.distribution.manifest.v2+json
  Platform:  linux/amd64
```

运行每一个镜像并观察输出结果：

```bash
🐳 → docker run --rm docker.io/yangchuansheng/hello-arch:latest@sha256:38e083870044cfde7f23a2eec91e307ec645282e76fd0356a29b32122b11c639
Hello, arm!

🐳 → docker run --rm docker.io/yangchuansheng/hello-arch:latest@sha256:de273a2a3ce92a5dc1e6f2d796bb85a81fe1a61f82c4caaf08efed9cf05af66d
Hello, arm64!

🐳 → docker run --rm docker.io/yangchuansheng/hello-arch:latest@sha256:8b735708d7d30e9cd6eb993449b1047b7229e53fbcebe940217cb36194e9e3a2
Hello, amd64!
```

So cool！

## 总结

回顾一下，本文带大家了解了在不同的 CPU 架构上运行软件的挑战性，以及 `buildx` 如何帮助我们解决了其中的一些挑战。使用 `buildx`，我们无需对 Dockerfile 进行任何修改，就可以创建支持多种 CPU 架构的 Docker 镜像，然后将其推送到 Docker Hub。任何安装了 Docker 的系统都可以拉取到与它的 CPU 架构相对应的镜像。

未来 buildx 可能会成为 `docker build` 命令的一部分，最终所有上面提到的功能都会变成默认的功能，下沉到基础设施中交叉编译程序的做法将会变成远古时代的愚蠢行为。

## 参考资料

+ [Building Multi-Arch Images for Arm and x86 with Docker Desktop](https://engineering.docker.com/2019/04/multi-arch-images/)
+ [Getting started with Docker for Arm on Linux](https://engineering.docker.com/2019/06/getting-started-with-docker-for-arm-on-linux/)
+ [Leverage multi-CPU architecture support](https://docs.docker.com/docker-for-mac/multi-arch/)
