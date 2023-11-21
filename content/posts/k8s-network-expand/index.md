---
title: "Kubernetes 网络扩展"
subtitle: "通过边界网关和边界 DNS 直接访问 k8s 中的服务"
date: 2018-02-11T10:40:33Z
draft: false
author: 米开朗基杨
toc: true
categories: "kubernetes"
tags: ["kubernetes", "docker"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191204221704.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

## <span id="inline-toc">1.</span> Kubernetes 中服务暴露的方式

----

k8s 的服务暴露分为以下几种情况：

+ hostNetwork
+ hostPort
+ NodePort
+ LoadBalancer
+ Ingress

说是暴露 Pod 其实跟暴露 Service 是一回事，因为 Pod 就是 Service 的 backend。

### HostNetwork

这是一种直接定义 Pod 网络的方式。

如果在 Pod 中使用 `hostNotwork:true` 配置的话，在这种 pod 中运行的应用程序可以直接看到 pod 启动的主机的网络接口。在主机的所有网络接口上都可以访问到该应用程序。以下是使用主机网络的 pod 的示例定义：

```bash
apiVersion: v1
kind: Pod
metadata:
  name: influxdb
spec:
  hostNetwork: true
  containers:
    - name: influxdb
      image: influxdb
```

这种 Pod 的网络模式有一个用处就是可以将网络插件包装在 Pod 中然后部署在每个宿主机上，这样该 Pod 就可以控制该宿主机上的所有网络。

<p id="div-border-top-purple"><font color="red">缺点：</font>每次启动这个Pod的时候都可能被调度到不同的节点上，所有外部访问Pod的IP也是变化的，而且调度Pod的时候还需要考虑是否与宿主机上的端口冲突，因此一般情况下除非您知道需要某个特定应用占用特定宿主机上的特定端口时才使用 <code>hostNetwork: true</code> 的方式。</p>

### hostPort

这是一种直接定义 Pod 网络的方式。

`hostPort` 是直接将容器的端口与所调度的节点上的端口路由，这样用户就可以通过宿主机的 IP 加上来访问 Pod 了，如:

```bash
apiVersion: v1
kind: Pod
metadata:
  name: influxdb
spec:
  containers:
    - name: influxdb
      image: influxdb
      ports:
        - containerPort: 8086
          hostPort: 8086
```

<p id="div-border-top-purple"><font color="red">缺点：</font>因为 Pod 重新调度的时候该Pod被调度到的宿主机可能会变动，这样就变化了，用户必须自己维护一个 Pod 与所在宿主机的对应关系。</p>

### NodePort

NodePort 在 kubenretes 里是一个广泛应用的服务暴露方式。Kubernetes 中的 service 默认情况下都是使用的 ClusterIP 这种类型，这样的 service 会产生一个 ClusterIP，这个 IP 只能在集群内部访问，要想让外部能够直接访问 service，需要将 service type 修改为  `nodePort`。

```bash
apiVersion: v1
kind: Pod
metadata:
  name: influxdb
  labels:
    name: influxdb
spec:
  containers:
    - name: influxdb
      image: influxdb
      ports:
        - containerPort: 8086
```

同时还可以给 service 指定一个 `nodePort` 值，范围是 30000-32767，这个值在 API server 的配置文件中，用-- `service-node-port-range` 定义。

```bash
kind: Service
apiVersion: v1
metadata:
  name: influxdb
spec:
  type: NodePort
  ports:
    - port: 8086
      nodePort: 30000
  selector:
    name: influxdb
```

集群外就可以使用 kubernetes 任意一个节点的 IP 加上 30000 端口访问该服务了。kube-proxy 会自动将流量以 round-robin 的方式转发给该 service 的每一个 pod。

<p id="div-border-top-purple"><font color="red">缺点：</font>所有 node 上都会开启端口监听，且需要记住端口号。</p>

### LoadBalancer

`LoadBalancer` 只能在 service 上定义。这是公有云提供的负载均衡器，如 AWS、Azure、CloudStack、GCE 等。

```bash
kind: Service
apiVersion: v1
metadata:
  name: influxdb
spec:
  type: LoadBalancer
  ports:
    - port: 8086
  selector:
    name: influxdb
```

查看服务：

```bash
$ kubectl get svc influxdb

NAME       CLUSTER-IP     EXTERNAL-IP     PORT(S)          AGE
influxdb   10.97.121.42   10.13.242.236   8086:30051/TCP   39s
```

内部可以使用 ClusterIP 加端口来访问服务，如 19.97.121.42:8086。

外部可以用以下两种方式访问该服务：

+ 使用任一节点的 IP 加 30051 端口访问该服务
+ 使用 `EXTERNAL-IP` 来访问，这是一个 VIP，是云供应商提供的负载均衡器 IP，如 `10.13.242.236:8086`。

<p id="div-border-top-purple"><font color="red">缺点：</font>需要云服务商支持。</p>

### Ingress

`Ingress` 是自 kubernetes1.1 版本后引入的资源类型。必须要部署 Ingress controller 才能创建 Ingress 资源，Ingress controller 是以一种插件的形式提供。Ingress controller 是部署在 Kubernetes 之上的 Docker 容器。它的 Docker 镜像包含一个像 `nginx` 或 `HAProxy` 的负载均衡器和一个控制器守护进程。控制器守护程序从 Kubernetes 接收所需的 Ingress 配置。它会生成一个 nginx 或 HAProxy 配置文件，并重新启动负载平衡器进程以使更改生效。换句话说，Ingress controller 是由 Kubernetes 管理的负载均衡器。

Kubernetes Ingress 提供了负载平衡器的典型特性：HTTP 路由，粘性会话，SSL 终止，SSL 直通，TCP 和 UDP 负载平衡等。目前并不是所有的 Ingress controller 都实现了这些功能，需要查看具体的 Ingress controller 文档。

```bash
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: influxdb
spec:
  rules:
    - host: influxdb.kube.example.com
      http:
        paths:
          - backend:
              serviceName: influxdb
              servicePort: 8086
```

外部访问 URL  http://influxdb.kube.example.com/ping 访问该服务，入口就是 80 端口，然后 `Ingress controller` 直接将流量转发给后端 Pod，不需再经过 kube-proxy 的转发，比 LoadBalancer 方式更高效。

<p id="div-border-top-purple"><font color="red">缺点：</font>80 端口暴露 必需通过域名引入，而且一次只能一条规则，很麻烦。</p>

但是在正常的虚拟机环境下，我们只需要一个 `IP 地址+端口` 即可访问服务。

为什么我们不能做到像访问虚拟机一样直接访问 k8s 集群服务呢？当然可以，以下架构可以实现：

+ 打通 k8s 网络和物理网络直通
+ 物理网络的 dns 域名服务直接调用 k8s-dns 域名服务直接互访

## <span id="inline-toc">2.</span> 集群环境

----

### 架构环境

+ k8s 集群网络：`172.28.0.0/16`
+ k8s-service 网络：`10.96.0.0/12`
+ 物理机网络：`192.168.0.0/16`

### k8s 集群节点

```bash
$ kubectl get cs

NAME                 STATUS    MESSAGE              ERROR
scheduler            Healthy   ok                   
controller-manager   Healthy   ok                   
etcd-0               Healthy   {"health": "true"}

$ kubectl get nodes -owide

NAME      STATUS    AGE       VERSION   EXTERNAL-IP   OS-IMAGE                KERNEL-VERSION
node1     Ready     13d       v1.7.11   <none>        CentOS Linux 7 (Core)   3.10.0-514.el7.x86_64
node2     Ready     13d       v1.7.11   <none>        CentOS Linux 7 (Core)   3.10.0-514.el7.x86_64
node3     Ready     13d       v1.7.11   <none>        CentOS Linux 7 (Core)   3.10.0-514.el7.x86_64
```

角色定义：

| 角色名称 | IP 地址 | 主机名 |
| :---- | :---- | :---- |
| 边界网关路由器 | 192.168.2.173 | calico-gateway |
| 边界 dns 代理服务器 | 192.168.1.62 | node3 |

假设我们要访问 k8s 中的 `dao-2048` 服务：

```bash
$ kubectl get svc|egrep 'NAME|2048'

NAME                              CLUSTER-IP       EXTERNAL-IP   PORT(S)          AGE
dao-2048                          10.98.217.155    <none>        80/TCP           13m
```

该方案的架构原理如下：

```bash                     
          +-----------------+
          |                 |
          |  192.168.0.0/16 |          # 物理网络以域名或tcp方式发起访问k8s service以及端口
          |                 |
          +-----------------+
                   |
                   |
+------------------------------------+
| dao-2048.default.svc.cluster.local |  # 请求k8s服务所在空间的服务名，完整域名
+------------------------------------+
                   |
                   |
          +-----------------+
          |                 |           # dns代理服务以ingress-udp pod的模式运行在此节点udp53号端口上，
          |   192.168.1.62  |           # 为物理网络提供仿问k8s-dns的桥梁解析dns
          |                 |           # 此节点应固定做为一个节点布署，所有外部机器设置dns为此 192.168.1.62
          +-----------------+
                   |
                   |
          +-----------------+
          |                 |
          |  10.98.217.155  |           # 获取 svc 的实际 clusterip
          |                 |
          +-----------------+
                   |
                   |
          +-----------------+           # 边界网关,用于物理网络连接k8s集群，需要开启内核转发：net.ipv4.ip_forward=1
          |                 |           # 所有外部物理机加一条静态路由：访问 k8s 网络 10.96.0.0/12 网段必需经过网关 192.168.2.173
          |  192.168.2.173  |           # ip route add 10.96.0.0/12 via 192.168.2.173
          |                 |           # 边界网关运行 kube-proxy 用于防火墙规则同步实现 svc 分流，此节点不运行 kubele 服务，不受 k8s 管控
          +-----------------+
                   |
                   |
         +-------------------+
         |                   |
         |  calico-Iface接口  |
         |                   |
         +-------------------+
                   |
                   |
          +-----------------+
          |   k8s 集群网络   |            # 流量最终到达 k8s 集群
          +-----------------+
```

以下为该方案的实施步骤。

## <span id="inline-toc">3.</span> 部署边界 dns 代理服务器
----

布署 dns 代理服务节点为外部提供 dns 服务,以 `hostNetwork: true` 为非 k8s 集群网络物理机节点提供 dns 服务

```bash
$ cd ~/dns-udp; ll ./

total 20K
-rw-r--r--. 1 root root 1.2K Feb 12 05:13 default-backend.yaml
-rw-r--r--. 1 root root  140 Feb 12 05:14 nginx-udp-ingress-configmap.yaml
-rw-r--r--. 1 root root 1.8K Feb 12 05:35 nginx-udp-ingress-controller.yaml
-rw-r--r--. 1 root root 2.4K Feb 12 05:15 rbac.yaml

$ cat default-backend.yaml

apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: default-http-backend
  labels:
    app: default-http-backend
  namespace: kube-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: default-http-backend
  template:
    metadata:
      labels:
        app: default-http-backend
    spec:
      terminationGracePeriodSeconds: 60
      containers:
      - name: default-http-backend
        # Any image is permissible as long as:
        # <span id="inline-toc">1.</span> It serves a 404 page at /
        # <span id="inline-toc">2.</span> It serves 200 on a /healthz endpoint
        image: gcr.io/google_containers/defaultbackend:1.4
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
            scheme: HTTP
          initialDelaySeconds: 30
          timeoutSeconds: 5
        ports:
        - containerPort: 8080
        resources:
          limits:
            cpu: 10m
            memory: 20Mi
          requests:
            cpu: 10m
            memory: 20Mi
---

apiVersion: v1
kind: Service
metadata:
  name: default-http-backend
  namespace: kube-system
  labels:
    app: default-http-backend
spec:
  ports:
  - port: 80
    targetPort: 8080
  selector:
    app: default-http-backend
    
$ cat nginx-udp-ingress-configmap.yaml

apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-udp-ingress-configmap
  namespace: kube-system
data:
  53: "kube-system/kube-dns:53"
  
$ cat nginx-udp-ingress-controller.yaml

apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: nginx-udp-ingress-controller
  labels:
    k8s-app: nginx-udp-ingress-lb
  namespace: kube-system
spec:
  replicas: 1
  selector:
    matchLabels:
      k8s-app: nginx-udp-ingress-lb
  template:
    metadata:
      labels:
        k8s-app: nginx-udp-ingress-lb
        name: nginx-udp-ingress-lb
    spec:
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: kubernetes.io/hostname
                operator: In
                values:
                - node3
      hostNetwork: true
      serviceAccountName: nginx-ingress-serviceaccount
      terminationGracePeriodSeconds: 60
      containers:
      - image: quay.io/kubernetes-ingress-controller/nginx-ingress-controller:0.10.2
        name: nginx-udp-ingress-lb
        readinessProbe:
          httpGet:
            path: /healthz
            port: 10254
            scheme: HTTP
        livenessProbe:
          httpGet:
            path: /healthz
            port: 10254
            scheme: HTTP
          initialDelaySeconds: 10
          timeoutSeconds: 1
        env:
          - name: POD_NAME
            valueFrom:
              fieldRef:
                fieldPath: metadata.name
          - name: POD_NAMESPACE
            valueFrom:
              fieldRef:
                fieldPath: metadata.namespace
        ports:
        - containerPort: 80
          hostPort: 80
        - containerPort: 443
          hostPort: 443
        - containerPort: 53
          hostPort: 53
        args:
        - /nginx-ingress-controller
        - --default-backend-service=$(POD_NAMESPACE)/default-http-backend
        - --udp-services-configmap=$(POD_NAMESPACE)/nginx-udp-ingress-configmap

$ cat rbac.yaml

apiVersion: v1
kind: ServiceAccount
metadata:
  name: nginx-ingress-serviceaccount
  namespace: kube-system

---

apiVersion: rbac.authorization.k8s.io/v1beta1
kind: ClusterRole
metadata:
  name: nginx-ingress-clusterrole
rules:
  - apiGroups:
      - ""
    resources:
      - configmaps
      - endpoints
      - nodes
      - pods
      - secrets
    verbs:
      - list
      - watch
  - apiGroups:
      - ""
    resources:
      - nodes
    verbs:
      - get
  - apiGroups:
      - ""
    resources:
      - services
    verbs:
      - get
      - list
      - watch
  - apiGroups:
      - "extensions"
    resources:
      - ingresses
    verbs:
      - get
      - list
      - watch
  - apiGroups:
      - ""
    resources:
        - events
    verbs:
        - create
        - patch
  - apiGroups:
      - "extensions"
    resources:
      - ingresses/status
    verbs:
      - update

---

apiVersion: rbac.authorization.k8s.io/v1beta1
kind: Role
metadata:
  name: nginx-ingress-role
  namespace: kube-system
rules:
  - apiGroups:
      - ""
    resources:
      - configmaps
      - pods
      - secrets
      - namespaces
    verbs:
      - get
  - apiGroups:
      - ""
    resources:
      - configmaps
    resourceNames:
      # Defaults to "<election-id>-<ingress-class>"
      # Here: "<ingress-controller-leader>-<nginx>"
      # This has to be adapted if you change either parameter
      # when launching the nginx-ingress-controller.
      - "ingress-controller-leader-nginx"
    verbs:
      - get
      - update
  - apiGroups:
      - ""
    resources:
      - configmaps
    verbs:
      - create
  - apiGroups:
      - ""
    resources:
      - endpoints
    verbs:
      - get

---

apiVersion: rbac.authorization.k8s.io/v1beta1
kind: RoleBinding
metadata:
  name: nginx-ingress-role-nisa-binding
  namespace: kube-system
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: nginx-ingress-role
subjects:
  - kind: ServiceAccount
    name: nginx-ingress-serviceaccount
    namespace: kube-system

---

apiVersion: rbac.authorization.k8s.io/v1beta1
kind: ClusterRoleBinding
metadata:
  name: nginx-ingress-clusterrole-nisa-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: nginx-ingress-clusterrole
subjects:
  - kind: ServiceAccount
    name: nginx-ingress-serviceaccount
    namespace: kube-system
    
$ kubectl create -f ./

deployment "default-http-backend" created
service "default-http-backend" created
configmap "nginx-udp-ingress-configmap" created
deployment "nginx-udp-ingress-controller" created
```

通过 nginx 反向代理 `kube-dns` 服务，同时以 `hostNetwork: true` 向集群外部暴露 53 端口，为非 k8s 集群网络物理机节点提供 dns 服务。

## <span id="inline-toc">4.</span> 部署 gateway 边界网关节点

----

此节点只运行 `calico` 和 `kube-proxy`。

### 首先开启内核转发

```bash
$ echo 'net.ipv4.ip_forward=1' >>/etc/sysctl.conf
$ sysctl -p
```

### 运行 calico

```bash
$ docker run --net=host --privileged --name=calico-node -d --restart=always \
  -v /etc/etcd/ssl:/etc/kubernetes/ssl \
  -e ETCD_ENDPOINTS=https://192.168.1.60:12379 \
  -e ETCD_KEY_FILE=/etc/kubernetes/ssl/peer-key.pem \
  -e ETCD_CERT_FILE=/etc/kubernetes/ssl/peer-cert.pem \
  -e ETCD_CA_CERT_FILE=/etc/kubernetes/ssl/ca.pem \
  -e NODENAME=${HOSTNAME} \
  -e IP= \
  -e CALICO_IPV4POOL_CIDR=172.28.0.0/16 \
  -e NO_DEFAULT_POOLS= \
  -e AS= \
  -e CALICO_LIBNETWORK_ENABLED=true \
  -e IP6= \
  -e CALICO_NETWORKING_BACKEND=bird \
  -e FELIX_DEFAULTENDPOINTTOHOSTACTION=ACCEPT \
  -v /var/run/calico:/var/run/calico \
  -v /lib/modules:/lib/modules \
  -v /run/docker/plugins:/run/docker/plugins \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /var/log/calico:/var/log/calico \
  calico/node:v2.6.7
```

需要提前将相关证书拷贝到 `/etc/kubernetes/ssl/` 目录下。

<p id="div-border-top-red"><font color="blue">注意：</font>此处的 <code>-e CALICO_IPV4POOL_CIDR=172.28.0.0/16</code> 要与 k8s 集群网络的网段一致</p>

### 创建边界路由器

以下命令在 k8s 的 master 节点上进行操作

```bash
$ cat bgpPeer.yaml

apiVersion: v1
kind: bgpPeer
metadata:
  peerIP: 192.168.2.173
  scope: global
spec:
  asNumber: 64512
  
$ calicoctl  create -f bgpPeer.yaml
```

查看 node 情况

```bash
$ calicoctl node status

Calico process is running.

IPv4 BGP status
+---------------+-------------------+-------+------------+-------------+
| PEER ADDRESS  |     PEER TYPE     | STATE |   SINCE    |    INFO     |
+---------------+-------------------+-------+------------+-------------+
| 192.168.1.61  | node-to-node mesh | up    | 2018-01-29 | Established |
| 192.168.1.62  | node-to-node mesh | up    | 2018-02-09 | Established |
| 192.168.2.173 | node-to-node mesh | up    | 2018-02-09 | Established |
| 192.168.2.173 | global            | start | 2018-02-09 | Idle        |
+---------------+-------------------+-------+------------+-------------+

IPv6 BGP status
No IPv6 peers found.
```

查看全局对等体节点

```bash
$ calicoctl get bgpPeer --scope=global

SCOPE    PEERIP          NODE   ASN     
global   192.168.2.173          64512
```

### 部署 kube-proxy

#### 安装 conntrack

```bash
$ yum install -y conntrack-tools
```

#### 创建 kube-proxy 的 service 配置文件

文件路径 `/usr/lib/systemd/system/kube-proxy.service`。

```bash
[Unit]
Description=Kubernetes Kube-Proxy Server
Documentation=https://github.com/GoogleCloudPlatform/kubernetes
After=network.target

[Service]
EnvironmentFile=-/etc/kubernetes/config
EnvironmentFile=-/etc/kubernetes/proxy
ExecStart=/usr/local/bin/kube-proxy \
        --logtostderr=true \
        --v=2 \
        --bind-address=192.168.2.173 \
        --hostname-override=192.168.2.173 \
        --kubeconfig=/etc/kubernetes/kube-proxy.kubeconfig \
        --proxy-mode=iptables \
        --cluster-cidr=172.28.0.0/16
Restart=on-failure
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

需要提前将 `kube-proxy.kubeconfig` 文件拷贝到 `/etc/kubernetes/` 目录下。

#### 启动 kube-proxy

```bash
$ systemctl daemon-reload
$ systemctl enable kube-proxy
$ systemctl start kube-proxy
```

## <span id="inline-toc">5.</span> 测试网关和 dns 解析以及服务访问情况

------

找台集群外的机器来验证，这台机器只有一个网卡，没有安装 `calico`。

+ 添加路由

```bash
$ ip route add 10.96.0.0/12 via 192.168.2.173 dev ens160
```

+ 修改 dns 为 `192.168.1.62`

```bash
$ cat /etc/resolv.conf

nameserver 192.168.1.62
search default.svc.cluster.local svc.cluster.local cluster.local
nameserver 223.5.5.5
```

+ 解析 `dao-2048` 服务的域名

```bash
$ dig dao-2048.default.svc.cluster.local

; <<>> DiG 9.9.4-RedHat-9.9.4-51.el7_4.2 <<>> dao-2048.default.svc.cluster.local
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 57053
;; flags: qr aa rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4096
;; QUESTION SECTION:
;dao-2048.default.svc.cluster.local. IN A

;; ANSWER SECTION:
dao-2048.default.svc.cluster.local. 5 IN A      10.98.217.155

;; Query time: 1 msec
;; SERVER: 192.168.1.62#53(192.168.1.62)
;; WHEN: Mon Feb 12 06:46:38 EST 2018
;; MSG SIZE  rcvd: 79
```

+ 访问 `dao-2048` 服务

```bash
$ curl dao-2048.default.svc.cluster.local

* About to connect() to dao-2048.default.svc.cluster.local port 80 (#0)
*   Trying 10.98.217.155...
* Connected to dao-2048.default.svc.cluster.local (10.98.217.155) port 80 (#0)
> GET / HTTP/1.1
> User-Agent: curl/7.29.0
> Host: dao-2048.default.svc.cluster.local
> Accept: */*
> 
< HTTP/1.1 200 OK
< Server: nginx/1.10.1
< Date: Mon, 12 Feb 2018 11:47:58 GMT
< Content-Type: text/html
< Content-Length: 4085
< Last-Modified: Sun, 11 Feb 2018 11:31:27 GMT
< Connection: keep-alive
< ETag: "5a80298f-ff5"
< Accept-Ranges: bytes
< 
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>2048</title>
.........
```

**<font color="red">成功访问！</font>**

如果是 windows 用户，添加路由可以用管理员打开 cmd 命令运行：

```bash
$ route ADD -p 172.28.0.0 MASK 255.255.0.0 192.168.2.173
```

<p id="div-border-top-red"><font color="blue">PS：</font>如果你不想一台台机器加路由和 dns，你可以把路由信息加入物理路由器上，这样就不用每台机都加路由和 dns 了，直接打通所有链路。</p>

## <span id="inline-toc">6.</span> 参考

----

[k8s-dns-gateway 网关网络扩展实战](http://blog.csdn.net/idea77/article/details/73863822)
