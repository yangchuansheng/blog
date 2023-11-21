---
title: "Kubernetes 使用集群联邦实现多集群管理"
subtitle: "使用联邦服务进行跨集群服务发现"
date: 2018-03-22T09:36:27Z
draft: false
author: 米开朗基杨
toc: true
categories: cloud-native
tags: ["kubernetes"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191204220637.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

在云计算环境中，服务的作用距离范围从近到远一般可以有：

+ 同主机（Host，Node）
+ 跨主机同可用区（Available Zone）
+ 跨可用区同地区（Region）
+ 跨地区同服务商（Cloud Service Provider）
+ 跨云平台

K8s 的设计定位是单一集群在同一个地域内，因为同一个地区的网络性能才能满足 K8s 的调度和计算存储连接要求。

但是实际情况中经常遇到的一些问题，就是单个集群通常无法跨单个云厂商的多个 Region，更不用说支持跨跨域不同的云厂商。这样会给企业带来一些担忧，如何应对可用区级别的 Fail，以及容灾备份？是否会造成厂商锁定，增加迁移成本？如何应对线上线下突发流量？如何统一管理调度容器资源？单个集群规模的上限等等。

集群联邦（Federation）可以一定程度上解决这些问题。`Federation` 是可以将分布在多个 Region 或者多个云厂商的 Kubernetes 集群整合成一个大的集群，统一管理与调度。

## <span id="inline-toc">1.</span> Kubernetes集群联邦介绍
------

### 管理多个 kuberntes 集群

**集群联邦**在架构上同 kubernetes 集群很相似。有一个**集群联邦**的 API server 提供一个标准的 Kubernetes API，并且通过 etcd 来存储状态。不同的是，一个通常的Kubernetes 只是管理节点计算，而**集群联邦**管理所有的 kubernetes 集群。

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/PJSV9a.jpg)

Federation主要包括三个组件：

+ **federation-apiserver :** 类似 `kube-apiserver`，但提供的是跨集群的 REST API
+ **federation-controller-manager :** 类似 `kube-controller-manager`，但提供多集群状态的同步机制
+ **kubefed :** Federation 管理命令行工具

用户可以通过 Federation 的 API Server 注册该 Federation 的成员 `K8s Cluster`。当用户通过 Federation 的 API Server 创建、更改 API 对象时，`Federation API Server` 会在自己所有注册的子 K8s Cluster 都创建一份对应的 API 对象。

在提供业务请求服务时，`K8s Federation` 会先在自己的各个子 Cluster 之间做负载均衡，而对于发送到某个具体 `K8s Cluster` 的业务请求，会依照这个 K8s Cluster 独立提供服务时一样的调度模式去做 K8s Cluster 内部的负载均衡。而Cluster 之间的负载均衡是通过域名服务的负载均衡来实现的。

所有的设计都尽量不影响 K8s Cluster 现有的工作机制，这样对于每个子 K8s 集群来说，并不需要更外层的有一个 K8s Federation，也就是意味着所有现有的 K8s 代码和机制不需要因为 `Federation` 功能有任何变化。

### 跨集群服务发现

Kubernetes 有一个标准的插件：`kube-dns`，这个插件可以在集群内部提供 DNS 服务，通过 DNS 解析 service 名字来访问 kubernetes 服务。<br />

Kubernetes 服务是由一组 kubernetes POD 组成的，这些 POD 是一些已经容器化了的应用，这些 POD 前面使用到了负载均衡器。<br />

假如我们有一个 kubernetes 集群，这个集群里面有一个服务叫做 mysql，这个服务是由一组 mysql POD 组成的。在这个 kubernetes 集群中，其他应用可以通过 DNS 来访问这个 mysql 服务。

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/aRaBGQ.jpg)

### 跨集群调度

<p id="div-border-top-red">为了追求高可用性和更高的性能，集群联邦能够把不同 POD 指定给不同的 Kubernetes 集群中。集群联邦调度器将决定如何在不同 kubernetes 集群中分配工作负载。</p>

通过跨集群调度，我们可以：

+ 跨 kubernetes 集群均匀的调度任务负载
+ 将各个 kubernetes 集群的工作负载进行最大化，如果当前 kubernetes 集群超出了承受能力，那么将额外的工作负载路由到另一个比较空闲的 kubernetes 集群中
+ 根据应用地理区域需求，调度工作负载到不同的 kubernetes 集群中，对于不同的终端用户，提供更高的带宽和更低的延迟。

