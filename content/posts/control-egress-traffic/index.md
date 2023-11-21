---
title: "控制 Egress 流量"
subtitle: "服务网格内部的 ServiceEntry 配置深度解析以及 Egress 流量的访问策略管理"
date: 2018-08-16T13:40:27+08:00
draft: false
author: 米开朗基杨
toc: true
categories: service-mesh
tags: ["istio", "service mesh", "kubernetes"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191203170514.jpg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

<!--more-->

<p id="div-border-left-red">本文主要内容来自 <a href="https://istio.io/zh/docs/tasks/traffic-management/egress/" target="_blank">Istio 官方文档</a>，并对其进行了大量扩展和补充。</p>

缺省情况下，Istio 服务网格内的 Pod，由于其 iptables 将所有外发流量都透明的转发给了 `Sidecar`，所以这些集群内的服务无法访问集群之外的 URL，而只能处理集群内部的目标。

本文的任务描述了如何将外部服务暴露给 Istio 集群中的客户端。你将会学到如何通过定义 [ServiceEntry](https://istio.io/docs/reference/config/istio.networking.v1alpha3/#ServiceEntry) 来调用外部服务；或者简单的对 Istio 进行配置，要求其直接放行对特定 IP 范围的访问。

## <span id="inline-toc">1.</span> 开始之前

----

+ 根据[安装指南](https://icloudnative.io/posts/istio-1.0-deploy/)的内容，部署 Istio。
+ 启动 [sleep](https://github.com/istio/istio/tree/release-1.0/samples/sleep) 示例应用，我们将会使用这一应用来完成对外部服务的调用过程。 如果启用了 [Sidecar 的自动注入功能](https://istio.io/zh/docs/setup/kubernetes/sidecar-injection/#sidecar-%E7%9A%84%E8%87%AA%E5%8A%A8%E6%B3%A8%E5%85%A5)，运行：

```bash
$ kubectl apply -f samples/sleep/sleep.yaml
```

否则在部署 `sleep` 应用之前，就需要手工注入 Sidecar：

```bash
$ kubectl apply -f <(istioctl kube-inject -f samples/sleep/sleep.yaml)
```

实际上任何可以 `exec` 和 `curl` 的 Pod 都可以用来完成这一任务。

## <span id="inline-toc">2.</span> Istio 中配置外部服务

----

通过配置 Istio `ServiceEntry`，可以从 Istio 集群中访问外部任意的可用服务。这里我们会使用 [httpbin.org](http://httpbin.org/) 以及 [www.baidu.com](https://www.baidu.com/) 进行试验。

### 配置外部服务

<p id="blue">1. 创建一个 <code>ServiceEntry</code> 对象，放行对一个外部 HTTP 服务的访问：</p>

```yaml
$ cat <<EOF | istioctl create -f -
apiVersion: networking.istio.io/v1alpha3
kind: ServiceEntry
metadata:
  name: httpbin-ext
spec:
  hosts:
  - httpbin.org
  ports:
  - number: 80
    name: http
    protocol: HTTP
EOF
```

<p id="blue">2. 另外创建一个 <code>ServiceEntry</code> 对象和一个 <code>VirtualService</code>，放行对一个外部 HTTPS 服务的访问：</p>

```yaml
$ cat <<EOF | istioctl create -f -
apiVersion: networking.istio.io/v1alpha3
kind: ServiceEntry
metadata:
  name: baidu
spec:
  hosts:
  - www.baidu.com
  ports:
  - number: 443
    name: https
    protocol: HTTPS
  resolution: DNS
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: baidu
spec:
  hosts:
  - www.baidu.com
  tls:
  - match:
    - port: 443
      sniHosts:
      - www.baidu.com
    route:
    - destination:
        host: www.baidu.com
        port:
          number: 443
      weight: 100
EOF
```

### 发起对外部服务的访问

使用 `kubectl exec` 命令进入测试 Pod。假设使用的是 sleep 服务，运行如下命令：

```bash
$ export SOURCE_POD=$(kubectl get pod -l app=sleep -o go-template='{{range .items}}{{.metadata.name}}{{end}}')
$ kubectl exec -it $SOURCE_POD -c sleep bash
```

发起一个对外部 HTTP 服务的请求：

```bash
$ curl http://httpbin.org/headers
```

发起一个对外部 HTTPS 服务的请求：

```bash
$ curl https://www.baidu.com
```

### HTTP ServiceEntry 配置深度解析

按照之前的惯例，还是先来解读一下 HTTP 协议的 `ServiceEntry` 映射到 Envoy 配置层面具体是哪些内容，这样才能对 ServiceEntry 有更加深刻的认识。

{{< notice note >}}
创建一个 <code>HTTP</code> 协议的 ServiceEntry（不指定 <code>GateWay</code>） 本质上是在服务网格内的<strong>所有应用的所有 Pod</strong>上创建相应的路由规则和与之对应的 Cluster。指定 GateWay 的 ServiceEntry 遵循的是另一套法则，后面我们再说。
{{< /notice >}}

可以通过 istioctl 来验证一下（以 `httpbin-ext` 为例）：

```bash
# 查看 sleep 的 Pod Name：
$ kubectl get pod -l app=sleep

NAME                     READY     STATUS    RESTARTS   AGE
sleep-5bc866558c-89shb   2/2       Running   0          49m
```

查看路由

```bash
$ istioctl pc routes sleep-5bc866558c-89shb --name 80 -o json
```
```json
[
    {
        "name": "80",
        "virtualHosts": [
            {
                "name": "httpbin.org:80",
                "domains": [
                    "httpbin.org",
                    "httpbin.org:80"
                ],
                "routes": [
                    {
                        "match": {
                            "prefix": "/"
                        },
                        "route": {
                            "cluster": "outbound|80||httpbin.org",
                            "timeout": "0.000s",
                            "maxGrpcTimeout": "0.000s"
                        },
                        "decorator": {
                            "operation": "httpbin.org:80/*"
                        },
...
```

可以看到从 Pod sleep-5bc866558c-89shb 内部对域名 `httpbin.org` 发起的请求通过 HTTP 路由被定向到集群 `outbound|80||httpbin.org`。`outbound` 表示这是出站流量

查看 `Cluster`：

```bash
$ istioctl pc clusters sleep-5bc866558c-89shb --fqdn httpbin.org -o json
```
```json
[
    {
        "name": "outbound|80||httpbin.org",
        "type": "ORIGINAL_DST",
        "connectTimeout": "1.000s",
        "lbPolicy": "ORIGINAL_DST_LB",
        "circuitBreakers": {
            "thresholds": [
                {}
            ]
        }
    }
]
```

+ <span id="inline-blue">type</span> : 服务发现类型。`ORIGINAL_DST` 表示原始目的地类型，大概意思就是：连接进入之前已经被解析为一个特定的目标 IP 地址。这种连接通常是由代理使用 IP table REDIRECT 或者 eBPF 之类的机制转发而来的。完成路由相关的转换之后，代理服务器会将连接转发到该 IP 地址。`httpbin.org` 是外网域名，当然可以解析，所以连接进入之前可以被解析为一个特定的目标 IP 地址。Envoy 服务发现类型的详细解析可以参考：[Service discovery](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/service_discovery#arch-overview-service-discovery-types-original-destination)。`ServiceEntry.Resolution` 字段的解析可以参考：[ServiceEntry.Resolution](https://istio.io/docs/reference/config/istio.networking.v1alpha3/#ServiceEntry-Resolution)。

    这里我简要说明一下，ServiceEntry 的 `resolution` 字段可以取三个不同的值，分别对应 Envoy 中的三种服务发现策略：
  
    + `NONE` : 对应于 Envoy 中的 [ORIGINAL_DST](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/service_discovery#original-destination)。如果不指定 resolution 字段，默认使用这个策略。
    + `STATIC` : 对应于 Envoy 中的 [STATIC](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/service_discovery#static)。表示使用 `endpoints` 中指定的静态 IP 地址作为服务后端。
    + `DNS` : 对应于 Envoy 中的 [STRICT_DNS](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/service_discovery#strict-dns)。表示处理请求时尝试向 DNS 查询 IP 地址。如果没有指定 `endpoints`，并且没有使用通配符，代理服务器会使用 DNS 解析 `hosts` 字段中的地址。如果指定了 `endpoints`，那么指定的地址就会作为目标 IP 地址。

+ <span id="inline-blue">lbPolicy</span> : 负载均衡策略。`ORIGINAL_DST_LB` 表示使用原始目的地的负载均衡策略。具体参考: [Load balancing](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/load_balancing)。

如果你还部署了 `bookinfo` 示例应用，可以通过执行 `istioctl pc routes <productpage_pod_name> --name 80 -o json` 和 `istioctl pc clusters <productpage_pod_name> --fqdn httpbin.org -o json` 来验证一下，你会发现输出的结果和上面一模一样。如果还不放心，可以查看 bookinfo 应用内的所有 Pod，你会得到相同的答案。至此你应该可以理解**在服务网格内的所有应用的所有 Pod上创建相应的路由规则和与之对应的 Cluster**这句话的含义了。

### HTTPS ServiceEntry 配置深度解析

`HTTPS` 协议的 ServiceEntry 与 Envoy 配置文件的映射关系与 HTTP 协议有所不同。

{{< notice note >}}
创建一个 <code>HTTPS</code> 协议的 ServiceEntry（不指定 <code>GateWay</code>） 本质上是在服务网格内的<strong>所有应用的所有 Pod</strong>上创建相应的<strong>监听器</strong>和与之对应的 Cluster。指定 GateWay 的 ServiceEntry 我会另行发文详说。
{{< /notice >}}

可以通过 istioctl 来验证（以 `baidu` 为例）。为了更精确地分析该 ServiceEntry，可以先把 `VirtualService` 删除：

```bash
$ istioctl delete virtualservice baidu
```

查看监听器：

```bash
$ istioctl pc listeners sleep-5bc866558c-89shb --address 0.0.0.0 --port 443 -o json
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
                    ...
                    {
                        "name": "envoy.tcp_proxy",
                        "config": {
                            "cluster": "outbound|443||www.baidu.com",
                            "stat_prefix": "outbound|443||www.baidu.com"
                        }
                    }
...
```

+ <span id="inline-blue">name</span> : 监听器过滤器的名称。该字段的值必须与 Envoy 所支持的过滤器匹配，不可随意填写，具体参考：[listener.Filter](https://www.envoyproxy.io/docs/envoy/latest/api-v2/api/v2/listener/listener.proto#listener-filter)。此处 `envoy.tcp_proxy` 表示使用 TCP 代理，而 TCP 代理是无法基于路由过滤的，所以这里不会创建路由规则，而是直接将请求转到 `Cluster`。

查看 Cluster：

```bash
$ istioctl pc clusters sleep-5bc866558c-89shb --fqdn www.baidu.com -o json
```
```json
[
    {
        "name": "outbound|443||www.baidu.com",
        "type": "STRICT_DNS",
        "connectTimeout": "1.000s",
        "hosts": [
            {
                "socketAddress": {
                    "address": "www.baidu.com",
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

从监听器的配置来看，由于绑定的是 `0.0.0.0`，而且也没有指定域名，看起来应该可以访问集群外任何 443 端口的服务。实际上这是行不通的，因为当请求通过监听器转到 Cluster 之后，由于 Cluster 采用的是严格的 DNS 服务发现策略，只要域名不是 `www.baidu.com`，都不会解析。你可以使用 kubectl exec 命令进入 sleep Pod 来测试一下：

```bash
$ kubectl exec -it $SOURCE_POD -c sleep bash
```

发起对外部 HTTPS 服务的请求：

```bash
$ curl https://www.163.com
curl: (51) SSL: no alternative certificate subject name matches target host name 'www.163.com'

$ curl https://www.taobao.com
curl: (51) SSL: no alternative certificate subject name matches target host name 'www.taobao.com'

$ curl https://192.192.192.192
curl: (51) SSL: certificate subject name 'baidu.com' does not match target host name '192.192.192.192'
```

而如果你将服务发现策略改为 `NONE`，就会发现除了可以访问 `www.baidu.com`，还可以访问 `www.163.com` 和 `www.taobao.com` 等其他 https 协议的网站，至于为什么会这样，前面介绍服务发现策略的时候我已经详细解释过了。

### TLS VirtualService 配置深度解析

关于 VirtualService 的解析之前的文章已有相关说明，不过这里的 VirtualService 与之前遇到的不同，涉及到了 `TLSRoute`。

+ <span id="inline-blue">tls</span> : 透传 TLS 和 HTTPS 流量。TLS 路由通常应用在 `https-`、`tls-` 前缀的平台服务端口，或者经 `Gateway` 透传的 HTTPS、TLS 协议 端口，以及使用 HTTPS 或者 TLS 协议的 `ServiceEntry` 端口上。具体参考：[TLSRoute](https://istio.io/docs/reference/config/istio.networking.v1alpha3/#TLSRoute)。
  + <span id="inline-blue">sniHosts</span> : 必要字段。要匹配的 SNI（服务器名称指示）。可以在 SNI 匹配值中使用通配符。比如 `*.com` 可以同时匹配 `foo.example.com` 和 `example.com`。
+ <span id="inline-blue">route</span> : 流量的转发目标。目前 TLS 服务只允许一个转发目标(所以权重必须设置为 100)。当 Envoy 支持 TCP 权重路由之后，这里就可以使用多个目标了。

查看映射到 Envoy 中的配置：

```bash
$ istioctl pc listeners sleep-5bc866558c-89shb --address 0.0.0.0 --port 443 -o json
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
                "filterChainMatch": {
                    "serverNames": [
                        "www.baidu.com"
                    ]
                },
                "filters": [
                    ...
                    {
                        "name": "envoy.tcp_proxy",
                        "config": {
                            "cluster": "outbound|443||www.baidu.com",
                            "stat_prefix": "outbound|443||www.baidu.com"
                        }
                    }
...
```

+ <span id="inline-blue">filterChainMatch</span> : 用于为**监听器过滤器链**指定匹配条件，具体参考：[listener.FilterChainMatch](https://www.envoyproxy.io/docs/envoy/latest/api-v2/api/v2/listener/listener.proto#listener-filterchainmatch)。

> 最后我们来思考一下：既然不创建 TLS VirtualService 也可以访问 `www.baidu.com`，那么创建 TLS VirtualService 和不创建 TLS VirtualService 有什么区别呢？正确答案是：没有关联 `VirtualService` 的 `https-` 或者 `tls-` 端口流量会被视为透传 `TCP` 流量，而不是透传 TLS 和 HTTPS 流量。

### 为外部服务设置路由规则

通过 `ServiceEntry` 访问外部服务的流量，和网格内流量类似，都可以进行 Istio [路由规则](https://istio.io/zh/docs/concepts/traffic-management/#%E8%A7%84%E5%88%99%E9%85%8D%E7%BD%AE) 的配置。下面我们使用 istioctl 为 httpbin.org 服务设置一个超时规则。

<p id="blue">1. 在测试 Pod 内部，调用 httpbin.org 这一外部服务的 <code>/delay</code> 端点：</p>

```bash
$ kubectl exec -it $SOURCE_POD -c sleep bash
$ time curl -o /dev/null -s -w "%{http_code}\n" http://httpbin.org/delay/5

200

real    0m5.024s
user    0m0.003s
sys     0m0.003s
```

这个请求会在大概五秒钟左右返回一个内容为 `200 (OK)` 的响应。

<p id="blue">2. 退出测试 Pod，使用 <code>istioctl</code> 为 httpbin.org 外部服务的访问设置一个 3 秒钟的超时：</p>

```yaml
cat <<EOF | istioctl create -f -
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: httpbin-ext
spec:
  hosts:
    - httpbin.org
  http:
  - timeout: 3s
    route:
      - destination:
          host: httpbin.org
        weight: 100
EOF
```

<p id="blue">3. 等待几秒钟之后，再次发起 <code>curl</code> 请求：</p>

```bash
$ kubectl exec -it $SOURCE_POD -c sleep bash
$ time curl -o /dev/null -s -w "%{http_code}\n" http://httpbin.org/delay/5

504

real    0m3.149s
user    0m0.004s
sys     0m0.004s
```

这一次会在 3 秒钟之后收到一个内容为 `504 (Gateway Timeout)` 的响应。虽然 httpbin.org 还在等待他的 5 秒钟，Istio 却在 3 秒钟的时候切断了请求。


## <span id="inline-toc">3.</span> 直接调用外部服务

----

如果想要跳过 Istio，直接访问某个 IP 范围内的外部服务，就需要对 Envoy sidecar 进行配置，阻止 Envoy 对外部请求的[劫持](https://istio.io/zh/docs/concepts/traffic-management/#%E6%9C%8D%E5%8A%A1%E4%B9%8B%E9%97%B4%E7%9A%84%E9%80%9A%E8%AE%AF)。可以在 [Helm](https://istio.io/docs/reference/config/installation-options/) 中设置 `global.proxy.includeIPRanges` 变量，然后使用 kubectl apply 命令来更新名为 `istio-sidecar-injector` 的 `Configmap`。在 istio-sidecar-injector 更新之后，global.proxy.includeIPRanges 会在所有未来部署的 Pod 中生效。

使用 `global.proxy.includeIPRanges` 变量的最简单方式就是把内部服务的 IP 地址范围传递给它，这样就在 Sidecar proxy 的重定向列表中排除掉了外部服务的地址了。

内部服务的 IP 范围取决于集群的部署情况。例如你的集群中这一范围是 `10.0.0.1/24`，这个配置中，就应该这样更新 istio-sidecar-injector：

```bash
$ helm template install/kubernetes/helm/istio <安装 Istio 时所使用的参数> --set global.proxy.includeIPRanges="10.0.0.1/24" -x templates/sidecar-injector-configmap.yaml | kubectl apply -f -
```

注意这里应该使用和之前部署 Istio 的时候同样的 Helm 命令，尤其是 --namespace 参数。在安装 Istio 原有命令的基础之上，加入 `--set global.proxy.includeIPRanges="10.0.0.1/24" -x templates/sidecar-injector-configmap.yaml` 即可。

然后和前面一样，重新部署 sleep 应用。更新了 `ConfigMap istio-sidecar-injector` 并且重新部署了 sleep 应用之后，Istio sidecar 就应该只劫持和管理集群内部的请求了。任意的外部请求都会简单的绕过 Sidecar，直接访问目的地址。

```bash
$ export SOURCE_POD=$(kubectl get pod -l app=sleep -o go-template='{{range .items}}{{.metadata.name}}{{end}}')
$ kubectl exec -it $SOURCE_POD -c sleep curl http://httpbin.org/headers
```

## <span id="inline-toc">4.</span> 总结

----

这个任务中，我们使用两种方式从 Istio 服务网格内部来完成对外部服务的调用：

1. 使用 `ServiceEntry` (推荐方式)
2. 配置 Istio sidecar，从它的重定向 IP 表中排除外部服务的 IP 范围

第一种方式（`ServiceEntry`）中，网格内部的服务不论是访问内部还是外部的服务，都可以使用同样的 Istio 服务网格的特性。我们通过为外部服务访问设置超时规则的例子，来证实了这一优势。

第二种方式越过了 Istio sidecar proxy，让服务直接访问到对应的外部地址。然而要进行这种配置，需要了解云供应商特定的知识和配置。

## <span id="inline-toc">5.</span> 清理

----

<span id="blue">1. 删除规则：</span>

```bash
$ istioctl delete serviceentry httpbin-ext baidu
$ istioctl delete virtualservice httpbin-ext baidu
```
   
<span id="blue">2. 停止 sleep 服务：</span>

```bash
$ kubectl delete -f samples/sleep/sleep.yaml
```
