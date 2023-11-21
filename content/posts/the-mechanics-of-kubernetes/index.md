---
keywords:
- 米开朗基杨
- Kubernetes
- 声明式
title: "Kubernetes 设计哲学"
subtitle: "理解 Kubernetes 对象存储和控制器的工作原理"
description: 本文将会带你了解 Kubernetes 的状态转换机制以及控制器的工作原理。
date: 2019-02-23T23:35:42+08:00
draft: false
author: 米开朗基杨
toc: true
categories: cloud-native
tags: ["kubernetes"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/0_pF-ql1YNymlesR8X.jpeg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

<p id="div-border-left-red">
<strong>原文地址：</strong><a href="https://medium.com/@dominik.tornow/the-mechanics-of-kubernetes-ac8112eaa302" target="_blank">The Mechanics of Kubernetes</a>
</p>

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/3a3GzB.jpg)

`Kubernetes` 是一个用于在一组节点（通常称之为集群）上托管容器化应用程序的容器编排引擎。本系列教程旨在通过系统建模的方法帮助大家更好地理解 `Kubernetes` 及其基本概念。

+ [深入理解 Kubernetes API Server](https://icloudnative.io/posts/kubernetes-api-server-part-1/)
+ [Kubernetes 设计哲学](https://icloudnative.io/posts/the-mechanics-of-kubernetes/)

本文可以帮助你理解 Kubernetes 对象存储和控制器的工作原理。

Kubernetes 是一个声明式容器编排引擎。在声明式系统中，你可以声明期望的状态，系统将不断地调整实际状态，直到与期望状态保持一致。因此，“声明式系统”这个术语表示一组经过精确计算的相互协调的操作，用来将系统的当前状态调整为期望状态。但实际上 Kubernetes 并不是这么工作的！

Kubernetes 不会基于系统当前状态和期望状态来来确定接下来要执行的一组经过精确计算的相互协调的命令，而是仅基于系统当前状态确定下一个要执行的命令，然后不断迭代，直到没有下一个命令可以执行，系统就达到了稳定状态。

## <span id="inline-toc">1.</span> 状态转换机制

----

下面我将用一个抽象模型来表示 Kubernetes 的状态转换机制。

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/mkYnsM.jpg)

```als
fact {
    all k8s : K8s - last | let k8s' = k8s.next {
        some c : NextCommand[k8s] {
            command.source = k8s and command.target = k8s'
        }
    }
    NextCommand[k8s.last] = none
}
```

给定一个函数 `NextCommand`，用来表示下一个要执行的命令，系统会基于当前状态 `k8s` 来决定下一个要执行的命令，该命令会将系统从当前状态 `k8s` 转换成下一个状态 `k8s'`。

```als
fun NextCommand(k8s : K8s) : set Command {
  DeploymentController.NextCommand[k8s] +
  ReplicaSetController.NextCommand[k8s] +
  ...
}
```

`NextCommand` 函数事实上是每个 Kubernetes 控制器的 `NextCommand` 函数的集合。

```als
pred Steady(k8s : K8s) { NextCommand[k8s] = none }
```

所有的状态组成一个状态序列，状态序列的终止状态是 `k8s.last`，该状态的 `NextCommand` 函数不会产生下一个命令，此时系统就会进入稳定（steady）状态。

## <span id="inline-toc">2.</span> Kubernetes 资源对象

----

Kubernetes 对象存储表示持久化的 Kubernetes 资源对象集合。Kubernetes 的资源对象实际上是不同类型的数据记录，通常用 `kind` 来表示类型。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: busybox
        image: busybox
```

上述 manifest 内容描述了一个 `Deployment` 对象：

+ `.kind` 等于 `Deployment`。
+ `.spec.replicas` 等于 3.
+ `.spec.template.spec.containers[0].image` 等于 `BusyBox`。

## <span id="inline-toc">3.</span> Kubernetes 控制器

----

每一个控制器都是 `NextCommand` 函数的组成部分，控制器实际上是根据 Kubernetes 当前状态确定下一个要执行命令的一个连续的过程。

```tla
process Controller = "Deployment Controller"
begin
    ControlLoop:
      while TRUE do
        \* The Deployment Controller monitors Deployment Objects
        with d ∈ {d ∈ k8s: d.kind = "Deployment"} do
          \* 1. Enabling Condition
          if Cardinality({r \in k8s: r.kind = "ReplicaSet" ∧ match(d.spec.labelSelector, r.meta.labels)}) < 1 then
            \* Reconciling Command
            CREATE([kind |-> "ReplicaSet", spec |-> [replicas |-> d.spec.replicas, template |-> d.spec.template]]);
          end if;
          \* 2. Enabling Condition
          if Cardinality({r \in k8s: r.kind = "ReplicaSet" ∧ match(d.spec.labelSelector, r.meta.labels)}) > 1 then
            \* Reconciling Command
            with r ∈ {r \in k8s: r.kind = "ReplicaSet" ∧ match(d.spec.labelSelector, r.meta.labels)} do
               DELETE(r);
            end with;
          end if;
        end with;
      end while;
end process;
```

上述 [Alloy](http://alloytools.org/) 规范语言描述了 Deployment 控制器的实现原理：控制器对所有的 Deployment 对象进行监控，并为每个对象执行一组条件语句：

+ **条件 :** 
如果匹配的 `ReplicaSet` 对象少于 1 个。<br />
**命令 :** 
控制器就会生成 `Create ReplicaSet` 命令。

+ **条件 :** 
如果匹配的 `ReplicaSet` 对象多于 1 个。<br />
**命令 :** 
控制器就会生成 `Delete ReplicaSet` 命令。

从控制器的视角来看，如果任何一个条件语句的条件都不满足，Deployment 对象就会进入稳定状态，控制器也不会执行任何命令。

### 级联命令

Kubernetes 的控制器可以相互级联启用，他们是层层控制的关系：

+ 给定一个当前状态 `k8s`，如果启用了控制器 `C`，`C` 会执行命令将状态转换为 `k8s'`。
+ 给定一个当前状态 `k8s'`，如果启用了控制器 `C'`，`C'` 会执行命令将状态转换为 `k8s''`。

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/lgPiYz.jpg)