### 集群高可用，故障自动迁移

集群联邦可以跨集群冗馀部署，当某个集群所在区域出现故障时，并不影响整个服务。集群联邦还可以检测集群是否为不可用状态，如果发现某个集群为不可用状态时，可以将失败的任务重新分配给集群联邦中其他可用状态的集群上。

## <span id="inline-toc">2.</span> 使用集群联邦实现多集群管理
------

### 系统环境

| 功能组件 | 系统组件 | 系统版本 | 设备数量 | 备注
|:-------|:------:|:-------|:--------|:--------
| 联邦集群控制平面 | k8s 1.9+Federation | CentOS 7.3 | 3台 | 联邦集群控制平面
| K8s集群01 | k8s 1.9 master+node | CentOS 7.3 | 3台 | 联邦集群节点

### 安装 kubefed

选择其中的一个集群作为主集群，这个主集群将运行组成联邦控制面板的所有组件。

使用下列命令下载对应最新发行的 `kubefed` 安装包并将安装包里的二进制文件解压出来：

```bash
$ curl -LO https://storage.cloud.google.com/kubernetes-federation-release/release/${RELEASE-VERSION}/federation-client-linux-amd64.tar.gz
$ tar -xzvf federation-client-linux-amd64.tar.gz
```

请用[federation release page](https://github.com/kubernetes/federation/releases)页面实际的版本号替换变量 `RELEASE-VERSION`。

将解压出来的内容复制到你的环境变量 `$PATH` 里的随便一个路径， 并设置可执行权限。

```bash
$ cp federation/client/bin/kubefed /usr/local/bin
$ chmod +x /usr/local/bin/kubefed
```

### 配置 context

在准备配置联邦集群的 DCE 集群中配置两个 DCE 集群的 `context`。让改节点能通过切换 `context` 连接不同的子集群。

先创建本地集群的 `kubeconfig` 文件

```bash
$ export KUBE_APISERVER="https://192.168.123.250:6443"
# 设置集群参数
$ kubectl config set-cluster kubernetes \
  --certificate-authority=/etc/kubernetes/ssl/ca.pem \
  --embed-certs=true \
  --server=${KUBE_APISERVER}
# 设置客户端认证参数
$ kubectl config set-credentials admin \
  --client-certificate=/etc/kubernetes/ssl/admin.pem \
  --embed-certs=true \
  --client-key=/etc/kubernetes/ssl/admin-key.pem
# 设置上下文参数
$ kubectl config set-context kubernetes \
  --cluster=kubernetes \
  --user=admin
# 设置默认上下文
$ kubectl config use-context kubernetes
```

生成的 kubeconfig 被保存到 `~/.kube/config` 文件。

{{< notice note >}}
~/.kube/config 文件拥有对该集群的最高权限，请妥善保管。
{{< /notice >}}

配置结果如下：

```bash
$ kubectl config get-contexts

CURRENT   NAME          CLUSTER       AUTHINFO      NAMESPACE
*         kubernetes    kubernetes    admin
```

### 设置 CoreDNS 作为集群联邦的 DNS 提供商
#### 前提

+ 为启用 `CoreDNS` 来实现跨联邦集群的服务发现，联邦的成员集群中必须支持 `LoadBalancer` 服务。（<font color="red">本地集群默认不支持 `LoadBalancer` 服务，所以要让本地集群支持 `LoadBalancer` 服务才能使用 `coredns` 来实现 federation 的服务发现功能！！！</font>）
+ 我们可以利用 `helm charts` 来部署 CoreDNS。 CoreDNS 部署时会以 etcd 作为后端，并且 etcd 应预先安装。 etcd 也可以利用 helm charts 进行部署。
+ 所有加入 federation 的集群的 node 必须打上以下的标签：<br />
   `failure-domain.beta.kubernetes.io/region=<region>`<br />
   `failure-domain.beta.kubernetes.io/zone=<zone>`

#### 使本地集群支持 LoadBalancer 服务

为了使本地集群支持 `LoadBalancer` 服务，可以参考以下两种实现方案：

+ [keepalived-cloud-provider](https://github.com/munnerz/keepalived-cloud-provider)
+ [metalLB](https://github.com/google/metallb)

这里我们选择使用 `metalLB`。

metalLB 的部署很简单，直接使用 yaml 文件部署：

```bash
$ kubectl apply -f https://raw.githubusercontent.com/google/metallb/v0.5.0/manifests/metallb.yaml
```

具体参考 [https://metallb.universe.tf/installation/](https://metallb.universe.tf/installation/)

部署完成后需要为 LoadBalancer 服务选择一个特定的 IP 地址池，这里通过 configmap 来创建。

下面是一个简单示例：

```bash
$ cat metallb-cm.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  namespace: metallb-system
  name: config
data:
  config: |
    address-pools:
    - name: default
      protocol: layer2
      addresses:
      - 192.168.1.58-192.168.1.60

$ kubectl create -f metallb-cm.yaml
```

更多高级配置请参考：[https://metallb.universe.tf/configuration/](https://metallb.universe.tf/configuration/)

现在本地集群已经支持 LoadBalancer 服务了，下面我们开始 federation 的旅程吧！:clap:

#### 安装 helm

首先需要安装 `helm` 客户端

```bash
$ curl https://raw.githubusercontent.com/kubernetes/helm/master/scripts/get > get_helm.sh
$ chmod 700 get_helm.sh
$ ./get_helm.sh
```

创建 tiller 的 `serviceaccount` 和 `clusterrolebinding`

```bash
$ kubectl create serviceaccount --namespace kube-system tiller
$ kubectl create clusterrolebinding tiller-cluster-rule --clusterrole=cluster-admin --serviceaccount=kube-system:tiller
```

然后安装 helm 服务端 `tiller`

```bash
$ helm init
```

为应用程序设置 `serviceAccount`：

```bash
$ kubectl patch deploy --namespace kube-system tiller-deploy -p '{"spec":{"template":{"spec":{"serviceAccount":"tiller"}}}}'
```

检查是否安装成功：

```bash
$ kubectl -n kube-system get pods|grep tiller

tiller-deploy-7bf964fff8-sklts                1/1       Running   0          7h

$ helm version

Client: &version.Version{SemVer:"v2.8.2", GitCommit:"a80231648a1473929271764b920a8e346f6de844", GitTreeState:"clean"}
Server: &version.Version{SemVer:"v2.8.2", GitCommit:"a80231648a1473929271764b920a8e346f6de844", GitTreeState:"clean"}
```

#### 部署 etcd

下载 `helm charts` 仓库

```bash
$ git clone https://github.com/kubernetes/charts.git
```

部署 `etcd-operator`（etcd-operator 会通过 kubernetes 的 `CustomResourceDefinition` 自动创建 `etcd cluster`）

```bash
$ cd charts

$ helm install --name etcd-operator stable/etcd-operator --set rbac.install=true,rbac.apiVersion=v1,customResources.createEtcdClusterCRD=true
```

检查是否部署成功

```bash
$ kubectl get pods

NAME                                                              READY     STATUS    RESTARTS   AGE
etcd-cluster-6skfqj9mwp                                           1/1       Running   0          7m
etcd-cluster-6w8ntzvkwm                                           1/1       Running   0          8m
etcd-cluster-mclzhqrldf                                           1/1       Running   0          7m
etcd-operator-etcd-operator-etcd-backup-operator-5df985959bvvkw   1/1       Running   0          9m
etcd-operator-etcd-operator-etcd-operator-58d98b95c-x44bz         1/1       Running   0          9m
etcd-operator-etcd-operator-etcd-restore-operator-8688c7684nmdh   1/1       Running   0          9m

$ kubectl get crd

NAME                                    AGE
etcdbackups.etcd.database.coreos.com    1d
etcdclusters.etcd.database.coreos.com   1d
etcdrestores.etcd.database.coreos.com   1d

$ kubectl get crd etcdclusters.etcd.database.coreos.com -o yaml

apiVersion: apiextensions.k8s.io/v1beta1
kind: CustomResourceDefinition
metadata:
...
...
spec:
  group: etcd.database.coreos.com
  names:
    kind: EtcdCluster
    listKind: EtcdClusterList
    plural: etcdclusters
    shortNames:
    - etcd
    singular: etcdcluster
  scope: Namespaced
  version: v1beta2
...
...

$ kubectl get EtcdCluster

NAME           AGE
etcd-cluster   11m

$ kubectl get svc

NAME                    TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)             AGE
etcd-cluster            ClusterIP   None             <none>        2379/TCP,2380/TCP   17m
etcd-cluster-client     ClusterIP   10.254.140.7     <none>        2379/TCP            17m
etcd-restore-operator   ClusterIP   10.254.177.113   <none>        19999/TCP           18m
kubernetes              ClusterIP   10.254.0.1       <none>        443/TCP             16d
```

部署成功后，可以在 host 集群内通过 http://etcd-cluster-client.default:2379 端点访问 etcd。

#### 部署 CoreDNS

首先需要定制 `CoreDNS chart` 模板的默认配置，它会覆盖 `CoreDNS chart` 的默认配置参数。

```bash
$ cat Value.yaml

isClusterService: false
serviceType: "NodePort"
plugins:
  kubernetes:
    enabled: false
  etcd:
    enabled: true
    zones:
    - "example.com."
    endpoint: "http://etcd-cluster-client.default:2379"
```

参数说明：

+ `isClusterService`: 指定 CoreDNS 是否以集群服务的形式部署（默认为是）。 需要将其设置为 “false”，以使 CoreDNS 以 Kubernetes 应用服务的形式部署，否则会与集群的 dns 服务 kubedns 冲突。
+ `serviceType`: 指定为 CoreDNS 创建的 Kubernetes 服务类型。 选择 “NodePort”，以使得 CoreDNS 服务能够从 Kubernetes 集群外部访问。
+ `plugins.kubernetes`: 默认是启用的，通过将 `plugins.kubernetes.enabled` 设置为 “false” 来禁用 plugins.kubernetes。
+ 通过将 plugins.etcd.enabled 设置为 “true” 来启用 plugins.etcd。
+ 通过设置 `plugins.etcd.zones` 来配置 CoreDNS 被授权的 DNS 区域（联邦区域）。
+ 通过设置 `plugins.etcd.endpoint` 来设置先前部署的 etcd 的端点。

现在运行以下命令来部署 CoreDNS：

```bash
$ helm install --name coredns -f Values.yaml stable/coredns
```

验证部署：

```bash
$ kubectl get pods -l app=coredns-coredns

NAME                               READY     STATUS    RESTARTS   AGE
coredns-coredns-57b54ddb97-xffnc   1/1       Running   0          1d

$ kubectl get svc -l app=coredns-coredns

NAME              TYPE       CLUSTER-IP       EXTERNAL-IP   PORT(S)                                    AGE
coredns-coredns   NodePort   10.254.198.211   <none>        53:27165/UDP,53:27165/TCP,9153:26492/TCP   1d
```

#### 使用 CoreDNS 作为 DNS 提供商来部署 Federation

可以使用 `kubefed init` 来部署联邦控制平面。 可以通过指定两个附加参数来选择 CoreDNS 作为 DNS 提供商。

```bash
--dns-provider=coredns
--dns-provider-config=coredns-provider.conf
```

coredns-provider.conf 内容如下：

```bash
[Global]
etcd-endpoints = http://etcd-cluster-client.default:2379
zones = example.com.
coredns-endpoints = <coredns-server-ip>:<port>
```

+ `etcd-endpoints` 是访问 etcd 的端点。
+ `zones` 是 CoreDNS 被授权的联邦区域，其值与 `kubefed init` 的 –-dns-zone-name 参数相同。
+ `coredns-endpoints` 是访问 CoreDNS 服务器的端点。 这是一个 1.7 版本开始引入的可选参数。

{{< notice note >}}
CoreDNS 配置中的 <code>plugins.etcd.zones</code> 与 kubefed init 的 `--dns-zone-name` 参数应匹配。
{{< /notice >}}

给所有 node 打上 `region` 和 `zone` 的标签：

```bash
$ kubectl label nodes 192.168.123.248 failure-domain.beta.kubernetes.io/zone=shanghai failure-domain.beta.kubernetes.io/region=yangpu

$ kubectl label nodes 192.168.123.249 failure-domain.beta.kubernetes.io/zone=shanghai failure-domain.beta.kubernetes.io/region=yangpu

$ kubectl label nodes 192.168.123.250 failure-domain.beta.kubernetes.io/zone=shanghai failure-domain.beta.kubernetes.io/region=yangpu
```

通过本条命令初始化 federation 控制平面，参数如下：

```bash
$ kubefed init federation \ # 联邦的名字
  --host-cluster-context=kubernetes \ # 主集群的context名字
  --dns-provider=coredns \ # DNS服务提供商
  --dns-zone-name="example.com." \ # 前面注册好的域名，必须以.结束
  --dns-provider-config="coredns-provider.conf" \ # coredns 配置文件
  --api-server-service-type="NodePort" \
  --api-server-advertise-address="192.168.123.250"

  Creating a namespace federation-system for federation system components... done
  Creating federation control plane service..... done
  Creating federation control plane objects (credentials, persistent volume claim)... done
  Creating federation component deployments... done
  Updating kubeconfig... done
  Waiting for federation control plane to come up..................................................................................................................................................... done
  Federation API server is running at: 10.110.151.216
```

观察以上输出信息，该命令做了以下几件事情：

1. 创建一个 namespace `federation-system`

    ```bash
    $ kubectl get ns

    NAME                STATUS    AGE
    default             Active    8d
    federation-system   Active    8s
    kube-public         Active    8d
    kube-system         Active    8d
    my-namespace        Active    7d
    ```

2. 创建两个服务 `federation-apiserver` 和 `federation-controller-manager`

    ```bash
    $ kubectl -n federation-system get pods

    NAME                                             READY     STATUS         RESTARTS   AGE
    federation-apiserver-909415585-wktmw             1/1       Running   0          2s
    federation-controller-manager-4247980660-c8ls5   1/1       Running   1          3s
    ```

3. 创建一个 ServiceAccount `federation-controller-manager`

    ```bash
    $ kubectl -n federation-system get sa

    NAME                            SECRETS   AGE
    default                         1         31m
    federation-controller-manager   1         31m
    ```

4. 创建一个 Role `federation-system:federation-controller-manager`

    ```bash
    $ kubectl -n federation-system get role

    NAME                                              AGE
    federation-system:federation-controller-manager   38m
    ```

5. 创建一个 RoleBinding `federation-system:federation-controller-manager`

    ```bash
    $ kubectl -n federation-system get rolebinding

    NAME                                              AGE
    federation-system:federation-controller-manager   39m
    ```

6. 创建一个 context `federation`

    ```bash
    $ kubectl config get-contexts

    CURRENT   NAME         CLUSTER      AUTHINFO     NAMESPACE
              federation   federation   federation
    *         kubernetes   kubernetes   admin
    ```

{{< notice note >}}
默认情况下，<code>kubefed init</code> 通过动态创建 PV 的方式为 etcd 创建持久化存储。如果 kubernetes 集群不支持动态创建 PV，则可以预先创建 PV，注意 PV 要匹配 `kubefed` 的 PVC。或者使用 <code>hostpath</code>，同时指定调度节点。
{{< /notice >}}

#### 添加集群至 federation

目前为止您已经成功的初始化好了 `Federation` 的控制平面。接下来需要将各个子集群加入到 Federation 集群中。

添加集群 `kubernetes`：

```bash
$ kubefed join kubernetes \ #加入联邦的集群命名名字
  --context=federation \ #联邦的context
  --cluster-context=kubernetes \ #要添加集群的context
  --host-cluster-context=kubernetes #主集群的context

$ kubectl --context=federation get cluster

NAME          STATUS    AGE
kubernetes    Ready     6d
```

通过我的观察，以上过程在 `加入 federation 的 kubernetes 集群中` 做了以下几件事情：

1. 在 namespace `federation-system` 中创建一个 ServiceAccount `kubernetes-kubernetes`

    ```bash
    $ kubectl -n federation-system get sa

    NAME                            SECRETS   AGE
    default                         1         45m
    federation-controller-manager   1         45m
    kubernetes-kubernetes           1         8m
    ```

2. 创建一个 ClusterRole `federation-controller-manager:federation-kubernetes-kubernetes`

    ```bash
    $ kubectl get clusterrole|egrep "NAME|federation"

    NAME                                                                   AGE
    federation-controller-manager:federation-kubernetes-kubernetes         10m
    ```

3. 创建一个 ClusterRoleBinding `federation-controller-manager:federation-kubernetes-kubernetes`

    ```bash
    $ kubectl get clusterrolebinding|egrep "NAME|federation"

    NAME                                                             AGE
    federation-controller-manager:federation-kubernetes-kubernetes   11m
    ```

整个过程是否还进行了其他操作，暂时没有发现，有待继续研究。

**介绍下集群查询，移除集群，删除联邦等命令 :** 

查询注册到 Federation 的 kubernetes 集群列表

```bash
$ kubectl --context=federation get clusters

NAME          STATUS    AGE
kubernetes    Ready     8m
```

移除 `kubernetes` 集群

```bash
$ kubefed unjoin kubernetes --host-cluster-context=kubernetes --context=federation

Successfully removed cluster "kubernetes" from federation

$ kubectl --context=federation get clusters

No resources found.
```

集群联邦控制平面的删除功能还在开发中，目前可以通过删除 namespace `federation-system` 的方法来清理（注意pv不会删除）。命令在 host-cluster-context 上执行。

```bash
$ kubectl delete ns federation-system
```

## <span id="inline-toc">3.</span> Federation 支持的服务
------

集群联邦支持以下联邦资源，这些资源会自动在所有注册的 `kubernetes` 集群中创建。

+ Federated ConfigMap
+ Federated Service
+ Federated DaemonSet
+ Federated Deployment
+ Federated Ingress
+ Federated Namespaces
+ Federated ReplicaSets
+ Federated Secrets
+ Federated Events（仅存在federation控制平面）
+ Federated Jobs（v1.8+）
+ Federated Horizontal Pod Autoscaling (HPA，v1.8+)

示例：

**创建 `deployment`**

```bash
$ cat nginx-deployment.yaml

apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 2
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80

$ kubectl --context=federation create ns default
$ kubectl --context=federation create -f nginx-deployment.yaml
```

可以通过 `kubectl scale deploy nginx --replicas=3 --context=federation` 来扩展 nginx 副本，然后观察 nginx 应用在各个子集群中的分布情况。

```bash
$ kubectl --context=kubernetes get deploy
```

**通过 Federated Service 来实现跨集群服务发现**

```bash
$ cat nginx-svc.yaml

apiVersion: v1
kind: Service
metadata:
  name: nginx
  labels:
    app: nginx
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
    name: http
  selector:
    app: nginx

# 这会在所有注册到联邦的 kubernetes 集群中创建服务
$ kubectl --context=federation create -f nginx-svc.yaml

# 查看服务状态
$ kubectl --context=federation describe services nginx

Name:                     nginx
Namespace:                default
Labels:                   app=nginx
Annotations:              federation.kubernetes.io/service-ingresses={"items":[{"cluster":"kubernetes","items":[{"ip":"192.168.1.58"}]}]}
Selector:                 app=nginx
Type:                     LoadBalancer
IP:
LoadBalancer Ingress:     192.168.1.58
Port:                     http  80/TCP
TargetPort:               80/TCP
Endpoints:                <none>
Session Affinity:         None
External Traffic Policy:  Cluster
Events:                   <none>
```

可以通过 DNS 来访问联邦服务，访问格式包括以下几种：

+ `<service name>.<namespace>.<federation>`
+ `<service name>.<namespace>.<federation>.svc.<domain>`
+ `<service name>.<namespace>.<federation>.svc.<region>.<domain>`
+ `<service name>.<namespace>.<federation>.svc.<zone>.<region>.<domain>`

本例中可以通过以下几个域名来访问：

+ `nginx.default.federation`
+ `nginx.default.federation.svc.example.com`
+ `nginx.default.federation.svc.shanghai.example.com`
+ `nginx.default.federation.svc.shanghai.yangpu.example.com`

DNS 在 etcd 下的存储路径为：`/skydns`

```bash
$ kubectl exec etcd-cluster-fznzsrttt9 etcdctl ls /skydns/com/example/

/skydns/com/example/kubernetes
/skydns/com/example/svc
/skydns/com/example/yangpu

$ kubectl exec etcd-cluster-fznzsrttt9 etcdctl ls /skydns/com/example/yangpu/

/skydns/com/example/yangpu/shanghai
/skydns/com/example/yangpu/svc
```

## <span id="inline-toc">4.</span> 参考文档
------

+ [Kubernetes federation](https://kubernetes.io/docs/concepts/cluster-administration/federation/)
+ [Set up CoreDNS as DNS provider for Cluster Federation](https://kubernetes.io/docs/tasks/federation/set-up-coredns-provider-federation/)

