---
keywords:
- 米开朗基杨
- kubernetes
- apiserver
title: "Kubernetes 设计与开发原则"
description: 本文将通过揭示其底层的设计原则，帮助您更深入地了解 Kubernetes。
date: 2018-12-04T17:35:59+08:00
draft: false
author: 米开朗基杨
toc: true
categories: cloud-native
tags: ["kubernetes"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/EKierwHWwAAqd3z.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

<p id="div-border-left-red">
原文地址：<a href="https://thenewstack.io/kubernetes-design-and-development-explained/" target="_blank">Kubernetes Design and Development Explained</a>
</p>

**本文是 8 月 29 日至 31 日在温哥华举行的[开源峰会](https://events.linuxfoundation.org/events/open-source-summit-north-america-2018/attend/register/?utm_source=thenewstack&utm_medium=media-partner&utm_campaign=ossna18)上作者演讲内容的一部分，详细内容请查看下文。**

----

`Kubernetes` 正迅速成为在分布式系统中部署工作负载的事实标准。在这篇文章中，我将通过揭示其底层的设计原则，帮助您更深入地了解 Kubernetes。

## <span id="inline-toc">1.</span> 声明式而不是命令式 {#declarative-over-imperative}

----

一旦你学会了在 Kubernetes 编排引擎中部署第一个工作负载（Pod），你就会体会到 Kubernetes 的第一个原则 : **Kubernetes API 是声明式的而不是命令式的。**

在命令式 API 中，你可以直接发出让服务器执行的命令，例如：“运行容器”，“停止容器” 等。而在声明式 API 中，你可以声明期望的状态，系统将不断地调整实际状态，直到与期望状态保持一致。你可以把这两者类比成手动驾驶与自动驾驶。

因此，在 Kubernetes 中，你可以创建一个 API 对象（使用命令行或者 `REST API`）来表示你希望系统执行的操作。然后系统中所有的组件都会向该状态发展，最终于该状态保持一致，除非你删除了该对象。

例如，如果想要调度容器化工作负载而不是发出 “运行容器” 的命令，可以创建一个描述所需状态的 API 对象：`Pod`

```yaml
# simple-pod.yaml

apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  containers:
    - name: nginx
      image: internal.mycorp.com:5000/mycontainer:1.7.9
```

```bash
$ kubectl create -f simple-pod.yaml
pod "nginx" created
```

该对象创建之后被保存在 `API Server` 中：

```bash
$ kubectl get pods

NAME      READY     STATUS    RESTARTS   AGE
nginx     1/1       Running   0          17s
```

如果容器由于某种原因崩溃，系统将会重新启动容器。如果想删除容器，请直接删除 Pod 对象：

```bash
$ kubectl delete -f https://k8s.io/examples/pods/simple-pod.yaml
pod "nginx" deleted
```

### 为什么选择声明式而不是命令式 {#why-declarative-over-imperative}

因为声明式 API 可以使系统更加健壮。在分布式系统中，任何组件都可能随时发生故障，我们需要关心的是：当发生故障的组件恢复正常后，它们需要弄清楚接下来要做什么。

当使用命令式 API 时，崩溃的组件可能在它挂掉时丢失了一个调用，如果想正常工作，就需要一些外部组件来保证它恢复时能够及时处理之前丢失的调用。如果用了声明式 API，这些组件只需要查看 `API Server` 的当前状态，即可确定接下来需要执行的操作（“啊，我只需要确保此容器正在运行就行了”）。

声明式 API 也被描述为 <span id=inline-purple>水平触发</span>。在 <span id=inline-purple>边缘触发</span> 系统中，如果系统错过了某个事件（“边缘”），则必须重新查看该事件才能恢复系统。而在 <span id=inline-purple>水平触发</span> 系统中，即使系统错过了某个事件（可能因为故障挂掉了），当它恢复时，依然可以通过查看信号的当前状态来做出正确的响应。

因此，声明式 API 使 Kubernetes 系统更加健壮，可以更从容地应对组件故障。


## <span id="inline-toc">2.</span> 内部不存在隐藏的 API {#no-hidden-internal-apis}

----

如果你了解 Kubernetes 各个组件的工作原理，就能体会到 Kubernetes 的第二个原则 : **控制平面是透明的，因为它的内部不存在隐藏的 API。**

这意味着 Kubernetes 各个组件之间相互交互使用的 API 和客户端与 Kubernetes 交互 使用的 API 相同。结合第一个原则（Kubernetes API 是声明式的）你可以发现，Kubernetes 的各个组件之间只能通过监视和修改 Kubernetes API 来相互交互（而不是直接用“下一步该做什么”这样的指令来相互调用）。

让我们通过一个简单的示例来说明这一点。为了启动容器化工作负载，你可以在 `Kubernetes API Server` 上创建一个 Pod 对象，如前文所述。

Kubernetes 调度器根据可用资源来确定要运行的 Pod 的最佳节点，调度器通过监视 `Kubernetes API Server` 以获取新的 Pod 来完成调度工作。当新创建的 Pod 还没有被调度时，调度器就会运行其算法来查找运行该 Pod 的最佳节点。Pod 被成功调度之后（已经为该 Pod 选择了最佳节点），调度器并不需要通知所选的节点启动 Pod（记住：Kubernetes API 是声明式的，内部各个组件都使用相同的 API），只需要更新 Pod 对象中的 `NodeName` 字段来声明该 Pod 已被成功调度。

`Kubelet`（在节点上运行的 Kubernetes agent）也会监视 Kubernetes API（和其他组件一样），当它看到某个 Pod 的 `NodeName` 字段是该节点时，就知道该 Pod 被调度到了这个节点，必须要启动它。一旦了 kubelet 启动了 Pod，它就会继续监视 Pod 内部的容器状态，只要 API Server 中存在相应的 Pod 对象，它们就会一直保持运行状态。

Pod 对象被删除后，kubelet 就会明白不再需要该容器，并删除该容器。

### 为什么内部不存在隐藏的 API {#why-no-hidden-internal-apis}

Kubernetes 各个组件之间相互交互使用的 API 和客户端与 Kubernetes 交互 使用的 API 相同，使得 Kubernetes 的可扩展性更强。

如果由于某种原因，Kubernetes 的默认组件（例如，调度器）不满足你的需求，你可以将其替换为自己的使用相同 API 的组件。

此外，如果你需要一些额外的功能，可以使用公共 API 轻松编写额外的组件来扩展 Kubernetes 的功能。

## <span id="inline-toc">3.</span> 随时随地满足用户需求 {#meet-user-where-they-are}

----

Kubernetes API 允许存储一些工作负载可能感兴趣的信息，例如 Secret 和 ConfigMap。`Secret` 可以是你不想保存在容器镜像中的任何敏感数据，包括密码，证书和其他敏感信息。`ComfigMap` 可以包含独立于容器镜像的配置信息，例如容器启动参数和其他类似参数。

通过上文描述的 Kubernetes 的第二个原则，我们可以修改在 Kubernetes 上运行的应用程序以直接从 Kubernetes API Server 获取 Secret 和 ConfigMap 信息。这意味着你需要修改应用程序使它意识到自己运行在 Kubernetes 中。

这就是 Kubernetes 的第三个原则 : **随时随地满足用户需求。**指的是 Kubernetes 不应该要求重新编写应用程序才能在 Kubenretes 中运行。

例如，许多应用程序都接受 Secret 和 ConfigMap 作为文件或环境变量。因此，Kubernetes 支持将 Secret 和 ConfigMap 作为文件或环境变量注入 Pod 之中。更多内容请参考 [Secret 文档](https://kubernetes.io/docs/concepts/configuration/secret/) 中的 “使用 Secret” 部分。

### 为什么需要随时随地满足用户需求 {#meet-user-where-they-are}

这种设计可以最大限度地减少在 Kubernetes 上部署工作负载的障碍，可以轻松地在 Kubernetes 上运行现有的工作负载，而无需对其进行重写或者更改。

## <span id="inline-toc">4.</span> 工作负载的可移植性 {#workload-portability}

----

一旦可以在 Kubernetes 上运行无状态的工作负载，下一步自然就是尝试在 Kubernetes 上运行有状态的工作负载。Kubernetes提供了一个功能强大的 volume 插件系统，可以将许多不同类型的持久存储系统与 Kubernetes 工作负载一起使用。

例如，用户可以轻松地向 API Server 请求将 `Google Cloud Persistent Disk` 挂载到 Pod 的特定路径中：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: sleepypod
spec:
  volumes:
    - name: data
      gcePersistentDisk:
        pdName: panda-disk
  containers:
  - name: sleepycontainer
    image: gcr.io/google_containers/busybox
    command:
      - sleep
      - "6000"
    volumeMounts:
      - name: data
        mountPath: /data
```

当这个 Pod 被创建时，Kubernetes 将会自动将指定的 `GCE PD` 附加到 Pod 被调度到的节点，并将其挂载到指定的容器中。然后容器可以脱离容器或 Pod 的生命周期来将持久数据写入 GCE PD 挂载的路径。

但该方法还是有点小问题的，`YAML` 文件中直接引用了 `Google Cloud Persistent Disk`，如果此 Pod 没有部署在 Google Cloud Kubernetes 集群上，则无法启动，因为无法使用 GCE PD。

这就是 Kubernetes 下一个原则的用武之地 : **工作负载的定义应该可以跨群集移植**。用户应该能够使用相同的工作负载定义文件（例如相同的 Pod yaml）来跨不同的群集部署工作负载。

理想情况下，上面定义的 Pod 应该运行在没有 GCE PD 的集群上。为了使 Pod 能够成功运行，Kubernetes 引入了 `PersistentVolumeClaim`（PVC）和 `PersistentVolume`（PV）API 对象，这些对象将存储提供与存储使用分离开来。

`PersistentVolumeClaim` 对象可以让用户请求存储资源而无需关心存储的实现方式。例如，用户可以创建 `PVC` 对象来请求 10 GB 的可读写存储资源，而不是请求特定的 GCE PD：

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mypvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
```

Kubernetes 系统会将创建此 Pod 的请求与包含该 `PersistentVolume` 对象的存储池中的卷相匹配，或者自动配置新卷以满足创建请求，这两种方式都可以跨 Kubernetes 集群移植工作负载的定义文件。

### 为什么需要工作负载的可移植性 {#why-workload-portability}

工作负载可移植性原则突出了 Kubernetes 的核心优势：就像操作系统使应用程序开发人员不必担心底层硬件的细节一样，Kubernetes 将分布式系统应用程序开发人员从底层集群的细节中解放出来。使用 Kubernetes 之后，分布式系统应用程序开发人员不必拘泥于特定的集群环境。针对 Kubernetes 部署的应用程序可以轻松地部署到本地和云环境的各种群集中，而无需针对特定的环境对应用程序或部署脚本进行更改（Kubernetes endpoint 除外）。

## <span id="inline-toc">5.</span> 总结 {#conclusion}

----

通过践行这些原则，Kubernetes 变得更强大，可扩展性和可移植性更强，且易于迁移。这就是 Kubernetes 正迅速成为在分布式系统中部署工作负载的事实标准的原因。

## <span id="inline-toc">6.</span> 相关资料

----

+ [谈 Kubernetes 的架构设计与实现原理](https://draveness.me/understanding-kubernetes)

----

{{< notice note >}}
<a href="https://events.linuxfoundation.org/events/open-source-summit-north-america-2018/attend/register/?utm_source=thenewstack&utm_medium=media-partner&utm_campaign=ossna18" target="_blank">开源峰会</a>将开源生态系统连接在一起。它涵盖了基础的开源技术；通过多元化赋权峰会帮助生态系统领导者实现开源转型，并跟踪业务和合规性；同时也会深入研究涉及开源的最新技术和最新趋势，包括网络、云原生、边缘计算和 AI 等。这是开发人员，系统管理员，DevOps 专家和推动未来技术发展的 IT 架构师之间相互切磋交流的绝佳机会。
{{< /notice >}}

**作者简介 :** 

> [Saad Ali](https://thenewstack.io/author/saad-ali/) 是 Google 的高级软件工程师，负责 Kubernetes 项目。 他于 2014 年 12 月加入该项目，并领导了 Kubernetes 存储和 volume 子系统的开发。 他是 Kubernetes Storage SIG 的领导者，也是 `Container Storage Interface` 的共同作者和维护者。 在加入 Google 之前，他曾在 Microsoft 工作，领导开发 Outlook.com 的 IMAP 协议。

**推广部分 :** 

关于声明式 API 这一部分内容，极客时间专栏《深入剖析 Kubernetes》讲解的更加详细，该专栏**基于作者多年的从业经验，用深入浅出的方式**帮助大家从看似凌乱复杂的 Kubernetes 项目中梳理出一条主线，助你理解容器和 Kubernetes 背后的设计思想和逻辑，从而解决现实生活中遇到的问题。

**最好的投资就是投资自己**，扫我海报购买，新人立减 ￥30。

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/rUoT4x.jpg)
