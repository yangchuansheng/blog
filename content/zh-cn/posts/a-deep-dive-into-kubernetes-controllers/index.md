---
keywords:
- 米开朗基杨
- kubernetes
- controller
- informer
title: "Kubernetes 控制器的工作原理解读"
subtitle: "Kubernetes 控制器的内部结构"
description: 本文我将会带你深入了解 Kubernetes 控制器的内部结构、基本组件以及它的工作原理。
date: 2019-03-11T17:36:27+08:00
draft: false
author: 米开朗基杨
toc: true
categories: cloud-native
tags: ["kubernetes"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/1_dmfykjhuLG8NZDliNetoQQ.jpeg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

<!--more-->

Kubernetes 中运行了一系列控制器来确保集群的当前状态与期望状态保持一致，它们就是 Kubernetes 的大脑。例如，ReplicaSet 控制器负责维护集群中运行的 Pod 数量；Node 控制器负责监控节点的状态，并在节点出现故障时及时做出响应。总而言之，在 Kubernetes 中，**每个控制器只负责某种类型的特定资源**。对于集群管理员来说，了解每个控制器的角色分工至关重要，如有必要，你还需要深入了解控制器的工作原理。

本文我将会带你深入了解 Kubernetes 控制器的内部结构、基本组件以及它的工作原理。本文使用的所有代码都是从 Kubernetes 控制器的当前实现代码中提取的，基于 Go 语言的 [client-go](https://github.com/kubernetes/client-go) 库。

## 控制器的模型

----

Kubernetes 官方文档给出了控制器最完美的解释：

> In applications of robotics and automation, a control loop is a non-terminating loop that regulates the state of the system. In Kubernetes, a controller is a control loop that watches the shared state of the cluster through the API server and makes changes attempting to move the current state towards the desired state. Examples of controllers that ship with Kubernetes today are the replication controller, endpoints controller, namespace controller, and serviceaccounts controller.

翻译：

> 在机器人设计和自动化的应用中，<strong>控制循环</strong>是一个用来调节系统状态的非终止循环。而在 Kubernetes 中，控制器就是前面提到的控制循环，它通过 API Server 监控整个集群的状态，并确保集群处于预期的工作状态。Kubernetes 自带的控制器有 ReplicaSet 控制器，Endpoint 控制器，Namespace 控制器和 Service Account 控制器等。

官方文档：[Kube-controller-manager](https://kubernetes.io/docs/reference/command-line-tools-reference/kube-controller-manager/)

Kubernetes 控制器会监视资源的创建/更新/删除事件，并触发 `Reconcile` 函数作为响应。整个调整过程被称作 “Reconcile Loop”（调谐循环）或者 “Sync Loop”（同步循环）。`Reconcile` 是一个使用 object（Resource 的实例）的命名空间和 object 名来调用的函数，使 object 的实际状态与 object 的 `Spec` 中定义的状态保持一致。调用完成后，`Reconcile` 会将 object 的状态更新为当前实际状态。

什么时候才会触发 `Reconcile` 函数呢？以 ReplicaSet 控制器为例，当收到了一个关于 ReplicaSet 的事件或者关于 ReplicaSet 创建 Pod 的事件时，就会触发 `Reconcile` 函数。

为了降低复杂性，Kubernetes 将所有的控制器都打包到 `kube-controller-manager` 这个守护进程中。下面是控制器最简单的实现方式：

```go
for {
  desired := getDesiredState()
  current := getCurrentState()
  makeChanges(desired, current)
}
```

## 水平触发的 API

----

Kubernetes 的 API 和控制器都是基于水平触发的，可以促进系统的自我修复和周期协调。**水平触发**这个概念来自硬件的中断，中断可以是水平触发，也可以是边缘触发。

+ <span id="inline-purple">水平触发</span> : 系统仅依赖于当前状态。即使系统错过了某个事件（可能因为故障挂掉了），当它恢复时，依然可以通过查看信号的当前状态来做出正确的响应。
+ <span id="inline-purple">边缘触发</span> : 系统不仅依赖于当前状态，还依赖于过去的状态。如果系统错过了某个事件（“边缘”），则必须重新查看该事件才能恢复系统。

Kubernetes 水平触发的 API 实现方式是：监视系统的实际状态，并与对象的 `Spec` 中定义的期望状态进行对比，然后再调用 `Reconcile` 函数来调整实际状态，使之与期望状态相匹配。

{{< alert >}}
水平触发的 API 也叫声明式 API。
{{< /alert >}}

水平触发的 API 有以下几个特点：

+ `Reconcile` 会跳过中间过程在 `Spec` 中声明的值，直接作用于当前 `Spec` 中声明的值。
+ 在触发 `Reconcile` 之前，控制器会并发处理多个事件，而不是串行处理每个事件。

举两个例子：

**例 1：并发处理多个事件**

用户创建了 1000 个副本数的 ReplicaSet，然后 ReplicaSet 控制器会创建 1000 个 Pod，并维护 ReplicaSet 的 `Status` 字段。在水平触发系统中，控制器会在触发 `Reconcile` 之前并发更新所有 Pod（`Reconcile` 函数仅接收对象的 Namespace 和 Name 作为参数），只需要更新 `Status` 字段 1 次。而在边缘触发系统中，控制器会串行响应每个 Pod 事件，这样就会更新 `Status` 字段 1000 次。

**例 2：跳过中间状态**

用户修改了某个 Deployment 的镜像，然后进行回滚。在回滚过程中发现容器陷入 crash 循环，需要增加内存限制。然后用户更新了 Deployment 的内容，调整内存限制，重新开始回滚。在水平触发系统中，控制器会立即停止上一次回滚动作，开始根据最新值进行回滚。而在边缘触发系统中，控制器必须等上一次回滚操作完成才能进行下一次回滚。

## 控制器的内部结构

----

每个控制器内部都有两个核心组件：`Informer/SharedInformer` 和 `Workqueue`。其中 `Informer/SharedInformer` 负责 watch Kubernetes 资源对象的状态变化，然后将相关事件（evenets）发送到 `Workqueue` 中，最后再由控制器的 `worker` 从 `Workqueue` 中取出事件交给控制器处理程序进行处理。

{{< alert >}}
<strong>事件</strong> = <strong>动作</strong>（create, update 或 delete） + <strong>资源的 key</strong>（以 <code>namespace/name</code> 的形式表示）
{{< /alert >}}

### Informer

控制器的主要作用是 watch 资源对象的当前状态和期望状态，然后发送指令来调整当前状态，使之更接近期望状态。**为了获得资源对象当前状态的详细信息，控制器需要向 API Server 发送请求。**

但频繁地调用 API Server 非常消耗集群资源，因此为了能够多次 `get` 和 `list` 对象，Kubernetes 开发人员最终决定使用 `client-go` 库提供的缓存机制。控制器并不需要频繁调用 API Server，只有当资源对象被创建，修改或删除时，才需要获取相关事件。**`client-go` 库提供了 `Listwatcher` 接口用来获得某种资源的全部 Object，缓存在内存中；然后，调用 Watch API 去 watch 这种资源，去维护这份缓存；最后就不再调用 Kubernetes 的任何 API :** 

```go
lw := cache.NewListWatchFromClient(
      client,
      &v1.Pod{},
      api.NamespaceAll,
      fieldSelector)
```

上面的这些所有工作都是在 `Informer` 中完成的，Informer 的数据结构如下所示：

```go
store, controller := cache.NewInformer {
	&cache.ListWatch{},
	&v1.Pod{},
	resyncPeriod,
	cache.ResourceEventHandlerFuncs{},
```

尽管 Informer 还没有在 Kubernetes 的代码中被广泛使用（目前主要使用 `SharedInformer`，下文我会详述），但如果你想编写一个自定义的控制器，它仍然是一个必不可少的概念。

{{< alert >}}
你可以把 <code>Informer</code> 理解为 API Server 与控制器之间的事件代理，把 `Workqueue` 理解为存储事件的数据结构。
{{< /alert >}}

下面是用于构造 Informer 的三种模式：

#### ListWatcher

`ListWatcher` 是对某个特定命名空间中某个特定资源的 `list` 和 `watch` 函数的集合。这样做有助于控制器只专注于某种特定资源。`fieldSelector` 是一种过滤器，它用来缩小资源搜索的范围，让控制器只检索匹配特定字段的资源。Listwatcher 的数据结构如下所示：

```go
cache.ListWatch {
	listFunc := func(options metav1.ListOptions) (runtime.Object, error) {
		return client.Get().
			Namespace(namespace).
			Resource(resource).
			VersionedParams(&options, metav1.ParameterCodec).
			FieldsSelectorParam(fieldSelector).
			Do().
			Get()
	}
	watchFunc := func(options metav1.ListOptions) (watch.Interface, error) {
		options.Watch = true
		return client.Get().
			Namespace(namespace).
			Resource(resource).
			VersionedParams(&options, metav1.ParameterCodec).
			FieldsSelectorParam(fieldSelector).
			Watch()
	}
}
```

#### Resource Event Handler

`Resource Event Handler` 用来处理相关资源发生变化的事件：

```go
type ResourceEventHandlerFuncs struct {
	AddFunc    func(obj interface{})
	UpdateFunc func(oldObj, newObj interface{})
	DeleteFunc func(obj interface{})
}
```

+ **AddFunc** : 当资源创建时被调用
+ **UpdateFunc** : 当已经存在的资源被修改时就会调用 `UpdateFunc`。`oldObj` 表示资源的最近一次已知状态。如果 Informer 向 API Server 重新同步，则不管资源有没有发生更改，都会调用 `UpdateFunc`。
+ **DeleteFunc** : 当已经存在的资源被删除时就会调用 `DeleteFunc`。该函数会获取资源的最近一次已知状态，如果无法获取，就会得到一个类型为 `DeletedFinalStateUnknown` 的对象。

#### ResyncPeriod

`ResyncPeriod` 用来设置控制器遍历缓存中的资源以及执行 `UpdateFunc` 的频率。这样做可以周期性地验证资源的当前状态是否与期望状态匹配。

如果控制器错过了 update 操作或者上一次操作失败了，`ResyncPeriod` 将会起到很大的弥补作用。如果你想编写自定义控制器，不要把周期设置太短，否则系统负载会非常高。

### SharedInformer

通过上文我们已经了解到，Informer 会将资源缓存在本地以供自己后续使用。但 Kubernetes 中运行了很多控制器，有很多资源需要管理，难免会出现以下这种重叠的情况：一个资源受到多个控制器管理。

为了应对这种场景，可以通过 `SharedInformer` 来创建一份供多个控制器共享的缓存。这样就不需要再重复缓存资源，也减少了系统的内存开销。使用了 `SharedInformer` 之后，不管有多少个控制器同时读取事件，`SharedInformer` 只会调用一个 Watch API 来 watch 上游的 API Server，大大降低了 API Server 的负载。实际上 `kube-controller-manager` 就是这么工作的。

`SharedInformer` 提供 hooks 来接收添加、更新或删除某个资源的事件通知。还提供了相关函数用于访问共享缓存并确定何时启用缓存，这样可以减少与 API Server 的连接次数，降低 API Server 的重复序列化成本和控制器的重复反序列化成本。

```go
lw := cache.NewListWatchFromClient(…)
sharedInformer := cache.NewSharedInformer(lw, &api.Pod{}, resyncPeriod)
```

### Workqueue

由于 `SharedInformer` 提供的缓存是共享的，所以它无法跟踪每个控制器，这就需要控制器自己实现排队和重试机制。因此，大多数 `Resource Event Handler` 所做的工作只是将事件放入消费者工作队列中。

每当资源被修改时，`Resource Event Handler` 就会放入一个 key 到 `Workqueue` 中。key 的表示形式为 `<resource_namespace>/<resource_name>`，如果提供了 `<resource_namespace>`，key 的表示形式就是 `<resource_name>`。每个事件都以 key 作为标识，因此每个消费者（控制器）都可以使用 workers 从 Workqueue 中读取 key。所有的读取动作都是串行的，这就保证了不会出现两个 worker 同时读取同一个 key 的情况。

`Workqueue` 在 [client-go](https://github.com/kubernetes/client-go) 库中的位置为 `client-go/util/workqueue`，支持的队列类型包括延迟队列，定时队列和速率限制队列。下面是速率限制队列的一个示例：

```go
queue :=
workqueue.NewRateLimitingQueue(workqueue.DefaultControllerRateLimiter())
```

`Workqueue` 提供了很多函数来处理 key，每个 key 在 `Workqueue` 中的生命周期如下图所示：

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/eENdLY.jpg)

如果处理事件失败，控制器就会调用 `AddRateLimited()` 函数将事件的 key 放回 `Workqueue` 以供后续重试（如果重试次数没有达到上限）。如果处理成功，控制器就会调用 `Forget()` 函数将事件的 key 从 `Workqueue` 中移除。**注意：该函数仅仅只是让 `Workqueue` 停止跟踪事件历史，如果想从 `Workqueue` 中完全移除事件，需要调用 `Done()` 函数。**

现在我们知道，`Workqueue` 可以处理来自缓存的事件通知，但还有一个问题 :** 控制器应该何时启用 workers 来处理 `Workqueue` 中的事件呢？**

控制器需要等到缓存完全同步到最新状态才能开始处理 `Workqueue` 中的事件，主要有两个原因：

1. 在缓存完全同步之前，获取的资源信息是不准确的。
2. 对单个资源的多次快速更新将由缓存合并到最新版本中，因此控制器必须等到缓存变为空闲状态才能开始处理事件，不然只会把时间浪费在等待上。

这种做法的伪代码如下：

```go
controller.informer = cache.NewSharedInformer(...)
controller.queue = workqueue.NewRateLimitingQueue(workqueue.DefaultControllerRateLimiter())

controller.informer.Run(stopCh)

if !cache.WaitForCacheSync(stopCh, controller.HasSynched)
{
	log.Errorf("Timed out waiting for caches to sync"))
}

// Now start processing
controller.runWorker()
```

所有处理流程如下所示：

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/2019-06-29-033816.jpg)

<center><p id=small>控制器处理事件的流程</p></center>

## 参考资料

----

+ [A Deep Dive Into Kubernetes Controllers](https://engineering.bitnami.com/articles/a-deep-dive-into-kubernetes-controllers.html)
