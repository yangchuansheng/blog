---
keywords:
- kubernetes
- namespace
- hierarchical namespace
- hierarchical namespaces
title: "Kubernetes 的层级命名空间介绍"
date: 2020-08-15T08:52:57+08:00
lastmod: 2020-08-15T08:52:57+08:00
description: 本文指出了 Kubernetes namespace 的不足，介绍了层级命名空间（hierarchical namespaces）是如何弥补这些不足的。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocLevels: ["h2", "h3", "h4"]
tags:
- kubernetes
categories: kubernetes
img: https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@master/img/20200817090632.png
---

> 原文链接：[Introducing Hierarchical Namespaces](https://kubernetes.io/blog/2020/08/14/introducing-hierarchical-namespaces/)

在单个 `Kubernetes` 集群上安全托管大量用户一直是一个老大难问题，其中最大的麻烦就是不同的组织以不同的方式使用 `Kubernetes`，很难找到一种租户模式可以适配所有组织。相反，Kubernetes 只提供了创建不同租户模式的基础构件，例如 `RBAC` 和 `NetworkPolicies`，这些基础构件实现得越好，安全构建多租户集群就越容易。

## 1. 命名空间

其中最重要的基础构件是命名空间（`namespace`），它构成了几乎所有 Kubernetes 控制平面安全和共享策略的骨干。命名空间有两个关键属性，使其成为策略执行的理想选择：

+ 首先，命名空间可以用来**代表所有权**。大多数 Kubernetes 对象资源必须在某一个命名空间中，所以如果使用命名空间来代表所有权，那么命名空间中的所有对象都隶属于同一个所有者。
+ 其次，命名空间的**创建和使用需要授权**。只有超级管理员才能创建命名空间，其他用户需要明确的权限才能使用这些命名空间（包括创建、查看和修改命名空间中的资源对象）。可以设置恰当的安全策略，防止非特权用户创建某些资源对象。

## 2. 命名空间的限制

然而在实际使用中，命名空间还是不够灵活，无法满足一些常见的用例。假设一个团队拥有好几套微服务环境，每一套微服务环境都有自己的秘钥和资源配额，理想情况下应该将不同的微服务环境放到不同的命名空间中，以便相互隔离。但这样会带来两个问题：

+ 首先，不同的命名空间没有共同的所有权概念，即使它们属于同一个团队。如果某个团队控制了多个命名空间，Kubernetes 不仅没有任何关于这些命名空间的共同所有者的记录，而且针对命名空间范围内的策略也无法跨多个命名空间生效。
+ 其次，如果团队能够自主运作，团队协作效率会更高。但创建命名空间是需要高级权限的，所以开发团队的任何成员都不可能有权限创建命名空间。这就意味着，每当某个团队想要创建新的命名空间时，就必须向集群管理员提出申请，这种方式对小规模组织还可以接受，但随着组织的发展壮大，势必需要寻求更佳的方案。

## 3. 层级命名空间介绍

[层级命名空间（`hierarchical namespaces`）](https://github.com/kubernetes-sigs/multi-tenancy/blob/master/incubator/hnc/docs/user-guide/concepts.md#basic)是 Kubernetes [多租户工作组（Working Group for Multi-Tenancy，wg-multitenancy）](https://github.com/kubernetes-sigs/multi-tenancy) 为了解决这些问题而提出的新概念。在最简单的形式下，层级命名空间就是一个常规的命名空间，它标识了一个单一的、可选的父命名空间；更复杂的形式下，父命名空间还可以继承出子空间。这样就建立了跨命名空间的所有权概念，而不是局限于命名空间内。

这种层级命名空间的所有权可以在命名空间的基础上实现额外的两种功能：

+ **策略继承** : 如果一个命名空间是另一个命名空间的子空间，那么权限策略（例如 `RBAC RoleBindings`）将会[从父空间直接复制到子空间](https://github.com/kubernetes-sigs/multi-tenancy/blob/master/incubator/hnc/docs/user-guide/concepts.md#basic-propagation)。
+ **继承创建权限** : 通常情况下，需要管理员权限才能创建命名空间。但层级命名空间提供了一个新方案：[子命名空间（`subnamespaces`）](https://github.com/kubernetes-sigs/multi-tenancy/blob/master/incubator/hnc/docs/user-guide/concepts.md#basic-subns)，只需要使用父命名空间中的部分权限即可操作子命名空间。

有了这两个功能后，集群管理员就可以为团队创建一个『根』命名空间，以及所有必要的权限策略，然后将创建子命名空间的权限赋予该团队的成员。这样团队内的成员就可以在不违反集群策略的情况下创建自己的子命名空间。

## 4. 示例

层级命名空间由 Kubernetes 的[层级命名空间控制器（Hierarchical Namespace Controller，**HNC**）](https://github.com/kubernetes-sigs/multi-tenancy/tree/master/incubator/hnc)。`HNC` 包含两个组件：

+ **控制器** : 控制器运行在集群中，用来管理子命名空间，传递策略对象，确保层次结构的合理性，并管理扩展点。
+ **kubectl 插件** : 插件名叫 `kubectl-hns`，用户可以使用该插件和控制器进行交互。

控制器和插件的安装请参考 [release 页面](https://github.com/kubernetes-sigs/multi-tenancy/releases)。

下面举一个简单的例子，假设某团队成员没有创建命名空间的权限，但可以查看命名空间 `team-a`，也可以为其创建子命名空间。使用 kubectl 插件执行以下命令：

```bash
$ kubectl hns create svc1-team-a -n team-a
```

这个命令创建了一个子命名空间 `svc1-team-a`。子命名空间也是常规的命名空间，所以名称不能重复。

查看命名空间的层级结构：

```bash
$ kubectl hns tree team-a
# Output:
team-a
└── svc1-team-a
```

如果父命名空间中有任何策略，都会被继承到子命名空间中。例如，假设  `team-a` 中有一个名为 `sres` 的 RBAC RoleBinding，那么它也会出现在子命名空间中：

```bash
$ kubectl describe rolebinding sres -n svc1-team-a
# Output:
Name:         sres
Labels:       hnc.x-k8s.io/inheritedFrom=team-a  # inserted by HNC
Annotations:  <none>
Role:
  Kind:  ClusterRole
  Name:  admin
Subjects: ...
```

`HNC` 还为层级命名空间添加了相关标签，其中包含了层级结构的相关信息，你可以用来设置其他的策略。例如，可以创建以下 `NetworkPolicy`：

```yaml
kind: NetworkPolicy
apiVersion: networking.k8s.io/v1
metadata:
  name: allow-team-a
  namespace: team-a
spec:
  ingress:
  - from:
    - namespaceSelector:
        matchExpressions:
          - key: 'team-a.tree.hnc.x-k8s.io/depth' # Label created by HNC
            operator: Exists
```

该策略会传递给 `team-a` 的所有子命名空间，也会允许所有这些子命名空间之间的 `ingress` 流量。 这些 "tree" 标签只能由 `HNC` 创建，用来确保最新的层级结构。

关于 HNC 的更多信息请参考[用户指南](https://github.com/kubernetes-sigs/multi-tenancy/tree/master/incubator/hnc/docs/user-guide)。