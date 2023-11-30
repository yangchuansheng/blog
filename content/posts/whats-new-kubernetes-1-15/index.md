---
keywords:
- 米开朗基杨
- kubernetes
title: "Kubernetes 1.15 详细介绍"
subtitle: "CustomResource 成为 Kubernetes 1.15 中的一等公民"
description: 本文除了告知读者 Kubernetes 1.15 有什么新特性之外，更重要的在于提供了一个机会去了解 Kubernetes 这么庞大的系统在跟第三方整合或是某个组件的性能遇到瓶颈时该怎么解决，为我们以后设计架构时提供了参考依据。
date: 2019-07-18T08:38:48+08:00
draft: false
author: 米开朗基杨
toc: true
categories: cloud-native
tags: ["kubernetes"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-07-18-D-wFV60WwAAewjQ.jpeg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

2019 年 6 月 20 日，Kubernetes 重磅发布了 1.15 版本，不过笔者忙到现在才有空认真来看一下到底更新了哪些东西。这一版本更新主要是针对稳定性的持续改善和可扩展性，仔细把 25 个新增或改动的功能看完后，发现许多以前的小痛点都在这个版本中解决了，本文对每个特性的介绍格式如下：

> **#492** : 前面是 GitHub issue 编号，后面是具体的特性<br />
> **进度** : 表示该特性目前处于什么阶段，如 Alpha，Beta，Stable<br />
> **特性分类** : 表示该特性属于哪个分类，如 API，CLI，Network 等。<br />
>
> 这里是具体的特性介绍，例如改进了什么，为什么要这么做，有的特性还会有简单的使用范例。

## 亮点更新

----

+ [CustomResourceDefinitions 的改良](https://sysdig.com/blog/whats-new-kubernetes-1-15/#95)
+ [Event API 的重新设计](https://sysdig.com/blog/whats-new-kubernetes-1-15/#383)
+ [Execution hooks 的推出](https://sysdig.com/blog/whats-new-kubernetes-1-15/#962)
+ [新的 Scheduling Framework](https://sysdig.com/blog/whats-new-kubernetes-1-15/#624)

## 核心功能

----

### [#1024](https://github.com/kubernetes/enhancements/issues/1024) NodeLocal DNSCache

**进度**：迈向 Beta

**特性分类**：Network

NodeLocal DNSCache 通过在集群节点上以 `Deamonset` 的方式运行 DNS 缓存代理来提高集群的 DNS 性能，从而可以避免使用 iptables DNAT 规则和连接跟踪。如果本地 DNS 缓存代理在内存中找不到相应的 DNS 记录，就会向 kube-dns 服务发起查询请求（默认情况下以 `cluster.local` 为后缀）。

想了解该特性的更多细节可以阅读 [Kubernetes Enhancement Proposal (KEP)](https://github.com/kubernetes/enhancements/blob/master/keps/sig-network/20190424-NodeLocalDNS-beta-proposal.md) 文档中的设计说明。

### [#383](https://github.com/kubernetes/enhancements/issues/383) Redesign event API

**进度**：Alpha

**特性分类**：Scalability

这项工作主要有两个目标：

1. 减少 Events 对集群其余部分的性能影响；
2. 向 Event 对象添加更多的数据结构，这是使 Event 分析自动化的必要步骤，也是第一步。

目前 Event API 的主要问题是包含太多垃圾信息，导致其难以摄取和分析有效信息。除此之外还有数个性能问题，例如当集群出现问题时，Events 可能会使 API server 过载（例如常见的 [crashloop](https://sysdig.com/blog/debug-kubernetes-crashloopbackoff/)）

关于该 issue 的讨论以及建议的解决方案和改进工作可以参考这里的[设计提案](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/instrumentation/events-redesign.md)。

### [#492](https://github.com/kubernetes/enhancements/issues/492) Admission webhook

**进度**：Beta

**特性分类**：API

Mutating 和 Validating Admission Webhook 已经成为扩展 API 的主流选择。在 1.15 以前，所有的 webhook 只会按照字母表顺序调用一次，这样就会导致一个问题：一个更早的 webhook 不能应对后面的 webhook 的更新，这可能会导致未知的问题，例如前面的 webhook 设置某个 pod 的启动参数，而随后的 webhook 将其更改或者移除了。

在 Kubernetes 1.15 中，允许 webhook 被重复调用，即使是对同一对象的修改。如果想启用该特性，必须要确保你引入的任何 admission webhook 都是幂等操作，也就是说，同一个对象被执行任意多次操作与执行一次操作产生的效果相同。

### [#624](https://github.com/kubernetes/enhancements/issues/624) Scheduling framework

**进度**：Alpha

**特性分类**：Scheduling

该特性为 Kubernetes 1.15 的调度器设计了一个新的可插拔结构，主要是为了解决日益增加的定制化调度需求。Scheduler Framework 在原有的 Priority/Predicates 接口的基础上增加了 reserve, pre-bind 等十几个接口。

下图显示了 Pod 在新的 Scheduling framework 中的调度过程：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-07-17-055446.jpg)

关于该特性的更多信息请查阅[官方设计文档](https://github.com/kubernetes/enhancements/blob/master/keps/sig-scheduling/20180409-scheduling-framework.md)。

### [#606](https://github.com/kubernetes/enhancements/issues/606) Support 3rd party device monitoring plugins

**进度**：迈向 Beta

**特性分类**：Node

该特性允许 Kubelet 将容器 `binding` 信息暴露给第三方监控插件，这样系统管理员就可以使用第三方的设备监控代理来监控自定义资源分配给 Pod 的使用率（例如，每个 Pod 的 `GPU` 使用率）。

未解耦前，Kubelet 会检测所有支持的设备是否存在，即使节点并没有安装该设备。

使用新的框架之后，Kubelet 会通过 `/var/lib/kubelet/pod-resources/kubelet.sock` 提供一个新的 GRPC 服务，该服务会把容器和设备所分配到资源相关的信息都暴露出来。

### [#757](https://github.com/kubernetes/enhancements/issues/757) Pid limiting

**进度**：迈向 Beta

**特性分类**：Node

`Pid` 是 Linux 系统中很重要的资源，系统很容易在 CPU 或内存的使用量还没达到上限之前，进程数量就达到了上限。因此管理员必须得想办法确保 Pod 不会把系统的 Pid 用完，进而造成其他重要的服务无法运行（例如，container runtime，kubelet 等）。

新的特性允许修改 Kubelet 配置来限制每个 Pod 的 Pid 数量。在 Node 层面限制 Pid 的功能现在可以直接使用，不再需要通过 feature gate 的参数 `SupportNodePidsLimit=true` 显示设置。

[Kubernetes 官方博客](https://kubernetes.io/blog/2019/04/15/process-id-limiting-for-stability-improvements-in-kubernetes-1.14/)有对此特性的详细介绍。

### [#902](https://github.com/kubernetes/enhancements/issues/902) Add non-preempting option to PriorityClasses

**进度**：Alpha

**特性分类**：Scheduling

Kubernetes 1.15 在 PriorityClass 中添加 `PreemptionPolicy` 字段作为 Alpha 特性。

`PreemptionPolicy` 字段的默认值为 `PreemptLowerPriority`，表示允许该优先级的 Pod 抢占低优先级的 Pod（这是默认的抢占行为）。如果 `PreemptionPolicy` 字段的值为 `Never`，则该 Pod 会被放置到调度队列中，并且放置的位置排在低优先级 Pod 的前面，但是不能抢占其他的 Pod。

以数据科学领域为例：用户提交了一个 job，他希望此 job 的优先级比其他 job 高，但是不希望因为抢占 Pod 而导致目前的任务被搁置。

### [#917](https://github.com/kubernetes/enhancements/issues/917) Add go module support to k8s.io/kubernetes

**进度**：Stable

**特性分类**：Architecture

自从 Kubernetes 开源以来，一直使用 [godep](https://github.com/tools/godep) 来 vendoring 所有依赖库。随着 Go 生态系统越来越成熟，vendoring 已经变成主流，而 godep 已经不再维护了，于是 Kubernetes 一开始使用 godep 的定制版，这期间还有一些其他的 vendoring 工具（例如 `glide` 和 `dep`）也跟着出现，而现在 Go 的依赖库管理终于可以以 go module 的形式直接添加到 Go 中。

Go 从 1.13 已经默认开启 go module，并且移除了 `$GOPATH` 模式。为了支持这个改动，Kubernetes 1.15 版本调整了好几个组件的代码以使用 go module。

### [#956](https://github.com/kubernetes/enhancements/issues/956) Add Watch bookmarks support

**进度**：Alpha

**特性分类**：API

一个 Kubernetes 集群只会保留一段时间内的变更历史记录，比如使用 etcd3 的集群默认会保留 5 分钟的变更历史记录。而为 Kubernetes Watch 事件添加一个书签（`bookmark`）可以想象成多了一个检测点，所有 Client 请求的对象如果符合预先想查找的资源版本（resourceVersion）就会被这个书签给筛选出来。

例如：新增一个 Watch 的请求去查找所有资源版本为 X 的事件，这时 API server 知道该 Watch 请求对其他资源版本的事件没有兴趣，就会使用书签来略过所有其他事件，只将特定的事件发送给客户端，从而避免增加 API server 的负载。

### [#962](https://github.com/kubernetes/enhancements/issues/962) Execution hooks

**进度**：Alpha

**特性分类**：storage

ExecutionHook 提供了一种通用机制，让用户可以在容器中触发想要执行的 hook 命令，例如：

+ 应用程序备份
+ 升级
+ 数据库迁移
+ 重新加载配置文件
+ 重启容器

hook 的定义中包含两条重要信息：

1. 需要执行什么命令
2. 在哪执行命令（通过 `Pod Selector`）

下面提供一个简单示例：

```yaml
apiVersion: apps.k8s.io/v1alpha1
kind: HookAction
metadata:
  name: action-demo
Action:
  exec:
    command: ["run_quiesce.sh"]
  actionTimeoutSeconds: 10
```

想了解该特性的更多细节可以阅读 [Kubernetes Enhancement Proposal (KEP)](https://github.com/kubernetes/enhancements/blob/master/keps/sig-storage/20190120-execution-hook-design.md) 文档中的设计说明。

### [#981](https://github.com/kubernetes/enhancements/issues/981) PDB support for custom resources with scale subresource

**进度**：迈向 Beta

**特性分类**：Apps

Pod Disruption Budget (PDB) 是一种 Kubernetes API，用于限制在同一时间自愿中断的应用程序（如 Deployment 或 ReplicaSet）中宕机的 Pod 的数量。PDB 可以通过指定最小可用数量或最大不可用数量的 Pod 来自定义中断预算。

例如，对于一个无状态的前端应用：

+ 要求：服务能力不能减少超过 10%
+ 解决方案：使用一个包含 `minAvailable 90%` 值的 PDB

使用 PDB 后，就可以允许管理员在不降低服务的可用性和性能的前提下操作 Kubernetes 的工作负载。

## 自定义资源

----

### [#95](https://github.com/kubernetes/enhancements/issues/95) CustomResourceDefinitions

**进度**：Beta

**特性分类**：API

该特性没有什么实质性的功能，只是把在 Kubernetes 1.15 版本中跟 CRD 相关的修复和改进进行了分组：

+ [Structural schema using OpenAPI](https://sysdig.com/blog/whats-new-kubernetes-1-15/#692)
+ [CRD pruning](https://sysdig.com/blog/whats-new-kubernetes-1-15/#575)
+ [CRD defaulting](https://sysdig.com/blog/whats-new-kubernetes-1-15/#575)
+ [Webhook conversion moved to beta](https://sysdig.com/blog/whats-new-kubernetes-1-15/#598)
+ [Publishing the CRD OpenAPI schema](https://sysdig.com/blog/whats-new-kubernetes-1-15/#692)

### [#692](https://github.com/kubernetes/enhancements/issues/692) Publish CRD OpenAPI schema

**进度**：迈向 Beta

**特性分类**：API

该特性允许开发者使用 [OpenAPI v3 schema](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md) 来定义 Custom Resource Definition (CRD) ，以便开启 Server 端对 CustomResources (CR) 的验证。

发布使用 OpenAPI 规范的 CRD 便可以开启客户端验证（例如 `kubectl create` 和 `kubectl apply` 时），也可以对规范进行描述（例如 `kubectl explain`），Client 也会因为 CRs 而自动生成，所以开发者可以轻易使用任何支持的编程语言来和 API 进行交互。

使用 OpenAPI 规范有助于使 CRD 开发者和 Kubernetes API 的发展方向更加清晰，文档格式更加简洁精炼。

### [#575](https://github.com/kubernetes/enhancements/issues/575) Defaulting and pruning for custom resources

**进度**：Alpha

**特性分类**：API

下面的这两个特性主要是为了使与 CRD 相关的 JSON 处理更加方便。

**Pruning** : CRD 传统的存储方式是以 JSON 格式存储在 ETCD 中。现在如果它是以 OpenAPI v3 的规范来定义的，并且 `preserveUnknownFields` 的值为 false，未被定义的字段在创建或更新时便会被删除。

```yaml
preserveUnknownFields: false
validation:
  openAPIV3Schema:
    type: object
```

**Defaulting** : 此特性在 Kubernetes 1.15 版本处于 Alpha 阶段，默认处于关闭状态，可以通过 feature gate 的参数 `CustomResourceDefaulting` 来开启。Defaulting 和 Pruning 一样，在一开始就要将规范定好，不符合规范的就会被去掉。

```yaml
spec:
  type: object
  properties:
    cronSpec:
      type: string
      pattern: '^(\d+|\*)(/\d+)?(\s+(\d+|\*)(/\d+)?){4}$'
      default: "5 0 * * *"
```

### [#598](https://github.com/kubernetes/enhancements/issues/598) Webhook conversion for custom resources

**进度**：迈向 Beta

**特性分类**：API

不同的 CRD 版本可以有不同的规范，现在你可以在操作中处理不同版本之间的转换，并且实现了版本转换的 webhook。这个 webhook 会在下面几种情况下被调用：

+ 请求的自定义资源版本与原来储存的版本不一致
+ 自定义资源在 Watch 时创建了某一版本，但在下次修改时发现跟存储的版本不一致
+ 使用 `PUT` 请求自定义资源时，发现请求的版本与存储的版本不一致

这里有一个实现[自定义资源之间相互转换的 webhook server](https://github.com/kubernetes/kubernetes/blob/v1.13.0/test/images/crd-conversion-webhook/main.go) 的示例，大家可以作为参考。

## 配置管理

----

### [#515](https://github.com/kubernetes/enhancements/issues/515) Kubectl get and describe should work well with extensions

**进度**：迈向 Stable

**特性分类**：Cli

目前已经可以使用 `kubectl get` 和 `describe` 来让第三方 API 扩展和 CRD 提供自定义格式化输出。该特性使输出可以打印到服务器端，从而实现了更好的扩展性，并且让 Kubectl 和扩展的实现细节进行解耦。

想了解关于该特性的更多详细信息，可以查阅相关[设计文档](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/api-machinery/server-get.md)。

### [#970](https://github.com/kubernetes/enhancements/issues/970) Kubeadm: New v1beta2 config format

**进度**：迈向 Beta

**特性分类**：Cluster lifecycle

随着时间的推移，在 kubeadm 的配置文件中配置 Kubernetes 集群创建时的选项数量已经大大增加，然后 CLI 参数的数量还是没有变化，所以导致使用配置文件来创建集群是目前唯一一个比较符合使用者需求方法。

该特性的目标是重新设计配置的存储方式来改善当前版本遇到的问题，并放弃了使用包含所有选项的单个配置文件，使用子结构来为高可用集群提供更好的支持。

### [#357](https://github.com/kubernetes/enhancements/issues/357) Ability to create dynamic HA clusters with kubeadm

**进度**：迈向 Beta

**特性分类**：Cluster lifecycle

Kubernetes 可以通过多个控制平面来提供高可用性。kubeadm 工具现在可以用来创建高可用集群，有两种方式：

+ etcd 与 Control Plane 节点 (Master) 共存
+ etcd 与 Control Plane 节点 (Master) 是分开的

这个版本的 kubeadm 将会自动复制其中需要的证书，减少人为干预的需求，目前的做法是使用一个暂时加密的秘钥来确保证书在传输过程中的安全性，更多细节可以参考 [KEP](https://github.com/kubernetes/enhancements/blob/master/keps/sig-cluster-lifecycle/kubeadm/0015-kubeadm-join-control-plane.md) 文档。

## 云提供商

----

### [#423](https://github.com/kubernetes/enhancements/issues/423) Support AWS network load balancer

**进度**：迈向 Beta

**特性分类**：AWS

在 Kubernetes 1.15 中可以通过 `annotations` 的方式，在 Service 的种类是 LoadBalancer 时，直接请求建立 AWS NLB：

```yaml
metadata:
  name: my-service
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
```

与经典的弹性负载均衡器不同，Network Load Balancers (NLBs) 会把客户端的 IP 直接传递给节点。AWS NLB 其实从 1.9 的时候就已经处于 Alpha 阶段，现在代码和 API 都已经相对稳定，所以准备迁移到 Beta 阶段。

### [#980](https://github.com/kubernetes/enhancements/issues/980) Finalizer protection for service LoadBalancers

**进度**：Alpha

**特性分类**：Network

默认情况下，云服务商提供的 Load Balancer 资源，应该要在 Kubernetes Service 被删除的时候也跟着一起被删除才对，然而在各种极端的案例中，可以发现在删除关联的 Kubernetes Service 后，Load Balancer 资源却被孤立在一旁没有被清除掉，而引入 `Finalizer` 就是为了预防这种情况的发生。

如果你的集群已经开启了和云服务商的整合，Finalizer 将会附加到任何包含 `type=LoadBalancer` 字段的 Kubernetes Service，当这类 Service 即将被删除时，Finalizer 会先将 Serivce 的删除动作给冻结住，直接确保 Load Balancer 资源被清除后，才会将 Service 真正删除。

## 存储

----

### [#625](https://github.com/kubernetes/enhancements/issues/625) In-tree storage plugin to CSI Driver Migration

**进度**：Alpha

**特性分类**：Storage

存储插件最初都在 Kubernetes 的基础代码库中，增加了代码维护的复杂性，也阻碍了其扩展性。因此该特性的目标是将所有存储相关的代码移出来变成可加装的插件形式，并通过 Container Storage Interface（CSI）来和 Kubernetes 进行交互。如此一来便可降低开发的成本，并使其更加模块化，可扩展性更强，让不同版本的存储插件与 Kubernetes 之间有更好的兼容性。想了解该特性的最新进展可以参考[这里](https://github.com/kubernetes/enhancements/blob/master/keps/sig-storage/20190129-csi-migration.md)。

### [#989](https://github.com/kubernetes/enhancements/issues/989) Extend allowed PVC DataSources

**进度**：Alpha

**特性分类**：Storage

该特性可以让使用者复制现有的 PV。复制和备份其实还是不太一样的，复制会产生一个新的且内容和原来完全一样的存储卷。复制既有的 PV 会消耗用户的存储卷配额，并且会遵循和其他存储卷创建时一样的创建和检查流程，复制出来的 PV 也和普通的 PV 一样具有相同的生命周期和工作流程。使用该特性时，需要注意以下事项：

+ 复制功能的 `VolumePVCDataSource` 参数仅适用于 CSI Driver。
+ 复制功能仅适用于动态存储卷配置。
+ 到底能不能使用复制功能还要取决于 CSI Driver 有没有实现存储卷的复制功能。

### [#1029](https://github.com/kubernetes/enhancements/issues/1029) Quotas for ephemeral storage

**进度**：Alpha

**特性分类**：Node

目前限制临时存储卷使用量的机制是定期遍历查看每个临时存储卷的大小，这种做法很慢，具有很高的延迟。该特性中提出的机制利用文件系统的 [Project Quota](https://www.itread01.com/p/126886.html) 来监控资源消耗程度，然后再决定要不要限制其使用量。希望能够实现以下目标：

+ 通过以非强制方式使用 Project Quota 来收集有关临时卷的使用情况，进而改善监控的性能。
+ 检测出在 Pod 中已经被删除掉，但是因为文件还处于打开的状态下而被隐藏起来的存储卷。

如此一来便可以通过 Project Quota 来限制每一个存储卷的使用量。

### [#531](https://github.com/kubernetes/enhancements/issues/531) Add support for online resizing of PVs

**进度**：迈向 Beta

**特性分类**：Storage

该特性让使用者可以通过修改 PVC 来在线扩展存储卷使用到的文件系统，而不需要重启使用到该存储卷的 PVC。在线扩展 PVC 的功能目前还处于 Beta 阶段，且默认是开启的，你也可以通过 feature gate 参数 `ExpandInUsePersistentVolumes` 显示开启。

文件系统的扩展行为会在以下情况下被触发：

+ 当 Pod 启动时
+ 当 Pod 正在运行且底层的文件系统支持在线扩展（例如，XFS，ext3 或 ext4）

关于该特性的更多消息信息请参考 Kubernetes [官方文档](https://kubernetes.io/docs/concepts/storage/persistent-volumes/#resizing-a-volume-containing-a-file-system)。

### [#559](https://github.com/kubernetes/enhancements/issues/559) Provide environment variables expansion in sub path mount

**进度**：迈向 Beta

**特性分类**：Storage

目前 Kubernetes 对于挂载节点本地存储卷的支持有一个限制：如果有大于等于两个 Pod 运行在同一个节点上，同时把相同的 log 文件名称写入相同的存储卷会导致这些 Pod 发生冲突。

使用 subPath 是个不错的选择，但 subPath 目前只能写死，无法提供灵活性。之前的解决办法是创建一个带有挂载路径的软链接的 Sidecar 容器。

为了更方便地解决这个问题，现在提出了向 subPath 中添加环境变量来缓和这个限制，参考以下示例：

```yaml
env:
- name: POD_NAME
  valueFrom:
    fieldRef:
      apiVersion: v1
        ieldPath: metadata.name
 
...
   
volumeMounts:
- name: workdir1
  mountPath: /logs
  subPath: $(POD_NAME)
```

也可以写成这种格式：

```yaml
volumeMounts:
- name: workdir1
  mountPath: /logs
  subPathExpr: $(POD_NAME)
```

## 总结

----

本文除了告知读者 Kubernetes 1.15 有什么新特性之外，更重要的在于提供了一个机会去了解 Kubernetes 这么庞大的系统在跟第三方整合或是某个组件的性能遇到瓶颈时该怎么解决，为我们以后设计架构时提供了参考依据。

## 参考资料

----

+ [https://sysdig.com/blog/whats-new-kubernetes-1-15/](https://sysdig.com/blog/whats-new-kubernetes-1-15/)
