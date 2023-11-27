---
keywords:
- 米开朗基杨
- virtualservice
- service mesh
- istio
title: "Istio 中 VirtualService 的注意事项"
subtitle: "VirtualService 最佳定义准则"
description: 本文将会告诉你在 Istio 中定义 VirtualService 的一些注意事项和定义准则。
date: 2018-12-15T18:28:30+08:00
draft: false
author: 米开朗基杨
toc: true
categories: service-mesh
tags:
- Istio
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/751332-637074676275676382.jpg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

Istio 要求集群中 [VirtualService](https://istio.io/zh/docs/reference/config/istio.networking.v1alpha3/#virtualservice) 定义的所有目标主机都是唯一的。当使用目标主机的短名称时（不包含 `'.'` 的目标主机，例如使用 `reviews`，而不是 `reviews.default.svc.cluster.local`），Istio 会将该短名称转换为 VirtualService 规则所在的命名空间的 [FQDN](https://www.wikiwand.com/zh/%E5%AE%8C%E6%95%B4%E7%B6%B2%E5%9F%9F%E5%90%8D%E7%A8%B1)，而不是转换为目标主机所在的命名空间的 FQDN。因此，当在不同的命名空间中定义 VirtualService 资源时允许目标主机的短名称重复。当你的目标主机包含 `*` 通配符前缀、IP 地址或 Web 地址时，VirtualService 不会将其视为短名称，也就不会尝试将其转换为 FQDN。反正无论如何，目标主机必须是唯一的。

## 目标主机冲突示例

下面举几个目标主机冲突的例子，以帮助大家加深对这方面的理解。

### 示例 1

下面两个 `VirtualService` 的目标主机的 FQDN 分别是 `reviews.foo.svc.cluster.local` 和 `reviews.bar.svc.cluster.local `，这是允许的。

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: vs1
  namespace: foo
spec:
  hosts:
  - reviews
  ...
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: vs2
  namespace: bar
spec:
  hosts:
  - reviews
  ...
```

### 示例 2

下面两个 `VirtualService` 的目标主机的 FQDN 都是 `reviews.default.svc.cluster.local`，这是不推荐的，会导致不确定的路由行为。

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: vs3
  namespace: default
spec:
  hosts:
  - reviews
  ...
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: vs4
  namespace: default
spec:
  hosts:
  - reviews
  ...
```

优化方案请参考下文的 [使目标主机唯一](/posts/conflictingvirtualservicehost/#make-the-hostnames-unique)。

### 示例 3

下面这种写法也是不推荐的，因为它在两个不同的 VirtualService 资源中定义了相同的 Web 地址，会导致路由冗余。

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: vs5
  namespace: foo
spec:
  hosts:
  - google.com
  http:
  - match:
    - uri:
        prefix: /search
    route:
    - destination:
        host: search.foo.svc.cluster.local
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: vs6
  namespace: foo
spec:
  hosts:
  - google.com
  http:
  - match:
    - uri:
        prefix: /mail
    route:
    - destination:
        host: mail.foo.svc.cluster.local
```

优化方案请参考下文的 [合并冲突的 VirtualService](/posts/conflictingvirtualservicehost/#merge-the-conflicting-virtualServices)。

## 优化方案

这里给出两个优化准则，可以改进上文的不恰当写法。

### 使目标主机唯一 {#make-the-hostnames-unique}

可以将冲突的 VirtualService 中定义的目标主机更改为唯一的。以下的 VirtualServices 具有唯一的目标主机 `reviews` 和 `ratings`，可以用来优化上面示例 2 的写法。

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: vs3
  namespace: default
spec:
  hosts:
  - reviews
  ...
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: vs4
  namespace: default
spec:
  hosts:
  - ratings
  ...
```

### 合并冲突的 VirtualService {#merge-the-conflicting-virtualServices}

可以将冲突的 VirtualService 中定义的路由规则合并到同一个 VirtualService 中。下面的 VirtualService 可以解决示例 3 的问题，因为规则已合并，并且仅保留具有目标主机 `google.com` 的单个 VirtualService。

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: vs5
  namespace: foo
spec:
  hosts:
  - google.com
  http:
  - match:
    - uri:
        prefix: /search
    route:
    - destination:
        host: search.foo.svc.cluster.local
  - match:
    - uri:
        prefix: /mail
    route:
    - destination:
        host: mail.foo.svc.cluster.local
```
