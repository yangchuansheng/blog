---
keywords:
- 云原生
- cloud native
- kubernetes
- kube-router
- lvs
- ipvs
- calico
title: "Kube-router 使用指南"
subtitle: "使用 Kube-router 作为 Kubernetes 负载均衡器"
date: 2018-04-20T04:36:40Z
draft: false
author: 米开朗基杨
toc: true
categories: 
- cloud-native
tags:
- Kubernetes
- LVS
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191204205005.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

[Kube-router](https://github.com/cloudnativelabs/kube-router) 是一个挺有想法的项目，兼备了 `calico` 和 `kube-proxy` 的功能，是基于 Kubernetes 网络设计的一个集负载均衡器、防火墙和容器网络的综合方案。

## 体系架构

----

Kube-router 是围绕 <span id="inline-blue">观察者</span> 和 <span id="inline-blue">控制器</span> 的概念而建立的。 

<span id="inline-blue">观察者</span> 使用 `Kubernetes watch API` 来获取与创建，更新和删除 Kubernetes 对象有关的事件的通知。 每个观察者获取与特定 API 对象相关的通知。 在从 API 服务器接收事件时，观察者广播事件。 

<span id="inline-blue">控制器</span> 注册以获取观察者的事件更新，并处理事件。

`Kube-router` 由3个核心控制器和多个观察者组成，如下图所示。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/sMs3sm.jpg)

### 流程分析

Kube-router 启动之后，首先创建 `wathcer`:

```go
func (kr *KubeRouter) Run() error {
	...
	err = kr.startApiWatchers()
```

在 `startApiWatchers` 中，会启动 endpoint、namespace、pod、node、networkpolicy、service 这六个 wather。

这六个 wathcer 将监听的变化发送到 `Broadcaster`。

```go
func NewBroadcaster() *Broadcaster {
	return &Broadcaster{}
}

func (b *Broadcaster) Add(listener Listener) {
	b.listenerLock.Lock()
	defer b.listenerLock.Unlock()
	b.listeners = append(b.listeners, listener)
}

func (b *Broadcaster) Notify(instance interface{}) {
	b.listenerLock.RLock()
	listeners := b.listeners
	b.listenerLock.RUnlock()
	for _, listener := range listeners {
		go listener.OnUpdate(instance)
	}
}
```

之后创建三个 controller：`NetworkPolicyController`、`NetworkRoutingController`、`NetworkServicesControllers`。 每个 controller 会监听所关心的资源的变化。

```go
func NewNetworkServicesController(clientset *kubernetes.Clientset,\
	config *options.KubeRouterConfig) (*NetworkServicesController, error) {
	...
	nsc := NetworkServicesController{}
	...
	watchers.EndpointsWatcher.RegisterHandler(&nsc)
	watchers.ServiceWatcher.RegisterHandler(&nsc)
	...
```

