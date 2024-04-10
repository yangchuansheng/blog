---
keywords:
- goland
- idea
- projector-docker
- jetbrains
title: "Goland 网页版使用教程"
subtitle: "使用 Goland 网页版实现远程开发"
date: 2021-03-17T00:48:25+08:00
lastmod: 2021-03-17T00:48:25+08:00
description: 本文介绍了如何使用 Kubernetes 和 Docker 来部署 Goland 网页版。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- Goland
- Jetbrains
- Kubernetes
categories: 
- tech-social
- cloud-native
img: https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@three/img/20210326141559.png
---

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@three/img/20210326141546.png)

云原生玩家往往都是左手 `MacBook`，右手 `Goland`，但由于大部分人的 MacBook 硬件资源有限，基本上无法丝滑地使用 Goland。即使你是 8C16G 的高富帅，多开几个 `PornHub` 标签页也会撑不住的，许多人不得不忍痛转向 `VSCode`。

现在我要告诉你们一个重大好消息：**Goland 竟然有网页版了！**

有了网页版之后，我们就可以直接在 Linux 环境中调试应用了，那感觉真叫一个酸爽啊。只要你的远程机器资源充足，可以随意给网页版 Goland 分配 CPU 和内存资源，想象一下，你拥有一个 16C32G 的网页版 Goland，而且这 16C32G 都是 Goland 独占的，那该有多幸福！

部署方法闭着眼睛也能猜到了，官方直接提供了 Docker 镜像，一把梭跑起来就完事了，项目地址：

+ [https://github.com/JetBrains/projector-docker](https://github.com/JetBrains/projector-docker)

官方提供的部署命令比较简单，不太适合实际使用，还需要加点参数才能真正用起来。由于我有丰富的 Kubernetes 集群资源，就直接部署在 Kubernetes 中了，本文也只讲解 `Kubernetes` 的部署方式，如果你是通过 `docker-compose` 或直接用 `docker` 部署，可以参考我的方案自己修改。

官方镜像最大的问题是没有安装 `golang` 的 SDK 环境，但是我也不想自己再重新构建镜像了，就直接使用 Kubernetes 的持久化存储来解决了。同时 Goland 自身的配置和 Go 项目所在的目录都要持久化，不然 Pod 重启就玩完了。好在所有持久化的东西都在 `/home/projector-user` 目录下，存储直接挂载到这个目录就行了。

先准备一个 `Deployment` 资源清单：

```yaml
# projector-goland.yaml
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: project-data
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: projector-goland
  labels:
    app: projector-goland
spec:
  replicas: 1 
  selector:
    matchLabels:
      app: projector-goland
  template:
    metadata:
      labels:
        app: projector-goland
    spec:
      containers:
      - name: projector-goland 
        image: registry.jetbrains.team/p/prj/containers/projector-goland
        imagePullPolicy: IfNotPresent 
        volumeMounts:
        - mountPath: /etc/localtime
          name: localtime
        - mountPath: /home/projector-user
          name: project-data 
      imagePullSecrets:
      - name: regcred
      volumes:
      - name: localtime
        hostPath:
          path: /etc/localtime
      - name: project-data 
        persistentVolumeClaim:
          claimName: project-data 
---
apiVersion: v1
kind: Service
metadata:
  name: projector-goland 
  labels:
    app: projector-goland
spec:
  selector:
    app: projector-goland
  ports:
    - protocol: TCP
      name: http
      port: 80
      targetPort: 8887
```

**如果你的 Kubernetes 集群没有对接后端分布式存储，可以使用 `hostPath` 代替，然后将 Pod 调度到指定的节点。**

使用资源清单创建应用实例：

```bash
$ kubectl apply -f projector-goland.yaml
```

查看是否创建成功：

```bash
$ kubectl get pod -l app=projector-goland
NAME                                READY   STATUS    RESTARTS   AGE
projector-goland-7dcc58f964-9p7xw   1/1     Running   0          3m38s

$ kubectl get svc -l app=projector-goland
NAME               TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)   AGE
projector-goland   ClusterIP   10.106.190.178   <none>        80/TCP    3m38s
```

如果你能够[直接访问集群的 Service IP](/posts/use-wireguard-as-kubernetes-cni/)，就可以直接通过 Service IP 访问 Goland 网页版了：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@three/img/20210323224346.png)

经过一番设置之后，最后激活进入主界面：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@three/img/20210323224731.png)

激活方法我就不介绍了，大家自己想办法。

接下来你可以从本地的 Goland IDE 导出插件和配置：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@three/img/20210323233328.png)

将备份拷贝到容器中：

```bash
$ kubectl cp settings.zip projector-goland-7dcc58f964-9p7xw:/home/projector-user/settings.zip
```

在网页版 Goland 中依次点击 `Configure` -> `Import Settings`：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@three/img/20210323233601.png)

选择备份配置：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@three/img/20210323234003.png)

点击 `OK` 开始导入：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@three/img/20210323234113.png)

最后选择 `Shutdown` 关闭容器进程，稍后 Pod 中的进程会原地重启，Pod 不会被销毁重建：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@three/img/20210323234201.png)

点击 `reconnect` 重新连接：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@three/img/20210323234926.png)

下面还需要做一些额外的操作，因为官方的镜像默认没有安装 `golang` 的 SDK 环境，在线下载需要叉叉上网，所以最好还是先手动下载：

```bash
$ wget https://mirrors.ustc.edu.cn/golang/go1.16.2.linux-amd64.tar.gz
```

然后再拷贝到容器中：

```bash
$ kubectl cp go1.16.2.linux-amd64.tar.gz projector-goland-7dcc58f964-9p7xw:/home/projector-user/go1.16.2.linux-amd64.tar.gz
```

进入容器解压 sdk：

```bash
$ kubectl exec -it projector-goland-7dcc58f964-9p7xw -- bash
projector-user@projector-goland-7dcc58f964-9p7xw:/$ cd ~
projector-user@projector-goland-7dcc58f964-9p7xw:/$ mkdir sdk
projector-user@projector-goland-7dcc58f964-9p7xw:/$ tar zxvf go1.16.2.linux-amd64.tar.gz -C sdk
```

访问 Goland 网页版，依次点击右下角的 `Configure` -> `Settings` -> Go -> `GOROOT`，点击 `Add SDK`，选择 `local`:

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@three/img/20210323232150.png)

选择 `sdk` 路径，然后点击 OK：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@three/img/20210323232309.png)

点击 `Apply`，然后再点击 OK：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@three/img/20210323232451.png)

点击 `Go Modules`，勾上 `Enable Go modules integration`，`Vgo excutable` 选择 Project SDK，然后点击 OK：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@three/img/20210323232817.png)

至此网页版 Goland 就配置完成了：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@three/img/20210323222856.png)

从此以后躺在家里吃灰的 `iPad` 就可以拿来写代码了。。。

如果你无法拉取官方的镜像，可以从我这边获取，关注公众号：

<p>
<img src="https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@master/img/20200430221955.png" width="350">
</p>


公众号后台回复 `goland` 即可获取 goland 网页版镜像。