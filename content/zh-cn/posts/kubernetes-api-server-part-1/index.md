---
title: "深入理解 Kubernetes API Server（一）"
subtitle: "Kubernetes API Server 的架构和行为规范"
date: 2018-11-19T13:42:03+08:00
draft: false
author: 米开朗基杨
toc: true
categories: cloud-native
tags: ["kubernetes"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/MasterCloudNativeInfrastructurewithKubernetes_LP_1200x630-1548277017303.jpg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

> 原文地址：[Kubernetes API Server, Part I](https://medium.com/@dominik.tornow/kubernetes-api-server-part-i-3fbaf2138a31)

![](https://images.icloudnative.io/uPic/t4siPv.jpg "概念架构")

`Kubernetes` 是一个用于在一组节点（通常称之为集群）上托管容器化应用程序的容器编排引擎。本系列教程旨在通过系统建模的方法帮助大家更好地理解 `Kubernetes` 及其基本概念。

本文使用的语言是 [Alloy](http://alloytools.org/)，这是一种基于一阶逻辑表达结构和行为的[规范语言](https://www.wikiwand.com/zh-hans/%E8%A7%84%E7%BA%A6%E8%AF%AD%E8%A8%80)。文中我对每一段 Alloy 规范语言表达的意思都作了简明的描述。

> **规约语言**（英语：Specification language），或称**规范语言**，是在计算机科学领域的使用的一种形式语言。编程语言是用于系统实现的、可以直接运行的形式语言。与之不同，规约语言主要用于系统分析和设计的过程中。

本系列文章总共分为三个部分：

+ 第一部分描述了 `API Server` 的架构和行为
+ 第二部分描述了 `Kubernetes API`
+ 第三部分描述了 Kubernetes 的对象存储

本文主要讲述第一部分的内容。

## 前言——什么是 API Server

“API Server” 这个术语很宽泛，涉及了太多的概念，本文将尝试使用 `API Server`，`Kubernetes API` 和 `Kubernetes 对象存储` 这三个不同的术语来明确表示各个概念。

![](https://images.icloudnative.io/uPic/006tNbRwgy1fxc8pwh73mj30tu0fr3zn.jpg "图 1：API Server，Kubernetes API 和 Kubernetes 对象存储")

+ <span id=inline-purple>Kubernetes API</span> 表示处理读取和写入请求以及相应地查询或修改 Kubernetes 对象存储的组件。
+ <span id=inline-purple>Kubernetes 对象存储</span> 表示持久化的 Kubernetes 对象集合。
+ <span id=inline-purple>API Server</span> 表示 Kubernetes API 和 Kubernetes 对象存储的并集。

## API Server 详解

**Kubernetes API Server** 是 Kubernetes 的核心组件。从概念上来看，Kubernetes API Server 就是 Kubernetes 的数据库，它将集群的状态表示为一组 **Kubernetes 对象**，例如 `Pod`、`ReplicaSet` 和 `Deployment` 都属于 Kubernetes 对象。

![](https://images.icloudnative.io/uPic/006tNbRwgy1fxchxltk62j30hp03jaa8.jpg "图 2：Kubernetes API Server & Kubernetes 对象")

Kubernetes API Server 存在多个版本，每一个版本都是它在不同时间段的快照，类似于 git 仓库：

+ Kubernetes API Server 具有属性 `rev`，是 Kubernetes API Server 版本的缩写。该属性表示的是 Kubernetes API Server 在每个时间戳的快照。
+ Kubernetes 对象具有属性 `mod`，是 Kubernetes 对象版本的缩写。该属性表示的是该对象最后一次被修改的快照。

但实际上 Kubernetes API Server 在实现上会限制快照的时间长度，并且默认情况下会在 5 分钟后丢弃快照。

![](https://images.icloudnative.io/uPic/006tNbRwgy1fxciw5ywkkj30um044gm9.jpg "图 3：Kubernetes API Server & 版本")

Kubernetes API Server 暴露了一个不支持事务性语义的 CRUD （`Create/Read/Update/Delete`）接口：

+ 保证**写入请求**是针对最新版本执行的，并相应地增加版本号。
+ 但不保证**读取请求**是针对最新版本执行的，这主要取决于 API Server 的安装与配置方式。

缺乏事务性语义会导致经典的[竞争危害](https://www.wikiwand.com/zh-hans/%E7%AB%B6%E7%88%AD%E5%8D%B1%E5%AE%B3)现象，如非确定性写入。

缺乏 `read-last-write` 语义会导致两个截然不同的后果，即过期读取和无序读取：

+ <span id=inline-purple>过期读取（Stale reads）</span> 指的是读取请求针对的不是最新版本的现象，因此会产生“过期”响应。
+ <span id=inline-purple>无序读取（Out-of-order reads）</span> 指的是在两个连续的读取请求中，第一个请求读取的是较高版本，而第二个请求读取的是较低版本，因此会产生无序响应。

![](https://images.icloudnative.io/uPic/006tNbRwgy1fxcjti2wl0j31jk0aoac9.jpg "图 4：读取")

### 防护 token 和新鲜度 token

客户端可以使用属性 `rev` 作为用于写入操作的防护 token（`fencing tokens`），以此来抵消丢失的事务性语义。或者作为用于读取操作的新鲜度 token（`freshness tokens`），以此来抵消丢失的 `read-last-write` 语义。

![](https://images.icloudnative.io/uPic/006tNbRwgy1fxckathpzcj31f40azdhw.jpg "图 5：防护 token")

在执行写入操作时，客户端使用 `rev` 或 `mod` 作为防护 token。客户端指定期望的 `rev` 或 `mod` 值，但只有当前 `rev` 或 `mod` 值等于期望值时，API Server 才会处理该请求。这一过程被称为乐观锁定（optimistic locking）。

> 图 5 中客户端期望的 `rev` 值为 n，而当前的 `rev` 值为 n+1，与期望不符，因此 API Server 不处理该请求，`rev` 值仍然保持为 n+1。

![](https://images.icloudnative.io/uPic/006tNbRwgy1fxckvkwm1ij31jk0ao40u.jpg "图 6：新鲜度 token")

在执行读取操作时，客户端使用 `rev` 或 `mod` 作为新鲜度 token，该 token 用来确保读取请求返回的结果不早于新鲜度 token 的值指定的结果。

## 架构规范

```als
sig Server {objects : set Object, rev : Int}

sig Object {kind : Kind, name : Name, namespace : Namespace, mod : Int}

// Equality of objects
pred eq(o, o' : Object) {
  o.kind = o'.kind and o.name = o'.name and o.namespace = o'.namespace
}

// Uniqueness constraint
fact {
  all s : Server {
    all disj o, o' : s.objects | not eq[o, o']
  }
}
```

+ Kubernetes API Server 有一组 Kubernetes 对象和一个 `rev` 属性。
+ Kubernetes 对象具有 [kind](https://github.com/kubernetes/community/blob/master/contributors/devel/api-conventions.md#types-kinds)，[name](https://github.com/kubernetes/community/blob/master/contributors/devel/api-conventions.md#metadata)，[namespace](https://github.com/kubernetes/community/blob/master/contributors/devel/api-conventions.md#metadata) 和 mod 这几个属性。
+ 对象由其 kind，name 和 namespace 三元组来标识。
+ API Server 中任何两个不同的 Kubernetes 对象都不可能具有相同的 kind，name 和 namespace 三元组。

## 行为规范

从概念上来看，Kubernetes API Server 提供了写入接口和读取接口。
其中写入接口将所有更改状态的命令组合在一起，读取接口将所有查询状态的命令组合在一起。

![](https://images.icloudnative.io/uPic/006tNbRwgy1fxcli4vrpsj31bc0dajsu.jpg "图 7：写入和读取接口")

### 写入接口

写入接口提供创建、更新和删除对象的命令。

```als
abstract sig Command {server : one Server, server' : one Server}

fact {
  all c : Command {
    c.server'.revision = c.server.revision.plus[1]
  }
}
```

每一个 **Command** 表示一个状态转换：将 API Server 从当前状态转换到下一个状态。每个命令都会增加 API Server 的版本。

```als
abstract sig Event { origin : one Command, object : one Object }

fact {
  all c : Command {
    one e : Event | e.origin = c
  }
}
```

此外，每个命令都会生成一个事件。**Event** 表示命令执行的持久化可查询记录。

![](https://images.icloudnative.io/uPic/006tNbRwgy1fxcltkebzkj30yu0e4abl.jpg "图 8：API Server，命令和事件")

**图 8** 描述了 API Server 的一系列命令和结果状态转换。总共分为三层结构，从下往上依次表示为 API Server，命令和事件。

Kubernetes API Server 的设计和实现方式保证了 API Server 在任何时间点的当前状态等于事件流到该时间点的聚合状况，这种模式也被称为 [事件溯源（event sourcing）](https://docs.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)。

```bash
state = reduce(apply, events, {})
```

#### 创建命令

```als
sig Create extends Command {toCreate : one Object}

fact {
  all c : Create {
    // pre-condition(s)
    not c.toCreate in c.server.objects
    // next state
    c.server'.objects = c.server.objects + c.toCreate
    // mod
    c.toCreate.mod = c.server'.rev
  }
}
```

+ 创建命令将 Kubernetes 对象添加到 API Server，并将对象的 `mod` 值设置为 API Server 的 `rev` 值。
+ 如果想要创建的对象违反了 API Server 的唯一性约束，则会拒绝创建命令。

```als
sig Created extends Event {}

fact {
  all c : Create {
    one e : Created | e.origin = c and e.object = c.toCreate
  }
}
```

+ 每个创建命令都会生成一个持久且可查询的 `Created Event`，event 的 `object` 字段引用创建的 Kubernetes 对象。

#### 更新命令

```als
sig Update extends Command {old : one Object, new : one Object, mod : Int}

fact {
  all u : Update {
    // pre-condition(s)
    u.old in u.server.objects and not u.new in u.server.objects and eq[u.old, u.new]
    // optimistic locking
    u.old.mod = u.mod 
    // next state
    u.server'.objects = u.server.objects - u.old + u.new
    // mod
    u.new.mod = u.server'.rev
  }
}
```

+ 更新命令将更新 API Server 中的 Kubernetes 对象，并将对象的 `mod` 值设置为 API Server 的 `rev` 值。
+ 如果命令的 `mod` 值与对象的 `rev` 值不匹配，则拒绝更新命令。这里的 `mod` 用作防护 token。

```als
sig Updated extends Event {}

fact {
  all u : Update {
    one e : Updated | e.origin = u and e.object = u.new
  }
}
```

+ 每个更新命令都会生成一个持久且可查询的 Updated Event，event 的 object 字段引用新的 Kubernetes 对象。

#### 删除命令

```als
sig Delete extends Command {toDelete : one Object, mod : Int}

fact {
  all d : Delete {
    // pre-condition(s)
    d.toDelete in d.server.objects
    // optimistic locking
    d.toDelete.mod = d.mod 
    // next state
    d.server'.objects = d.server.objects - d.toDelete
  }
}
```

+ 删除命令从 API Server 中删除 Kubernetes 对象。
+ 如果命令的 `mod` 值与对象的 `mod` 值不匹配，则拒绝删除命令。这里的 `mod` 用作防护 token。

```als
sig Deleted extends Event {}

fact {
  all d : Delete {
    one e : Deleted | e.origin = d and e.object = d.toDelete
  }
}
```

+ 每个删除命令都会生成一个持久且可查询的 Deleted Event，event 的 object 字段引用已删除的 Kubernetes 对象。

### 读取接口

Kubernetes API 读取接口提供两个字接口，一个接口与对象相关，另一个与事件相关。

#### 对象相关的子接口

对象相关的子接口提供读取对象和对象列表的命令。

```als
sig ReadO {kind : one Kind, name : one Name, namespace : one Namespace, min : Int, res : lone Object, rev : Int}

fact {
  all r : ReadO {
    some s : Server {
      r.min <= server.rev
      r.rev = s.rev
      r.res = {o : s.objects | o.kind = r.kind and o.name = r.name and o.namespace = r.namespace}
    }
  }
}
```

+ 读取对象的请求接收 kind、name 和 namespace 三元组，同时也会接收用作新鲜度 token 的 `min` 参数。
+ API Server 至少在由 `min` 指定的 API Server 的版本处返回匹配的 Kubernetes 对象。

#### 事件相关的子接口

事件相关的子接口提供命令以读取关于对象和对象列表的事件。

```als
sig WatchO {kind : Kind, name : Name, namespace : Namespace, min : Int, res : set Event}

fact {
  all w : WatchO {
    w.res = {e : Event | e.origin.server.rev >= w.min and e.object.kind = w.kind and e.object.name = w.name and e.object.namespace = w.namespace}
  }
}
```

+ Watch 对象的请求接收 kind、name 和 namespace 三元组，同时也会接收用作新鲜度 token 的 `min` 参数。
+ API Server 从指定的 API Server 版本开始返回所有匹配的事件。

```als
sig WatchL {kind : Kind, name : Name, min : Int, res : set Event}

fact {
  all w : WatchL {
    w.res = {e : Event | e.origin.server.rev >= w.min and e.object.kind = w.kind and e.object.name = w.name}
  }
}
```

+ Watch List 对象的请求接收 kind、name 和 namespace 三元组，同时也会接收用作新鲜度 token 的 min 参数。
+ API Server 从指定的 API Server 版本开始返回所有匹配的事件。

#### 例子

对象相关的子接口与事件相关的子接口一起组成了 Kubernetes 中广泛使用的有效查询机制，例如在 Kubernetes 控制器中就用到了这种机制。

通过这种机制，客户端可以先请求一次当前状态，然后订阅后续事件流，而不是重复轮询对象或对象列表的当前状态。

```bash
pods, rev := request-object-list(kind="pods", namespace="default")
for e in request-watch-list(kind="pods", namespace="default", rev)
  pods := apply(pods, e)
```

通过将读取请求最初返回的 Kubernetes API Server 版本线程化到 watch 请求，可以保证客户端能够接收到读取和写入请求之间以及之后发生的任何事件。

这种实现机制可以确保客户端的状态与 API Server 的状态保持最终一致性。

## 总结

本文描述了 Kubernetes API Server 的架构和行为。设计和实现一个适当的客户端的关键部分是正确使用  Kubernetes API Server 的版本和 Kubernetes 对象的版本作为防护 token 和新鲜度 token。

下一篇文章将会为大家介绍 Kubernetes API 和 Kubernetes 对象存储。

## 后记

本系列文章是 CNCF，Google 和 SAP 之间合作努力的结果，旨在促进大家对 Kubernetes 及其基本概念的理解。