上图展示了用户将 Deployment 对象提交给 API Server 之后生成的级联命令。

## <span id="inline-toc">4.</span> Kubernetes 是声明式系统吗？

----

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/uuoKDr.jpg)

```als
fact {
    all sys : Sys - last | let sys' = sys.next {
        some c : Command {
            command.source = sys and command.target = sys'
        }
    }
    Desired[sys.last]
}
```

上述规范语言描述了严格意义上的声明式系统的状态转换机制：给定一个期望状态，系统将找到一系列命令让自己从当前状态 `sys.first` 转换为期望状态 `sys.last`。

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/IsG3gM.jpg)

如果我们不把 Kubernetes 的资源对象看成对实际描述的数据的记录，而是看成对最终期望的结果的记录，就可以认为 Kubernetes 是一个声明式系统。例如，我们可以将前文提到的 Deployment 对象解释为 :** 最终期望的结果是存在 `3` 个 Pod 对象。**

这种理解方式的可取之处在于：如果你将一个资源对象看成对最终期望的结果的记录，你就会对接下来要执行的操作有多种选择。例如，一个 Deployment 对象可以被看成：

+ 一个 `ReplicaSet` 或
+ 一组 `Pod`

按照这种理解方式，只有当存在一个 `ReplicaSet` 和与此相关联的一组 `Pod`时，才会被认为满足期望状态。

如果按照严格意义的声明式系统的理解方式：

+ 只要有一个 `ReplicaSet` 对象，k8s 的 `Deployment` 对象就会进入稳定状态（Deployment 控制器不会产生命令）。
+ 只要有一组 `Pod` 对象，k8s 的 `ReplicaSet` 对象就会进入稳定状态（ReplicaSet 控制器不会产生命令）。

## <span id="inline-toc">5.</span> 总结

----

在大多数情况下，如果定义不是很严格，Kubernetes 可以被看成声明式系统，Kubernetes 资源对象被当成对最终期望的结果的记录。但当涉及到 Kubernetes 的行为时，你要知道它并不会像真正意义上的声明式系统那样通过一系列相互协作的命令来过渡到理想状态，而是通过持续迭代方式一步一步过渡到稳定状态。

## <span id="inline-toc">6.</span> 后记

----

本系列文章是 CNCF，Google 和 SAP 之间合作努力的结果，旨在促进大家对 Kubernetes 及其基本概念的理解。
