---
keywords:
- kubernetes
- security context
- allowPrivilegeEscalation
- runAsUser
title: "Kubernetes 最佳安全实践指南"
date: 2020-11-26T14:02:20+08:00
lastmod: 2020-11-26T14:02:20+08:00
description: Kubernetes 提供了非常多的选项来增强集群的安全性，本文介绍了如何利用这些特性来增强集群的安全。
draft: false 
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocLevels: ["h2", "h3", "h4"]
tags:
- kubernetes
categories: kubernetes
img: https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201130153130.jpg
---

对于大部分 Kubernetes 用户来说，安全是无关紧要的，或者说没那么紧要，就算考虑到了，也只是敷衍一下，草草了事。实际上 Kubernetes 提供了非常多的选项可以大大提高应用的安全性，只要用好了这些选项，就可以将绝大部分的攻击抵挡在门外。为了更容易上手，我将它们总结成了几个最佳实践配置，大家看完了就可以开干了。当然，本文所述的最佳安全实践仅限于 Pod 层面，也就是容器层面，于容器的生命周期相关，至于容器之外的安全配置（比如操作系统啦、k8s 组件啦），以后有机会再唠。

## 1. 为容器配置 Security Context

大部分情况下容器不需要太多的权限，我们可以通过 `Security Context` 限定容器的权限和访问控制，只需加上 SecurityContext 字段：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: <Pod name>
spec:
  containers:
  - name: <container name>
  image: <image>
+   securityContext:
```

## 2. 禁用 allowPrivilegeEscalation 

`allowPrivilegeEscalation=true` 表示容器的任何子进程都可以获得比父进程更多的权限。最好将其设置为 false，以确保 `RunAsUser` 命令不能绕过其现有的权限集。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: <Pod name>
spec:
  containers:
  - name: <container name>
  image: <image>
    securityContext:
  +   allowPrivilegeEscalation: false
```

## 3. 不要使用 root 用户

为了防止来自容器内的提权攻击，最好不要使用 root 用户运行容器内的应用。UID 设置大一点，尽量大于 `3000`。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: <name>
spec:
  securityContext:
+   runAsUser: <UID higher than 1000>
+   runAsGroup: <UID higher than 3000>
```

## 4. 限制 CPU 和内存资源

这个就不用多说了吧，requests 和 limits 都加上。

## 5. 不必挂载 Service Account Token

ServiceAccount 为 Pod 中运行的进程提供身份标识，怎么标识呢？当然是通过 Token 啦，有了 Token，就防止假冒伪劣进程。如果你的应用不需要这个身份标识，可以不必挂载：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: <name>
spec:
+ automountServiceAccountToken: false
```

## 6. 确保 seccomp 设置正确

对于 Linux 来说，用户层一切资源相关操作都需要通过系统调用来完成，那么只要对系统调用进行某种操作，用户层的程序就翻不起什么风浪，即使是恶意程序也就只能在自己进程内存空间那一分田地晃悠，进程一终止它也如风消散了。seccomp（secure computing mode）就是一种限制系统调用的安全机制，可以可以指定允许那些系统调用。

对于 Kubernetes 来说，大多数容器运行时都提供一组允许或不允许的默认系统调用。通过使用 `runtime/default` 注释或将 Pod 或容器的安全上下文中的 seccomp 类型设置为 `RuntimeDefault`，可以轻松地在 Kubernetes 中应用默认值。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: <name>
  annotations:
  + seccomp.security.alpha.kubernetes.io/pod: "runtime/default"
```

默认的 seccomp 配置文件应该为大多数工作负载提供足够的权限。如果你有更多的需求，可以自定义配置文件。

## 7. 限制容器的 capabilities

容器依赖于传统的Unix安全模型，通过控制资源所属用户和组的权限，来达到对资源的权限控制。以 root 身份运行的容器拥有的权限远远超过其工作负载的要求，一旦发生泄露，攻击者可以利用这些权限进一步对网络进行攻击。

默认情况下，使用 Docker 作为容器运行时，会启用 `NET_RAW` capability，这可能会被恶意攻击者进行滥用。因此，建议至少定义一个`PodSecurityPolicy`(PSP)，以防止具有 NET_RAW 功能的容器启动。

通过限制容器的 capabilities，可以确保受攻击的容器无法为攻击者提供横向攻击的有效路径，从而缩小攻击范围。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: <name>
spec:
  securityContext:
  + runAsNonRoot: true
  + runAsUser: <specific user>
  capabilities:
  drop:
  + -NET_RAW
  + -ALL
```

如果你对 Linux capabilities 这个词一脸懵逼，建议去看看我的脑残入门系列：

+ [Linux Capabilities 入门教程：概念篇](https://icloudnative.io/posts/linux-capabilities-why-they-exist-and-how-they-work/)
+ [Linux Capabilities 入门教程：基础实战篇](https://icloudnative.io/posts/linux-capabilities-in-practice-1/)
+ [Linux Capabilities 入门教程：进阶实战篇](https://icloudnative.io/posts/linux-capabilities-in-practice-2/)

## 8. 只读

如果容器不需要对根文件系统进行写入操作，最好以只读方式加载容器的根文件系统，可以进一步限制攻击者的手脚。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: <Pod name>
spec:
  containers:
  - name: <container name>
  image: <image>
  securityContext:
  + readOnlyRootFilesystem: true
```

## 9 总结

总之，Kubernetes 提供了非常多的选项来增强集群的安全性，没有一个放之四海而皆准的解决方案，所以需要对这些选项非常熟悉，以及了解它们是如何增强应用程序的安全性，才能使集群更加稳定安全。

最后，请记住：你需要万分小心你的 YAML 文件内容缩进，如果你的 YAML 文件非常多，眼睛看花了，希望下面的神器可以助你一臂之力：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201126170306.png)