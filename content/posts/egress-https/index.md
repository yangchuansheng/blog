---
title: "在服务网格内部调用外部 Web 服务"
subtitle: "HTTPS 流量的出口规则"
date: 2018-11-21T17:09:25+08:00
draft: false
author: 米开朗基杨
toc: true
categories: 
- service-mesh
tags: 
- Istio
- Kubernetes
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/0_HhlrMVOhRsgWuBZ6.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

> 此博客文章于 2018 年 8 月 9 日更新。新版本使用了 Istio 1.0，并使用了新的 [v1alpha3 流量管理 API](https://preliminary.istio.io/zh/blog/2018/v1alpha3-routing/)。如果您使用的 Istio 是旧版本，请参考 [使用外部 Web 服务归档版](https://archive.istio.io/v0.7/blog/2018/egress-https.html)。

在许多情况下，在 service mesh 中的微服务应用并不是应用程序的全部，有时，网格内部的微服务需要使用在服务网格外部的遗留系统提供的功能。虽然我们希望逐步将这些系统迁移到服务网格中，但是在迁移这些系统之前，必须让服务网格内的应用程序能访问它们。在其他情况下，应用程序使用外部组织提供的 Web 服务，这些服务通常是通过万维网提供的服务。

在这篇博客文章中，我修改了 [Istio Bookinfo 示例应用程序](https://preliminary.istio.io/zh/docs/examples/bookinfo/)让它可以从外部 Web 服务（[Google Books APIs](https://developers.google.com/books/docs/v1/getting_started)）中获取图书详细信息。 我将展示如何使用 `mesh-external service entries` 在 Istio 中启用外部 HTTPS 流量。我提供了两种方式来配置出口流量的 TLS，并描述了每个选项的优缺点。

## 初始设定

为了演示使用外部 Web 服务的场景，首先需要一个安装了 [Istio](https://preliminary.istio.io/zh/docs/setup/kubernetes/quick-start/#%E5%AE%89%E8%A3%85%E6%AD%A5%E9%AA%A4) 的 Kubernetes 集群，然后部署 [Istio Bookinfo 示例应用程序](https://preliminary.istio.io/zh/docs/examples/bookinfo/)，此应用程序使用 details 微服务来获取书籍详细信息，例如页数和作者。原始的 details 微服务无需调用任何外部服务就可以提供书籍的详细信息。

本文的示例命令适用于 Istio 1.0+，无论你有没有启用[双向 TLS 认证](https://preliminary.istio.io/zh/docs/concepts/security/#%E5%8F%8C%E5%90%91-tls-%E8%AE%A4%E8%AF%81)。Bookinfo 配置文件位于 Istio 发行存档的 `samples/bookinfo` 目录中。

以下是原始版本的 Bookinfo 示例应用程序中应用程序端到端架构的副本。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/withistio.svg)

<center><p id=small>原 Bookinfo 应用程序</p></center>

首先按照[部署应用程序](https://preliminary.istio.io/zh/docs/examples/bookinfo/#%E9%83%A8%E7%BD%B2%E5%BA%94%E7%94%A8)、[确认应用正在运行](https://preliminary.istio.io/zh/docs/examples/bookinfo/#%E7%A1%AE%E8%AE%A4%E5%BA%94%E7%94%A8%E5%9C%A8%E8%BF%90%E8%A1%8C%E4%B8%AD)，以及[应用默认目标规则](https://preliminary.istio.io/zh/docs/examples/bookinfo/#%E5%BA%94%E7%94%A8%E7%BC%BA%E7%9C%81%E7%9B%AE%E6%A0%87%E8%A7%84%E5%88%99)中的步骤进行操作。

## Bookinfo 使用 HTTPS 访问 Google 图书 Web 服务

让我们添加一个新的 `v2` 版本的 details 微服务，用来从 [Google Books APIs](https://developers.google.com/books/docs/v1/getting_started) 中获取图书详细信息。执行下面的命令将新版本的 details 服务所在的容器的环境变量 `DO_NOT_ENCRYPT` 设置为 `false`，表示使用 HTTPS（而不是 HTTP ）来访问外部服务。

```bash
$ kubectl apply -f samples/bookinfo/platform/kube/bookinfo-details-v2.yaml --dry-run -o yaml | kubectl set env --local -f - 'DO_NOT_ENCRYPT=false' -o yaml | kubectl apply -f -
```

更新后的架构如下所示：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/bookinfo-details-v2.svg)

<center><p id=small>details V2 版本的 Bookinfo 应用程序</p></center>

> 请注意，Google Book 服务位于 Istio 服务网格之外，其边界由虚线标记。

将指向 details 微服务的所有流量重定向到 `details v2`：

```bash
$ kubectl apply -f samples/bookinfo/networking/virtual-service-details-v2.yaml
```

> 请注意，此处的 `VirtualService` 依赖于您在[应用默认目标规则](https://preliminary.istio.io/zh/docs/examples/bookinfo/#%E5%BA%94%E7%94%A8%E7%BC%BA%E7%9C%81%E7%9B%AE%E6%A0%87%E8%A7%84%E5%88%99)部分中创建的目标规则。

在[确定 ingress 的 IP 和端口](https://preliminary.istio.io/zh/docs/examples/bookinfo/#%E7%A1%AE%E5%AE%9A-ingress-%E7%9A%84-ip-%E5%92%8C%E7%AB%AF%E5%8F%A3)之后， 就可以访问应用程序的 web 页面了。

糟糕…页面显示的是 `Error fetching product details`，而不是书籍详细信息：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/zr3sFd.jpg)

<center><p id=small>获取产品详细信息的错误消息</p></center>

好消息是应用程序没有崩溃, 我们通过良好的微服务设计，没有让**故障扩散**。调用 details 服务失败并不会导致无法访问 `productpage` 服务，并且 productpage 的绝大多数功能仍然可用，它通过优雅降级来让评论和评级能够正确显示。

那么问题到底出在哪里呢？啊……原来是我忘了启用从网格内部访问外部服务的流量，在本例中外部服务指的是 Google Book Web 服务。默认情况下，Istio sidecar 代理（[Envoy proxies](https://www.envoyproxy.io/)） 阻止到集群外服务的所有流量，要启用此类流量，我们必须先定义 [mesh-external service entry](https://preliminary.istio.io/zh/docs/reference/config/istio.networking.v1alpha3/#ServiceEntry)。

### 启用对 Google 图书 Web 服务的 HTTPS 访问

别担心，创建一个 **mesh-external** `ServiceEntry` 就可以修复应用程序的访问错误啦，同时还需要定义一个 `VirtualService` 以使用 [SNI](https://en.wikipedia.org/wiki/Server_Name_Indication) 对外部服务进行路由。

```yaml
$ kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: ServiceEntry
metadata:
  name: googleapis
spec:
  hosts:
  - www.googleapis.com
  ports:
  - number: 443
    name: https
    protocol: HTTPS
  location: MESH_EXTERNAL
  resolution: DNS
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: googleapis
spec:
  hosts:
  - www.googleapis.com
  tls:
  - match:
    - port: 443
      sni_hosts:
      - www.googleapis.com
    route:
    - destination:
        host: www.googleapis.com
        port:
          number: 443
      weight: 100
EOF
```

现在再次访问应用程序的网页就会显示书籍的详细信息了：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/09YjRJ.jpg)

<center><p id=small>正确显示书籍详细信息</p></center>

查看创建的 `ServiceEntry`：

```bash
$ kubectl get serviceentries

NAME         AGE
googleapis   8m
```

删除该 `ServiceEntry`：

```bash
$ kubectl delete serviceentry googleapis

serviceentry "googleapis" deleted
```

删除 `ServiceEntry` 后访再问 Web 页面会产生我们之前遇到的相同错误，即 `Error fetching product details`。因为 `ServiceEntry` 和其他 Istio 的配置一样是**动态定义**的，Istio operators 可以在不重新部署微服务的情况下动态决定允许哪些微服务访问哪些域名，也可以动态启用和禁用外部服务的流量。

### 清除对 Google 图书 Web 服务的 HTTPS 访问权限

```bash
$ kubectl delete serviceentry googleapis
$ kubectl delete virtualservice googleapis
$ kubectl delete -f samples/bookinfo/networking/virtual-service-details-v2.yaml
$ kubectl delete -f samples/bookinfo/platform/kube/bookinfo-details-v2.yaml
```

## 由 Istio 发起的 TLS

假设你想监控你的你的微服务使用哪些特定的 [Google API](https://developers.google.com/apis-explorer/)（[书籍](https://developers.google.com/books/docs/v1/getting_started)，[日历](https://developers.google.com/calendar/)，[任务](https://developers.google.com/tasks/)等）；假设你要强制执行仅允许使用 [Books API](https://developers.google.com/books/docs/v1/getting_started) 的策略；假设你要监控被微服务访问的书籍标识符。对于这些监控和策略任务，你需要知道确切的 URL 路径。例如考虑这样一个 URL：`www.googleapis.com/books/v1/volumes?q=isbn:0486424618`，在该 URL 中，[Books API](https://developers.google.com/books/docs/v1/getting_started) 由路径 `/books` 和路径 `/volumes?q=isbn:0486424618` 的 [ISBN](https://en.wikipedia.org/wiki/International_Standard_Book_Number) 编号指定。但在 `HTTPS` 中，所有 HTTP 详细信息（主机名，路径，头文件等）都是加密的，sidecar 代理的这种监控和策略执行是无法实现的，Istio 只能通过 [SNI](https://tools.ietf.org/html/rfc3546#section-3.1)（`Server Name Indication`）得知加密请求中的主机名称，在这里就是 `www.googleapis.com`。

为了让 Istio 能够根据 HTTP 详细信息对出口请求进行监控和过滤，微服务必须发出 HTTP 请求，然后 Istio 再打开到目标的 HTTPS 连接（执行 TLS 发起）。微服务的代码编写方式和配置方式需要根据该微服务运行在 Istio 服务网格内部还是外部来进行调整，虽然这与 Istio 的[最大化透明度](https://preliminary.istio.io/zh/docs/concepts/what-is-istio/#%E8%AE%BE%E8%AE%A1%E7%9B%AE%E6%A0%87)设计目标相矛盾, 但有时我们需要妥协……

下图显示了通过 HTTPS 协议将流量发送到外部服务的两种方式。上面这幅图中，微服务自己发送常规的端到端加密 HTTPS 请求。下图中微服务在同一个 Pod 内发送未加密的 HTTP 请求，这些请求被 sidecar Envoy 代理拦截，sidecar 代理执行 TLS 发起，因此 pod 和外部服务之间的流量被加密。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/https_from_the_app.svg)

<center><p id=small>对外发起 HTTPS 流量的两种方式：微服务自行发起，或由 Sidecar 代理发起</p></center>

以下代码展示了如何在 [Bookinfo 的 details 微服务代码](https://raw.githubusercontent.com/istio/istio/master/samples/bookinfo/src/details/details.rb) 中使用 Ruby [net/http](https://docs.ruby-lang.org/en/2.0.0/Net/HTTP.html) 模块：

```ruby
uri = URI.parse('https://www.googleapis.com/books/v1/volumes?q=isbn:' + isbn)
http = Net::HTTP.new(uri.host, uri.port)
...
unless ENV['DO_NOT_ENCRYPT'] === 'true' then
     http.use_ssl = true
end
```

请注意，默认的 HTTPS 端口 `443` 的取值是 `URI.parse` 通过对 URI (`https://`) 的解析得来的。当定义了 `DO_NOT_ENCRYPT` 环境变量时，请求将通过普通的 HTTP 协议发出。

你可以在 [details v2 的 deployment 配置文件](https://raw.githubusercontent.com/istio/istio/master/samples/bookinfo/platform/kube/bookinfo-details-v2.yaml)的 `container` 配置项中将环境变量 `DO_NOT_ENCRYPT` 的值设置为 “true”。

```yaml
env:
- name: DO_NOT_ENCRYPT
  value: "true"
```

下一节将会配置 TLS 发起以访问外部 Web 服务。

### 配置 Bookinfo 到 Google 图书 Web 服务之间的 TLS 发起

<span id=blue>1.</span> 部署 details v2 版本，将 HTTP 请求发送到 [Google Books API](https://developers.google.com/books/docs/v1/getting_started)。 在 [bookinfo-details-v2.yaml](https://raw.githubusercontent.com/istio/istio/master/samples/bookinfo/platform/kube/bookinfo-details-v2.yaml) 中， 将 `DO_NOT_ENCRYPT` 变量设置为 true。

```bash
$ kubectl apply -f samples/bookinfo/platform/kube/bookinfo-details-v2.yaml
```

<span id=blue>2.</span> 将指向 details 微服务的流量重定向到 details v2。

```bash
$ kubectl apply -f samples/bookinfo/networking/virtual-service-details-v2.yaml
```

<span id=blue>3.</span> 为 `www.google.apis` 创建一个 mesh-external `ServiceEntry`，再创建一个 `DestinationRule` 用于执行 TLS 发起。 

```yaml
$ kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: ServiceEntry
metadata:
  name: googleapis
spec:
  hosts:
  - www.googleapis.com
  ports:
  - number: 443
    name: http-port-for-tls-origination
    protocol: HTTP
  resolution: DNS
---
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: originate-tls-for-googleapis
spec:
  host: www.googleapis.com
  trafficPolicy:
    loadBalancer:
      simple: ROUND_ROBIN
    portLevelSettings:
    - port:
        number: 443
      tls:
        mode: SIMPLE # initiates HTTPS when accessing edition.cnn.com
EOF
```

{{< alert >}}
注意，端口 <code>443</code> 的名称以 <code>http-</code> 为前缀，使用的协议是 <code>HTTP</code>，你不需要在 Bookinfo 使用 443 端口发送 HTTP 请求时执行 TLS 发起。关于如何使用端口重定向来执行 TLS 发起可以参考<a href="https://preliminary.istio.io/docs/examples/advanced-gateways/egress-tls-origination/" target="_blank">这篇文章</a>。 
{{< /alert >}}

<span id=blue>4.</span> 访问应用程序的 Web 页面，并验证是否能显示图书的详细信息。

<span id=blue>5.</span> 检查 `details v2` 的 sidecar 代理的日志，并查看 HTTP 请求。

```bash
$ kubectl logs $(kubectl get pods -l app=details -l version=v2 -o jsonpath='{.items[0].metadata.name}') istio-proxy | grep googleapis

[2018-08-09T11:32:58.171Z] "GET /books/v1/volumes?q=isbn:0486424618 HTTP/1.1" 200 - 0 1050 264 264 "-" "Ruby" "b993bae7-4288-9241-81a5-4cde93b2e3a6" "www.googleapis.com:443" "172.217.20.74:443"
EOF
```

> 日志中的 URL 路径可以被监控，也可以根据该路径来应用访问策略。要了解有关HTTP 出口流量的监控和访问策略的更多信息，请查看 [归档博客之出口流量监控之日志](https://archive.istio.io/v0.8/blog/2018/egress-monitoring-access-control/#logging)。

### 清除 Bookinfo 到 Google 图书 Web 服务之间的 TLS 发起

```bash
$ kubectl delete serviceentry googleapis
$ kubectl delete destinationrule originate-tls-for-googleapis
$ kubectl delete -f samples/bookinfo/networking/virtual-service-details-v2.yaml
$ kubectl delete -f samples/bookinfo/platform/kube/bookinfo-details-v2.yaml
```

### 与 Istio 双向 TLS 的关系

TLS 发起与 Istio 的[双向 TLS](https://preliminary.istio.io/docs/concepts/security/#mutual-tls-authentication) 无关，无论 Istio 是否开启双向 TLS，对外部服务的 TLS 发起都会起作用。双向 TLS 用来保护网格**内**的服务之间通信，并为每个服务提供强大的身份认证功能。而本文中的**外部服务**是使用单向 TLS 访问的，这种机制用于保护 Web 浏览器和 Web 服务器之间的通信。将 TLS 应用于与外部服务之间的通信，可以对流量加密，并对外部服务器进行身份认证。

## 总结

本文我演示了如何让 Istio 服务网格中的微服务通过 HTTPS 协议和外部的 Web 服务进行通信。默认情况下，Istio 会阻止群集外主机的所有流量，想要访问外部服务，必须得为该服务创建一个 mesh-external `ServiceEntry`。可以通过发出 HTTPS 请求来访问外部服务，也可以只发出 HTTP 请求，然后通过 sidecar 代理执行 TLS 发起来访问外部服务。当微服务发出 HTTPS 请求时，流量是端到端加密的，Istio 无法监控到 HTTP 详细信息，例如请求的 URL 路径。当服务器发出 HTTP 请求时，Istio 就可以监控到 HTTP 详细信息了，并且可以强制执行基于 HTTP 的访问策略。 但此时微服务和 sidecar 代理之间的流量是未加密的，在有严格安全要求的环境中，这种方法还是不够的，你必须通过发出 HTTPS 请求来加密所有的流量。
