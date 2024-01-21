---
keywords:
- k3s
- WireGuard
- flannel
- Kubernetes
title: "跨云厂商部署 k3s 集群"
date: 2020-06-14T13:44:03+08:00
lastmod: 2020-06-14T13:44:03+08:00
description: 本文介绍了如何跨云厂商部署 k3s 集群，解决 flannel 内网无法互通的问题。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocLevels: ["h2", "h3", "h4"]
tags:
- K3s
- WireGuard
- Kubernetes
- Flannel
categories: 
- cloud-native
img: https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20200615100550.png
---

最近一两年各大云服务商都出了各种福利活动，很多小伙伴薅了一波又一波羊毛，比如腾讯云 1C2G `95/年` 真香系列，华为云和阿里云也都有类似的活动，薅个两三台就能搭建一个 `Kubernetes` 集群。但是跨云服务商搭建 `Kubernetes` 集群并不像我们想象中的那么容易，首先就是原生的 `Kubernetes` 组件本身对资源的消耗量很大，而云服务器的资源非常有限，经不起这么大家伙的折腾，对此我们可以选择使用轻量级 Kubernetes 发行版：`k3s`。

`k3s` 将安装 Kubernetes 所需的一切打包进仅有 `60MB` 大小的二进制文件中，并且完全实现了 Kubernetes API。为了减少运行 Kubernetes 所需的内存，`k3s` 删除了很多不必要的驱动程序，并用附加组件对其进行替换。由于它只需要极低的资源就可以运行，因此它能够在任何 `512MB` 内存以上的设备上运行集群。

其实 k3s 的安装非常简单，分分钟就能搞定，但对于公有云来说，还是有很多坑的，比如内网不通、公网 IP 不在服务器上该咋办？本文就为你一一解决这些难题，让天下的云羊毛都成为 k3s 的后宫！

## 1. 下载二进制文件

