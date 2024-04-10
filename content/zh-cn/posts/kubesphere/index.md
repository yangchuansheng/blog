---
keywords:
- 米开朗基杨
- kubesphere
- kubernetes
- dashboard
title: "KubeSphere 安装教程"
subtitle: "以应用为中心的容器管理平台 KubeSphere"
description: 在现有的 Kubernetes 集群上部署 KubeSphere
date: 2019-09-19T21:53:07+08:00
draft: false
author: 米开朗基杨
toc: true
categories: cloud-native
tags: ["kubernetes"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/2019-09-19-091028.jpg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

2018 年 7 月份，青云在 Cloud Insight 云计算峰会上推出了一款全新的容器平台——`KubeSphere`，旨在帮助企业快速低成本管理容器。并且 `KubeSphere` 本身是开源的，它是基于 Kubernetes 构建的分布式、多租户、企业级开源容器平台，具有强大且完善的网络与存储能力，并通过极简的人机交互提供完善的多集群管理、CI / CD 、微服务治理、应用管理等功能，帮助企业在云、虚拟化及物理机等异构基础设施上快速构建、部署及运维容器架构，实现应用的敏捷开发与全生命周期管理。

KubeSphere 目前最新的版本为高级版 `2.0.2`，并且所有版本 100% 开源。它的 Dashboard 是这个样子的：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/2023-11-28-22-16-kaZw8G.png)

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/2023-11-28-22-17-nOTXRc.png)

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/2023-11-28-22-17-cnH0Nu.png)

