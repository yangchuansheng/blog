---
keywords:
- shim
- dockershim
- Docker
- Containerd
title: "Containerd shim 原理深入解读"
date: 2022-02-16T09:19:37+08:00
lastmod: 2022-05-13T09:19:37+08:00
description: 本文给大家介绍了 Containerd shim 的类型与 RPC 调用流程。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- Containerd
- Docker
- Conatiners
categories: cloud-native
img: https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting4@main/uPic/2022-05-13-11-19-PIPRRh.png
---

> 原文链接：[https://container42.com/2022/01/10/shim-shiminey-shim-shiminey/](https://container42.com/2022/01/10/shim-shiminey-shim-shiminey/)

Kubernetes 1.20 版开始废除了对 dockershim 的支持，改用 [Containerd](https://containerd.io/) 作为默认的容器运行时。本文将介绍 Containerd 中的 "shim" 接口。

每一个 Containerd 或 Docker 容器都有一个相应的 "shim" 守护进程，这个守护进程会提供一个 API，Containerd 使用该 API 来管理容器基本的生命周期（启动/停止），在容器中执行新的进程、调整 TTY 的大小以及与特定平台相关的其他操作。shim 还有一个作用是向 Containerd 报告容器的退出状态，在容器退出状态被 Containerd 收集之前，shim 会一直存在。这一点和僵尸进程很像，僵尸进程在被父进程回收之前会一直存在，只不过僵尸进程不会占用资源，而 shim 会占用资源。

shim 将 Containerd 进程从容器的生命周期中分离出来，具体的做法是 runc 在创建和运行容器之后退出，并将 shim 作为容器的父进程，即使 Containerd 进程挂掉或者重启，也不会对容器造成任何影响。这样做的好处很明显，你可以高枕无忧地升级或者重启 Containerd，不会对运行中的容器产生任何影响。Docker 的 [--live-restore](https://docs.docker.com/config/containers/live-restore/) 特征也实现了类似的功能。

## Containerd 支持哪些 shim？

Containerd 目前官方支持的 shim 清单：

### io.containerd.runtime.v1.linux

`io.containerd.runtime.v1.linux` 是最原始的 shim API 和实现的 v1 版本，在 Containerd 1.0 之前被设计出来。该 shim 使用 `runc` 来执行容器，并且只支持 `cgroup v1`。目前 v1 版 shim API 已被废弃，并将于 Containerd 2.0 被删除。

### io.containerd.runc.v1

`io.containerd.runc.v1` 与 `io.containerd.runtime.v1.linux` 的实现类似，唯一的区别是它使用了 v2 版本 shim API。该 shim 仍然只支持 cgroup v1。

### io.containerd.runc.v2

该 shim 与 **v1** 采用了完全不同的实现，并且使用了 v2 版本 shim API，同时支持 cgroup v1 和 v2。该 shim 进程以运行多个容器，用于 Kubernetes 的 CRI 实现，可以在一个 Pod 中运行多个容器。

### io.containerd.runhcs.v1

这是 Windows 平台的 shim，使用 Window 的 `HCSv2 API` 来管理容器。

----

当然，除了官方正式支持的 shim 之外，任何人都可以编写自己的 shim，并让 Containerd 调用该 shim。Containerd 在调用时会将 shim 的名称解析为二进制文件，并在 `$PATH` 中查找这个二进制文件。例如 io.containerd.runc.v2 会被解析成二进制文件 `containerd-shim-runc-v2`，`io.containerd.runhcs.v1` 会被解析成二进制文件 `containerd-shim-runhcs-v1.exe`。客户端在创建容器时可以指定使用哪个 shim，如果不指定就使用默认的 shim。

下面是一个示例，用来指定将要使用的 shim：

```go
package main

import (
    "context"

    "github.com/containerd/containerd"
    "github.com/containerd/containerd/namespaces"
    "github.com/containerd/containerd/oci"
    v1opts "github.com/containerd/containerd/pkg/runtimeoptions/v1"
)

func main() {
    ctx := namespaces.WithNamespace(context.TODO(), "default")

    // Create containerd client
    client, err := containerd.New("/run/containerd/containerd.sock")
    if err != nil {
        panic(err)
    }

    // Get the image ref to create the container for
    img, err := client.GetImage(ctx, "docker.io/library/busybox:latest")
    if err != nil {
        panic(err)
    }

    // set options we will pass to the shim (not really setting anything here, but we could)
    var opts v1opts.Options

    // Create a container object in containerd
    cntr, err := client.NewContainer(ctx, "myContainer",
        // All the basic things needed to create the container
        containerd.WithSnapshotter("overlayfs"),
        containerd.WithNewSnapshot("myContainer-snapshot", img),
        containerd.WithImage(img),
        containerd.WithNewSpec(oci.WithImageConfig(img)),

        // Set the option for the shim we want
        containerd.WithRuntime("io.containerd.runc.v1", &opts),
    )
    if err != nil {
        panic(err)
    }

    // cleanup
    cntr.Delete(ctx)
}
```

> **⚠️注意**：`WithRuntime` 将 `interface{}` 作为第二个参数，可以传递任何类型给 shim。只要确保你的 shim 能够识别这个类型的数据，并在 typeurl 包中注册这个类型，以便它能被正确编码。

每个 shim 都有自己支持的一组配置选项，可以单独针对每个容器进行配置。例如 `io.containerd.runc.v2` 可以将容器的 stdout/stderr 转发到一个单独的进程，为 shim 的运行设置自定义的 cgroup 等等。你可以创建自定义的 shim，在容器运行时添加自定义的选项。总的来说，shim 的 API 包含了 RPC 和一些二进制调用用于创建/删除 shim，以及到 Containerd 进程的反向通道。

如果你想实现自己的 shim，下面是相关参考资料：

+ [(v2) shim RPC API 的详细定义](https://github.com/containerd/containerd/blob/v1.5.8/runtime/v2/task/shim.proto)
+ [实现 shim 二进制和RPC API的辅助工具](https://github.com/containerd/containerd/blob/89370122089d9cba9875f468db525f03eaf61e96/runtime/v2/shim/shim.go#L181-L194)
+ [shim 的使用方式](https://github.com/containerd/containerd/blob/v1.5.8/cmd/containerd-shim-runc-v2/main.go)

你只需要实现一个接口，`shim.Run` 会处理剩下的事情。shim 需要重点关注的是内存使用，因为每个容器都有一个 shim 进程，随着容器数量的增加，shim 的内存使用会急剧上升。shim 的 API 是在 `protobuf` 中定义的，看起来有点像 `gRPC` 的 API，但实际上 shim 使用的是一个叫做 [ttrpc](https://github.com/containerd/ttrpc) 的自定义协议，与 gRPC 并不兼容。ttrpc 是一个原 RPC 协议，专为降低内存使用而设计。

## 创建容器的 RPC 调用流程

Containerd 中有一个 container 对象，当你创建一个 container 对象，只是创建了一些与容器相关的数据，并将这些数据存储到本地数据库中，并不会在系统中启动任何容器。container 对象创建成功后，客户端会从 container 对象中创建一个 task，接下来是调用 shim API。

以下是 RPC 调用的总体流程：

1. 客户端调用 `container.NewTask(…)`，containerd 根据指定或默认的运行时名称解析 shim 二进制文件，例如：`io.containerd.runc.v2` -> `containerd-shim-runc-v2`。

2. containerd 通过 **start** 命令启动 shim 二进制文件，并加上一些额外的参数，用于定义命名空间、OCI bundle 路径、调试模式、返回给 containerd 的 unix socket 路径等。在这一步调用中，当前工作目录设置为 shim 的工作路径。

   此时，新创建的 shim 进程会向 `stdout` 写一个连接字符串，以允许 containerd 连接到 shim ，进行 API 调用。一旦连接字符串初始化完成，shim 开始监听之后，start 命令就会返回。

3. containerd 使用 shim start 命令返回的连接字符串，打开一个与 shim API 的连接。

4. containerd 使用 OCI bundle 路径和其他选项，调用 Create shim RPC。这一步会创建所有必要的 沙箱，并返回沙箱进程的 pid。以 runc 为例，我们使用 `runc create --pid-file=<path>` 命令创建容器，runc 会分叉出一个新进程（`runc init`）用来设置沙箱，然后等待调用 `runc start`，所有这些都准备好后，runc create 命令就会返回结果。在 runc create 返回结果之前，runc 会将 runc-init 进程的 pid 写入定义的 pid 文件中，客户端可以使用这个 pid 来做一些操作，比如在沙箱中设置网络（网络命名空间可以在 `/proc/<pid>/ns/net` 中设置）。

   create 调用还会提供一个挂载列表以构建 rootfs，还包含 checkpoint 信息。

5. 下一步客户端调用 `task.Wait`，触发 containerd 调用 shim  `Wait` API。这是一个持久化的请求，只有在容器退出后才会返回。到这一步仍然不会启动容器。

6. 客户端继续调用 `task.Start`，触发 containerd 调用 Start shim RPC。**这一步才会真正启动容器**，并返回容器进程的 pid。

7. 这一步，客户端就可以针对 task 进行一些额外的调用请求。例如，如果 task 包含 TTY，会请求 `task.ResizePTY`，或者请求 `task.Kill` 来发送一个信号等等。

   `task.Exec` 比较特殊，它会调用 shim Exec RPC，但并没有在容器中执行某个进程，只是在 shim 中注册了 exec，后面会使用 exec ID 来调用 shim `Start` RPC。

8. 在容器或 exec 进程退出后，containerd 将会调用 shim `Delete` RPC，清理 exec 进程或容器的所有资源。例如，对于runc shim， 这一步会调用 runc delete。

9. containerd 调用 `Shutdown` RPC，此时 shim 将会退出。

shim 的另一个重要部分是将容器的生命周期事件返回给 containerd ，包括： `TaskCreate` `TaskStart` `TaskDelete` `TaskExit`, `TaskOOM`, `TaskExecAdded`, `TaskExecStarted`, `TaskPaused`, `TaskResumed`, `TaskCheckpointed`。可参考 [task 的详细定义](https://github.com/containerd/containerd/blob/v1.5.6/api/events/task.proto)。

## 总结

**Containerd 通过 shim 为底层的容器运行时提供了可插拔能力**。虽然这不是使用 Containerd 管理容器的唯一手段，但目前内置的 TaskService 使用了该方式，Kubernetes 通过调用 CRI 来创建 Pod 也是使用的 shim。由此可见 shim 这种方式很受欢迎，它不但增强了 Containerd 的扩展能力，以支持更多平台和基于虚拟机的运行时（[firecracker](https://github.com/firecracker-microvm/firecracker-containerd/tree/main/runtime), [kata](https://github.com/kata-containers/kata-containers/tree/2.3.0/src/runtime)），而且允许尝试其他 shim 实现（[systemd](https://github.com/cpuguy83/containerd-shim-systemd-v1)）。