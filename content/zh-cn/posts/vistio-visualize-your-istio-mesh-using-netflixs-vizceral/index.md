---
keywords:
- service mesh
- 服务网格
- istio
- kubernetes
- ingress
title: "Vistio—使用 Netflix 的 Vizceral 可视化 Istio service mesh"
subtitle: "Vistio 部署使用教程"
date: 2018-08-03T15:29:37+08:00
draft: false
author: 米开朗基杨
toc: true
categories: 
- service-mesh
tags: 
- Istio
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/QLT35D.jpg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

> 本文转载自 <a href="https://jimmysong.io/posts/vistio-visualize-your-istio-mesh-using-netflixs-vizceral/" target="_blank">Jimmy Song 的博客</a>，并且有很多改动。

[Vizceral](https://github.com/Netflix/vizceral) 是 `Netflix` 发布的一个开源项目，用于近乎实时地监控应用程序和集群之间的网络流量。[Vistio](https://github.com/nmnellis/vistio) 是使用 Vizceral 对 Istio 和网格监控的改进。它利用 `Istio Mixer` 生成的指标，然后将其输入 Prometheus。Vistio 查询 `Prometheus` 并将数据存储在本地以允许重播流量。关于 Vizceral 可以参考这篇文章：[Vizceral Open Source](https://medium.com/netflix-techblog/vizceral-open-source-acc0c32113fe)。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/QLT35D.jpg)

Vizceral 有两个可视化级别，全局可视化和集群级别可视化。在全局范围内（如上所示），您可以通过 Istio Ingress Gateway 等入口点将从 Internet 到 Istio 服务网格网络的网络流量可视化，或者您可以在 Istio 服务网格网络中显示总网络流量。

在集群级别（如下所示），您可以可视化内部网格的流量。通过设置警告和错误级别警报，当应用程序出现问题时可以被快速检测出来。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/81eYoC.jpg)

## 在 Istio 服务网格中安装 Vistio

----

### 依赖

+ Prometheus
+ Istio 1.0

### 假设

以下 Demo 使得这些假设更容易部署。如果您的环境设置不同，则可能需要将代码下载到本地并编辑一些文件。

+ Prometheus 部署在 `istio-system` namespace 下，可以通过 `http://prometheus.istio-system:9090` 地址访问
+ Istio mixer 启用了 `istio_request_count metric`
+ Kubernetes 集群包含有 `standard StorageClass`
+ 为了便于部署已安装了 Helm（可选）

**由于测试环境大多数都没有外部网络存储，无法创建 StorageClass，待会儿我们可以将这部分的配置修改为 `hostPath`。**

### 前言

