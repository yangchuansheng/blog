---
title: "Kubernetes 中的容器运行时"
subtitle: "容器运行时接口解析"
date: 2018-04-03T06:50:43Z
draft: false
author: 米开朗基杨
toc: true
categories: cloud-native
tags: ["kubernetes", "docker"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191204211758.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

容器运行时（Container Runtime）是 Kubernetes 最重要的组件之一，负责真正管理镜像和容器的生命周期。Kubelet 通过 `Container Runtime Interface (CRI)` 与容器运行时交互，以管理镜像和容器。

容器运行时接口(`Container Runtime Interface (CRI)`) 是 Kubelet 1.5 和 kubelet 1.6 中主要负责的一块项目，它重新定义了 Kubelet Container Runtime API，将原来完全面向 Pod 级别的 API 拆分成面向 `Sandbox` 和 `Container` 的 API，并分离镜像管理和容器引擎到不同的服务。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/7Ds35Y.jpg)

CRI 最早从从 1.4 版就开始设计讨论和开发，在 v1.5 中发布第一个测试版。在 v1.6 时已经有了很多外部容器运行时，如 frakti、cri-o 的 alpha 支持。v1.7 版本新增了 `cri-containerd` 的 alpha 支持，而 `frakti` 和 `cri-o` 则升级到 beta 支持。

## CRI 接口

----

CRI 基于 `gRPC` 定义了 `RuntimeService` 和 `ImageService`，分别用于容器运行时和镜像的管理。其定义在

+ **v1.10+:** [pkg/kubelet/apis/cri/v1alpha2/runtime](https://github.com/kubernetes/kubernetes/blob/release-1.10/pkg/kubelet/apis/cri/runtime/v1alpha2)
+ **v1.7~v1.9:** [pkg/kubelet/apis/cri/v1alpha1/runtime](https://github.com/kubernetes/kubernetes/tree/release-1.9/pkg/kubelet/apis/cri/v1alpha1/runtime)
+ **v1.6:** [pkg/kubelet/api/v1alpha1/runtime](https://github.com/kubernetes/kubernetes/tree/release-1.6/pkg/kubelet/api/v1alpha1/runtime)

Kubelet 作为 CRI 的客户端，而 Runtime 维护者则需要实现 CRI 服务端，并在启动 kubelet 时将其传入：

```bash
$ kubelet --container-runtime=remote --container-runtime-endpoint=unix:///var/run/crio/crio.sock ..
```

## 如何开发新的 Container Runtime

----

开发新的 Container Runtime 只需要实现 `CRI gRPC Server`，包括 `RuntimeService` 和 `ImageService`。该 gRPC Server 需要监听在本地的 `unix socket`（Linux 支持 unix socket 格式，Windows 支持 tcp 格式）。

具体的实现方法可以参考下面已经支持的 Container Runtime 列表。

## 目前支持的 Container Runtime

----

目前，有多家厂商都在基于 CRI 集成自己的容器引擎，其中包括:

+ **Docker:** 核心代码依然保留在 kubelet 内部（`pkg/kubelet/dockershim`），依然是最稳定和特性支持最好的 Runtime

+ **[HyperContainer](https://github.com/kubernetes/frakti):** 支持 Kubernetes v1.6+，提供基于 `hypervisor` 和 docker 的混合运行时，适用于运行非可信应用，如多租户和 `NFV` 等场景

+ **Runc** 有两个实现，cri-o 和 cri-containerd
    + [cri-containerd](https://github.com/kubernetes-incubator/cri-containerd): 支持 kubernetes v1.7+
    + [cri-o](https://github.com/kubernetes-incubator/cri-o): 支持 Kubernetes v1.6+，底层运行时支持 runc 和 intel clear container

+ **[Rkt](https://github.com/kubernetes-incubator/rktlet):** 开发中

+ **[Mirantis](https://github.com/Mirantis/virtlet):** 直接管理 `libvirt` 虚拟机，镜像须是 `qcow2` 格式

+ **[Infranetes](https://github.com/apporbit/infranetes):** 直接管理 IaaS 平台虚拟机，如 GCE、AWS 等

### cri-containerd

以 Containerd 为例，在 1.0 及以前版本将 `dockershim` 和 `docker daemon` 替换为 `cri-containerd + containerd`，而在 1.1 版本直接将 cri-containerd 内置在 Containerd 中，简化为一个 CRI 插件。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/4pdror.jpg)

Containerd 内置的 CRI 插件实现了 Kubelet CRI 接口中的 `Image Service` 和 `Runtime Service`，通过内部接口管理容器和镜像，并通过 CNI 插件给 Pod 配置网络。
![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/mCGR3h.jpg)

## CRI Tools

----

为了方便开发、调试和验证新的 Container Runtime，社区还维护了一个 [cri-tools](https://github.com/kubernetes-incubator/cri-tools) 工具，它提供两个组件

+ `crictl:` 类似于 docker 的命令行工具，不需要通过 Kubelet 就可以跟 Container Runtime 通信，可用来调试或排查问题
+ `critest:` CRI 的验证测试工具，用来验证新的 Container Runtime 是否实现了 CRI 需要的功能

另外一个工具是 [libpod](https://github.com/projectatomic/libpod)，它也提供了一个组件：[podman](https://github.com/projectatomic/libpod/blob/master/cmd/podman)，功能和 `crictl` 类似。

如果想构建 oci 格式的镜像，可以使用工具：[buildah](https://github.com/projectatomic/buildah)

