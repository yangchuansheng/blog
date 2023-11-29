---
keywords:
- 米开朗基杨
- envoy
- uds
- nginx
title: "Envoy 基础教程：使用 Unix Domain Socket（UDS） 与上游集群通信"
date: 2020-04-23T00:41:26+08:00
lastmod: 2020-04-23T00:41:26+08:00
description: 本文主要介绍了 Envoy Proxy 如何使用 UDS（Unix Domain Socket）与上游集群通信。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocLevels: ["h2", "h3", "h4"]
tags:
- Envoy
categories: service-mesh
img: https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200426205419.png
---

Envoy Proxy 在大多数情况下都是作为 `Sidecar` 与应用部署在同一网络环境中，每个应用只需要与 Envoy（`localhost`）交互，不需要知道其他服务的地址。然而这并不是 Envoy 仅有的使用场景，它本身就是一个七层代理，通过模块化结构实现了流量治理、信息监控等核心功能，比如流量治理功能就包括自动重连、熔断、全局限速、流量镜像和异常检测等多种高级功能，因此 Envoy 也常常被用于**边缘代理**，比如 Istio 的 `Ingress Gateway`、基于 Envoy 实现的 Ingress Controller（[Contour](/posts/use-envoy-as-a-kubernetes-ingress/)、[Ambassador](https://www.getambassador.io)、[Gloo](https://github.com/solo-io/gloo) 等）。

我的博客也是部署在轻量级 `Kubernetes` 集群上的（其实是 `k3s` 啦），一开始使用 `Contour` 作为 `Ingress Controller`，暴露集群内的博客、评论等服务。但好景不长，由于我在集群内部署了各种奇奇怪怪的东西，有些个性化配置 `Contour` 无法满足我的需求，毕竟大家都知道，**每抽象一层就会丢失很多细节**。换一个 Controller 保不齐以后还会遇到这种问题，索性就直接裸用 `Envoy` 作为边缘代理，大不了手撸 `YAML` 呗。

当然也不全是手撸，虽然没有所谓的**控制平面**，但仪式感还是要有的，我可以基于文件来动态更新配置啊，具体的方法参考 [Envoy 基础教程：基于文件系统动态更新配置](/posts/file-based-dynamic-routing-configuration/)。

## 1. UDS 介绍

----

说了那么多废话，下面进入正题。为了提高博客的性能，我选择将博客与 `Envoy` 部署在同一个节点上，并且全部使用 `HostNetwork` 模式，`Envoy` 通过 localhost 与博客所在的 Pod（`Nginx`） 通信。为了进一步提高性能，我盯上了 [Unix Domain Socket（UDS，Unix域套接字）](https://en.wikipedia.org/wiki/Unix_domain_socket)，它还有另一个名字叫 `IPC`（inter-process communication，进程间通信）。为了理解 `UDS`，我们先来建立一个简单的模型。

现实世界中两个人进行信息交流的整个过程被称作一次通信（`Communication`），通信的双方被称为端点（`Endpoint`）。工具通讯环境的不同，端点之间可以选择不同的工具进行通信，距离近可以直接对话，距离远可以选择打电话、微信聊天。这些工具就被称为 `Socket`。

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200426213301.png)

同理，在计算机中也有类似的概念：

+ 在 `Unix` 中，一次通信由两个端点组成，例如 `HTTP` 服务端和 `HTTP` 客户端。
+ 端点之间想要通信，必须借助某些工具，Unix 中端点之间使用 `Socket` 来进行通信。

`Socket` 原本是为网络通信而设计的，但后来在 `Socket` 的框架上发展出一种 `IPC` 机制，就是 `UDS`。使用 UDS 的好处显而易见：不需要经过网络协议栈，不需要打包拆包、计算校验和、维护序号和应答等，只是将应用层数据从一个进程拷贝到另一个进程。这是因为，**IPC 机制本质上是可靠的通讯，而网络协议是为不可靠的通讯设计的**。

`UDS` 与网络 Socket 最明显的区别在于，**网络 Socket** 地址是 IP 地址加端口号，而 `UDS` 的地址是一个 Socket 类型的文件在文件系统中的路径，一般名字以 `.sock` 结尾。这个 Socket 文件可以被系统进程引用，两个进程可以同时打开一个 `UDS` 进行通信，而且这种通信方式只会发生在系统内核里，不会在网络上进行传播。下面就来看看如何让 `Envoy` 通过 `UDS` 与上游集群 `Nginx` 进行通信吧，它们之间的通信模型大概就是这个样子：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200427143709.png)

## 2. Nginx 监听 UDS

----

首先需要修改 `Nginx` 的配置，让其监听在 `UDS` 上，至于 `Socket` 描述符文件的存储位置，就随你的意了。具体需要修改 `listen` 参数为下面的形式：