如果您还尚未部署服务网格，可以按照此 [Istio Bookinfo Demo](https://istio.io/docs/guides/bookinfo/) 中的说明部署 Istio 及其示例应用程序。您需要能够在应用程序之间生成流量。要测试指标是否从 Mixer 正确发送到 Prometheus，您可以打开 Prometheus 查询 `istio_request_bytes_count`，应该会看到多个条目。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/r6foLP.jpg)

## 部署 Vistio

----

您可以选择通过 `kubectl` 或者 `Helm` 来部署 Vistio，下面会主要介绍 Helm 部署方式。有些变量可能需要根据您自己的环境来修改。

如果你想通过 Helm 部署 Vistio，你将需要在 GitHub 上下载项目来获取 Helm 模板。此外，如果上述假设之一不符合您的需求（例如 prometheus url 不同），则应手动编辑文件。

```bash
$ git clone https://github.com/nmnellis/vistio.git
```

### 使用 Helm 部署

由于我们使用的是 Istio 1.0 版本，而 Vistio 已经有相当一段时间没有更新了，很多配置项已经不适用了，需要改动很多地方。

切换到 Vistio 项目的根目录，修改 `values-with-ingress.yaml` 配置文件。

```bash
$ vim helm/vistio/values-with-ingress.yaml
```
```yaml
vistioConfig:
  graphName: Vistio
  globalLevel:
    maxVolume: 2000000
    clusterConnections:
      # Total requests per second coming into the ingress controller from internet
      # 将 istio_request_count 修改为 istio_request_bytes_count
      # 将 destination_service="istio-ingressgateway.istio-system.svc.cluster.local" 修改为 source_workload="istio-ingressgateway"
      - query: sum(rate(istio_request_bytes_count{source_workload="istio-ingressgateway"}[1m])) by (response_code)
        prometheusURL: http://prometheus.istio-system:9090
        ...
  clusterLevel:
    # Cluster name must match 'target' name in global
    - cluster: istio-mesh
      maxVolume: 3000
      serviceConnections:
      # 将 istio_request_count 修改为 istio_request_bytes_count
      # 将 source_service 修改为 source_app
        - query: sum(rate(istio_request_bytes_count[1m])) by (source_app,destination_service,response_code)
          prometheusURL: http://prometheus.istio-system:9090
          source:
            # 将 source_service 修改为 source_app
            label: source_app
            ...
```

修改 `values.yaml` 配置文件。

```bash
$ vim helm/vistio/values.yaml
```
```yaml
...
######################################
## Vistio-web
######################################
web:
  env:
    # Vistio-web 需要调用 Vistio-api 的 url，而且这个 url 必须是通过浏览器可以访问的，所以可以使用 ingress，后面将会创建
    updateURL: "http://vistio-api.istio.io/graph"
```

修改 `statefulset.yaml` 配置文件。

```bash
$ vim helm/vistio/templates/statefulset.yaml
```
```yaml
apiVersion: apps/v1beta1
kind: StatefulSet
metadata:
  name: vistio-api
  ...
spec:
  replicas: {{ .Values.api.replicaCount }}
  serviceName: vistio
  template:
    metadata:
    ...
    spec:
      volumes:
        - name: config
          configMap:
            name: vistio-api-config
        # 添加 volume vistio-db
        - name: vistio-db
          hostPath:
            path: /data/vistio
  # 将 volumeClaimTemplates 配置项注释或删除
  #volumeClaimTemplates:
  #- metadata:
  #    annotations:
  #      volume.beta.kubernetes.io/storage-class: {{ .Values.api.storage.class }}
  #    name: vistio-db
  #  spec:
  #    accessModes:
  #    - ReadWriteOnce
  #    resources:
  #      requests:
  #        storage: {{ .Values.api.storage.size }}
```

**同时你需要在运行 vistio-api 的节点上提前创建 `/data/vistio` 目录。**

运行 `helm install` 部署 Vistio。

```bash
$ helm install helm/vistio -f helm/vistio/values-with-ingress.yaml --name vistio --namespace default
```
```bash
$ kubectl get pod

vistio-api-0                      1/1       Running   0          2m
vistio-web-5c44b7f76d-hmjdc       1/1       Running   0          2m
```

## 验证和暴露 Vistio Web/API

----

### 暴露 Vistio Web/API

为 Service vistio-api 和 vistio-web 创建 `Ingress`：

```yaml
$ cat ingress.yaml

---
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: vistio-web
  namespace: default
spec:
  rules:
  - host: vistio-web.istio.io
    http:
      paths:
      - path: /
        backend:
          serviceName: vistio-web
          servicePort: 8080
---
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: vistio-api
  namespace: default
spec:
  rules:
  - host: vistio-api.istio.io
    http:
      paths:
      - path: /
        backend:
          serviceName: vistio-api
          servicePort: 9091
```
```bash
$ kubectl create -f ingress.yaml
```

然后在你的本地电脑上添加两条 hosts：

```bash
$Ingree_host vistio-web.istio.io
$Ingree_host vistio-api.istio.io
```

将 `$Ingree_host` 替换为 Ingress Controller 运行节点的 IP。

### 验证 visito-api

vistio-web 调用 vistio-api 来渲染服务网格。访问 `http://vistio-api.istio.io/graph` 您应该会看到类似下列的输出。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/mA3qxn.jpg)

### 访问 Vistio

如果一切都已经启动并准备就绪，您就可以访问 Vistio UI，开始探索服务网格网络，访问`http://vistio-web.istio.io` 您将会看到类似下图的输出。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/zO6YHU.jpg)

## 探索

----

在全局范围内，您将看到Istio网格内所有请求的总和，如果你点击 `istio-mesh` 气泡，就能查看你的网状网络。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/vInWWw.jpg)

在你的 Istio 网格中，您可以使用许多可视化工具来帮助您查明故障的应用程序。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/p3Rf9a.jpg)

使用屏幕右上方的过滤器可以快速过滤出错误率较高的应用程序。通过高级配置，当错误率超过特定值时，也可以触发警报。警报将显示给定应用程序的当前错误率趋势。

## 问题排查

----

访问 `http://vistio-api.istio.io/graph`，如果你从 vistio-api 中看到以下输出，表示某些功能无法正常工作。正确的输出显示在教程上面。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/7N7vFf.jpg)

1. 检查 vistio-api 日志中是否有错误——在大多数情况下，vistio-api 将记录与 Prometheus 通信时遇到的任何问题。

    ```bash
    $ kubectl logs -f $(kubectl get pod -l app=vistio-api -o go-template='{{range .items}}{{.metadata.name}}{{end}}') -c vistio-api
    ```
   
2. 验证 Prometheus 查询——vistio-api 使用以下查询检索其数据。您应该确保 Prometheus 内部的数据都存在。

    ```yaml
    # Global Level Query
    sum(rate(istio_request_bytes_count{source_workload="istio-ingressgateway"}[1m])) by (response_code)
    # Cluster Level Query
    sum(rate(istio_request_bytes_count[1m])) by (source_app,destination_service,response_code)
    ```
   
3. 提交 Issue——如果遇到问题无法解决请提交 Issue：[https://github.com/nmnellis/vistio/issues](https://github.com/nmnellis/vistio/issues)

----

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/wechat.gif)

