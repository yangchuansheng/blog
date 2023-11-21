---
keywords:
- WireGuard
- kubernetes
- prometheus
- grafana
- wireguard exporter
title: "WireGuard 教程：使用 Prometheus 监控 WireGuard"
date: 2021-03-11T19:06:37+08:00
lastmod: 2021-03-11T19:06:37+08:00
description: 本文描述了如何使用 kube-prometheus 来监控 WireGuard，并使用 Grafana 来展示仪表盘。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- WireGuard
categories: Network
img: https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210313011349.png
---

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210313181706.png)

云原生是一种信仰，是一种全新的技术模式，它不局限于你脑海中固有的那一亩三分地。人有多大胆，地有多大产，只要你敢想，万物皆可云原生。作为一个云原生狂热信徒，给大家看看我的狂热程度：

我的所有服务（包括博客、镜像加速、评论服务）都部署在云上 `k3s` 集群中，同时本地和家中设备均和云上集群 Pod 网络通过 `WireGuard` 打通，家中网关 DNS 用的是 CoreDNS 对国内外解析进行分流，网关使用 `Envoy` 来代理家中的各种服务，等等。

家中的所有设备和服务，包括云上的服务，全部使用 `kube-prometheus` 进行监控，具体我就不细说了，截几张图给大家看看：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210312141836.webp)

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210312141957.jpg)

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210312142104.webp)

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210312142209.webp)

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210312142221.webp)

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210312143503.webp)

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210312143649.webp)

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210312143710.webp)

现在还剩下个 `WireGuard` 没有监控，下面就来看看如何使用 `Prometheus` 来监控 `WireGuard`。

如果看到这篇文章的你仍然是个 `WireGuard` 新手，请务必按照以下顺序阅读每一篇文章：

