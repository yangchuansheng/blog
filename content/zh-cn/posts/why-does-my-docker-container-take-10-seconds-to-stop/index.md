---
keywords:
- docker
- sigterm
- tini
title: "Docker 容器优雅终止方案"
date: 2020-05-27T09:44:49+08:00
lastmod: 2020-05-27T09:44:49+08:00
description: 本文主要讨论了 Docker 容器无法处理 SIGTERM 信号的原因及解决方案。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocLevels: ["h2", "h3", "h4"]
tags:
- Docker
categories:
- cloud-native
img: https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20200527230726.jpg
---

> 原文链接：[Why Does My Docker Container Take 10+ Seconds to Stop?](https://blog.true-kubernetes.com/why-does-my-docker-container-take-10-seconds-to-stop/)

作为一名系统重启工程师（SRE），你可能经常需要重启容器，毕竟 Kubernetes 的优势就是快速弹性伸缩和故障恢复，遇到问题先重启容器再说，几秒钟即可恢复，实在不行再重启系统，这就是系统重启工程师的杀手锏。然而现实并没有理论上那么美好，某些容器需要花费 `10s` 左右才能停止，这是为啥？有以下几种可能性：

1. 容器中的进程没有收到 [SIGTERM](https://www.gnu.org/software/libc/manual/html_node/Termination-Signals.html) 信号。
2. 容器中的进程收到了信号，但忽略了。
3. 容器中应用的关闭时间确实就是这么长。

对于第 3 种可能性我们无能为力，本文主要解决 1 和 2。

如果要构建一个新的 Docker 镜像，肯定希望镜像越小越好，这样它的下载和启动速度都很快，一般我们都会选择一个瘦了身的操作系统（例如 `Alpine`，`Busybox` 等）作为基础镜像。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20200527100705.png)

问题就在这里，这些基础镜像的 [init 系统](https://en.wikipedia.org/wiki/Init)也被抹掉了，这就是问题的根源！

`init` 系统有以下几个特点：

+ 它是系统的第一个进程，负责产生其他所有用户进程。
+ init 以守护进程方式存在，是所有其他进程的祖先。
+ 它主要负责：
  + 启动守护进程
  + 回收孤儿进程
  + 将操作系统信号转发给子进程

## 1. Docker 容器停止过程

对于容器来说，`init` 系统不是必须的，当你通过命令 `docker stop mycontainer` 来停止容器时，docker CLI 会将 `TERM` 信号发送给 mycontainer 的 `PID` 为 1 的进程。

+ **如果 PID 1 是 init 进程** - 那么 PID 1 会将 TERM 信号转发给子进程，然后子进程开始关闭，最后容器终止。
+ **如果没有 init 进程** - 那么容器中的应用进程（Dockerfile 中的 `ENTRYPOINT` 或 `CMD` 指定的应用）就是 PID 1，应用进程直接负责响应 `TERM` 信号。这时又分为两种情况：
  + **应用不处理 SIGTERM** - 如果应用没有监听 `SIGTERM` 信号，或者应用中没有实现处理 `SIGTERM` 信号的逻辑，应用就不会停止，容器也不会终止。
  + **容器停止时间很长** - 运行命令 `docker stop mycontainer` 之后，Docker 会等待 `10s`，如果 `10s` 后容器还没有终止，Docker 就会绕过容器应用直接向内核发送 `SIGKILL`，内核会强行杀死应用，从而终止容器。

## 2. 容器进程收不到 SIGTERM 信号？

如果容器中的进程没有收到 `SIGTERM` 信号，很有可能是因为应用进程不是 `PID 1`，PID 1 是 `shell`，而应用进程只是 `shell` 的子进程。而 shell 不具备 `init` 系统的功能，也就不会将操作系统的信号转发到子进程上，这也是容器中的应用没有收到 `SIGTERM` 信号的常见原因。

问题的根源就来自 `Dockerfile`，例如：

```dockerfile
FROM alpine:3.7
COPY popcorn.sh .
RUN chmod +x popcorn.sh
ENTRYPOINT ./popcorn.sh
```

`ENTRYPOINT` 指令使用的是 **[shell 模式](https://docs.docker.com/engine/reference/builder/#shell-form-entrypoint-example)**，这样 Docker 就会把应用放到 `shell` 中运行，因此 `shell` 是 PID 1。

解决方案有以下几种：

### 方案 1：使用 exec 模式的 ENTRYPOINT 指令

与其使用 shell 模式，不如使用 [exec 模式](https://docs.docker.com/engine/reference/builder/#exec-form-entrypoint-example)，例如：

```dockerfile
FROM alpine:3.7
COPY popcorn.sh .
RUN chmod +x popcorn.sh
ENTRYPOINT ["./popcorn.sh"]
```

这样 PID 1 就是 `./popcorn.sh`，它将负责响应所有发送到容器的信号，至于 `./popcorn.sh` 是否真的能捕捉到系统信号，那是另一回事。

举个例子，假设使用上面的 Dockerfile 来构建镜像，`popcorn.sh` 脚本每过一秒打印一次日期：

```bash
#!/bin/sh

while true
do
    date
    sleep 1
done
```

构建镜像并创建容器：

```bash
🐳 → docker build -t truek8s/popcorn .
🐳 → docker run -it --name corny --rm truek8s/popcorn
```

打开另外一个终端执行停止容器的命令，并计时：

```bash
🐳 → time docker stop corny
```

因为 `popcorn.sh` 并没有实现捕获和处理 `SIGTERM` 信号的逻辑，所以需要 10s 左右才能停止容器。要想解决这个问题，就要往脚本中添加信号处理代码，让它捕获到 `SIGTERM` 信号时就终止进程：

```bash
#!/bin/sh

# catch the TERM signal and then exit
trap "exit" TERM

while true
do
    date
    sleep 1
done
```

**注意：下面这条指令与 shell 模式的 ENTRYPOINT 指令是等效的：**

```dockerfile
ENTRYPOINT ["/bin/sh", "./popcorn.sh"]
```

### 方案 2：直接使用 exec 命令

如果你就想使用 `shell` 模式的 ENTRYPOINT 指令，也不是不可以，只需将启动命令追加到 `exec` 后面即可，例如：

```dockerfile
FROM alpine:3.7
COPY popcorn.sh .
RUN chmod +x popcorn.sh
ENTRYPOINT exec ./popcorn.sh
```

这样 `exec` 就会将 shell 进程替换为 `./popcorn.sh` 进程，PID 1 仍然是 `./popcorn.sh`。

### 方案 3：使用 init 系统

如果容器中的应用默认无法处理 `SIGTERM` 信号，又不能修改代码，这时候方案 1 和 2 都行不通了，只能在容器中添加一个 `init` 系统。init 系统有很多种，这里推荐使用 tini，它是专用于容器的轻量级 init 系统，使用方法也很简单：

1. 安装 `tini`
2. 将 `tini` 设为容器的默认应用
3. 将 `popcorn.sh` 作为 `tini` 的参数

具体的 Dockerfile 如下：

```dockerfile
FROM alpine:3.7
COPY popcorn.sh .
RUN chmod +x popcorn.sh
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--", "./popcorn.sh"]
```

现在 `tini` 就是 PID 1，它会将收到的系统信号转发给子进程 `popcorn.sh`。

{{< alert >}}
如果你想直接通过 docker 命令来运行容器，可以直接通过参数 `--init` 来使用 tini，不需要在镜像中安装 tini。如果是 `Kubernetes` 就不行了，还得老老实实安装 tini。
{{< /alert >}}

## 3. 使用 tini 后应用还需要处理 SIGTERM 吗？

最后一个问题：如果移除 `popcorn.sh` 中对 SIGTERM 信号的处理逻辑，容器会在我们执行停止命令后立即终止吗？

答案是肯定的。在 Linux 系统中，`PID 1` 和其他进程不太一样，准确地说应该是 `init` 进程和其他进程不一样，它不会执行与接收到的信号相关的默认动作，必须在代码中明确实现捕获处理 `SIGTERM` 信号的逻辑，方案 1 和 2 干的就是这个事。

普通进程就简单多了，只要它收到系统信号，就会执行与该信号相关的默认动作，不需要在代码中显示实现逻辑，因此可以优雅终止。