每个 [controller](https://github.com/cloudnativelabs/kube-router/tree/master/pkg/controllers) 遵循以下结构。

```go
func Run() {
    for {
        Sync() // control loop that runs for ever and perfom sync at periodic interval
    }
}

func OnUpdate() {
    Sync() // on receiving update of a watched API object (namespace, node, pod, network policy etc)
}

Sync() {
    //re-concile any state changes
}

Cleanup() {
    // cleanup any changes (to iptables, ipvs, network etc) done to the system
}
```

## 主要功能

----

### 基于 IPVS/LVS 的负载均衡器 | `--run-service-proxy`

`Kube-router` 采用 Linux 内核的 `IPVS` 模块为 K8s 提供 `Service` 的代理。

Kube-router 的负载均衡器功能，会在物理机上创建一个虚拟的 `kube-dummy-if` 网卡，然后利用 k8s 的 watch APi 实时更新 `svc` 和 `ep` 的信息。svc 的 `cluster_ip` 会绑定在 kube-dummy-if 网卡上，作为 lvs 的 `virtual server` 的地址。`realserver` 的 ip 则通过 ep 获取到容器的IP地址。

基于 Kubernetes 网络服务代理的 Kube-router IPVS 演示

[![asciicast](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/2023-11-28-22-48-94sE6Q.png)](https://asciinema.org/a/120312)

特征：

+ 轮询负载均衡
+ 基于客户端IP的会话保持
+ 如果服务控制器与网络路由控制器（带有 `–-run-router` 标志的 kube-router）一起使用，源IP将被保留
+ 用 `–-masquerade-all` 参数明确标记伪装(SNAT)

更多详情可以参考：

+ [Kubernetes network services prox with IPVS/LVS](https://link.jianshu.com/?t=https://cloudnativelabs.github.io/post/2017-05-10-kube-network-service-proxy/)
+ [Kernel Load-Balancing for Docker Containers Using IPVS](https://link.jianshu.com/?t=https://blog.codeship.com/kernel-load-balancing-for-docker-containers-using-ipvs/)
+ [LVS负载均衡之持久性连接介绍](/posts/lvs-persistent-connection/)

### 容器网络 | `--run-router`

Kube-router 利用 BGP 协议和 Go 的 `GoBGP` 库和为容器网络提供直连的方案。因为用了原生的 Kubernetes API 去构建容器网络，意味着在使用 kube-router 时，不需要在你的集群里面引入其他依赖。

同样的，kube-router 在引入容器 CNI 时也没有其它的依赖，官方的 `bridge` 插件就能满足 kube-rouetr 的需求。

更多关于 BGP 协议在 Kubernetes 中的使用可以参考：

+ [Kubernetes pod networking and beyond with BGP](https://link.jianshu.com/?t=https://cloudnativelabs.github.io/post/2017-05-22-kube-pod-networking/)

### 网络策略管理 | `--run-firewall`

网络策略控制器负责从 Kubernetes API 服务器读取命名空间、网络策略和 pod 信息，并相应地使用 `ipset` 配置 iptables 以向 pod 提供入口过滤，保证防火墙的规则对系统性能有较低的影响。

Kube-router 支持 `networking.k8s.io/NetworkPolicy` 接口或网络策略 V1/GA [semantics](https://github.com/kubernetes/kubernetes/pull/39164#issue-197243974) 以及网络策略的 beta 语义。

更多关于 kube-router 防火墙的功能可以参考：

+ [Enforcing Kubernetes network policies with iptables](https://link.jianshu.com/?t=https://cloudnativelabs.github.io/post/2017-05-1-kube-network-policies/)

## 使用 kube-router 替代 kube-proxy

----

下面进入实战阶段，本方案只使用 kube-router 的 `service-proxy` 功能，网络插件仍然使用 `calico`（估计只有我能想到这么奇葩的组合了 :v:）

### 前提

+ 已有一个 k8s 集群
+ kube-router 能够连接 `apiserver`
+ 如果您选择以 `daemonset` 运行 kube-router，那么 kube-apiserver 和 kubelet 必须以 `–allow-privileged=true` 选项运行

### 集群环境

| 角色 | IP 地址 | 主机名 |
| :---- | :---- | :---- |
| k8s master | 192.168.123.250 | node1 |
| k8s node | 192.168.123.248 | node2 |
| k8s node | 192.168.123.249 | node3 |

### 安装步骤

如果你正在使用 `kube-proxy`，需要先停止 kube-proxy 服务，并且删除相关 iptables 规则。

```bash
$ systemctl stop kube-proxy
$ kube-proxy --cleanup-iptables
```

接下来以 `daemonset` 运行 kube-router，这里我们使用 DR 模式。

```bash
$ kubectl --namespace=kube-system create configmap kube-proxy  --from-file=kubeconfig.conf=/root/.kube/config
$ wget https://raw.githubusercontent.com/cloudnativelabs/kube-router/master/daemonset/kubeadm-kuberouter-all-features-dsr.yaml

# 将 kubeadm-kuberouter-all-features-dsr.yaml 里的 --run-router 参数和 --run-firewall 参数的值改为 false
$ kubectl create -f kubeadm-kuberouter-all-features-dsr.yaml
```

在每台机器上查看 lvs 条目

```bash
$ ipvsadm -Ln

IP Virtual Server version 1.2.1 (size=4096)
Prot LocalAddress:Port Scheduler Flags
  -> RemoteAddress:Port           Forward Weight ActiveConn InActConn
TCP  10.254.0.1:443 rr persistent 10800
  -> 192.168.123.250:6443         Masq    1      0          0
  
$ ipvsadm -S -n

-A -t 10.254.0.1:443 -s rr -p 10800
-a -t 10.254.0.1:443 -r 192.168.123.250:6443 -m -w 1
```

可以看出，kube-router 使用的是 lvs 的 nat 模式。

### 创建一个应用测试 kube-router

```bash
$ kubectl run whats-my-ip --image=cloudnativelabs/whats-my-ip --replicas=3

# 暴露服务
$ kubectl expose deploy whats-my-ip --target-port=8080 --port=8080
```

查看创建好的服务

```bash
$ kubectl get pods -owide

NAME                           READY     STATUS    RESTARTS   AGE       IP               NODE
whats-my-ip-845d4ff4f6-d2ptz   1/1       Running   0          23h       172.20.135.8     192.168.123.249
whats-my-ip-845d4ff4f6-jxzzn   1/1       Running   0          23h       172.20.166.130   192.168.123.250
whats-my-ip-845d4ff4f6-szhhd   1/1       Running   0          34s       172.20.104.9     192.168.123.248

$ kubectl get svc

NAME          TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)    AGE
kubernetes    ClusterIP   10.254.0.1       <none>        443/TCP    45d
whats-my-ip   ClusterIP   10.254.108.117   <none>        8080/TCP   16s
```

查看 lvs 规则条目

```bash
$ ipvsadm -Ln

IP Virtual Server version 1.2.1 (size=4096)
Prot LocalAddress:Port Scheduler Flags
  -> RemoteAddress:Port           Forward Weight ActiveConn InActConn
TCP  10.254.0.1:443 rr persistent 10800
  -> 192.168.123.250:6443         Masq    1      0          0
TCP  10.254.175.147:8080 rr
  -> 172.20.104.9:8080            Masq    1      0          0
  -> 172.20.135.8:8080            Masq    1      0          0
  -> 172.20.166.130:8080          Masq    1      0          0
```

可以发现本机的 `Cluster IP` 代理后端真实 `Pod IP`，使用 rr 算法。

通过 `ip a` 可以看到，每添加一个服务，node 节点上面的 `kube-dummy-if` 网卡就会增加一个虚IP。

### session affinity

Service 默认的策略是，通过 round-robin 算法来选择 backend Pod。 要实现基于客户端 IP 的会话亲和性，可以通过设置 `service.spec.sessionAffinity` 的值为 `ClientIP` （默认值为 "None"）。

```bash
$ kubectl delete svc whats-my-ip
$ kubectl expose deploy whats-my-ip --target-port=8080 --port=8080 --session-affinity=ClientIP

$ ipvsadm -Ln

IP Virtual Server version 1.2.1 (size=4096)
Prot LocalAddress:Port Scheduler Flags
  -> RemoteAddress:Port           Forward Weight ActiveConn InActConn
TCP  10.254.0.1:443 rr persistent 10800
  -> 192.168.123.250:6443         Masq    1      0          0
TCP  10.254.226.105:8080 rr persistent 10800
  -> 172.20.135.8:8080            Masq    1      0          0
  -> 172.20.166.130:8080          Masq    1      0          0
  -> 172.20.104.9:8080            Masq    1      0          0
  
$ ipvsadm -S -n

-A -t 10.254.0.1:443 -s rr -p 10800
-a -t 10.254.0.1:443 -r 192.168.123.250:6443 -m -w 1
-A -t 10.254.226.105:8080 -s rr -p 10800
-a -t 10.254.226.105:8080 -r 172.20.135.8:8080 -m -w 1
-a -t 10.254.226.105:8080 -r 172.20.166.130:8080 -m -w 1
-a -t 10.254.226.105:8080 -r 172.20.104.9:8080 -m -w 1
```

可以看到 lvs 的规则条目里多了个 `persistent`，即 lvs 的持久连接，关于 lvs 持久连接的具体内容可以参考我的另一篇博文 [LVS负载均衡之持久性连接介绍](/posts/lvs-persistent-connection/)。

可以通过设置 `service.spec.sessionAffinityConfig.clientIP.timeoutSeconds` 的值来修改 lvs 的 `persistence_timeout` 超时时间。

```yaml
$ kubectl get svc whats-my-ip -o yaml

apiVersion: v1
kind: Service
metadata:
  creationTimestamp: 2018-04-20T08:16:38Z
  labels:
    run: whats-my-ip
  name: whats-my-ip
  namespace: default
  resourceVersion: "6323769"
  selfLink: /api/v1/namespaces/default/services/whats-my-ip
  uid: 26315fdf-4473-11e8-8388-005056a1bc83
spec:
  clusterIP: 10.254.226.105
  ports:
  - port: 8080
    protocol: TCP
    targetPort: 8080
  selector:
    run: whats-my-ip
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800
  type: ClusterIP
status:
  loadBalancer: {}
```

### NodePort

```shell
$ kubectl delete svc whats-my-ip
$ kubectl expose deploy whats-my-ip --target-port=8080 --port=8080 --type=NodePort

$ ipvsadm -Ln

IP Virtual Server version 1.2.1 (size=4096)
Prot LocalAddress:Port Scheduler Flags
  -> RemoteAddress:Port           Forward Weight ActiveConn InActConn
TCP  192.168.123.249:34507 rr
  -> 172.20.135.8:8080            Masq    1      0          0
  -> 172.20.166.130:8080          Masq    1      0          0
  -> 172.20.104.9:8080            Masq    1      0          0
TCP  10.254.0.1:443 rr persistent 10800
  -> 192.168.123.250:6443         Masq    1      0          0
TCP  10.254.175.147:8080 rr
  -> 172.20.135.8:8080            Masq    1      0          0
  -> 172.20.166.130:8080          Masq    1      0          0
  -> 172.20.104.9:8080            Masq    1      0          0
```

可以看到不仅有虚拟IP条目，还多了对应主机的 lvs 条目。

### 更改算法

+ 最少连接数

```bash
$ kubectl annotate service my-service "kube-router.io/service.scheduler=lc"
```

+ 轮询

```bash
$ kubectl annotate service my-service "kube-router.io/service.scheduler=rr"
```

+ 源地址哈希

```bash
$ kubectl annotate service my-service "kube-router.io/service.scheduler=sh"
```

+ 目的地址哈希

```bash
$ kubectl annotate service my-service "kube-router.io/service.scheduler=dh"
```

## 问题解决

----

接下来需要面对一些非常棘手的问题，我尽可能将问题描述清楚。

<p id="div-border-top-red">
<strong>问题1：</strong>在集群内某个节点主机上通过 <code>SVC IP+Port</code> 访问某个应用时，如果 lvs 转到后端的 pod 在本主机上，那么可以访问，如果该 pod 不在本主机上，那么无法访问。
</p>

可以通过抓包来看一下，现在 `service whats-my-ip` 后端有三个 pod，分别运行在 `node1`、`node2` 和 `node3` 上。

```shell
$ kubectl get pods -owide

NAME                           READY     STATUS    RESTARTS   AGE       IP               NODE
whats-my-ip-845d4ff4f6-d2ptz   1/1       Running   0          23h       172.20.135.8     192.168.123.249
whats-my-ip-845d4ff4f6-jxzzn   1/1       Running   0          23h       172.20.166.130   192.168.123.250
whats-my-ip-845d4ff4f6-szhhd   1/1       Running   0          34s       172.20.104.9     192.168.123.248
```

在 `node3` 上访问 `whats-my-ip` 服务：

```shell
$ ip a show|grep 10.254.175.147

    inet 10.254.175.147/32 brd 10.254.175.147 scope link kube-dummy-if

$ ipvsadm -Ln -t 10.254.175.147:8080

Prot LocalAddress:Port Scheduler Flags
  -> RemoteAddress:Port           Forward Weight ActiveConn InActConn
TCP  10.254.175.147:8080 rr
  -> 172.20.104.9:8080            Masq    1      0          0
  -> 172.20.135.8:8080            Masq    1      0          0
  -> 172.20.166.130:8080          Masq    1      0          0

# 第一次访问，不通
$ curl 10.254.175.147:8080

# 第二次访问
$ curl 10.254.175.147:8080

HOSTNAME:whats-my-ip-845d4ff4f6-d2ptz IP:172.20.135.8

# 第三次访问，不通
$ curl 10.254.175.147:8080
```

同时在 `node1` 上抓包：

```shell
$ tcpdump -i ens160 host 172.20.166.130 -nn

tcpdump: verbose output suppressed, use -v or -vv for full protocol decode
listening on ens160, link-type EN10MB (Ethernet), capture size 262144 bytes
03:27:26.337553 IP 10.254.175.147.42036 > 172.20.166.130.8080: Flags [S], seq 405854371, win 43690, options [mss 65495,sackOK,TS val 359417229 ecr 0,nop,wscale 7], length 0
03:27:27.340131 IP 10.254.175.147.42036 > 172.20.166.130.8080: Flags [S], seq 405854371, win 43690, options [mss 65495,sackOK,TS val 359418232 ecr 0,nop,wscale 7], length 0
```

可以看到 `node1` 将数据包丢弃了，因为源IP是 `10.254.175.147`，系统认为这是 node1 自己本身。

根本原因可以查看 `node3` 的路由表：

```shell
$ ip route show table local|grep 10.254.175.147

local 10.254.175.147 dev kube-dummy-if proto kernel scope host src 10.254.175.147
broadcast 10.254.175.147 dev kube-dummy-if proto kernel scope link src 10.254.175.147
```

`src` 的值用来告诉该 host 使用 `10.254.175.147` 作为 `source address`，可以通过修改路由表来解决这个问题：

```shell
$ ip route replace local 10.254.175.147 dev kube-dummy-if proto kernel scope host src 192.168.123.249 table local
```

再次在 `node1` 上抓包可以发现源IP已经变成了 `192.168.123.249`。

```shell
$ tcpdump -i ens160 host 172.20.166.130 -nn

tcpdump: verbose output suppressed, use -v or -vv for full protocol decode
listening on ens160, link-type EN10MB (Ethernet), capture size 262144 bytes
03:39:42.824412 IP 192.168.123.249.52684 > 172.20.166.130.8080: Flags [S], seq 3520353543, win 43690, options [mss 65495,sackOK,TS val 360153716 ecr 0,nop,wscale 7], length 0
03:39:42.824542 IP 172.20.166.130.8080 > 192.168.123.249.52684: Flags [S.], seq 4057001749, ack 3520353544, win 28960, options [mss 1460,sackOK,TS val 360143668 ecr 360153716,nop,wscale 7], length 0
03:39:42.824706 IP 192.168.123.249.52684 > 172.20.166.130.8080: Flags [.], ack 1, win 342, options [nop,nop,TS val 360153716 ecr 360143668], length 0
03:39:42.825066 IP 192.168.123.249.52684 > 172.20.166.130.8080: Flags [P.], seq 1:84, ack 1, win 342, options [nop,nop,TS val 360153716 ecr 360143668], length 83: HTTP: GET / HTTP/1.1
03:39:42.825112 IP 172.20.166.130.8080 > 192.168.123.249.52684: Flags [.], ack 84, win 227, options [nop,nop,TS val 360143669 ecr 360153716], length 0
03:39:42.825589 IP 172.20.166.130.8080 > 192.168.123.249.52684: Flags [P.], seq 1:174, ack 84, win 227, options [nop,nop,TS val 360143669 ecr 360153716], length 173: HTTP: HTTP/1.1 200 OK
03:39:42.825735 IP 192.168.123.249.52684 > 172.20.166.130.8080: Flags [.], ack 174, win 350, options [nop,nop,TS val 360153717 ecr 360143669], length 0
03:39:42.825787 IP 192.168.123.249.52684 > 172.20.166.130.8080: Flags [F.], seq 84, ack 174, win 350, options [nop,nop,TS val 360153717 ecr 360143669], length 0
03:39:42.825882 IP 172.20.166.130.8080 > 192.168.123.249.52684: Flags [F.], seq 174, ack 85, win 227, options [nop,nop,TS val 360143669 ecr 360153717], length 0
03:39:42.826002 IP 192.168.123.249.52684 > 172.20.166.130.8080: Flags [.], ack 175, win 350, options [nop,nop,TS val 360153718 ecr 360143669], length 0
```

<br />
<p id="div-border-top-red">
<strong>问题2：</strong>在集群内某个节点主机上通过 <code>SVC IP+Port</code> 访问 <code>service kubernetes</code> 时，如果该节点是 master 节点（即 kube-apiserver 运行在该节点上），那么可以访问，如果该节点不是 master 节点，那么无法访问。
</p>

原因和问题1类似，可以通过修改路由表解决：

```shell
# 例如在 node3 节点上
$ ip route replace local 10.254.0.1 dev kube-dummy-if proto kernel scope host src 192.168.123.249 table local
```

<br />
<p id="div-border-top-red">
<strong>问题3：</strong>在某个 pod 内访问该 pod 本身的 <code>ClusterIP:Port</code>，如果 lvs 转到后端的 IP 是该 pod 的 IP，那么无法访问，如果不是则可以访问。
</p>

`kube-proxy` 的 iptables 模式也有同样的问题，这个问题可以忽略。

### 总结

问题1和问题2修改路由表可以通过批量 shell 脚本来解决：

```shell
#!/bin/sh

default_if=$(ip route|grep default|awk '{print $5}')
localip=$(ip a show ${default_if}|egrep -v inet6|grep inet|awk '{print $2}'|awk -F"/" '{print $1}')
svc_ip=$(ip route show table local|egrep -v broadcast|grep kube-dummy-if|awk '{print $2}')

for ip in $svc_ip; do
ip route replace local $ip dev kube-dummy-if proto kernel scope host src $localip table local;
done
```

如果想要在创建 `service` 时自动修改路由表，最好还是将该 fix 整合进 kube-router 的源码中。

## 参考

----

+ [Kube-router Documentation](https://github.com/cloudnativelabs/kube-router/blob/master/docs/README.md)
+ [kube-router之负载均衡器](https://www.jianshu.com/p/d69b40580c87)
+ [bad routing from host to service IP on same host](https://github.com/cloudnativelabs/kube-router/issues/376)