+ [WireGuard 教程：WireGuard 的工作原理](https://icloudnative.io/posts/wireguard-docs-theory/)
+ [WireGuard 快速安装教程](https://icloudnative.io/posts/wireguard-install/)
+ [WireGuard 配置教程：使用 wg-gen-web 来管理 WireGuard 的配置](https://icloudnative.io/posts/configure-wireguard-using-wg-gen-web/)
+ [Wireguard 全互联模式（full mesh）配置指南](https://icloudnative.io/posts/wireguard-full-mesh/)

如果遇到不明白的，可以参考这篇文章的注解：

+ [WireGuard 教程：WireGuard 的搭建使用与配置详解](https://icloudnative.io/posts/wireguard-docs-practice/)

剩下这几篇文章是可选的，有兴趣就看看：

+ [我为什么不鼓吹 WireGuard](https://icloudnative.io/posts/why-not-wireguard/)
+ [Why not "Why not WireGuard?"](https://icloudnative.io/posts/why-not-why-not-wireguard/)
+ [WireGuard 教程：使用 DNS-SD 进行 NAT-to-NAT 穿透](https://icloudnative.io/posts/wireguard-endpoint-discovery-nat-traversal/)

WireGuard 本身是不暴露任何指标的，需要通过第三方的 `exporter` 来暴露指标。目前有两个版本的 exporter，单纯使用其中一个都不太完美，所以我干脆都用。

## 1. 镜像构建

这两个 `exporter` 都没有提供 Docker 镜像，所以我只好自己动手了，`Rust` 版本 exporter 的 `Dockerfile` 如下：

```dockerfile
FROM rust as builder

LABEL description="Docker container for building prometheus exporter for wireguard."
LABEL maintainer="Ryan Yang <yangchuansheng33@gmail.com>"

WORKDIR /usr/src/
RUN git clone https://github.com/MindFlavor/prometheus_wireguard_exporter.git; \
    cd prometheus_wireguard_exporter; \
    cargo install --path .

FROM debian:buster-slim
RUN sh -c "echo 'deb http://deb.debian.org/debian buster-backports main contrib non-free' > /etc/apt/sources.list.d/buster-backports.list"; \
    apt update; \
    apt install -y wireguard; \
    rm -rf /var/lib/apt/lists/*
COPY --from=builder /usr/local/cargo/bin/prometheus_wireguard_exporter /usr/local/bin/prometheus_wireguard_exporter
CMD ["prometheus_wireguard_exporter"]
```

`Go` 版本 exporter 的 `Dockerfile` 如下：

```dockerfile
FROM golang AS build

LABEL description="Docker container for building prometheus exporter for wireguard."
LABEL maintainer="Ryan Yang <yangchuansheng33@gmail.com>"

WORKDIR /src
RUN git clone https://github.com/mdlayher/wireguard_exporter; \
    cd wireguard_exporter/cmd/wireguard_exporter/; \
    go build .

FROM busybox:glibc
COPY --from=build /src/wireguard_exporter/cmd/wireguard_exporter/wireguard_exporter .
CMD ["./wireguard_exporter"]
```

镜像的构建我就不赘述了，大家可以看我的 [GitHub 仓库](https://github.com/yangchuansheng/docker-image/tree/master/wireguard_exporter)。

## 2. prometheus_wireguard_exporter 部署

 [prometheus_wireguard_exporter](https://github.com/MindFlavor/prometheus_wireguard_exporter.git) 直接利用 `wg` 的配置文件来获取指标，它自己不需要单独准备配置文件，所以只需将 `/etc/wireguard` 目录映射到容器中。如果你的 wg 组网模式是中心辐射型，建议只需监控 wg 网关，如果是全互联模式，也可以只监控其中一个用来生成配置的节点，当然你也可以监控所有节点。

我这里只监控了其中一个用来生成配置的节点，以下是部署清单：

```yaml
# wireguard_exporter.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wireguard-exporter
  labels:
    app: wireguard-exporter
spec:
  replicas: 1 
  selector:
    matchLabels:
      app: wireguard-exporter
  strategy:
    rollingUpdate:
      maxSurge: 0
      maxUnavailable: 1
    type: RollingUpdate
  template:
    metadata:
      labels:
        app: wireguard-exporter
    spec:
      nodeSelector:
        kubernetes.io/hostname: blog-k3s03 
      tolerations:
      - key: node-role.kubernetes.io/ingress
        operator: Exists
        effect: NoSchedule
      hostNetwork: true 
      containers:
      - name: wireguard-exporter
        image: yangchuansheng/wireguard_exporter 
        command: ["/usr/local/bin/prometheus_wireguard_exporter"]
        args: ["-n", "/etc/wireguard/wg0.conf", "-r"]
        securityContext:
          capabilities:
            add: ["NET_ADMIN"]
        ports:
        - containerPort: 9586 
          protocol: TCP
          name: http-metrics
        volumeMounts:
        - mountPath: /etc/localtime
          name: localtime
        - mountPath: /etc/wireguard
          name: config
      volumes:
      - name: localtime
        hostPath:
          path: /etc/localtime
      - name: config
        hostPath:
          path: /etc/wireguard
---
apiVersion: v1
kind: Service
metadata:
  name: wireguard-exporter
  labels:
    app: wireguard-exporter
spec:
  sessionAffinity: ClientIP
  selector:
    app: wireguard-exporter
  ports:
    - protocol: TCP
      name: http-metrics
      port: 9586
      targetPort: 9586
```

使用部署清单部署 `prometheus_wireguard_exporter`：

```bash
$ kubectl apply -f wireguard_exporter.yaml
```

查看是否部署成功：

```bash
$ kubectl get pod -l app=wireguard-exporter
NAME                                  READY   STATUS    RESTARTS   AGE
wireguard-exporter-78d44b8bd9-ppm9t   1/1     Running   0          41s
```

## 3. wireguard_exporter 部署

 [wireguard_exporter](https://github.com/mdlayher/wireguard_exporter) 需要单独准备配置文件，格式如下：

```toml
# /etc/wireguard/wg0.toml

[[Peer]]
public_key = "cGsHfwmPEiLJj6Fv3GU5xFvdyQByn50PC5keVGJEe0w="
name = "RouterOS"

[[Peer]]
public_key = "izv5L8Kn48+SVwE3D498mdi7YfSrn6aKDNIRxIAHDkU="
name = "macOS"

[[Peer]]
public_key = "EOM0eLVxsj9jGKWamuIn65T3Wmqw36uLOg2ss7yJ2gw="
name = "blog-k3s02"

[[Peer]]
public_key = "1RxEokE41ypnIMsbE5OVHFVx199V71MOYzpzQ8bbsFY="
name = "blog-k3s01"

[[Peer]]
public_key = "b3JiuvdOUV7cFpXyJzLbO2Ea4V4c4AoyugIC/ufGZ18="
name = "Openwrt"

[[Peer]]
public_key = "FIbzqNv10cdCDO/Ka2GIN9rpxNVV2tO2f00R71EHeSg="
name = "Oneplus"
```

你需要将 `wg0.conf` 中的配置内容转化为上面的格式保存到 `wg0.toml` 文件中，再将其映射到容器中。部署清单如下：

```yaml
# wireguard_exporter_go.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wireguard-exporter-go
  labels:
    app: wireguard-exporter-go
spec:
  replicas: 1 
  selector:
    matchLabels:
      app: wireguard-exporter-go
  strategy:
    rollingUpdate:
      maxSurge: 0
      maxUnavailable: 1
    type: RollingUpdate
  template:
    metadata:
      labels:
        app: wireguard-exporter-go
    spec:
      nodeSelector:
        kubernetes.io/hostname: blog-k3s03 
      tolerations:
      - key: node-role.kubernetes.io/ingress
        operator: Exists
        effect: NoSchedule
      hostNetwork: true 
      containers:
      - name: wireguard-exporter-go
        image: docker.io/yangchuansheng/wireguard_exporter:golang 
        command: ["/wireguard_exporter"]
        args: ["-wireguard.peer-file", "/etc/wireguard/wg0.toml", "-metrics.addr", ":9587"]
        securityContext:
          capabilities:
            add: ["NET_ADMIN"]
        ports:
        - containerPort: 9587 
          protocol: TCP
          name: http-metrics
        volumeMounts:
        - mountPath: /etc/localtime
          name: localtime
        - mountPath: /etc/wireguard
          name: config
      volumes:
      - name: localtime
        hostPath:
          path: /etc/localtime
      - name: config
        hostPath:
          path: /etc/wireguard
---
apiVersion: v1
kind: Service
metadata:
  name: wireguard-exporter-go
  labels:
    app: wireguard-exporter-go
spec:
  sessionAffinity: ClientIP
  selector:
    app: wireguard-exporter-go
  ports:
    - protocol: TCP
      name: http-metrics
      port: 9587
      targetPort: 9587
```

使用部署清单部署  `wireguard_exporter`：

```bash
$ kubectl apply -f wireguard_exporter_go.yaml
```

查看是否部署成功：

```bash
$ kubectl get pod -l app=wireguard-exporter-go
NAME                                     READY   STATUS    RESTARTS   AGE
wireguard-exporter-go-7f5c88fc68-h45x5   1/1     Running   0          52s
```

## 4. 加入 Prometheus 监控

`kube-prometheus` 的部署方式这里略过，新手请自己查阅文档部署，我只讲关键的步骤。要想让 `kube-prometheus` 能获取到 WireGuard 的指标，需要创建相应的 `ServiceMonitor` 资源，资源清单如下：

```yaml
# prometheus-serviceMonitorWireguard.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  labels:
    app: wireguard-exporter 
  name: wireguard-exporter
  namespace: monitoring
spec:
  endpoints:
  - interval: 15s
    port: http-metrics
  namespaceSelector:
    matchNames:
    - default 
  selector:
    matchLabels:
      app: wireguard-exporter 
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  labels:
    app: wireguard-exporter-go
  name: wireguard-exporter-go
  namespace: monitoring
spec:
  endpoints:
  - interval: 15s
    port: http-metrics
  namespaceSelector:
    matchNames:
    - default
  selector:
    matchLabels:
      app: wireguard-exporter-go
```

使用资源清单创建 `ServiceMonitor`：

```bash
$ kubectl apply -f prometheus-serviceMonitorWireguard.yaml
```

查看 Prometheus 中对应的 `Target` 是否已经获取成功：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210312172948.png)

最后在 `Grafana` 中添加仪表盘，通过环境变量来切换不同 wg 接口的监控仪表盘。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210312183540.webp)

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210312183554.webp)

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@three/img/20210312183609.webp)

至于仪表盘的语法细节，我就不展开讲了，感兴趣的可以先导入我的仪表盘，后面遇到不懂的再来问我。仪表盘 json 文件链接：

+ https://jsdelivr.icloudnative.io/gh/yangchuansheng/docker-image@master/wireguard_exporter/dashboard.json

