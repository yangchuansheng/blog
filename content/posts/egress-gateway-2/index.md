---
title: "Istio 的高级边缘流量控制（二）"
subtitle: "通过 Egress gateway 发起 TLS 连接"
date: 2018-11-28T18:19:56+08:00
draft: false
author: 米开朗基杨
toc: true
categories: service-mesh
tags: ["istio", "service mesh", "kubernetes"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/istio4567.jpg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

[上一节](https://icloudnative.io/posts/egress-gateway-1/)我演示了如何通过 `Egress Gateway` 引导 Istio 的出口 `HTTP` 流量，但到 443 端口的 `HTTPS` 流量没有通过 Egress Gateway，而是直接转到 `edition.cnn.com` 。[Istio 出口流量的 TLS](https://icloudnative.io/posts/egress-tls-origination/) 演示了如何在网格内部直接通过 HTTP 协议访问外部加密服务。本文尝试将这两者结合起来，先将 HTTP 流量路由到 Egress Gateway，然后直接使用 Egress Gateway 发起 `TLS` 连接。

> 前提条件与[上一篇文章](https://icloudnative.io/posts/egress-gateway-1/#before-you-begin)相同。

## <span id="inline-toc">1.</span> ServiceEntry {#serviceentry}

----

首先需要为 `edition.cnn.com` 定义一个 `ServiceEntry` 以允许网格内服务访问外部服务。

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

该 ServiceEntry 会在服务网格内的所有应用的所有 Pod上创建相应的路由规则和与之对应的 Cluster。具体可以参考：[控制 Egress 流量](https://icloudnative.io/posts/control-egress-traffic/)。

验证 `ServiceEntry` 是否生效。发送 HTTPS 请求到 [http://edition.cnn.com/politics](http://edition.cnn.com/politics)。

```bash
$ kubectl exec -it $SOURCE_POD -c sleep -- curl -sL -o /dev/null -D - http://edition.cnn.com/politics

HTTP/1.1 301 Moved Permanently
...
location: https://edition.cnn.com/politics
...

command terminated with exit code 35
```

如果看到输出结果中包含 `301 Moved Permanently`，说明 `ServiceEntry` 配置正确。退出码 `35` 是由于 Istio 没有执行 TLS。 为了让 Egress gateway 执行 TLS，还要继续执行以下步骤进行配置。

## <span id="inline-toc">2.</span> Gateway {#gateway}

----

为 `edition.cnn.com` 的 `443` 端口创建一个 Egress Gateway（假设没有启用双向 TLS 认证）。

```yaml
$ kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: istio-egressgateway
spec:
  selector:
    istio: egressgateway
  servers:
  - port:
      number: 443
      name: http-port-for-tls-origination
      protocol: HTTP
    hosts:
    - edition.cnn.com
EOF
```

此处 Istio 会将 `Gateway` 翻译成 Egress Gateway 所在的 Pod 的 `Listener`。具体配置如下：

```bash
$ istioctl -n istio-system pc listener istio-egressgateway-f8b6469db-fj6zr -o json
```
```json
[
    {
        "name": "0.0.0.0_443",
        "address": {
            "socketAddress": {
                "address": "0.0.0.0",
                "portValue": 443
            }
        },
        "filterChains": [
            {
                "filters": [
                    {
                        "name": "envoy.http_connection_manager",
                        "config": {
                            ...
                            "rds": {
                                "config_source": {
                                    "ads": {}
                                },
                                "route_config_name": "http.443"
                            },
                            ...
```

可以看到经过该 Listener 的流量被转交给 RDS `http.443`，由于此时我们还没有创建 `VirtualService`，所以 RDS `http.443` 中不会包含任何有意义的路由，它会直接返回 `404` 状态码。

```bash
$ istioctl -n istio-system pc route istio-egressgateway-f8b6469db-fj6zr -o json
```
```json
[
    {
        "name": "http.443",
        "virtualHosts": [
            {
                "name": "blackhole:443",
                "domains": [
                    "*"
                ],
                "routes": [
                    {
                        "match": {
                            "prefix": "/"
                        },
                        "directResponse": {
                            "status": 404
                        },
                        "perFilterConfig": {
                            "mixer": {}
                        }
                    }
                ]
            }
        ],
        "validateClusters": false
    }
]
```

## <span id="inline-toc">3.</span> VirtualService 和 DestinationRule {#virtualservice_and_destinationrule}

----

创建一个 `DestinationRule` 和 `VirtualService` 来引导流量通过 Egress Gateway 与外部服务通信。

```yaml
$ kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: egressgateway-for-cnn
spec:
  host: istio-egressgateway.istio-system.svc.cluster.local
  subsets:
  - name: cnn
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: direct-cnn-through-egress-gateway
spec:
  hosts:
  - edition.cnn.com
  gateways:
  - istio-egressgateway
  - mesh
  http:
  - match:
    - gateways:
      - mesh
      port: 80
    route:
    - destination:
        host: istio-egressgateway.istio-system.svc.cluster.local
        subset: cnn
        port:
          number: 443
      weight: 100
  - match:
    - gateways:
      - istio-egressgateway
      port: 443
    route:
    - destination:
        host: edition.cnn.com
        port:
          number: 443
      weight: 100
EOF
```

这里 VirtualService 会分别为网格内的应用和 Egress Gateway 各创建一条路由，以实现通过 Egress Gateway 访问目的地址 `edition.cnn.com:443`。具体的 Envoy 配置解析与[上一篇文章](https://icloudnative.io/posts/egress-gateway-1/)类似。

但此时我们仍然不能访问外部服务，因为 Egress Gateway 通过 `443` 端口发起连接的时候，使用的仍然是 `HTTP` 协议。所以我们需要让 Egress Gateway 在出口流量上执行 TLS 发起，使用 `HTTPS` 协议来访问外部服务。

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
        mode: SIMPLE # initiates HTTPS for connections to edition.cnn.com
EOF
```

现在所有的配置都已经完成，只要是访问 `edition.cnn.com:80` 的流量都会被 Egress Gateway 路由到 Cluster `outbound|443||edition.cnn.com`，最后将流量转发到服务 `https://edition.cnn.com:443`。

完整的流量转发流程如下图所示：

<div class="gallery">
    <a href="https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/istio-egress-tls1.svg" data-lightbox="image-1" data-title="网格内服务访问 http://edition.cnn.com">
    <img src="https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/istio-egress-tls1.svg">
    </a>
</div>

<center><p id=small>网格内服务访问 http://edition.cnn.com</p></center>

重新发送 HTTP 请求到 [http://edition.cnn.com/politics](http://edition.cnn.com/politics)。

```bash
$ kubectl exec -it $SOURCE_POD -c sleep -- curl -sL -o /dev/null -D - http://edition.cnn.com/politics

HTTP/1.1 200 OK
...
content-length: 150793
...
```

输出应该与 [Istio 出口流量的 TLS](https://icloudnative.io/posts/egress-tls-origination/) 中的输出相同：没有 `301 Moved Permanently` 信息。

{{< notice note >}}
注意，这里我们只将到 80 端口的 <code>HTTP</code> 流量重定向到 Egress Gateway，并通过 Egress Gateway 发起 TLS 连接；到 443 端口的 <code>HTTP</code> 流量仍然直接通过应用的 sidecar 代理发起 TLS 连接。
{{< /notice >}}

## <span id="inline-toc">4.</span> 清理 {#cleanup}

----

删除之前创建的 Istio 配置项：

```bash
$ kubectl delete gateway istio-egressgateway
$ kubectl delete serviceentry cnn
$ kubectl delete virtualservice direct-cnn-through-egress-gateway
$ kubectl delete destinationrule originate-tls-for-edition-cnn-com
$ kubectl delete destinationrule egressgateway-for-cnn
```

## <span id="inline-toc">5.</span> 参考 {#reference}

----

+ [配置 Egress gateway](https://preliminary.istio.io/zh/docs/examples/advanced-gateways/egress-gateway/)
