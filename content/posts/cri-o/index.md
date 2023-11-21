---
title: "CRI-O 简介"
subtitle: "轻量级容器运行时 CRI-O 解析"
date: 2018-04-03T08:11:38Z
draft: false
author: 米开朗基杨
toc: true
categories: cloud-native
tags: ["kubernetes", "docker"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191204211347.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

[上一篇文章](https://icloudnative.io/posts/container-runtime) 介绍了什么是容器运行时，并列出了不同的容器运行时。本篇重点介绍其中的一种容器运行时 `CRI-O`。

## <span id="inline-toc">1.</span> CRI-O 的诞生

----

当容器运行时（Container Runtime）的标准被提出以后，Red Hat 的一些人开始想他们可以构建一个更简单的运行时，而且这个运行时仅仅为 Kubernetes 所用。这样就有了 `skunkworks`项目，最后定名为 `CRI-O`， 它实现了一个最小的 CRI 接口。在 2017 Kubecon Austin 的一个演讲中， Walsh 解释说， ”CRI-O 被设计为比其他的方案都要小，遵从 Unix 只做一件事并把它做好的设计哲学，实现组件重用“。

根据 Red Hat 的 CRI-O 开发者 Mrunal Patel 在研究里面说的， 最开始 Red Hat 在 2016 年底为它的 OpenShift 平台启动了这个项目，同时项目也得到了 `Intel` 和 `SUSE` 的支持。CRI-O 与 `CRI` 规范兼容，并且与 `OCI` 和 Docker 镜像的格式也兼容。它也支持校验镜像的 GPG 签名。 它使用容器网络接口 Container Network Interface（CNI）处理网络，以便任何兼容 CNI 的网络插件可与该项目一起使用，OpenShift 也用它来做软件定义存储层。 它支持多个 CoW 文件系统，比如常见的 overlay，aufs，也支持不太常见的 Btrfs。

## <span id="inline-toc">2.</span> CRI-O 的原理及架构

----

CRI-O 最出名的特点是它支持“受信容器”和“非受信容器”的混合工作负载。比如，CRI-O 可以使用 [Clear Containers](https://clearlinux.org/containers) 做强隔离，这样在多租户配置或者运行非信任代码时很有用。这个功能如何集成进 Kubernetes 现在还不太清楚，Kubernetes 现在认为所有的后端都是一样的。

当 Kubernetes 需要运行容器时，它会与 CRI-O 进行通信，CRI-O 守护程序与 `runc`（或另一个符合 OCI 标准的运行时）一起启动容器。当 Kubernetes 需要停止容器时，CRI-O 会来处理，它只是在幕后管理 Linux 容器，以便用户不需要担心这个关键的容器编排。

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/OerlSo.jpg)

CRI-O 有一个有趣的架构（见下图），它重用了很多基础组件，下面我们来看一下各个组件的功能及工作流程。

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/iSdQap.jpg)

+ Kubernetes 通知 `kubelet` 启动一个 pod。

+ kubelet 通过 `CRI`(Container runtime interface) 将请求转发给 `CRI-O daemon`。

+ CRI-O 利用 `containers/image` 库从镜像仓库拉取镜像。

+ 下载好的镜像被解压到容器的根文件系统中，并通过 `containers/storage` 库存储到 COW 文件系统中。

+ 在为容器创建 `rootfs` 之后，CRI-O 通过 [oci-runtime-tool](https://github.com/opencontainers/runtime-tools) 生成一个 OCI 运行时规范 json 文件，描述如何使用 OCI Generate tools 运行容器。

+ 然后 CRI-O 使用规范启动一个兼容 CRI 的运行时来运行容器进程。默认的运行时是 `runc`。

+ 每个容器都由一个独立的 `conmon` 进程监控，conmon 为容器中 pid 为 1 的进程提供一个 `pty`。同时它还负责处理容器的日志记录并记录容器进程的退出代码。

+ 网络是通过 CNI 接口设置的，所以任何 CNI 插件都可以与 CRI-O 一起使用。

### 隆重介绍一下 conmon

根据 Patel 所说，conmon 程序是“纯C编写的，用来提高稳定性和性能”，conmon 负责监控，日志，TTY 分配，以及类似 `out-of-memory` 情况的杂事。

conmon 需要去做所有 `systemd` 不做或者不想做的事情。即使 CRI-O 不直接使用 systemd 来管理容器，它也将容器分配到 sytemd 兼容的 `cgroup` 中，这样常规的 systemd 工具比如 `systemctl` 就可以看见容器资源使用情况了。

因为 conmon（不是CRI daemon）是容器的父进程，它允许 CRI-O 的部分组件重启而不会影响容器，这样可以保证更加平滑的升级。**现在 Docker 部署的问题就是 Docker 升级需要重起所有的容器**。 通常这对于 Kubernetes 集群来说不是问题，但因为它可以将容器迁移来滚动升级。

## <span id="inline-toc">3.</span> 下一步

----

`CRI-O 1.0` 在2017年10月发布，支持 Kubernetes 1.7，后来 CRI-O 1.8，1.9 相继发布，支持 Kubernetes 的 1.8， 1.9（此时版本命名规则改为与Kubernetes一致）。

CRI-O 在 `Openshift 3.7` 中作为 beta 版提供，Patel 考虑在 `Openshift 3.9` 中让它进步一步稳定，在 3.10 中成为缺省的运行时，同时让 Docker 作为候选的运行时。

下一步的工作包括集成新的 `Kata Containers` 的这个基于 VM 的运行时，增加 `kube-spawn` 的支持，支持更多类似 NFS， GlusterFS 的存储后端等。 团队也在讨论如何通过支持 `casync` 或者 `libtorrent` 来优化多节点间的镜像同步。

如果你想贡献或者关注开发，就去 [CRI-O 项目的 GitHub 仓库](https://github.com/kubernetes-incubator/cri-o)，然后关注 [CRI-O 博客](https://medium.com/cri-o)。

## <span id="inline-toc">4.</span> 参考

----

+ [CRI-O and Alternative Runtimes in Kubernetes](https://www.projectatomic.io/blog/2017/02/crio-runtimes/)
+ [Lightweight Container Runtime for Kubernetes](http://cri-o.io/)
+ [CRI-O Support for Kubernetes](https://medium.com/cri-o/cri-o-support-for-kubernetes-4934830eb98e)
+ [CRI-O 1.0 简介](https://linux.cn/article-9015-1.html)
