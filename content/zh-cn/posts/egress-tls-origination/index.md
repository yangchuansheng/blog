---
title: "Istio 出口流量的 TLS"
subtitle: "在网格内部直接通过 HTTP 协议访问外部加密服务"
date: 2018-11-16T15:56:49+08:00
draft: false
author: 米开朗基杨
toc: true
categories: 
- service-mesh
tags:
- Istio
- Kubernetes
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/SSL_termination_proxy.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

> 本文主要内容来自 [Istio 官方文档](https://preliminary.istio.io/zh/docs/examples/advanced-gateways/egress-tls-origination/)，并对其进行了大量扩展和补充。

[控制出口流量](https://preliminary.istio.io/zh/docs/tasks/traffic-management/egress/)任务演示了如何从网格内部的应用程序访问 Kubernetes 集群外部的 `HTTP` 和 `HTTPS` 服务, 如该主题中所述，默认情况下，启用了 Istio 的应用程序无法访问集群外的 URL, 要启用外部访问，必须定义外部服务的 [ServiceEntry](https://preliminary.istio.io/docs/reference/config/istio.networking.v1alpha3/#ServiceEntry)，或者在安装时配置为[直接访问外部服务](https://preliminary.istio.io/zh/docs/tasks/traffic-management/egress/#%E7%9B%B4%E6%8E%A5%E8%B0%83%E7%94%A8%E5%A4%96%E9%83%A8%E6%9C%8D%E5%8A%A1)。

本文描述了如何在 Istio 中配置出口流量的 `TLS`。

## 用例

考虑一个对外部站点执行 HTTP 调用的遗留应用程序, 假设运行应用程序的组织收到一个新要求，该要求规定必须加密所有外部流量, 使用 Istio，只需通过配置就可以实现这样的要求，而无需更改应用程序的代码。

在此任务中，如果原始流量为 HTTP，则将 Istio 配置为打开与外部服务的 HTTPS 连接, 应用程序将像以前一样发送未加密的 HTTP 请求，Istio 将加密应用程序的请求。

## 前提条件

+ 按照[安装指南](https://preliminary.istio.io/zh/docs/setup/)中的说明设置 Istio 。
+ 启动 [sleep](https://github.com/istio/istio/tree/master/samples/sleep) 示例，它将作为外部调用的测试源。

如果您已启用[自动注入 sidecar](https://preliminary.istio.io/zh/docs/setup/kubernetes/sidecar-injection/#sidecar-%E7%9A%84%E8%87%AA%E5%8A%A8%E6%B3%A8%E5%85%A5), 请按如下命令部署 `sleep` 应用程序:

```bash
$ kubectl apply -f samples/sleep/sleep.yaml
```

否则，您必须在部署 `sleep` 应用程序之前手动注入 sidecar：

```bash
$ kubectl apply -f <(istioctl kube-inject -f samples/sleep/sleep.yaml)
```

请注意，任何可以 `exec` 和 `curl` 的 pod 都可以执行以下步骤。

+ 创建一个 shell 变量来保存源 pod 的名称，以便将请求发送到外部服务, 如果您使用 [sleep](https://github.com/istio/istio/tree/master/samples/sleep) 示例，请按如下命令运行:

```bash
$ export SOURCE_POD=$(kubectl get pod -l app=sleep -o jsonpath={.items..metadata.name})
```

## 配置 HTTP 和 HTTPS 外部服务

首先，与[控制出口流量](https://preliminary.istio.io/zh/docs/tasks/traffic-management/egress/)任务相同的方式配置对 cnn.com 的访问。 请注意，在 `hosts` 中定义中使用 `*` 通配符：`*.cnn.com` , 使用通配符可以访问 www.cnn.com 以及 edition.cnn.com 。

<p id=blue>1. 创建一个 <code>ServiceEntry</code> 以允许访问外部 HTTP 和 HTTPS 服务：</p>

```yaml
$ kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: ServiceEntry
metadata:
  name: cnn
spec:
  hosts:
  - "*.cnn.com"
  ports:
  - number: 80
    name: http-port
    protocol: HTTP
  - number: 443
    name: https-port
    protocol: HTTPS
  resolution: NONE
```

<p id=blue>2. 向外部 HTTP 服务发出请求：</p>

```bash
$ kubectl exec -it $SOURCE_POD -c sleep -- curl -sL -o /dev/null -D - http://edition.cnn.com/politics

HTTP/1.1 301 Moved Permanently
...
location: https://edition.cnn.com/politics
...

HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
...
Content-Length: 151654
...
```
   
输出应该与上面的类似（一些细节用省略号代替）。
   
注意 curl 的 `-L` 标志，它指示 curl 遵循重定向, 在这种情况下， 服务器返回一个重定向响应（[301 Moved Permanently](https://tools.ietf.org/html/rfc2616#section-10.3.2)）到 `http://edition.cnn.com/politics` 的 HTTP 请求, 重定向响应指示客户端通过 HTTPS 向 `https://edition.cnn.com/politics` 发送附加请求, 对于第二个请求，服务器返回所请求的内容和 `200 OK` 状态代码。

而对于 curl 命令，这种重定向是透明的，这里有两个问题, 第一个问题是冗余的第一个请求，它使获取 `http://edition.cnn.com/politics` 内容的延迟加倍, 第二个问题是 URL 的路径，在这种情况下是 politics ，以明文形式发送, 如果有攻击者嗅探您的应用程序与 cnn.com 之间的通信，则攻击者会知道您的应用程序获取的 cnn.com 的哪些特定主题和文章, 出于隐私原因，您可能希望阻止攻击者披露此类信息。

在下一节中，我们将通过配置 Istio 执行 TLS 来解决这两个问题, 在继续下一部分之前先清理配置：

```bash
$ kubectl delete serviceentry cnn
```

## 出口流量的 TLS

总共需要创建三个资源对象，先定义一个 `ServiceEntry` 以允许网格内部应用程序访问 edition.cnn.com ，然后定义一个 `VirtualService` 来执行请求端口的重定向，最后定义一个 `DestinationRule` 用来执行 TLS 发起。

### ServiceEntry

```yaml
$ kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: ServiceEntry
metadata:
  name: cnn
spec:
  hosts:
  - edition.cnn.com
  ports:
  - number: 80
    name: http-port
    protocol: HTTP
  - number: 443
    name: http-port-for-tls-origination
    protocol: HTTP
  resolution: DNS
EOF
```

与上一节中的 ServiceEntry 不同，这里将端口 433 上的协议改为 `HTTP`，因为客户端将发送 HTTP 请求，而 Istio 将为它们执行 TLS 发起, 此外，在此示例中，必须将解析策略设置为 DNS 才能正确配置 Envoy。

此处 `ServiceEntry` 与 Envoy 配置文件的映射关系可以参考我之前的文章 [控制 Egress 流量](/posts/control-egress-traffic/) 中的 **HTTP ServiceEntry 配置深度解析**这一部分，具体细节不再赘述。

### VirtualService

```yaml
$ kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: rewrite-port-for-edition-cnn-com
spec:
  hosts:
  - edition.cnn.com
  http:
  - match:
      - port: 80
    route:
    - destination:
        host: edition.cnn.com
        port:
          number: 443
EOF
```

通过 **图 1** 可以看出目的地址是 `edition.cnn.com:80` 的流量被路由到了 Cluster `outbound|80||edition.cnn.com`。创建了 VirtualService 之后我们再来看一下这部分的路由：

```bash
$ istioctl pc routes $SOURCE_POD --name 80 -o json
```
```json
...
{
                "name": "edition.cnn.com:80",
                "domains": [
                    "edition.cnn.com",
                    "edition.cnn.com:80"
                ],
                "routes": [
                    {
                        "match": {
                            "prefix": "/"
                        },
                        "route": {
                            "cluster": "outbound|443||edition.cnn.com",
                            "timeout": "0.000s",
                            "maxGrpcTimeout": "0.000s"
                        },
                        "decorator": {
                            "operation": "edition.cnn.com:443/*"
                        },
                        ...
                        ...
```

该 VirtualService 的作用就是将目的地址是 `edition.cnn.com:80` 的流量重新路由到 Cluster `outbound|443||edition.cnn.com`，以此来**实现访问 80 端口重定向到 443 端口的功能**。

请注意 VirtualService 使用特定的主机 edition.cnn.com （没有通配符），因为 Envoy 代理需要确切地知道使用 HTTPS 访问哪个主机。

但此时我们仍然不能访问外部服务，因为 istio 通过 443 端口发起连接的时候，使用的仍然是 `HTTP` 协议，具体可以看 Envoy 的配置文件：

```bash
$ istioctl pc clusters $SOURCE_POD --fqdn edition.cnn.com --port 443 -o json
```
```json
[
    {
        "name": "outbound|443||edition.cnn.com",
        "type": "STRICT_DNS",
        "connectTimeout": "1.000s",
        "hosts": [
            {
                "socketAddress": {
                    "address": "edition.cnn.com",
                    "portValue": 443
                }
            }
        ],
        "circuitBreakers": {
            "thresholds": [
                {}
            ]
        },
        "dnsLookupFamily": "V4_ONLY"
    }
]
```

### DestinationRule

现在只剩下最后一步，我们需要让 istio 在出口流量上执行 TLS 发起，使用 HTTPS 协议来访问外部服务。

```yaml
$ kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: originate-tls-for-edition-cnn-com
spec:
  host: edition.cnn.com
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

再来看一下 Envoy 的 Cluster 配置：

```bash
$ istioctl pc clusters $SOURCE_POD --fqdn edition.cnn.com --port 443 -o json
```
```json
[
    {
        "name": "outbound|443||edition.cnn.com",
        "type": "STRICT_DNS",
        "connectTimeout": "1.000s",
        "hosts": [
            {
                "socketAddress": {
                    "address": "edition.cnn.com",
                    "portValue": 443
                }
            }
        ],
        "circuitBreakers": {
            "thresholds": [
                {}
            ]
        },
        "tlsContext": {
            "commonTlsContext": {}
        },
        "dnsLookupFamily": "V4_ONLY"
    }
]
```

创建 DestinationRule 之后，Cluster 配置项中多了一个 `tlsContext` 字段，该字段用来指定连接到上游群集的 TLS 配置（由于这里是出口流量，所以上游集群在这里指的是外部服务 `edition.cnn.com`）。如果没有添加该字段，则 Envoy 将不会使用 TLS 发起新连接。具体参考：[Envoy 官方文档](https://www.envoyproxy.io/docs/envoy/latest/api-v2/api/v2/cds.proto#cluster)

现在发送 HTTP 请求到 `http://edition.cnn.com/politics` ，如上一节所述：

```bash
$ kubectl exec -it $SOURCE_POD -c sleep -- curl -sL -o /dev/null -D - http://edition.cnn.com/politics

HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
...
Content-Length: 151654
...
```

这次你会直接收到 200 OK 状态码，因为 Istio 为 curl 执行了 TLS 发起，原始 HTTP 请求会被转化为 HTTPS 转发到 `cnn.com`，cnn.com 服务器直接返回内容，无需重定向。这就消除了客户端和服务器之间的双重往返，并且请求被 Istio 在网格中加密，而没有暴露出应用程序获取 cnn.com 的 `politics` 部分这一事实。

请注意，这里使用的命令与上一节中的命令相同，如果你以编程方式访问外部服务的应用程序，配置出口流量的 TLS 之后代码也不需要更改。因此，您可以通过配置 Istio 来获得 TLS 的好处，而无需对代码进行更改。

## 其他安全因素

请注意，应用程序 pod 与本地主机上的 sidecar 之间的流量仍未加密，这意味着如果攻击者能够穿透应用程序所在的节点，他们仍然可以在该节点的本地网络上看到未加密的通信。在某些环境中，可能存在严格的安全要求，即必须加密所有流量，即使在节点的本地网络上也是如此，如果有这么严格的要求，应用程序应该只使用 HTTPS（TLS），此任务中描述的 TLS 是不够的。

另外还需要注意，即使对于应用程序发起的 HTTPS ，虽然所有 HTTP 详细信息（主机名，路径，标头等）都是加密的，但攻击者可以通过检查[服务器名称指示（SNI）](https://en.wikipedia.org/wiki/Server_Name_Indication)得知加密请求中的主机名称，因为在 TLS 握手期间，发送 `SNI` 字段时是不加密的。使用 HTTPS 可防止攻击者了解特定的主题和文章，但这并不能阻止攻击者发现你访问的是 cnn.com。

## 清理

1. 删除创建的 Istio 资源对象：

    ```bash
    $ kubectl delete serviceentry cnn
    $ kubectl delete virtualservice rewrite-port-for-edition-cnn-com
    $ kubectl delete destinationrule originate-tls-for-edition-cnn-com
    ```
   
2. 删除 [sleep](https://github.com/istio/istio/tree/master/samples/sleep) 服务：

    ```bash
    $ kubectl delete -f samples/sleep/sleep.yaml
    ```