```nginx
listen      unix:/sock/hugo.sock;
```

当然，如果想获得更快的通信速度，可以放在 `/dev/shm` 目录下，这个目录是所谓的 `tmpfs`，它是 `RAM` 可以直接使用的区域，所以读写速度都会很快，下文会单独说明。

## 3. Envoy-->UDS-->Nginx

----

`Envoy` 默认情况下是使用 IP 地址和端口号和上游集群通信的，如果想使用 `UDS` 与上游集群通信，首先需要修改服务发现的类型，将 `type` 修改为 `static`：

```yaml
type: static
```

同时还需将端点定义为 UDS：

```yaml
- endpoint:
    address:
      pipe:
        path: "/sock/hugo.sock"
```

最终的 Cluster 配置如下：

```yaml
- "@type": type.googleapis.com/envoy.api.v2.Cluster
  name: hugo
  connect_timeout: 15s
  type: static
  load_assignment:
    cluster_name: hugo
    endpoints:
    - lb_endpoints:
      - endpoint:
          address:
            pipe:
              path: "/sock/hugo.sock"
```

最后要让 `Envoy` 能够访问 `Nginx` 的 `Socket` 文件，Kubernetes 中可以将同一个 `emptyDir` 挂载到两个 Container 中来达到共享的目的，**当然最大的前提是 Pod 中的 Container 是共享 IPC 的**。配置如下：

```yaml
spec:
  ...
  template:
    ...
    spec:
      containers:
      - name: envoy
        ...
        volumeMounts:
        - mountPath: /sock
          name: hugo-socket
          ...
      - name: hugo
        ...
        volumeMounts:
        - mountPath: /sock
          name: hugo-socket
          ...
      volumes:
      ...
      - name: hugo-socket
        emptyDir: {}
```

现在你又可以愉快地访问我的[博客](https://icloudnative.io)了，查看 `Envoy` 的日志，成功将请求通过 `Socket` 转发给了上游集群：

```bash
[2020-04-27T02:49:47.943Z] "GET /posts/prometheus-histograms/ HTTP/1.1" 200 - 0 169949 1 0 "66.249.64.209,45.145.38.4" "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.96 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" "9d490b2d-7c18-4dc7-b815-97f11bfc04d5" "icloudnative.io" "/dev/shm/hugo.sock"
```

嘿嘿，`Google` 的爬虫也来凑热闹。

你可能会问我：你这里的 Socket 为什么在 `/dev/shm/` 目录下啊？别急，还没结束呢，先来补充一个背景知识。

## 4. Linux 共享内存机制

----

共享内存（shared memory），是 `Linux` 上一种用于进程间通信（IPC）的机制。

进程间通信可以使用管道，Socket，信号，信号量，消息队列等方式，但这些方式通常需要在用户态、内核态之间拷贝，一般认为会有 4 次拷贝；相比之下，共享内存将内存直接映射到用户态空间，即多个进程访问同一块内存，理论上性能更高。嘿嘿，又可以改进上面的方案了。

共享内存有两种机制：

+ `POSIX` 共享内存（`shm_open()、shm_unlink()`）
+ `System V` 共享内存（`shmget()、shmat()、shmdt()`）

其中，`System V` 共享内存历史悠久，一般的 `UNIX` 系统上都有这套机制；而 `POSIX` 共享内存机制接口更加方便易用，一般是结合内存映射 `mmap` 使用。

`mmap` 和 `System V` 共享内存的主要区别在于：

+ System V shm 是持久化的，除非被一个进程明确的删除，否则它始终存在于内存里，直到系统关机。
+ `mmap` 映射的内存不是持久化的，如果进程关闭，映射随即失效，除非事先已经映射到了一个文件上。
+ `/dev/shm` 是 Linux 下 sysv 共享内存的默认挂载点。

`POSIX` 共享内存是基于 `tmpfs` 来实现的。实际上，更进一步，不仅 `PSM`(POSIX shared memory)，而且 `SSM`(System V shared memory) 在内核也是基于 `tmpfs` 实现的。

从这里可以看到 `tmpfs` 主要有两个作用：

- 用于 `System V` 共享内存，还有匿名内存映射；这部分由内核管理，用户不可见。
- 用于 `POSIX` 共享内存，由用户负责 `mount`，而且一般 mount 到 `/dev/shm`，依赖于 `CONFIG_TMPFS`。

虽然 System V 与 POSIX 共享内存都是通过 tmpfs 实现，但是受的限制却不相同。也就是说 **/proc/sys/kernel/shmmax 只会影响 System V 共享内存，/dev/shm 只会影响 POSIX 共享内存**。实际上，`System V` 与 `POSIX` 共享内存本来就是使用的两个不同的 `tmpfs` 实例。

`System V` 共享内存能够使用的内存空间只受 `/proc/sys/kernel/shmmax` 限制；而用户通过挂载的 `/dev/shm`，默认为物理内存的 `1/2`。

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@master/img/20200427124844.png)