这个颜值，比 Kubernetes Dashboard 不知道高到哪里去了，感兴趣的小伙伴可以给一个 Github Star 鼓励一下开发小哥。访问官网请戳这里：[kubesphere.io](https://kubesphere.io/)

KubeSphere 官网大致提供了两种安装方式，一种是安装 k8s 集群和 KubeSphere，一种是在现有的 k8s 集群上安装 KubeSphere。我想大多数用户的需求肯定是在现有的集群上安装，但官方文档给出的部署方案有很多奇怪的坑，本文就来为大家一一填平这些坑。

## 环境准备

----

当然，还有些同学可能会和我一样有强迫症，即使目前没有现成的 Kubernetes 环境，我也不想让 KubeSphere 给我来个全家桶，还是想自己搭建 k8s 集群，怎么办，二进制部署好烦啊，像我这种菜鸟没有半天搞不定，有没有简单快捷的方法，十分钟就能建好集群？当然有，用 [sealos](https://github.com/fanux/sealos) 就好了，只需一条命令即可跨主机安装所有依赖，不需要 `ansible`，不需要 ssh 登录到其他机器，安装之前需要做一些准备工作：

+ 所有节点安装并启动 docker
+ 下载 [kubernetes 离线安装包](https://github.com/sealstore/cloud-kernel/releases/)
+ 下载[最新版本 sealos](https://github.com/fanux/sealos/releases)（目前稳定版是 2.0.4）

我的机器规划是这样的：

|     Hostname     | IP | Role |
|:----------:|:--------:|:--------:|
| sealos-node1 |   192.168.0.2  |  master  |
| sealos-node2 |   192.168.0.3  |  node  |
| sealos-node3 |   192.168.0.4  |  node  |

安装步骤分为以下几步：

1、在 master 上执行以下命令：

```bash
$ sealos init --master 192.168.0.2 \
  --node 192.168.0.3 \
  --node 192.168.0.4 \
  --user root \
  --passwd password \
  --version v1.14.5 \
  --pkg-url /root/kube1.14.5.tar.gz
```

2、没有了。

真没有了，如果想了解原理，请查看 sealos 的[官方文档](https://github.com/fanux/sealos)。

下面就正式进入 KubeSphere 的安装环节。

## 安装 KubeSphere

----

1、首先将 `ks-installer` 仓库克隆到 master 节点上：

```bash
$ git clone https://github.com/kubesphere/ks-installer -b advanced-2.0.2
```

2、在 Kubernetes 集群中创建名为 `kubesphere-system` 和 `kubesphere-monitoring-system` 的 namespace。

```yaml
$ cat <<EOF | kubectl create -f -
---
apiVersion: v1
kind: Namespace
metadata:
    name: kubesphere-system
---
apiVersion: v1
kind: Namespace
metadata:
    name: kubesphere-monitoring-system
EOF
```

3、创建 Kubernetes 集群 CA 证书的 Secret。

> 注：按照当前集群 ca.crt 和 ca.key 证书路径创建（Kubeadm 创建集群的证书路径一般为 `/etc/kubernetes/pki`）

```bash
$ kubectl -n kubesphere-system create secret generic kubesphere-ca  \
--from-file=ca.crt=/etc/kubernetes/pki/ca.crt  \
--from-file=ca.key=/etc/kubernetes/pki/ca.key 
```

4、创建 etcd 的证书 Secret。

> 注：根据集群实际 etcd 证书位置创建；

+ 若 etcd 已经配置过证书，则参考如下创建：

   ```bash
   $ kubectl -n kubesphere-monitoring-system create secret generic kube-etcd-client-certs  \
   --from-file=etcd-client-ca.crt=/etc/kubernetes/pki/etcd/ca.crt  \
   --from-file=etcd-client.crt=/etc/kubernetes/pki/etcd/healthcheck-client.crt  \
   --from-file=etcd-client.key=/etc/kubernetes/pki/etcd/healthcheck-client.key
   ```
   
+ 若 etcd 没有配置证书，则创建空 Secret（以下命令适用于 Kubeadm 创建的 Kubernetes 集群环境）：

   ```bash
   $ kubectl -n kubesphere-monitoring-system create secret generic kube-etcd-client-certs
   ```
   
我这里是使用 sealos 搭建的集群，可以通过查看 etcd 的资源清单文件来获取它的证书：

```yaml
$ cat /etc/kubernetes/manifests/etcd.yaml

......
livenessProbe:
  exec:
    command:
    - /bin/sh
    - -ec
    - ETCDCTL_API=3 etcdctl --endpoints=https://[127.0.0.1]:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt
        --cert=/etc/kubernetes/pki/etcd/healthcheck-client.crt --key=/etc/kubernetes/pki/etcd/healthcheck-client.key
        get foo
......
```

5、修改部署文件

由于 KubeSphere 部署过程中涉及的组件非常多，安装过程中会有很多莫名其妙的坑，你可能会遇到以下几个问题：

**问题 1 :** 如果现有集群中已经安装有 metrics-server，需要在配置文件中将 `metrics_server_enable` 设置为 False。我的集群中没有安装这个组件，所以不用设为 False。

**问题 2 :** 在安装过程中卡死在 `Waitting for ks-sonarqube port to become open` 部分，节点上通过 NodePort 已经可以正常访问 sonarqube ，该问题没有解决，由于是一个不影响全局安装的一个操作，所以同样在配置文件中将 `sonarqube_enable` 设置为 False。

**问题 3 :** 如果当前的集群资源不是很足，可以临时取消掉 istio 的安装，后续再开启 istio 的支持。

**问题 4 :** KubeSphere 的组件默认情况下使用持久化存储，需要确保集群中有一个默认的 `StorageClass` 资源对象，如果确实没有，只是想临时部署一个 demo，可以在配置文件中将 `persistence` 里面的 `enable` 设置为 false。

我最终用于安装 KubeSphere 的配置文件如下：

```yaml
---
apiVersion: v1
data:
  ks-config.yaml: |
    kube_apiserver_host: 192.168.0.2:6443
    etcd_tls_enable: True
    etcd_endpoint_ips: 192.168.0.2
    disableMultiLogin: True
    elk_prefix: logstash
    sonarqube_enable: False
    istio_enable: False
    persistence:
      enable: false
      storageClass: ""
kind: ConfigMap
metadata:
  name: kubesphere-config
  namespace: kubesphere-system
......
```

只需要修改 ConfigMap 的值即可，其中 `kube_apiserver_host` 就是现有集群的 APIServer 地址，`etcd_endpoint_ips` 就是 etcd 的所在节点 IP，默认端口为 2379，如果你是集群模式 etcd，这里可以填写多个节点 IP，中间用 `,` 隔开，下面就是不需要安装的组件设置为 False。

6、自定义 Docker 镜像。

因为目前 ConfigMap 中不能禁用日志，所以只能强行修改 ansible playbook 了。进入 ks-installer 的根目录，将 `kubesphere.yaml` 中的 `ks-logging` 删除：

```yaml
---

- hosts: localhost
  gather_facts: false
  roles:
    - kubesphere-defaults
    - ks-devops/sonarqube
    - openpitrix
    - prepare/base
    - { role: metrics-server, when: "metrics_server_enable == true" }
    - ingress
    - ks-account
    - ks-apigateway
    - ks-controller-manager
    - ks-devops/s2i
    - ks-monitor
    - ks-console
    - ks-devops/ks-devops
    - ks-notification
    - ks-alerting
    - ks-devops/jenkins
    - ks-apiserver
    - { role: ks-istio, when: "istio_enable == true" }
```

然后修改 `Dockerfile`，将 Helm v2 替换为 Helm v3，原因你懂得，我可不想装 tiller。修改后的 Dockerfile 内容如下：

```dockerfile
FROM ubuntu:18.04

WORKDIR /usr/src/kubesphere

RUN apt update && apt install ansible python-netaddr openssl  curl jq  make software-properties-common -y &&  apt-add-repository --yes --update ppa:ansible/ansible && apt install ansible -y && apt clean

RUN curl -SsL https://storage.googleapis.com/kubernetes-release/release/v1.15.0/bin/linux/amd64/kubectl -o /usr/local/bin/kubectl &&  chmod +x /usr/local/bin/kubectl

RUN curl -OSsL https://get.helm.sh/helm-v3.0.0-beta.3-linux-amd64.tar.gz && tar -zxf helm-v3.0.0-beta.3-linux-amd64.tar.gz && mv linux-amd64/helm /usr/local/bin/helm && rm -rf *linux-amd64* && chmod +x /usr/local/bin/helm

COPY roles .

COPY kubesphere.yaml .
```

最后重新构建镜像，将部署文件中 Deployment 的镜像改为自定义的镜像，就可以直接部署了：

```bash
$ kubectl apply -f deploy/kubesphere.yaml

$ kubectl -n kubesphere-system get pod
NAME                                     READY   STATUS      RESTARTS   AGE
ks-account-585846bd44-mt7ss              1/1     Running     0          3h9m
ks-apigateway-7d77cb9495-hxgz8           1/1     Running     0          3h9m
ks-apiserver-697c5f4859-dsbmm            1/1     Running     0          3h7m
ks-console-5b8fbf45c4-7hxrw              1/1     Running     0          3h8m
ks-console-5b8fbf45c4-hj4bj              1/1     Running     0          3h8m
ks-controller-manager-7497f6c944-4k8wd   1/1     Running     0          3h8m
ks-docs-65999c97c9-5f9z7                 1/1     Running     0          3h37m
kubesphere-installer-6j49s               0/1     Completed   0          3h10m
openldap-78df9f7b47-wvs5n                1/1     Running     0          3h38m
redis-99f5985b8-2d62q                    1/1     Running     0          3h38m

$ kubectl -n kubesphere-system get job
NAME                   COMPLETIONS   DURATION   AGE
kubesphere-installer   1/1           2m9s       3h10m
```

如果上面用于安装的 Job 是完成状态的话，证明 KubeSphere 已经安装成功了。

可以创建一个 [IngressRoute](/posts/use-envoy-as-a-kubernetes-ingress/) 对象来访问 KubeSphere：

```yaml
apiVersion: contour.heptio.com/v1beta1
kind: IngressRoute
metadata:
  name: kubesphere
  namespace: kubesphere-system
spec:
  virtualhost:
    fqdn: ks.yangcs.net
  routes:
    - match: /
      services:
        - name: ks-console
          port: 80
```

将域名信息加入本地电脑的 hosts 中，就可以在浏览器中访问 KubeSphere 的 Dashboard 了。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/2019-09-19-121541.png)

默认的集群管理员账号为：

+ 用户名：admin
+ 密码：P@88w0rd

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/2019-09-19-139.198.0.142_30880_dashboard.png)

详细的使用方式可以参考官方文档：[https://kubesphere.io/docs/zh-CN/](https://kubesphere.io/docs/zh-CN/)

## 参考资料

----

+ [在现有 Kubernetes 集群上安装 KubeSphere](https://www.qikqiak.com/post/install-kubesphere-on-k8s/)
