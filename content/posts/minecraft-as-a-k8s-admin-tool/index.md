---
keywords:
- kubecraft
- dockercraft
- kubecraftadmin
title: "在 Minecraft 中管理 Kubernetes 集群"
date: 2020-10-08T23:20:08+08:00
lastmod: 2020-10-08T23:20:08+08:00
description: 通过 kubecraft 和 kubecraftadmin 来管理 Kubernetes 集群。
draft: false 
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocLevels: ["h2", "h3", "h4"]
tags:
- kubernetes
- minecraft
categories: cloud-native
img: https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20201008232412.png
---

微软 2015 年收购 Minecraft 之后不久开源了一个项目叫 [Dockercraft](https://github.com/docker/dockercraft)，这个项目当时看起来非常有趣，通过 [Dockercraft](https://github.com/docker/dockercraft)，玩家可以在 Minecraft 中启动或停止一个 Docker 容器，而 Docker 容器会以一个 N*N 的方块房子的方式显示在玩家面前，每一栋房子都代表一个 Docker 容器。

**房子的外面挂着显示容器信息的看板，包括容器的名称、正在运行的进程、CPU 与内存的使用率等信息。**

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20201008221254.png)

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20201008222053.png)

房子里面是管理容器的开关，扳动墙上的开关可以停止和启动容器，这对于码农来说是一个非常有趣的服务器。

我寻思着，既然有了 Dockercraft，怎么能没有 Kubecraft 呢？Google 搜了下还真有，项目名字正好就叫 [Kubecraft](https://github.com/stevesloka/kubecraft)。它的功能和 Dockercraft 类似，可以管理 `Kubernetes` 集群中的容器，每一个房子代表一个 `Pod`，房子里面有开关可以销毁 `Pod`，真是太好玩了（太无聊了......）。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20201008223401.jpg)

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20201008223421.jpg)

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20201008223441.jpg)

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20201008223513.jpg)

[官方仓库](https://github.com/stevesloka/kubecraft)给的部署方式是用 `Docker` 跑的，命令如下：

```bash
$ docker run -t -d -i -p 25565:25565 \
--name kubecraft \
-e KUBE_CFG_FILE=/etc/kubeconfig \
-v ~/.kube/config:/etc/kubeconfig \
stevesloka/kubecraft
```

如果想部署在 Kubernetes 中，可以参考下面的部署清单：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kubecraft
  labels:
    app: kubecraft
spec:
  replicas: 1 
  selector:
    matchLabels:
      app: kubecraft
  template:
    metadata:
      labels:
        app: kubecraft
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - kubecraft 
              topologyKey: kubernetes.io/hostname
            weight: 1
      tolerations:
      - key: node-role.kubernetes.io/ingress
        operator: Exists
        effect: NoSchedule
      containers:
      - name: kubecraft
        image: stevesloka/kubecraft 
        tty: true
        stdin: true
        env:
        - name: KUBE_CFG_FILE 
          value: /etc/kubeconfig
        ports:
        - containerPort: 25565 
          protocol: TCP
        volumeMounts:
        - mountPath: /etc/kubeconfig
          subPath: kubeconfig
          name: kubeconfig
      volumes:
      - name: kubeconfig
        configMap:
          name: kubeconfig
---
apiVersion: v1
kind: Service
metadata:
  name: kubecraft
  labels:
    app: kubecraft
spec:
  selector:
    app: kubecraft
  ports:
    - protocol: TCP
      name: http
      port: 25565
      targetPort: 25565
```

**一定要加上 `tty: true` 和 `stdin:true`，不然容器无法启动！**

你还需要先创建一个 `Configmap` 来保存 `kubeconfig`，例如：

```bash
$ kubectl create cm kubeconfig --from-file=/root/.kube/config
```

然后就可以愉快地部署了。

除了 Kubecraft 之外，还有一个项目叫 [KubeCraftAdmin](https://github.com/erjadi/kubecraftadmin)，功能上并没有什么太大的差异，只是**每一个动物代表一个 Pod，你只要干掉一只鸡🐔，Kubernetes 中的 Pod 就被干死了，刺不刺激？**

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20201008224856.png)

{{< bilibili BV1jZ4y1L7HH >}}