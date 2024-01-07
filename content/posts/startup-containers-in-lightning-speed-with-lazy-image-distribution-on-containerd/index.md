---
keywords:
- stargz
- containerd
- snapshotter
- OCI
- 容器
- 镜像
title: "Containerd 使用 Stargz Snapshotter 延迟拉取镜像"
date: 2020-08-18T15:15:35+08:00
lastmod: 2020-08-18T15:15:35+08:00
description: 本文主要介绍了 Stargz Snapshotter 的工作原理和配置方法。
draft: false 
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocLevels: ["h2", "h3", "h4"]
tags:
- Containerd
categories: 
- cloud-native
img: https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20200820145127.png
---

在容器的整个生命周期中，拉取镜像是最耗时的步骤之一。[Harter 等人的研究](https://www.usenix.org/node/194431)表明：

> 拉取镜像占用了容器启动时间的 `76%`，只有 `6.4%` 的时间用来读取数据。

这个问题一直困扰着各类工作负载，包括 serverless 函数的冷启动时间，镜像构建过程中基础镜像的拉取等。虽然有各种折中的解决方案，但这些方案都有缺陷：

+ **缓存镜像** : 冷启动时仍然有性能损失。
+ **减小镜像体积** : 无法避免某些场景需要用到大体积的镜像，比如机器学习。

现在有一个更通用的解决方案，该方案完全兼容 OCI 标准，目前看来是比较理想的方案。

## 1. Containerd Stargz Snapshotter

`Containerd` 为了解决这个问题启动了一个非核心子项目 [**Stargz Snapshotter**](https://github.com/containerd/stargz-snapshotter)，旨在提高镜像拉取的性能。该项目作为 Containerd 的一个插件，利用 [Google 的 stargz 镜像格式](https://github.com/google/crfs)来延迟拉取镜像。这里的**延迟拉取**指的是 Containerd 在拉取时不会拉取整个镜像文件，而是按需获取必要的文件。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20200820145800.png)

下图是基于 [HelloBench](https://github.com/Tintri/hello-bench) 的容器启动过程基准测试结果，[跑在 Github Actions 提供的机器上，镜像仓库直接使用 Docker Hub](https://github.com/containerd/stargz-snapshotter/actions?query=workflow:Benchmark+branch:master)：

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20200820145843.png)

+ `legacy` 表示使用 Containerd 默认的 snapshotter（`overlayfs`）来拉取镜像且不进行优化时的启动性能，这种情况下 Containerd 会拉取整个镜像内容，所以拉取时间会很长。
+ 而对于 `stargz` 格式的镜像，Containerd 可以在镜像还没有完全拉取到本地之前就启动容器，然后按需获取需要的文件，所以拉取的时间更短。但读取文件时需要从远程仓库下载文件内容，所以 `run` 的性能要低于传统的拉取方式。
+ 如果使用进一步优化的镜像格式 `estargz`，可以在拉取时间短的基础上提高 `run` 的性能。

`Stargz snapshotter` 的特点：

### 兼容 OCI 标准

`Stargz snapshotter` 可以从符合 [OCI](https://github.com/opencontainers/distribution-spec)/[Docker](https://docs.docker.com/registry/spec/api/) 镜像仓库标准的镜像仓库中延迟拉取 `stargz` 镜像，拉取到的 `stargz` 镜像也符合  [OCI](https://github.com/opencontainers/image-spec/)/[Docker](https://github.com/moby/moby/blob/master/image/spec/v1.2.md) 镜像规范，所以任何容器运行时都可以运行。

### 支持私有镜像仓库

`Stargz snapshotter` 支持基于文件 `~/.docker/config.json` 的认证，也支持基于 Kubernetes `Secret` 的认证。

### 支持 Kubernetes

它也可以作为 [Containerd 的 CRI 插件](https://github.com/containerd/cri)，所以 Kubernetes 也可以使用。

## 2. 使用指南

要想在 Kubernetes 中使用 `stargz snapshotter`，需要在每个节点上运行一个守护进程，然后将其配置为 Containerd 的插件。同时需要确保 Containerd 的 commit 版本不低于 [d8506bf](https://github.com/containerd/containerd/commit/d8506bfd7b407dcb346149bcec3ed3c19244e3f1)。所需的 Containerd 配置文件（`/etc/containerd/config.toml`）内容如下：

```toml
version = 2

# Plug stargz snapshotter into containerd
# Containerd recognizes stargz snapshotter through specified socket address.
# The specified address below is the default which stargz snapshotter listen to.
[proxy_plugins]
  [proxy_plugins.stargz]
    type = "snapshot"
    address = "/run/containerd-stargz-grpc/containerd-stargz-grpc.sock"

# Use stargz snapshotter through CRI
[plugins."io.containerd.grpc.v1.cri".containerd]
  snapshotter = "stargz"
```

然后就可以创建 stargz 格式的 Pod 了，例如：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nodejs
spec:
  containers:
  - name: nodejs-stargz
    image: stargz/node:13.13.0-esgz
    command: ["node"]
    args:
    - -e
    - var http = require('http');
      http.createServer(function(req, res) {
        res.writeHead(200);
        res.end('Hello World!\n');
      }).listen(80);
    ports:
    - containerPort: 80
```

该 Pod 使用了可以从 Docker Hub 中延迟拉取的镜像 `stargz/node:13.13.0-esgz` 来取代官方的镜像 `library/node:13.13.0`。

## 3. 实现原理

Stargz snapshotter 是由多种技术组合而成的，本节只介绍其中三种技术：

### stargz 压缩格式

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20200820145449.png)

延迟拉取的目的是让容器运行时有选择地从 `blob` 中的镜像层（layer）下载和提取文件，但 [OCI](https://github.com/opencontainers/image-spec/)/[Docker](https://github.com/moby/moby/blob/master/image/spec/v1.2.md) **镜像规范**将所有的镜像层打包成一个 `tar` 或 `tar.gz` 存档，这样即使你要提取单个文件也要扫描整个 `blob`。如果镜像使用 gzip 进行压缩，就更没有办法提取特定文件了。

[Stargz](https://github.com/google/crfs) 是谷歌提出的存档压缩格式，是 `Seekable tar.gz` 的缩写，顾名思义，可以有选择地从存档中搜寻并提取特定的文件，无需扫描整个镜像 blob。关于 Stargz 镜像格式的更多细节，请参考 [CRFS 项目](https://github.com/google/crfs)。通过结合  [OCI](https://github.com/opencontainers/distribution-spec)/[Docker](https://docs.docker.com/registry/spec/api/) **镜像仓库规范**支持的 `HTTP Range Request`，容器运行时可以有选择地从镜像仓库中获取文件。

在 stargz 存档中，每个 `tar` 条目都被压缩成 `gzip` 格式，stargz 是所有 `gzip` 的组合，仍然是有效的 `gzip`，所以任何容器运行时都可以像对待传统的 `tar.gz` 镜像层一样对待 `stargz` 镜像层。对于大文件来说，会被分成多个 gzip，只包含元数据的条目（如符号链接）与相邻的条目会压缩到同一个 gzip 中。

在 gzip 之后还包含一个名为 TOC 的索引文件条目，这是一个 JSON 文件（`stargz.index.json`），记录了 stargz 存档中每个文件内容对应的块的大小和偏移量，以及每个文件的元数据（名称、文件类型、所有者等）。有了 TOC 之后，就可以在不扫描整个存档文件的情况下提取需要的文件。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20200820145544.png)

### stargz 优化版

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20200820145630.png)

`Stargz` 虽然提高了拉取性能，但在运行阶段按需读取文件时仍然存在性能缺陷。为了解决这个问题，stargz snapshotter 做了进一步的优化。

一般情况下，每个容器镜像都是用来运行特定的服务，这些信息在构建时就已经定义好了，例如在 `Dockerfile` 中定义的 entrypoint、环境变量等等。我们可以根据这些信息来预测容器运行时可能需要访问的文件，在运行之前预取这些文件，从而提高缓存命中率。

stargz snapshotter 项目中的 `ctr-remote images optimize` 命令提供了对读取最有可能在运行时访问的文件性能的优化，将这些文件放到相邻的镜像层中。具体的做法是在一个沙箱环境中运行指定的工作负载，并对所有文件进行剖析，筛选出最有可能被访问的文件，然后按照预测的访问顺序对其进行排序，并在最后放置一个标志性文件作为结束。在运行容器之前，stargz snapshotter 会通过单个 `HTTP Range Request` 预取和预缓存这个范围的文件，提高缓存命中率，从而减轻运行时的开销。

### 远程 snapshotter 插件

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20200820145709.png)

Containerd 的架构是可插拔的，所有的功能是按照定义的 API 以插件的形式实现的。用户可以将其与自定义插件集成来扩展 Containerd 的功能。例如，[AWS Firecracker](https://github.com/firecracker-microvm/firecracker-containerd) 就扩展了 Containerd 来支持 `microVMs`。

Snapshotter 就是 Containerd 的其中一个插件，它被用来存储拉取到本地的镜像层。在拉取镜像的过程中，Containerd 会提取其中的镜像层，并将它们叠加在一起，存储为为一个快照（`snapshot`）。当 Containerd 启动容器时，会向 snapshotter 查询快照，并将其作为容器的 `rootfs`。

Containerd 也支持远程的 `snapshotter`，它是 `snapshotter` 的一个变体，能够直接挂载远程的镜像层作为快照（`snapshot`），无需拉取整个镜像层。`Stargz snapshotter` 也实现了远程 snapshotter。

## 参考链接

+ [Startup Containers in Lightning Speed with Lazy Image Distribution on Containerd](https://medium.com/nttlabs/startup-containers-in-lightning-speed-with-lazy-image-distribution-on-containerd-243d94522361)
+ [Stargz Snapshotter](https://github.com/containerd/stargz-snapshotter)

