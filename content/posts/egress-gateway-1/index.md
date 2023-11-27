---
title: "Istio 的高级边缘流量控制（一）"
subtitle: "通过 Egress Gateway 引导 Istio 的出口 HTTP 流量"
date: 2018-11-26T14:43:51+08:00
draft: false
author: 米开朗基杨
toc: true
categories: 
- service-mesh
tags:
- Istio
- Kubernetes
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/1_TYaxJKWKaw6smCdt5uwpZw.jpeg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

在上一篇文章 [Istio 出口流量的 TLS](/posts/egress-tls-origination/) 中，我演示了如何在网格内部直接通过 HTTP 协议访问外部加密服务，并揭示了其背后 Envoy 的配置逻辑。

本文将会通过 `Egress Gateway` 来引导 Istio 的出口流量，与 [Istio 出口流量的 TLS](/posts/egress-tls-origination/) 任务中描述的功能的相同，唯一的区别就是，这里会使用 `Egress Gateway` 来完成这一任务。

Istio 0.8 引入了 i[ngress 和 Egress gateway](https://preliminary.istio.io/zh/docs/reference/config/istio.networking.v1alpha3/#gateway) 的概念。 Ingress Gateway 允许定义进入服务网格的流量入口，所有入站流量都通过该入口；`Egress Gateway` 与之相对，它定义了网格的流量出口。 Egress Gateway 允许将 Istio  的流量治理功能（例如，监控和路由规则）应用于 Egress 流量。

## 用例

设想一个具有严格安全要求的组织。根据这些要求，服务网格的所有出口流量必须流经一组专用节点。这些节点与运行其他应用的节点分开，通过策略来控制出口流量。相比其他节点而言，对这些专用节点的监控也更加详细。

另一个用例是设想一个集群，它的应用程序所在的节点没有外网 IP，因此在其上运行的网格内服务无法访问外网服务。通过定义 `Egress Gateway`，并将公共 IP 分配给 `Egress Gateway` 节点，然后通过它引导所有出口流量，就可以控制网格内服务访问外网服务了。

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

## 定义 Egress Gateway 来引导 Istio 的出口 HTTP 流量

首先创建一个 `ServiceEntry` 以允许网格内服务访问外部服务。

<span id=blue>1.</span> 为 `edition.cnn.com` 定义一个 `ServiceEntry`：

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
    name: https
    protocol: HTTPS
  resolution: DNS
EOF
```

<span id=blue>2.</span> 验证 `ServiceEntry` 是否生效。发送 HTTPS 请求到 [http://edition.cnn.com/politics](http://edition.cnn.com/politics)。

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

此处的返回结果应该与 [Istio 出口流量的 TLS](/posts/egress-tls-origination/) 中没有配置 TLS 发起的情况下的返回结果相同。

<span id=blue>3.</span> 为 `edition.cnn.com` 的 80 端口创建一个 Egress Gateway（假设没有启用[双向 TLS 认证](https://preliminary.istio.io/zh/docs/tasks/security/mutual-tls/)）。

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
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - edition.cnn.com
EOF
```

此处 Istio 会将 `Gateway` 翻译成 Egress Gateway 所在的 Pod 的 `Listener`。具体配置如下：

```bash
$ istioctl -n istio-system pc listeners istio-egressgateway-f8b6469db-4csb2 -o json
```
```json
[
    {
        "name": "0.0.0.0_80",
        "address": {
            "socketAddress": {
                "address": "0.0.0.0",
                "portValue": 80
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
                                "route_config_name": "http.80"
                            },
                            ...
```

可以看到流量经过该 Listener 之后被转交给 RDS `http.80`，由于此时我们还没有创建 `VirtualService`，所以 RDS `http.80` 中不会包含任何有意义的路由，它会直接返回 `404` 状态码。

```bash
$ istioctl -n istio-system pc route istio-egressgateway-f8b6469db-4csb2 -o json
```
```json
[
    {
        "name": "http.80",
        "virtualHosts": [
            {
                "name": "blackhole:80",
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

此处的 `validateClusters` 用来决定集群管理器是否对路由中指向的 Cluster 进行验证。如果该参数设置为 `true` 且路由指向了不存在的集群，则不会加载该路由；如果该参数设置为 `false` 且路由指向了不存在的集群，则会继续加载该路由，最后找不到路由会返回 404。如果通过静态配置文件 [route_config](https://www.envoyproxy.io/docs/envoy/latest/api-v2/config/filter/network/http_connection_manager/v2/http_connection_manager.proto#envoy-api-field-config-filter-network-http-connection-manager-v2-httpconnectionmanager-route-config) 定义路由，则该选项默认值为 `true`；如果通过 RDS 接口动态加载路由，则该选项默认值为 `false`。

> 如果你启用了双向 TLS 认证，需要加上额外的 TLS 配置，这里我不展开详述，可以参考[官方文档](https://preliminary.istio.io/zh/docs/examples/advanced-gateways/egress-gateway/)。

<span id=blue>4.</span> 创建一个 `DestinationRule` 和 `VirtualService` 来引导流量通过 Egress Gateway 与外部服务通信。

```yaml
$ kubectl apply -f - <<EOF
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
      - mesh    ①
      port: 80
    route:
    - destination:
        host: istio-egressgateway.istio-system.svc.cluster.local
        subset: cnn
        port:
          number: 80
      weight: 100
  - match:
    - gateways:
      - istio-egressgateway    ②
      port: 80
    route:
    - destination:
        host: edition.cnn.com
        port:
          number: 80
      weight: 100
EOF
```

这里其实创建了两条路由，我们一个一个来看：

+ ① : gateway 选择了 `mesh`，表示该路由创建在网格内的应用中：

```bash
$ istioctl pc route sleep-5bc866558c-5nl8k --name 80 -o json|grep "edition.cnn.com" -A 11 -B 1
```
```json
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
                "cluster": "outbound|80|cnn|istio-egressgateway.istio-system.svc.cluster.local",
                "timeout": "0.000s",
                "maxGrpcTimeout": "0.000s"
            },
