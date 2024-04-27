---
keywords:
- service mesh
- 服务网格
- istio
- kubernetes
- ingress
title: "Istio 服务网格中的网关"
subtitle: "使用 Istio 控制 Ingress 流量"
date: 2018-08-02T13:29:08+08:00
draft: false
author: 米开朗基杨
toc: true
categories: 
- service-mesh
tags: 
- Istio
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191203192635.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

在一个典型的网格中，通常有一个或多个用于终结外部 TLS 链接，将流量引入网格的负载均衡器（我们称之为 gateway）。 然后流量通过边车网关（sidecar gateway）流经内部服务。 应用程序使用外部服务的情况也很常见（例如访问 Google Maps API），一些情况下，这些外部服务可能被直接调用；但在某些部署中，网格中所有访问外部服务的流量可能被要求强制通过专用的出口网关（Egress gateway）。 下图描绘了网关在网格中的使用情况。

![Istio服务网格中的网关](https://images.icloudnative.io/uPic/gateways.svg "Istio服务网格中的网关")

其中 `Gateway` 是一个独立于平台的抽象，用于对流入专用中间设备的流量进行建模。下图描述了跨多个配置资源的控制流程。

![不同v1alpha3元素之间的关系](https://images.icloudnative.io/uPic/virtualservices-destrules.svg "不同v1alpha3元素之间的关系")

## Gateway 介绍

[Gateway](https://istio.io/docs/reference/config/istio.networking.v1alpha3/#Gateway) 用于为 HTTP / TCP 流量配置负载均衡器，并不管该负载均衡器将在哪里运行。 网格中可以存在任意数量的 Gateway，并且多个不同的 Gateway 实现可以共存。 实际上，通过在配置中指定一组工作负载（Pod）标签，可以将 Gateway 配置绑定到特定的工作负载，从而允许用户通过编写简单的 Gateway Controller 来重用现成的网络设备。

对于入口流量管理，您可能会问： 为什么不直接使用 Kubernetes Ingress API ？ 原因是 Ingress API 无法表达 Istio 的路由需求。 Ingress 试图在不同的 HTTP 代理之间取一个公共的交集，因此只能支持最基本的 HTTP 路由，最终导致需要将代理的其他高级功能放入到注解（annotation）中，而注解的方式在多个代理之间是不兼容的，无法移植。

Istio `Gateway` 通过将 L4-L6 配置与 L7 配置分离的方式克服了 `Ingress` 的这些缺点。 `Gateway` 只用于配置 L4-L6 功能（例如，对外公开的端口，TLS 配置），所有主流的L7代理均以统一的方式实现了这些功能。 然后，通过在 `Gateway` 上绑定 `VirtualService` 的方式，可以使用标准的 Istio 规则来控制进入 `Gateway` 的 HTTP 和 TCP 流量。

例如，下面这个简单的 `Gateway` 配置了一个 Load Balancer，以允许访问 host `bookinfo.com` 的 https 外部流量进入网格中：

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: bookinfo-gateway
spec:
  servers:
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - bookinfo.com
```

要为进入上面的 Gateway 的流量配置相应的路由，必须为同一个 host 定义一个 [VirtualService](/posts/istio-traffic-management/)（参考上一篇博文），并使用配置中的 `gateways` 字段绑定到前面定义的 `Gateway` 上：

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: bookinfo
spec:
  hosts:
    - bookinfo.com
  gateways:
  - bookinfo-gateway # <---- bind to gateway
    http:
  - match:
    - uri:
        prefix: /reviews
    route:
    ...
```

Gateway 可以用于建模边缘代理或纯粹的内部代理，如第一张图所示。 无论在哪个位置，所有网关都可以用相同的方式进行配置和控制。

下面通过一个示例来演示如何配置 Istio 以使用 Istio  Gateway 在服务网格外部公开服务。

## 使用 Istio 网关配置 Ingress

让我们看看如何为 Gateway 在 HTTP 80 端口上配置流量。

1. 创建一个 Istio Gateway

      ```yaml    
      $ cat <<EOF | istioctl create -f -
      apiVersion: networking.istio.io/v1alpha3
      kind: Gateway
      metadata:
        name: httpbin-gateway
      spec:
        selector:
          istio: ingressgateway # use Istio default gateway implementation
        servers:
        - port:
            number: 80
            name: http
            protocol: HTTP
          hosts:
          - "httpbin.example.com"
      EOF    
      ```
      
2. 为通过 Gateway 进入的流量配置路由

      ```yaml
      $ cat <<EOF | istioctl create -f -
      apiVersion: networking.istio.io/v1alpha3
      kind: VirtualService
      metadata:
        name: httpbin
      spec:
        hosts:
        - "httpbin.example.com"
        gateways:
        - httpbin-gateway
        http:
        - match:
          - uri:
              prefix: /status
          - uri:
              prefix: /delay
          route:
          - destination:
              port:
                number: 8000
              host: httpbin
      EOF
      ```
     
      在这里，我们 为服务创建了一个 [VirtualService](https://istio.io/docs/reference/config/istio.networking.v1alpha3/#VirtualService) 配置 `httpbin` ，其中包含两条路由规则，允许路径 `/status` 和 路径的流量 `/delay`。

      该[网关](https://istio.io/docs/reference/config/istio.networking.v1alpha3/#VirtualService-gateways)列表指定，只有通过我们的要求 `httpbin-gateway` 是允许的。所有其他外部请求将被拒绝，并返回 404 响应。
    
      请注意，在此配置中，来自网格中其他服务的内部请求不受这些规则约束，而是简单地默认为循环路由。要将这些（或其他规则）应用于内部调用，我们可以**将特殊值 `mesh` 添加到 `gateways` 的列表中**。
      
3. 使用 curl 访问 httpbin 服务。

    首先获取 Ingress Gateway 的 IP 和 端口，参考上一篇文章：[Istio 流量管理](/posts/istio-traffic-management/)
    
    ```bash
    $ curl -I -HHost:httpbin.example.com http://$INGRESS_HOST:$INGRESS_PORT/status/200
    
    HTTP/1.1 200 OK
    server: envoy
    date: Thu, 02 Aug 2018 04:18:41 GMT
    content-type: text/html; charset=utf-8
    access-control-allow-origin: *
    access-control-allow-credentials: true
    content-length: 0
    x-envoy-upstream-service-time: 9
    ```
    
    请注意，我们使用该 `-H` 标志将 Host `HTTP Header` 设置为 “httpbin.example.com”。这是必需的，因为我们的 ingress `Gateway` 被配置为处理 “httpbin.example.com”，但在我们的测试环境中，我们没有该主机的 DNS 绑定，并且只是将我们的请求发送到 ingress IP。
    
4. 访问任何未明确公开的其他 URL。您应该看到一个 HTTP 404 错误：

    ```bash
    $ curl -I -HHost:httpbin.example.com http://$INGRESS_HOST:$INGRESS_PORT/headers
    
    HTTP/1.1 404 Not Found
    date: Thu, 02 Aug 2018 04:21:39 GMT
    server: envoy
    transfer-encoding: chunked
    ```

## 使用浏览器访问 Ingress 服务

如果你想在浏览器中输入 httpbin 服务的 URL 来访问是行不通的，因为我们没有办法像使用 curl 一样告诉浏览器假装访问 `httpbin.example.com`，只能通过向 `/etc/hosts` 文件中添加 hosts 来解决这个问题。

但是麻烦又来了，目前这种状况下即使你添加了 hosts，也仍然无法访问，因为 Istio Gateway 使用的是 NodePort 模式，暴露出来的不是 80 端口和 443 端口，而我们要想通过域名来访问服务，必须要求 Gateway 暴露出来的端口是 80 和 443。

所以我们只能曲线救国了，通过修改 Ingress Gateway 的 `Deployment`，将 80 端口和 443 端口配置为 `hostPort` 模式，然后再通过 Node 亲和性将 `Gateway` 调度到某个固定的主机上。

```bash
$ kubectl -n istio-system edit deployment istio-ingressgateway
```
```yaml
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: istio-ingressgateway
  namespace: istio-system
  ...
spec:
  ...
  template:
    ...
    spec:
      affinity:
        nodeAffinity:
          ...
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: kubernetes.io/hostname
                operator: In
                values:
                - 192.168.123.248   # 比如你想调度到这台主机上
      containers:
        - name: ISTIO_META_POD_NAME
        ...
          ports:
            - containerPort: 80
              hostPort: 80
              protocol: TCP
            - containerPort: 443
              hostPort: 443
              protocol: TCP
        ...
```

修改完之后保存退出，等待 Gateway 的 Pod 重新调度，然后在你的浏览器所在的本地电脑上添加一条 hosts：

```bash
192.168.123.248 httpbin.example.com
```

重新配置 `VirtualService`：

```yaml
$  cat <<EOF | istioctl replace -f -
 apiVersion: networking.istio.io/v1alpha3
 kind: VirtualService
 metadata:
   name: httpbin
 spec:
   hosts:
   - "httpbin.example.com"
     gateways:
   - httpbin-gateway
     http:
   - match:
     - uri:
         prefix: /status
     - uri:
         prefix: /delay
     - uri:
         prefix: /headers
     route:
     - destination:
         port:
           number: 8000
         host: httpbin
 EOF
```

接下来就可以在浏览器中输入 URL：`http://httpbin.example.com/headers` 来访问服务啦！

![](https://images.icloudnative.io/uPic/aV9pPs.jpg)

## 清理

删除 Gateway、VirtualService 和 httpbin 服务：

```bash
$ istioctl delete gateway httpbin-gateway
$ istioctl delete virtualservice httpbin
$ kubectl delete --ignore-not-found=true -f samples/httpbin/httpbin.yaml
```

## 参考

+ [控制 Ingress 流量](https://istio.io/zh/docs/tasks/traffic-management/ingress/)
+ [Gateway](https://istio.io/zh/docs/concepts/traffic-management/#gateway)

----

![](https://images.icloudnative.io/uPic/wechat.gif)