概括一下：

+ `POSIX` 共享内存与 `System V` 共享内存在内核都是通过 `tmpfs` 实现，但对应两个不同的 `tmpfs` 实例，相互独立。
+ 通过 `/proc/sys/kernel/shmmax` 可以限制 `System V` 共享内存的最大值，通过 `/dev/shm` 可以限制 `POSIX` 共享内存的最大值。

## 5. Kubernetes 共享内存

----

`Kubernetes` 创建的 Pod，其共享内存默认 `64MB`，且不可更改。

为什么是这个值呢？其实，Kubernetes 本身是没有设置共享内存的大小的，`64MB` 其实是 `Docker` 默认的共享内存的大小。

Docker run 的时候，可以通过 `--shm-size` 来设置共享内存的大小：

```bash
🐳 → docker run  --rm centos:7 df -h |grep shm
shm              64M     0   64M   0% /dev/shm

🐳 → docker run  --rm --shm-size 128M centos:7 df -h |grep shm
shm             128M     0  128M   0% /dev/shm
```

然而，Kubernetes 并没有提供设置 `shm` 大小的途径。在这个 [issue](https://github.com/kubernetes/kubernetes/issues/28272) 里社区讨论了很久是否要给 `shm` 增加一个参数，但是最终并没有形成结论，只是有一个 workgroud 的办法：将 `Memory` 类型的 `emptyDir` 挂载到 `/dev/shm` 来解决。

Kubernetes 提供了一种特殊的 `emptyDir`：可以将 `emptyDir.medium` 字段设置为 `"Memory"`，以告诉 Kubernetes 使用 `tmpfs`（基于 RAM 的文件系统）作为介质。用户可以将 Memory 介质的 `emptyDir` 挂到任何目录，然后将这个目录当作一个高性能的文件系统来使用，当然也可以挂载到 `/dev/shm`，这样就可以解决共享内存不够用的问题了。

使用 emptyDir 虽然可以解决问题，但也是有缺点的：

+ 不能及时禁止用户使用内存。虽然过 1~2 分钟 `Kubelet` 会将 `Pod` 挤出，但是这个时间内，其实对 `Node` 还是有风险的。
+ 影响 Kubernetes 调度，因为 `emptyDir` 并不涉及 Node 的 `Resources`，这样会造成 Pod “偷偷”使用了 Node 的内存，但是调度器并不知晓。
+ 用户不能及时感知到内存不可用。

由于共享内存也会受 `Cgroup` 限制，我们只需要给 Pod 设置 `Memory limits` 就可以了。如果将 Pod 的 `Memory limits` 设置为共享内存的大小，就会遇到一个问题：当共享内存被耗尽时，任何命令都无法执行，只能等超时后被 Kubelet 驱逐。

这个问题也很好解决，将共享内存的大小设置为 `Memory limits` 的 `50%` 就好。综合以上分析，最终设计如下：

1. 将 Memory 介质的 `emptyDir` 挂载到 `/dev/shm/`。
2. 配置 Pod 的 `Memory limits`。
3. 配置 `emptyDir` 的 `sizeLimit` 为 `Memory limits` 的 50%。

## 6. 最终配置

----

根据上面的设计，最终的配置如下。

`Nginx` 的配置改为：

```nginx
listen      unix:/dev/shm/hugo.sock;
```

`Envoy` 的配置改为：

```yaml
- "@type": type.googleapis.com/envoy.api.v2.Cluster
  name: hugo
  connect_timeout: 15s
  type: static
  load_assignment:
    cluster_name: hugo
    endpoints:
    - lb_endpoints:
      - endpoint:
          address:
            pipe:
              path: "/dev/shm/hugo.sock"
```

Kubernetes 的 `manifest` 改为：

```yaml
spec:
  ...
  template:
    ...
    spec:
      containers:
      - name: envoy
        resources:
          limits:
            memory: 256Mi
        ...
        volumeMounts:
        - mountPath: /dev/shm
          name: hugo-socket
          ...
      - name: hugo
        resources:
          limits:
            memory: 256Mi
        ...
        volumeMounts:
        - mountPath: /dev/shm
          name: hugo-socket
          ...
      volumes:
      ...
      - name: hugo-socket
        emptyDir:
          medium: Memory
          sizeLimit: 128Mi
```

## 7. 参考资料

----

+ [设置kubernetes Pod的shared memory](https://ieevee.com/tech/2019/11/10/shm.html)
+ [Kubernetes中Pod间共享内存方案](https://my.oschina.net/jxcdwangtao/blog/3006365)