```

> 如果不指定 gateway，gateway 默认值就是 `mesh`。

**该 VirtualService 的作用就是将目的地址是 `edition.cnn.com:80` 的流量重定向到 `Egress Gateway`。**

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/1543226447622-e17653c5-4dd3-4768-9b8f-cb1f3b0ef6a5.svg)

这里我们将流量打向了 subset 为 `cnn` 的 Cluster，但现在不存在这个 Cluster，所以还需要通过 `DestinationRule` 定义一个 Cluster：

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
EOF
```

查看创建好的 Cluster：

```bash
$ istioctl pc cluster sleep-5bc866558c-5nl8k --fqdn istio-egressgateway.istio-system.svc.cluster.local --subset cnn --port 80 -o json
```
```json
[
    {
        "name": "outbound|80|cnn|istio-egressgateway.istio-system.svc.cluster.local",
        "type": "EDS",
        "edsClusterConfig": {
            "edsConfig": {
                "ads": {}
            },
            "serviceName": "outbound|80|cnn|istio-egressgateway.istio-system.svc.cluster.local"
        },
        "connectTimeout": "1.000s",
        "circuitBreakers": {
            "thresholds": [
                {}
            ]
        },
        "http2ProtocolOptions": {
            "maxConcurrentStreams": 1073741824
        }
    }
]
```

+ ② : gateway 选择了 `istio-egressgateway`，表示该路由创建在 Egress Gateway 中：

```bash
$ istioctl -n istio-system pc route istio-egressgateway-f8b6469db-fj6zr -o json
```
```json
[
    {
        "name": "http.80",
        "virtualHosts": [
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
                            "cluster": "outbound|80||edition.cnn.com",
                            "timeout": "0.000s",
                            "maxGrpcTimeout": "0.000s"
                        },
                        ...
```

**该 VirtualService 的作用是通过 Egress Gateway 访问目的地址 `edition.cnn.com:80`。**这里 Egress Gateway 将流量路由到 Cluster `outbound|80||edition.cnn.com`，最后将流量转发到服务 `edition.cnn.com:80`。完整的流量转发流程如下图所示：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/2023-11-27-11-19-GfJU4t.svg "通过 Egress Gateway 引导 Istio 的出口 HTTP 流量")

<span id=blue>5.</span> 重新发送 HTTP 请求到 [http://edition.cnn.com/politics](http://edition.cnn.com/politics)。

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

输出应与步骤 2 中的输出相同。

<span id=blue>6.</span> 查看 `istio-egressgateway` pod 中与我们的请求相对应的日志。

```bash
$ kubectl logs $(kubectl get pod -l istio=egressgateway -n istio-system -o jsonpath='{.items[0].metadata.name}') istio-proxy -n istio-system | tail
```

你会在输出结果中看到与请求相关的日志：

```bash
[2018-06-14T11:46:23.596Z] "GET /politics HTTP/1.1" 301 - 0 0 3 1 "172.30.146.87" "curl/7.35.0" "ab7be694-e367-94c5-83d1-086eca996dae" "edition.cnn.com" "151.101.193.67:80"
```

> 这里我们只将到 80 端口的 HTTP 流量重定向到 Egress Gateway，到 443 端口的 HTTPS 流量直接转到 `edition.cnn.com` 。

## 清理

删除 Gateway、VirtualService、DestinationRule 和 ServiceEntry。

```bash
$ kubectl delete gateway istio-egressgateway
$ kubectl delete serviceentry cnn
$ kubectl delete virtualservice direct-cnn-through-egress-gateway
$ kubectl delete destinationrule egressgateway-for-cnn
```

## 参考

+ [配置 Egress gateway](https://preliminary.istio.io/zh/docs/examples/advanced-gateways/egress-gateway/)
