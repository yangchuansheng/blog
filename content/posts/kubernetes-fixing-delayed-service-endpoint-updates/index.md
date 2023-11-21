---
title: " 修复 Service Endpoint 更新的延迟"
subtitle: "Kube-controller-manager 调优"
date: 2018-06-15T14:02:11Z
draft: false
author: 米开朗基杨
categories: cloud-native
tags: ["kubernetes"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191204130017.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

几个月前，我在更新 Kubernetes 集群中的 `Deployment` 时发现了一个很奇怪的连接超时现象，在更新 Deployment 之后的 30 秒到两分钟左右，所有与以该 Deployment 作为服务后端的 `Service` 的连接都会超时或失败。同时我还注意到其他应用在这段时间内也会出现莫名其妙的延迟现象。

一开始我怀疑是[应用没有优雅删除](https://hackernoon.com/graceful-shutdown-in-kubernetes-435b98794461)导致的，但当我在更新 Deployment 的过程中（删除旧的 Pod，启动新的 Pod）通过 `curl` 来测试该应用的健康检查（liveness）和就绪检查（readiness）`Endpoints` 时，很快就排除了这个可能性。

我开始怀疑人生，开始怀疑我的职业选择，几个小时之后我忽然想起来 `Service` 并不是直接与 Deployment 关联的，而是按照标签对一组提供相同功能的 Pods 的抽象，并为它们提供一个统一的入口。更重要的是，Service 是由一组 `Endpoint` 组成的，只要 Service 中的一组 Pod 发生变更，Endpoint 就会被更新。

想到这里，就可以继续排查问题了。下面在更新 Deployment 的过程中通过 `watch` 命令来观察有问题的 Service 的 Endpoint。

```bash
$ watch kubectl describe endpoints [endpoint name]
```

然后我就发现了罪魁祸首，在旧 Pod 被移除的 30 秒到几分钟左右的时间段内，这些被删除的 Pod 的 `IP:Port` 仍然出现在 Endpoint 的就绪列表中，同时新启动的 Pod 的 `IP:Port` 也没有被添加到 Endpoint 中。终于发现了连接失败的根源，但是为什么会出现这种状况呢？仍然无解。

又经历了几天折腾之后，我又有了新点子，那就是调试负责更新 Endpoint 的组件：`kube-controller-manager`，最后终于在 kube-controller-manager 的日志输出中发现了如下可疑的信息：

```ini
I0412 22:59:59.914517       1 request.go:638] Throttling request took 2.489742918s, request: GET:https://10.3.0.1:443/api/v1/namespaces/[some namespace]/endpoints/[some endpoints]"
```

但还是感觉哪里不对劲，明明延迟了几分钟，为什么这里显示的只有两秒？

在阅读了 kube-controller-manager 的源码后，我发现了问题所在。Kube-controller-manager 的主要职责是通过内部的众多 `Controller` 将集群的当前状态调整到期望状态，其中 `Endpoint Controller` 用于监控 Pod 的生命周期事件并根据这些事件更新 Endpoint。

Endpoint Controller 内部运行了一组 `workers` 来处理这些事件并更新 Endpoint，如果有足够多的对 Endpoint 发起的请求被阻塞，那么所有的 workers 都会忙于等待被阻塞的请求，这时候新事件只能被添加到队列中排队等待，如果该队列很长，就会花很长时间来更新 Endpoint。

为了解决这个问题，首先我通过调整 kube-controller-manager 的 参数 `--concurrent-endpoints-syncs` 来增加 Endpoint Controller 的 workers，但收效甚微。

再次仔细阅读源码后，我找到了两个可以可以扭转战局的参数：`--kube-api-qps` 和 `--kube-api-burst`。kube-controller-manager 可以通过这两个参数来限制任何 Controller（包括 Endpoint Controller）对 kube-apiserver 发起的请求的速率。

这两个参数的默认值是 20，但当集群中的主机数量非常多时，默认值显然不满足集群运行的工作负载。经过不断调试之后，我将参数 `--kube-api-qps` 的值设置为 300，将 `--kube-api-burst` 的值设置为 325，上面的日志信息便消失了，同时添加或移除 Pod 时 Endpoint 也能够立即更新。

{{< notice note >}}
<code>--kube-api-qps</code> 和 <code>--kube-api-burst</code> 参数的值越大，kube-apiserver 和 etcd 的负载就越高。在我的集群中，通过适当地增加一些负载来解决这个问题是很值得的。
{{< /notice >}}

## 原文链接

----

+ [Kubernetes: Fixing Delayed Service Endpoint Updates](https://engineering.dollarshaveclub.com/kubernetes-fixing-delayed-service-endpoint-updates-fd4d0a31852c)
