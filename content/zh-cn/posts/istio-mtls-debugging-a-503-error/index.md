---
title: "在 Istio 中调试 503 错误"
subtitle: "记一次 mTLS 趟坑经历"
date: 2018-10-11T15:59:54+08:00
draft: false
author: 米开朗基杨
categories: 
- service-mesh
tags:
- Istio
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/error-503.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

> 原文链接：[Istio, mTLS, debugging a 503 error](https://bani.com.br/2018/08/istio-mtls-debugging-a-503-error/)

大家好，本文我将与你们分享我在 Istio 官方文档中尝试[熔断](https://istio.io/zh/docs/tasks/traffic-management/circuit-breaking/)教程时遇到的问题。我会记录下解决此问题的所有步骤，希望对你们有所帮助。至少对我自己来说，在整个排错过程中学到了很多关于 Istio 的知识。

我的实践步骤非常简单，总共分为两步：

1. 部署两个应用（一个 httpbin 示例应用 + 一个带有命令行工具 `curl` 的客户端）
2. 创建一个 [目标规则](https://istio.io/docs/reference/config/istio.networking.v1alpha3/#DestinationRule)以限制对 httpbin 服务的调用（熔断）

是不是非常简单？让我们开始吧！

首先安装 httpbin 服务和客户端：

```bash
$ kubectl create ns foo
$ kubectl apply -f <(istioctl kube-inject -f samples/httpbin/httpbin.yaml) -n foo
$ kubectl apply -f <(istioctl kube-inject -f samples/sleep/sleep.yaml) -n foo
 
$ kubectl -n foo get pod,svc

NAME                           READY     STATUS    RESTARTS   AGE
pod/httpbin-6bbb775889-wcp45   2/2       Running   0          35s
pod/sleep-5b597748b4-77kj5     2/2       Running   0          35s
 
NAME              TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)    AGE
service/httpbin   ClusterIP   10.105.25.98           8000/TCP   36s
service/sleep     ClusterIP   10.111.0.72            80/TCP     35s
```

接下来就登入客户端 Pod 并使用 curl 来调用 `httpbin`：

```bash
$ kubectl -n foo exec -it -c sleep sleep-5b597748b4-77kj5 -- curl http://httpbin:8000/get
```
```json
{
  "args": {}, 
  "headers": {
    "Accept": "*/*", 
    "Content-Length": "0", 
    "Host": "httpbin:8000", 
    "User-Agent": "curl/7.35.0", 
    "X-B3-Sampled": "1", 
    "X-B3-Spanid": "b5d006d3d9bf1f4d", 
    "X-B3-Traceid": "b5d006d3d9bf1f4d", 
    "X-Request-Id": "970b84b2-999b-990c-91b4-b6c8d2534e77"
  }, 
  "origin": "127.0.0.1", 
  "url": "http://httpbin:8000/get"
}
```

到目前为止一切正常。下面创建一个目标规则针对 `httpbin` 服务设置断路器：

```yaml
$ cat <<EOF | kubectl -n foo apply -f -
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: httpbin
spec:
  host: httpbin
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 1
      http:
        http1MaxPendingRequests: 1
        maxRequestsPerConnection: 1
    outlierDetection:
      consecutiveErrors: 1
      interval: 1s
      baseEjectionTime: 3m
      maxEjectionPercent: 100
EOF
```

现在尝试再次调用 httpbin 服务：

```bash
$ kubectl -n foo exec -it -c sleep sleep-5b597748b4-77kj5 -- curl http://httpbin:8000/get

upstream connect error or disconnect/reset before headers
```

哎呀出事了！我们可以让 curl 输出更加详细的信息：

```bash
$ kubectl -n foo exec -it -c sleep sleep-5b597748b4-77kj5 -- curl -v http://httpbin:8000/get

* Hostname was NOT found in DNS cache
*   Trying 10.105.235.142...
* Connected to httpbin (10.105.235.142) port 8000 (#0)
> GET /get HTTP/1.1
> User-Agent: curl/7.35.0
> Host: httpbin:8000
> Accept: */*
> 
< HTTP/1.1 503 Service Unavailable
< content-length: 57
< content-type: text/plain
< date: Tue, 28 Aug 2018 12:26:54 GMT
* Server envoy is not blacklisted
< server: envoy
< 
* Connection #0 to host httpbin left intact
upstream connect error or disconnect/reset before headers
```

发现了 503 错误。。。为什么呢？根据刚刚创建的 `DestinationRule`，应该可以成功调用 httpbin 服务的。因为我们将 TCP 连接的最大数量设置为 1，而 curl 命令只生成了一个连接。那么到底哪里出问题了呢？

我能想到的第一件事就是通过查询 istio-proxy 的状态来验证熔断策略是否生效：

```bash
$ kubectl -n foo exec -it -c istio-proxy sleep-5b597748b4-77kj5 -- curl localhost:15000/stats | grep httpbin | grep pending

cluster.outbound|8000||httpbin.foo.svc.cluster.local.upstream_rq_pending_active: 0
cluster.outbound|8000||httpbin.foo.svc.cluster.local.upstream_rq_pending_failure_eject: 0
cluster.outbound|8000||httpbin.foo.svc.cluster.local.upstream_rq_pending_overflow: 0
cluster.outbound|8000||httpbin.foo.svc.cluster.local.upstream_rq_pending_total: 5
```

`upstream_rq_pending_overflow` 的值是 `0`，说明没有任何调用被标记为熔断。

{{< alert >}}
Istio sidecar（名为 <code>istio-proxy</code> 的 Envoy 容器）暴露出 15000 端口以提供一些实用的功能，可以通过 HTTP 访问这个端口，例如打印相关服务的一些统计信息。

因此，在上面的的命令中，我们在客户端 Pod（sleep-5b597748b4-77kj5）的 sidecar 容器（-c istio-proxy）中执行 curl（curl localhost:15000/stats），过滤出我们要检查的服务的统计信息（| grep httpbin），然后过滤出熔断器挂起状态（| grep pending）。
{{< /alert >}}

为了确认 `DestinationRule` 才是罪魁祸首，我决定将它删除然后再尝试调用：

```bash
$ kubectl -n foo delete DestinationRule httpbin

destinationrule.networking.istio.io "httpbin" deleted


$ kubectl -n foo exec -it -c sleep sleep-5b597748b4-77kj5 -- curl -v http://httpbin:8000/get

...
< HTTP/1.1 200 OK
...
```

再将该 `DestinationRule` 加回来，然后再次尝试调用：

```bash
...
< HTTP/1.1 503 Service Unavailable
...
```

看来问题确实出在 DestinationRule 这里，但是还是不知道为什么，我们需要进一步研究。我灵机一动，要不先来看看 Envoy（istio-proxy sidecar）的日志吧：

```bash
$ kubectl -n foo logs -f sleep-5b597748b4-77kj5 -c istio-proxy

# 在另一个终端执行以下命令 (kubectl -n foo exec -it -c sleep sleep-5b597748b4-77kj5 -- curl -v http://httpbin:8000/get)
# 然后会输出下面的日志：

[2018-08-28T13:06:56.454Z] "GET /get HTTP/1.1" 503 UC 0 57 0 - "-" "curl/7.35.0" "19095d07-320a-9be0-8ba5-e0d08cf58f52" "httpbin:8000" "172.17.0.14:8000"
```

并没有看到什么有用的信息。日志告诉我们 Envoy 从服务器收到了 503 错误，OK，那我们就来检查一下服务器端（httpbin）的日志：

```bash
$ kubectl -n foo logs -f httpbin-94fdb8c79-h9zrq -c istio-proxy
# 在另一个终端执行以下命令 (kubectl -n foo exec -it -c sleep sleep-5b597748b4-77kj5 -- curl -v http://httpbin:8000/get)
# 日志输出为空
```

什么？日志输出中竟然没有任何内容，就好像请求根本没有到达服务器一样。那么现在该怎么办呢，可不可以增加日志输出等级？也许请求已经收到了，只是没有被输出而已。

还记得我上面讲过的 Envoy 暴露了 15000 端口作为管理接口吗？我们可以用它来获取统计数据。看看它都提供了哪些功能：

```bash
$ kubectl -n foo exec -it -c istio-proxy httpbin-94fdb8c79-h9zrq -- curl http://localhost:15000/help

admin commands are:
  /: Admin home page
  /certs: print certs on machine
...
  /logging: query/change logging levels
...
```

嘿嘿，似乎找到了我们需要的东西：`/logging`，试试吧：

```bash
$ kubectl -n foo exec -it -c istio-proxy httpbin-94fdb8c79-h9zrq -- curl http://localhost:15000/logging?level=trace

active loggers:
  admin: trace
...
```

上面的命令将服务器 Envoy 的日志等级设为 `trace`，该日志等级输出的日志信息最详细。关于管理接口的更多信息，请查看 [Envoy 官方文档](https://www.envoyproxy.io/docs/envoy/latest/operations/admin)。现在我们再来重新查看服务器 Envoy 的日志，希望能够得到一些有用的信息：

```bash
$ kubectl -n foo logs -f httpbin-94fdb8c79-h9zrq -c istio-proxy

# 在另一个终端执行以下命令 (kubectl -n foo exec -it -c sleep sleep-5b597748b4-77kj5 -- curl -v http://httpbin:8000/get)
# 然后会输出下面的日志：（我过滤了一些不相关的内容）

[debug][filter] external/envoy/source/extensions/filters/listener/original_dst/original_dst.cc:18] original_dst: New connection accepted
[debug][main] external/envoy/source/server/connection_handler_impl.cc:217] [C31] new connection
[trace][connection] external/envoy/source/common/network/connection_impl.cc:389] [C31] socket event: 2
[trace][connection] external/envoy/source/common/network/connection_impl.cc:457] [C31] write ready
[debug][connection] external/envoy/source/common/ssl/ssl_socket.cc:111] [C31] handshake error: 2
[trace][connection] external/envoy/source/common/network/connection_impl.cc:389] [C31] socket event: 3
[trace][connection] external/envoy/source/common/network/connection_impl.cc:457] [C31] write ready
[debug][connection] external/envoy/source/common/ssl/ssl_socket.cc:111] [C31] handshake error: 1
[debug][connection] external/envoy/source/common/ssl/ssl_socket.cc:139] [C31] SSL error: 268435612:SSL routines:OPENSSL_internal:HTTP_REQUEST
[debug][connection] external/envoy/source/common/network/connection_impl.cc:133] [C31] closing socket: 0
```

现在我们可以看到请求确实已经到达服务器了，但由于握手错误导致了请求失败，并且 Envoy 正在关闭连接。现在的问题是 : **为什么会发生握手错误？为什么会涉及到 SSL？**

当在 Istio 中谈到 SSL 时，一般指的是双向 TLS。然后我就去查看 Istio 官方文档，视图找到与我的问题相关的内容，最后终于在 [基础认证策略](https://istio.io/zh/docs/tasks/security/authn-policy/) 这篇文档中找到了我想要的东西。

**我发现我在部署 Istio 时启用了 Sidecar 之间的双向 TLS 认证！**

检查一下：

```yaml
$ kubectl get MeshPolicy default -o yaml

apiVersion: authentication.istio.io/v1alpha1
kind: MeshPolicy
metadata: ...
spec:
  peers:
  - mtls: {}

 
$ kubectl -n istio-system get DestinationRule default -o yaml

apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata: ...
spec:
  host: '*.local'
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL
```

上面这些输出表明集群中开启了双向 TLS 认证，因为这些全局身份验证策略和目标规则只有在开启双向 TLS 认证时才会存在。

再回到最初的问题：为什么调用 httpbin 服务会失败？现在我们已经知道了网格中开启了双向 TLS 认证，通过阅读文档可以推断出服务器端仅接受使用 TLS 的加密请求，而客户端仍在使用明文请求。现在来重新修改一个问题 :** 为什么客户端（sleep pod）会使用明文来请求服务器端（httpbin pod）？**

再次仔细阅读官方文档可以找到答案。双向 TLS 认证（`mTLS`）在 Istio 中的工作方式很简单：它会创建一个默认的 `DestinationRule` 对象（名称为 `default`），它表示网格中的所有客户端都使用双向 TLS。但是当我们为了实现熔断策略创建自己的 `DestinationRule` 时，用自己的配置（根本就没有设置 TLS！）覆盖了默认配置。

这是 [基础认证策略](https://istio.io/zh/docs/tasks/security/authn-policy/) 文档中的原文：

<p id="blockquote">
除了认证场合之外，目标规则还有其它方面的应用，例如金丝雀部署。但是所有的目标规则都适用相同的优先顺序。因此，如果一个服务需要配置其它目标规则（例如配置负载均衡），那么新规则定义中必须包含类似的 TLS 块来定义 <code>ISTIO_MUTUAL</code> 模式，否则它将覆盖网格或命名空间范围的 TLS 设置并禁用 TLS。
</p>

现在知道问题出在哪了，解决办法就是：修改 `DestinationRule` 以包含 TLS 配置项：

```yaml
cat <<EOF | kubectl -n foo apply -f -
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: httpbin
spec:
  host: httpbin
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 1
      http:
        http1MaxPendingRequests: 1
        maxRequestsPerConnection: 1
    outlierDetection:
      consecutiveErrors: 1
      interval: 1s
      baseEjectionTime: 3m
      maxEjectionPercent: 100
    tls:
      mode: ISTIO_MUTUAL
EOF
```

再次尝试调用 httpbin 服务：

```bash
kubectl -n foo exec -it -c sleep sleep-5b597748b4-77kj5 -- curl -v http://httpbin:8000/get

...
< HTTP/1.1 200 OK
...
```

现在我可以继续实验熔断教程了！

**总结 :** 

+ 确认是否启用了 mTLS，如果启用了可能会遇到很多错误。:blush:
+ 所有的目标规则都适用相同的优先顺序，具体的规则会覆盖全局的规则。
+ 有时候可以充分利用 Sidecar 的管理接口（本地端口 15000）。
+ 仔细阅读官方文档。:blush:

