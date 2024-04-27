---
keywords:
- envoy
- envoy proxy
- 熔断
- 雪崩
title: "Envoy 基础教程：熔断器的原理和使用"
subtitle: "使用熔断器来预防服务出现雪崩效应"
date: 2018-07-13T09:22:49Z
draft: false
author: 米开朗基杨
toc: true
categories: 
- cloud-native
tags:
- Envoy
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191203195651.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

在微服务领域，各个服务之间经常会相互调用。如果某个服务繁忙或者无法响应请求，将有可能引发集群的大规模级联故障，从而造成整个系统不可用，通常把这种现象称为 <span id="inline-purple">服务雪崩效应</span>。为了应对这种情况，可以使用熔断器（circuit breaking）。

<span id="inline-purple">熔断器</span> 是分布式系统的关键组件，默认情况下处于关闭状态，这时请求被允许通过熔断器。它调用失败次数积累，如果当前健康状况低于设定阈值则启动熔断机制，这时请求被禁止通过。这样做可以实现更优雅的故障处理，并在问题被放大之前做出及时的响应。你可以选择在基础架构层面实现熔断机制，但熔断器本身会很容易受到故障的影响。为了更好地实现熔断机制，可以在 Envoy 的网络层面配置熔断器，这样做的好处是 `Envoy` 在网络级别强制实现断路，而不必为每个应用程序单独配置或编程。

## 熔断器配置

----

Envoy 支持各种类型的完全分布式（非协调的）熔断，设置熔断时，需要考虑系统的具体情况，可以通过向 Envoy 的 `clusters` 配置项中添加 `circuit_breakers` 来为 Envoy 配置熔断器。下面是一个简单的示例：

```yaml
circuit_breakers:
  thresholds:
    - priority: DEFAULT
      max_connections: 1000
      max_requests: 1000
    - priority: HIGH
      max_connections: 2000
      max_requests: 2000
```

+ <span id="inline-blue">thresholds</span> : 阈值允许我们定义服务响应的流量类型的优先级和限制。
+ <span id="inline-blue">priority</span> : 优先级是指熔断器如何处理定义为 `DEFAULT` 或 `HIGH` 的路由。示例中的设置表示将任何不应该在长连接队列中等待的请求设置为 HIGH（例如，用户在购物网站上提交购买请求或保存当前状态的 POST 请求）。
+ <span id="inline-blue">max_connections</span> : Envoy 将为上游集群中的所有主机建立的最大连接数，默认值是 `1024`。实际上，这仅适用于 HTTP/1.1集群，因为 HTTP/2 使用到每个主机的单个连接。
+ <span id="inline-blue">max_requests</span> : 在任何给定时间内，集群中所有主机可以处理的最大请求数，默认值也是 1024。实际上，这适用于仅 HTTP/2 集群，因为 HTTP/1.1 集群由最大连接断路器控制。

## 基本的熔断策略

----

由于 `HTTP/1.1` 协议和 `HTTP/2` 协议具有不同的连接行为（HTTP/1.1 : 同一个连接只能处理一个请求；HTTP/2 : 同一个连接能并发处理多个请求，而且并发请求的数量比HTTP1.1大了好几个数量级），使用不同协议的集群将各自使用不同的配置项：

+ **HTTP/1.1 协议** : 使用 max_connections。
+ **HTTP/2 协议** ： 使用 max_requests。

这两个配置项都可以很好地实现熔断机制，主要取决于两个指标：服务的请求/连接数量和请求延时。例如，具有 1000个请求/second 和平均延迟 2 秒的 HTTP/1 服务通常会在任何给定时间内打开 `2000` 个连接。由于当存在大量非正常连接时熔断器会启动熔断机制，因此建议将参数 max_connections 的值最少设置为 `10 x 2000`，这样当最后 10 秒内的大多数请求未能返回正确的响应时就会打开熔断器。当然，具体的熔断器配置还得取决于系统的负载以及相关服务的具体配置。

## 高级熔断策略

----

上面讨论了一些基本的熔断策略，下面将介绍更高级的熔断策略，这些高级熔断策略可以为你的网络基础架构增加更多的弹性。

### 基于延迟设置熔断

如上所述，熔断器最常见的用例之一就是预防服务响应过慢但未完全瘫痪时引发的故障。虽然 Envoy 没有直接提供熔断器的延迟配置项，但可以通过自动重试配置项来模拟延迟。自动重试配置项通过 `max_retries` 字段定义，表示在任何给定时间内，集群中所有主机可以执行的最大重试次数。

### 基于长连接重试队列设置熔断

由于重试有可能将请求流量增加到两倍以上甚至更多，因此通过 `max_retries` 参数可以防止服务因为过多的重试而过载。建议将此参数的值设置为服务通常在 10 秒窗口中处理的请求总数的一小部分，最好不要将重试次数设置为与服务在 10 秒窗口中处理的请求总数差不多。

----

![](https://images.icloudnative.io/uPic/wechat.gif)
<center>扫一扫关注微信公众号</center>

