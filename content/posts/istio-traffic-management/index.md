---
keywords:
- service mesh
- 服务网格
- istio
- kubernetes
title: "Istio 流量管理"
subtitle: "使用 Istio 实现应用的金丝雀部署"
date: 2018-08-01T20:59:11+08:00
draft: false
author: 米开朗基杨
toc: true
categories: 
- service-mesh
tags:
- Istio
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191203193659.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

Istio 从 0.8 版本开始出现了一个新的 API 组：[networking.istio.io/v1alpha3](http://networking.istio.io/v1alpha3)，应该会替代现有的 [config.istio.io/v1alpha2](http://config.istio.io/v1alpha2) API。新的 API 不管是结构上还是功能上、以及命名上，都有很大差异。如果不作特殊说明，本文所有的示例将采用新版 API。

本文将通过简单的示例来演示通过 Istio 实现应用的金丝雀部署。

{{< alert >}}
正常情况下 istioctl 和 kubectl 都可以用来操作这些对象，但是 kubectl 缺乏验证功能，因此调试阶段使用 <code>istioctl</code> 会更方便一些。
{{< /alert >}}

## Bookinfo 应用介绍

----

以 Bookinfo 应用为示例，它由四个单独的微服务构成，用来演示多种 Istio 特性。这个应用模仿在线书店的一个分类，显示一本书的信息。页面上会显示一本书的描述，书籍的细节（ISBN、页数等），以及关于这本书的一些评论。

Bookinfo 应用分为四个单独的微服务：

+ `productpage` ：`productpage` 微服务会调用 `details` 和 `reviews` 两个微服务，用来生成页面。
+ `details` ：这个微服务包含了书籍的信息。
+ `reviews` ：这个微服务包含了书籍相关的评论。它还会调用 ratings 微服务。
+ `ratings` ：`ratings` 微服务中包含了由书籍评价组成的评级信息。

`reviews` 微服务有 3 个版本：

+ v1 版本不会调用 `ratings` 服务。
+ v2 版本会调用 `ratings` 服务，并使用 1 到 5 个黑色星形图标来显示评分信息。
+ v3 版本会调用 `ratings` 服务，并使用 1 到 5 个红色星形图标来显示评分信息。

下图展示了这个应用的端到端架构。

![Istio 注入之前的 Bookinfo 应用](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/noistio.svg "Istio 注入之前的 Bookinfo 应用")

Bookinfo 是一个异构应用，几个微服务是由不同的语言编写的。这些服务对 Istio 并无依赖，但是构成了一个有代表性的服务网格的例子：它由多个服务、多个语言构成，并且 `reviews` 服务具有多个版本。

## 部署 Bookinfo 应用

----

要在 Istio 中运行这一应用，无需对应用自身做出任何改变。我们只要简单的在 Istio 环境中对服务进行配置和运行，具体一点说就是把 Envoy sidecar 注入到每个服务之中。这个过程所需的具体命令和配置方法由运行时环境决定，而部署结果较为一致，如下图所示：

![Bookinfo 应用](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/withistio.svg "Bookinfo 应用")

所有的微服务都和 Envoy sidecar 集成在一起，被集成服务所有的出入流量都被 sidecar 所劫持，这样就为外部控制准备了所需的 Hook，然后就可以利用 Istio 控制平面为应用提供服务路由、遥测数据收集以及策略实施等功能。

接下来可以根据 Istio 的运行环境，按照下面的讲解完成应用的部署。

1. 进入 Istio 安装目录。
2. 启动应用容器：
   1. 如果集群用的是[手工 Sidecar 注入](https://istio.io/docs/setup/kubernetes/sidecar-injection/#manual-sidecar-injection)，使用如下命令：
 
      ```bash
      $ kubectl apply -f <(istioctl kube-inject -f samples/bookinfo/platform/kube/bookinfo.yaml)
      ```
    
      [istioctl kube-inject](https://istio.io/docs/reference/commands/istioctl/#istioctl-kube-inject) 命令用于在在部署应用之前修改 `bookinfo.yaml`
 
   2. 如果集群使用的是[自动 Sidecar 注入](https://istio.io/docs/setup/kubernetes/sidecar-injection/#automatic-sidecar-injection)，只需简单的 `kubectl` 就能完成服务的部署
      ```bash
      $ kubectl apply -f samples/bookinfo/platform/kube/bookinfo.yaml
      ```
    
      上面的命令会启动全部的四个服务，其中也包括了 `reviews` 服务的三个版本（`v1`、`v2` 以及 `v3`）
  
3. 给应用定义 Ingress gateway：

    ```bash
    $ kubectl apply -f samples/bookinfo/networking/bookinfo-gateway.yaml
    ```
  
4. 确认所有的服务和 Pod 都已经正确的定义和启动：

    ```bash
    $ kubectl get services
  
    NAME          TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)                         AGE
    details       ClusterIP   10.254.86.98     <none>        9080/TCP                        3h
    kubernetes    ClusterIP   10.254.0.1       <none>        443/TCP                         149d
    productpage   ClusterIP   10.254.199.214   <none>        9080/TCP                        3h
    ratings       ClusterIP   10.254.102.147   <none>        9080/TCP                        3h
    reviews       ClusterIP   10.254.249.86    <none>        9080/TCP                        3h
    ```
  
    ```bash
    $ kubectl get pods
  
    NAME                              READY     STATUS    RESTARTS   AGE
    details-v1-6456dbdb9-crqnw        2/2       Running   0          3h
    productpage-v1-6f6887645c-52qhn   2/2       Running   0          3h
    ratings-v1-648cf76d8f-g65s5       2/2       Running   0          3h
    reviews-v1-7dcbc85bb5-j748n       2/2       Running   0          3h
    reviews-v2-65fd78f5df-r8n6r       2/2       Running   0          3h
    reviews-v3-95c85969c-zmpfx        2/2       Running   0          3h
    ```
  
5. 确定 Ingress 的 IP 和端口

    执行以下命令以确定 `ingressgateway` 是否启用了 NodePort 模式。

    ```bash
    $ kubectl -n istio-system get svc istio-ingressgateway

    NAME                   TYPE       CLUSTER-IP      EXTERNAL-IP   PORT(S)                                                                                                     AGE
    istio-ingressgateway   NodePort   10.254.160.93   <none>        80:31380/TCP,443:31390/TCP,31400:31400/TCP,15011:25059/TCP,8060:36612/TCP,15030:25049/TCP,15031:36810/TCP   3h
    ```
  
    确定 ingress IP：
  
    ```bash
    $ export INGRESS_HOST=$(kubectl -n istio-system get po -l istio=ingressgateway -o go-template='{{range .items}}{{.status.hostIP}}{{end}}')
    ```
  
    确定端口：
  
    ```bash
    $ export INGRESS_PORT=$(kubectl -n istio-system get svc istio-ingressgateway -o go-template='{{range .spec.ports}}{{if eq .name "http"}}{{.nodePort}}{{end}}{{end}}')
    ```
  
6. 设置 `GATEWAY_URL`：

     ```bash
     $ export GATEWAY_URL=$INGRESS_HOST:$INGRESS_PORT
     ```
  
下面可以用 `curl` 命令来确认 Bookinfo 应用的运行情况：

```bash
$ curl -o /dev/null -s -w "%{http_code}\n" http://${GATEWAY_URL}/productpage

200
```

还可以用浏览器打开网址 `http://$GATEWAY_URL/productpage`，来浏览应用的 Web 页面。如果刷新几次应用的页面，就会看到页面中会随机展示 `reviews` 服务的不同版本的效果（红色、黑色的星形或者没有显示）。`reviews` 服务出现这种情况是因为我们还没有使用 Istio 来控制版本的路由。

## 金丝雀部署

----

由于 Bookinfo 示例部署了三个版本的 reviews 微服务，因此我们需要设置默认路由。 否则，如果您当多次访问应用程序，您会注意到有时输出包含星级评分，有时又没有。 这是因为没有为应用明确指定缺省路由时，Istio 会将请求随机路由到该服务的所有可用版本上。

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/ServiceModel_Versions.svg)

{{< alert >}}
此任务假定您尚未设置任何路由。 如果您已经为示例应用程序创建了存在冲突的路由规则，则需要在下面的命令中使用 <code>replace</code> 代替 <code>create</code>。 请注意：本文档假设还没有设置任何路由规则。
{{< /alert >}}

首先将所有微服务的默认路由设置为 v1。

```bash
$ istioctl create -f samples/bookinfo/networking/virtual-service-all-v1.yaml
```
```bash
$ istioctl create -f samples/bookinfo/networking/destination-rule-all.yaml
```

可以通过下面的命令来显示已创建的路由规则：

```bash
$ istioctl get virtualservices -o yaml
```
```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: details
  ...
spec:
  hosts:
  - details
  http:
  - route:
    - destination:
        host: details
        subset: v1
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: productpage
  ...
spec:
  gateways:
  - bookinfo-gateway
  - mesh
  hosts:
  - productpage
  http:
  - route:
    - destination:
        host: productpage
        subset: v1
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: ratings
  ...
spec:
  hosts:
  - ratings
  http:
  - route:
    - destination:
        host: ratings
        subset: v1
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: reviews
  ...
spec:
  hosts:
  - reviews
  http:
  - route:
    - destination:
        host: reviews
        subset: v1
---
```

由于路由规则是通过异步方式分发到代理的，因此在尝试访问应用程序之前，您应该等待几秒钟，以便规则传播到所有 pod 上。

现在在浏览器中打开 Bookinfo 应用程序的 URL (`http://$GATEWAY_URL/productpage`)，你应该可以看到 Bookinfo 应用程序的 `productpage` 页面。 请注意， `productpage` 页面显示的内容中没有评分星级，这是因为 `reviews:v1` 服务不会访问 ratings 服务。

由于新的 API 引入了一些新的配置资源，而且不向后兼容，所以很有必要来解释一下上面两个 yaml 文件提到的两个新概念：`VirtualService` 和 `DestinationRule`。

### VirtualService

过去的路由分配比较简单，使用标签即可。新的版本中，提出了 VirtualService 的概念。<span id="inline-blue">VirtualService</span> 由一组路由规则构成，用于对服务实体（在 K8S 中对应为 Pod）进行寻址。一旦有流量符合其中规则的选择条件，就会发送流量给对应的服务（或者服务的一个版本/子集）。

`VirtualService` 描述了一个或多个用户可寻址目标到网格内实际工作负载之间的映射。其中可寻址的目标服务使用 `hosts` 字段来指定，而网格内的实际工作负载由每个 `route` 配置项中的 `destination` 字段指定。在上面的示例中，这两个地址是相同的，但实际上用户可寻址目标可以是任何用于定位服务的、具有可选通配符前缀或 CIDR 前缀的 DNS 名称。 

流量的特征除了请求数据之外，还包括流量的来源，这样就能根据一些上下文来进行灵活的定义了。

例如，以下规则定义来自打了标签 `app=sleep` 的 Pod 对 php-server 的请求，都转向 v1：

```yaml
apiVersion: networking.istio.io/v1alpha3

kind: VirtualService

metadata:

  name: sleep-server-route

spec:

  hosts:

  - "php-server"

  http:

  - match:

    - sourceLabels:

        app: sleep

    route:

    - destination:

        name: php-server

        subset: v1

  - route:

    - destination:

        name: php-server

        subset: v2
```

> 这里的匹配策略是具有从上到下的优先级的，也就是说，最下一条就是缺省路由。所以没有打标签 app=sleep 的 Pod 对 php-server 的请求，都转向 v2。



而本文的 Bookinfo 示例中创建的路由规则表示：

+ 所有对 details 的请求，都转向 details 的 v1 版本。
+ 所有对 productpage 的请求，都转向 productpage 的 v1 版本。
+ 所有对 ratings 的请求，都转向 ratings 的 v1 版本。
+ 所有对 reviews 的请求，都转向 reviews 的 v1 版本。

可以看到，`match` 中不再包含 `source`，这里使用标签来过滤。写完应用之后，我们再次访问 Bookinfo 应用程序的 URL (`http://$GATEWAY_URL/productpage`)，会发现并没有生效。这是因为，**在 v3 版本的 API 中，目标规则不再是透明了**，路由定义必须以目标策略为基础。

### DestinationRule

因此这里需要定义一个 <span id="inline-blue">DestinationRule</span> 对象，来满足上面的目标需求：

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: productpage
spec:
  host: productpage
  subsets:
  - name: v1
    labels:
      version: v1
---
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: reviews
spec:
  host: reviews
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
  - name: v3
    labels:
      version: v3
---
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: ratings
spec:
  host: ratings
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
  - name: v2-mysql
    labels:
      version: v2-mysql
  - name: v2-mysql-vm
    labels:
      version: v2-mysql-vm
---
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: details
spec:
  host: details
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
---
```

DestinationRule 用于配置在将流量转发到服务时应用的策略集。这些策略应由服务提供者撰写，用于描述断路器、负载均衡、TLS 设置等。

+ DestinationRule 的 `host` 可以包含通配符前缀，以允许单个规则应用于多个服务。
+ DestinationRule 定义了目的 host 的子集 `subsets` （例如：命名版本）。 这些 subset 用于 `VirtualService` 的路由规则设置中，可以将流量导向服务的某些特定版本。通过这种方式为版本命名后，可以在不同的虚拟服务中明确地引用这些命名版本的 subset，简化 Istio 代理发出的统计数据，并可以将 subsets 编码到 SNI 头中。

现在再次访问 Bookinfo 应用程序的 URL (`http://$GATEWAY_URL/productpage`)，会发现规则已经生效了。

### 示例一：将 10% 请求发送到 v2 版本而其余 90% 发送到 v1 版本

```yaml
$ cat <<EOF | istioctl replace -f -
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
  - route:
    - destination:
        host: reviews
        subset: v1
      weight: 90
    - destination:
        host: reviews
        subset: v2
      weight: 10
EOF
```

现在的规则就是刷新 productpage 页面，90% 的概率看到黑色星标的评论，10%的概率看不到星标。

**注意 :** 因为使用Envoy sidecar的实现，你需要刷新页面很多次才能看到接近规则配置的概率分布。

### 示例二：将 jason 用户的请求全部发到 v2 版本

```yaml
cat <<EOF | istioctl replace -f -
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
  - match:
    - headers:
        end-user:
          exact: jason
    route:
    - destination:
        host: reviews
        subset: v2
  - route:
    - destination:
        host: reviews
        subset: v1
EOF
```

使用 `jason` 用户登陆 productpage 页面，你可以看到每个刷新页面时，页面上都有一个1到5颗星的评级。如果你使用其他用户登陆的话，将因继续使用 `reviews:v1` 而看不到星标评分。

### 示例三：全部切换到 v3 版本

```yaml
cat <<EOF | istioctl replace -f -
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
  - reviews
  http:
  - route:
    - destination:
        host: reviews
        subset: v3
EOF
```

现在不论你使用什么用户登陆 productpage 页面，你都可以看到带红色星标评分的评论了。

## 参考

----

+ [摸索：Istio 路由规则 Alpha v3](https://blog.fleeto.us/post/istio-route-alpha1v3/)
+ [配置请求路由](https://istio.io/zh/docs/tasks/traffic-management/request-routing/)


