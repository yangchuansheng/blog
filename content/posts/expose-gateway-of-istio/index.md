---
keywords:
- service mesh
- 服务网格
- istio
- gateway
title: "暴露 Istio Service Mesh 中的 Gateway"
subtitle: "使用 Envoy 作为 Ingress Gateway 的前端代理"
date: 2018-09-17T13:14:55+08:00
draft: false
author: 米开朗基杨
toc: true
categories: 
- service-mesh
tags:
- Istio
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191203163009.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

在之前的文章 [Istio 服务网格中的网关](/posts/istio-ingress/) 中，我已经介绍了简单的暴露 `Ingress Gateway` 的方案。当时的方案只是用于临时测试，不适合在大规模场景下使用，本文将探讨更加优化的暴露 Ingress Gateway 的方案。

## HostNetwork

----

第一种方法比较简单，可以直接使用 `HostNetwork` 模式运行 Ingress Gateway。但你会发现无法启动 ingressgateway 的 Pod，因为如果 Pod 设置了 `HostNetwork=true`，则 dnsPolicy 就会从 `ClusterFirst` 被强制转换成 `Default`。而 Ingress Gateway 启动过程中需要通过 DNS 域名连接 `pilot` 等其他组件，所以无法启动。

我们可以通过强制将 `dnsPolicy` 的值设置为 `ClusterFirstWithHostNet` 来解决这个问题，详情参考：[Kubernetes DNS 高阶指南](/posts/kubernetes-dns/)。

修改后的 ingressgateway deployment 配置文件如下：

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
    metadata:
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
      ...
      dnsPolicy: ClusterFirstWithHostNet
      hostNetwork: true
      restartPolicy: Always
      ...
```

接下来我们就可以在浏览器中通过 Gateway 的 URL 来访问服务网格中的服务了。

但是作为服务网格的流量接入层，Ingress Gateway 的高可靠性显得尤为重要，高可靠性首先要解决的就是单点故障问题，一般常用的是采用多副本部署的方式。而上述方案只适用于单实例（Deployment 的副本数为 1）的情况，为了适应多节点部署架构，需要寻求更好的暴露方案。

## 使用 Envoy 作为前端代理

----

我们已经知道，Ingress Gateway 实际上内部运行的是 `Envoy` 代理，我们可以在 Ingress Gateway 前面再加一层代理，这样就解决了高可用问题，你可以将 Ingress Gateway 的副本数扩展为多个，前端代理只需要通过 `Service Name` 来连接后端的 Gateway 就行了。同时建议采用独占节点的方式部署前端代理，以避免业务应用与前端代理服务发生资源争抢。

前端代理可以使用一般的负载均衡软件（如 `Haproxy`、`Nginx` 等），也可以使用 `Envoy`。由于 Envoy 是 Istio Service Mesh 中默认的 data plane，所以这里推荐使用 Envoy。

[Envoy 官方](https://github.com/envoyproxy/envoy)提供了一组 Envoy 的用例，我们只需要用到其中的 `Dockerfile`。首先克隆 Envoy 的代码仓库并转到 `examples/front-proxy` 目录：

```bash
$ git clone https://github.com/envoyproxy/envoy
$ cd envoy/examples/front-proxy
```

修改 `front-envoy.yaml` 配置文件，修改后的内容如下：

```yaml
static_resources:
  listeners:
  - address:
      socket_address:
        address: 0.0.0.0
        port_value: 80
    filter_chains:
    - filters:
      - name: envoy.tcp_proxy  ①
        config:
          stat_prefix: ingress_tcp
          cluster: ingressgateway
          access_log:
            - name: envoy.file_access_log
              config:
                path: /dev/stdout
  - address:
      socket_address:
        address: 0.0.0.0
        port_value: 443
    filter_chains:
    - filters:
      - name: envoy.tcp_proxy
        config:
          stat_prefix: ingress_tcp
          cluster: ingressgateway_tls
          access_log:
            - name: envoy.file_access_log
              config:
                path: /dev/stdout
  clusters:
  - name: ingressgateway
    connect_timeout: 0.25s
    type: strict_dns
    lb_policy: round_robin
    http2_protocol_options: {}
    hosts:
    - socket_address:
        address: istio-ingressgateway.istio-system  ②
        port_value: 80
  - name: ingressgateway_tls
    connect_timeout: 0.25s
    type: strict_dns
    lb_policy: round_robin
    http2_protocol_options: {}
    hosts:
    - socket_address:
        address: istio-ingressgateway.istio-system
        port_value: 443
admin:
  access_log_path: "/dev/null"
  address:
    socket_address:
      address: 0.0.0.0
      port_value: 8001
```

+ ① <span id="inline-blue">envoy.tcp_proxy</span> 表示要实例化的过滤器的名称。该名称必须与内置支持的过滤器匹配，也就是说，该字段的值不可随意填写，必须使用指定的几个值。这里 `envoy.tcp_proxy` 表示使用 TCP 代理。详情参考：[listener.Filter](https://www.envoyproxy.io/docs/envoy/latest/api-v2/api/v2/listener/listener.proto#listener-filter)
+ ② <span id="inline-blue">istio-ingressgateway.istio-system</span> 表示 Ingress Gateway 在集群内部的 DNS 域名。

其他配置解析请参考：[Envoy 的架构与基本术语](https://jimmysong.io/posts/envoy-archiecture-and-terminology/)

接下来通过 `Dockerfile-frontenvoy` 和 `front-envoy.yaml` 来构建 Docker 镜像，我们来看下该 Dockerfile 的内容。

```Dockerfile
FROM envoyproxy/envoy:latest

RUN apt-get update && apt-get -q install -y \
    curl
CMD /usr/local/bin/envoy -c /etc/front-envoy.yaml --service-cluster front-proxy
```

其中 `/etc/front-envoy.yaml` 是本地的 `front-envoy.yaml` 挂载进去的。在 Kubernetes 中可以通过 `ConfigMap` 来挂载，所以我们还要创建一个 ConfigMap：

```bash
$ kubectl -n istio-system create cm front-envoy --from-file=front-envoy.yaml
```

你可以将构建好的镜像 push 到私有镜像仓库中或者公共仓库中，也可以使用我已经上传好的镜像。

最后我们就可以通过该镜像来部署前端代理了，需要创建一个 `Deployment`，配置文件 `front-envoy-deploy.yaml` 内容如下：

```yaml
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: front-envoy
spec:
  replicas: 1
  template:
    metadata:
      labels:
        app: front-envoy
    spec:
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: kubernetes.io/hostname
                operator: In
                values:
                - 192.168.123.248 # 比如你想调度到这台主机上
      containers:
      - name: front-envoy
        image: yangchuansheng/front-envoy
        ports:
        - containerPort: 80
        volumeMounts:
        - name: front-envoy
          mountPath: /etc/front-envoy.yaml
          subPath: front-envoy.yaml
      hostNetwork: true
      volumes:
        - name: front-envoy
          configMap:
            name: front-envoy
```

你可以将镜像换成你自己的镜像，然后通过该 yaml 文件来部署：

```bash
$ kubectl -n istio-system create -f front-envoy-deploy.yaml
```

接下来我们就可以在浏览器中通过前端代理所在节点的 URL 来访问服务网格中的服务了。

更一般的场景，我们还可以配置前端代理的高可用。对于 Kubernetes 集群以外只暴露一个访问入口，可以使用 `keepalived` 排除单节点问题。具体实现方式与 Ingress 的高可用类似，可以参考 Ingress 的高可用方案。

----

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/wechat.gif)
<center>扫一扫关注微信公众号</center>