首先来解决第一个难题：**k3s 二进制文件的下载**。国内下载 `GitHub` 速度基本都是以几个 `kb` 为单位，不忍直视，如果下载内容都是代码，有很多办法可以解决，比如通过码云中转啊、直接通过 `CDN` 下载啊，什么？你不知道可以通过 CDN 下载？好吧没关系，现在我告诉你了：[https://cdn.con.sh/](https://cdn.con.sh/)。

但是上面的 CDN 并不能下载 `release` 里的内容，要想下载 release 里的内容，可以使用这个网站：[https://toolwa.com/github/](https://toolwa.com/github/)。打开网站，输入 release 里面的文件下载链接，点击起飞即可加速下载。

当然，如果你会魔法上网的话，上面的所有花里胡哨的方法都可以无视，直接下载就好啦（本文选择使用版本 `v1.17.6+k3s1`）：

```bash
$ wget https://github.com/rancher/k3s/releases/download/v1.17.6+k3s1/k3s -O /usr/local/bin/k3s
$ chmod +x /usr/local/bin/k3s
```

需要在所有节点中下载上述二进制文件。

## 2. 升级内核

k3s 的默认网络插件是 `flannel`，默认模式是 `vxlan` 模式，建议使用 `wireguard` 模式，原因不解释了，不知道 `wireguard` 是啥的自己去搜一下。

wireguard 对内核的要求比较高，而 `CentOS 7.x` 的默认内核是不满足要求的，需要升级内核（如果你的操作系统是 CentOS 7.x 的话）。步骤如下：

① 载入公钥

```bash
$ rpm --import https://www.elrepo.org/RPM-GPG-KEY-elrepo.org
```

② 升级安装 elrepo

```bash
$ rpm -Uvh http://www.elrepo.org/elrepo-release-7.0-3.el7.elrepo.noarch.rpm
```

③ 载入 elrepo-kernel 元数据

```bash
$ yum --disablerepo=\* --enablerepo=elrepo-kernel repolist
```

④ 安装最新版本的内核

```bash
$ yum --disablerepo=\* --enablerepo=elrepo-kernel install  kernel-ml.x86_64  -y
```

⑤ 删除旧版本工具包

```bash
$ yum remove kernel-tools-libs.x86_64 kernel-tools.x86_64  -y
```

⑥ 安装新版本工具包

```bash
$ yum --disablerepo=\* --enablerepo=elrepo-kernel install kernel-ml-tools kernel-ml-devel kernel-ml-headers -y
```

⑦ 查看内核插入顺序

```bash
$ grep "^menuentry" /boot/grub2/grub.cfg | cut -d "'" -f2

CentOS Linux (3.10.0-1127.10.1.el7.x86_64) 7 (Core)
CentOS Linux (5.7.2-1.el7.elrepo.x86_64) 7 (Core)
CentOS Linux (0-rescue-96820b9851c24560b5f942f2496b9aeb) 7 (Core)
```

默认新内核是从头插入，默认启动顺序也是从 0 开始。

⑧ 查看当前实际启动顺序

```bash
$ grub2-editenv list

saved_entry=CentOS Linux (3.10.0-1127.10.1.el7.x86_64) 7 (Core)
```

⑨ 设置默认启动

```bash
$ grub2-set-default 'CentOS Linux (5.7.2-1.el7.elrepo.x86_64) 7 (Core)'
```

最后重启检查：

```bash
$ reboot
$ uname -r
```

**注意：集群中的所有节点都需要升级内核。**

## 3. 安装 wireguard

内核升级了之后，就可以安装 wireguard 了，也很简单，步骤如下：

```bash
$ yum install epel-release https://www.elrepo.org/elrepo-release-7.el7.elrepo.noarch.rpm
$ yum install yum-plugin-elrepo
$ yum install kmod-wireguard wireguard-tools
```

**注意：集群中的所有节点都需要安装。**

## 4. 部署控制平面

下面就可以在控制节点上启动控制平面的组件了，这里我们选择手动部署，这样比较方便修改参数。先创建一个 Service Unit 文件：

```bash
$ cat > /etc/systemd/system/k3s.service <<EOF
[Unit]
Description=Lightweight Kubernetes
Documentation=https://k3s.io
Wants=network-online.target

[Install]
WantedBy=multi-user.target

[Service]
Type=notify
EnvironmentFile=/etc/systemd/system/k3s.service.env
KillMode=process
Delegate=yes
# Having non-zero Limit*s causes performance problems due to accounting overhead
# in the kernel. We recommend using cgroups to do container-local accounting.
LimitNOFILE=1048576
LimitNPROC=infinity
LimitCORE=infinity
TasksMax=infinity
TimeoutStartSec=0
Restart=always
RestartSec=5s
ExecStartPre=-/sbin/modprobe br_netfilter
ExecStartPre=-/sbin/modprobe overlay
ExecStart=/usr/local/bin/k3s \
    server \
    --tls-san <public_ip> \
    --node-ip <public_ip> \
    --node-external-ip <public_ip> \
    --no-deploy servicelb \
    --flannel-backend wireguard \
    --kube-proxy-arg "proxy-mode=ipvs" "masquerade-all=true" \
    --kube-proxy-arg "metrics-bind-address=0.0.0.0"
EOF
```

+ 将 `<public_ip>` 替换成控制节点的公网 IP。
+ flannel 使用 `wireguard` 协议来跨主机通信。
+ kube-proxy 使用 `ipvs` 模式。

启动 k3s 控制平面并设置开机自启：

```bash
$ systemctl enable k3s --now
```

查看集群组件健康状况：

```bash
$ kubectl get cs

NAME                 STATUS    MESSAGE   ERROR
scheduler            Healthy   ok
controller-manager   Healthy   ok
```

这里的输出没有 `etcd`，因为 k3s 的默认数据存储是 `Sqlite`，对于小型数据库十分友好。Kubernetes 控制平面中发生的更改更多是与频繁更新部署、调度 Pod 等有关，因此对于几个节点的小型集群而言，数据库不会造成太大负载，能省下不少资源，真香！

## 5. 加入计算节点

部署好控制平面之后，就可以加入计算节点了。首先在计算节点上创建 Service Unit 文件：

```bash
$ cat > /etc/systemd/system/k3s-agent.service <<EOF
[Unit]
Description=Lightweight Kubernetes
Documentation=https://k3s.io
Wants=network-online.target

[Install]
WantedBy=multi-user.target

[Service]
Type=exec
EnvironmentFile=/etc/systemd/system/k3s-agent.service.env
KillMode=process
Delegate=yes
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
TasksMax=infinity
TimeoutStartSec=0
Restart=always
RestartSec=5s
ExecStartPre=-/sbin/modprobe br_netfilter
ExecStartPre=-/sbin/modprobe overlay
ExecStart=/usr/local/bin/k3s agent \
    --node-external-ip <public_ip> \
    --node-ip <public_ip> \
    --kube-proxy-arg "proxy-mode=ipvs" "masquerade-all=true" \
    --kube-proxy-arg "metrics-bind-address=0.0.0.0"
EOF
```

环境变量文件 `/etc/systemd/system/k3s-agent.service.env` 中需要加入两个环境变量：

+ **K3S_URL** : `API Server` 的 URL，一般格式为：`https://<master_ip>:6443`。其中 <master_ip> 是控制节点的公网 IP。
+ **K3S_TOKEN** : 加入集群所需的 token，可以在控制节点上查看 `/var/lib/rancher/k3s/server/node-token` 文件。

`/etc/systemd/system/k3s-agent.service.env` 内容如下：

```bash
K3S_URL=https://<master_ip>:6443
K3S_TOKEN=xxxxxxxx
```

启动 k3s-agent 并设置开启自启：

```bash
$ systemctl enable k3s-agent --now
```

查看节点状态：

```bash
$ kubectl get node

NAME         STATUS   ROLES    AGE     VERSION
blog-k3s01   Ready    master   3d6h    v1.17.6+k3s1
blog-k3s02   Ready    <none>   3d3h    v1.17.6+k3s1
```

## 6. 内网不互通的解决办法

这里会遇到一个问题，不同节点的 `flannel` 使用的是内网 IP 来进行通信，而我们的云服务器是内网不互通的，而且公网 IP 也不在服务器上。可以看一下 node 的 `annotations`：

```bash
$ kubectl get node blog-k3s02 -o yaml

apiVersion: v1
kind: Node
metadata:
  annotations:
    flannel.alpha.coreos.com/backend-data: '"xxxxx"'
    flannel.alpha.coreos.com/backend-type: extension
    flannel.alpha.coreos.com/kube-subnet-manager: "true"
    flannel.alpha.coreos.com/public-ip: 192.168.0.11
    ...
```

可以看到 `flannel` 给节点打的注解中的节点 IP 是内网 IP。要想让 flannel 使用公网 IP 进行通信，需要额外添加一个注解 `public-ip-overwrite`，然后 flannel 会基于这个 IP 配置网络。按照官方文档的说法，如果你的 node 设置了 `ExternalIP`，flannel 会自动给 node 添加一个注解  `public-ip-overwrite`，但我不知道该如何给 node 设置 `ExternalIP`，干脆就直接手动加注解吧：

```bash
$ kubectl annotate nodes <master> flannel.alpha.coreos.com/public-ip-overwrite=<master_pub_ip>
$ kubectl annotate nodes <node> flannel.alpha.coreos.com/public-ip-overwrite=<node_pub_ip>
```

加了注解之后，flannel 的 `public-ip` 就会被修改为公网 IP。然后在各个节点上重启各自的 k3s 服务，查看 `wireguard` 连接状况：

```bash
$ wg show flannel.1

interface: flannel.1
  public key: ONDgJCwxxxxxxxJvdWpoOKTxQA=
  private key: (hidden)
  listening port: 51820
  
peer: MKKaanTxxxxxxxV8VpcHq4CSRISshw=
  endpoint: <pub_ip>:51820
  allowed ips: 10.42.4.0/24
  latest handshake: 26 seconds ago
  transfer: 133.17 KiB received, 387.44 KiB sent
  persistent keepalive: every 25 seconds
```

可以看到通信端点被改成了公网 IP，大功告成！

## 7. metrics-server 问题解决

还有一个问题就是 `metrics-server` 无法获取 cpu、内存等利用率核心指标。需要修改 `metrics-server` 的 manifests，使用以下命令在线编辑 `metrics-server` 的 manifests：

```bash
$ kubectl -n kube-system edit deploy metrics-server
```

然后加入以下执行参数后保存退出：

```bash
      -command:
        - /metrics-server
        - --kubelet-preferred-address-types=ExternalIP
        - --kubelet-insecure-tls
```

这样就可以让 metrics-server 使用公网 IP 来和 node 通信了。修改成功后就可以看到核心指标了：

```bash
$ kubectl top nodes
NAME         CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
blog-k3s01   193m         9%     886Mi           22%
blog-k3s02   41m          2%     1292Mi          32%

$ kubectl top pod -n kube-system
NAME                                      CPU(cores)   MEMORY(bytes)
coredns-848b6cc76f-zq576                  8m           14Mi
local-path-provisioner-58fb86bdfd-bzdfl   2m           9Mi
metrics-server-bdfc79c97-djmzk            1m           12Mi
```

到这里跨云服务商部署 k3s 基本上就大功告成了，下一篇文章将会教你如何打通家里到云上 k3s 的网络，**让你家中所有设备都可以直接访问 Pod IP、svc IP，甚至可以直接访问 svc 域名，敬请期待。**