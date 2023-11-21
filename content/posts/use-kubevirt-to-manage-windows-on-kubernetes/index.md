---
keywords:
- kubevirt
- cdi
- kubernetes
title: "Kubernetes 使用 Kubevirt 运行管理 Windows 10 操作系统"
date: 2020-11-13T16:13:56+08:00
lastmod: 2020-11-13T16:13:56+08:00
description: 本文介绍了 Kubevirt 的架构，并使用 Kubevirt 来运行管理 Windows 10 虚拟机。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocLevels: ["h2", "h3", "h4"]
tags:
- kubevirt
- kubernetes
categories: cloud-native
img: https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201126104701.png
---

最近我发现我的 `Kubernetes` 集群资源实在是太多了，有点浪费，不信你看：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@master/img/20201113174212.jpg)

既然闲置资源那么多，那我何不想办法利用一下。怎么用，用来干什么又是一个问题，想到我手中只有 MacBook，缺少 Windows 操作系统，那就先想办法用 Kubernetes 创建个 Windows 虚拟机用用吧，毕竟很多场景只能用 Windows（比如突破某盘的限速、Xshell 一把梭连接所有服务器）。于是我将目光转向了 Kubevirt。

`Kubevirt` 是 Red Hat 开源的以容器方式运行虚拟机的项目，通过 `CRD` 的方式来管理虚拟机实例，它的所有概念都和一般的 Kubernetes 容器应用差不多，不需要增加学习成本，对于咱玩烂了容器的 YAML 工程师来说没有任何压力，我们可以直接用它来创建虚拟机啊。

## 1. Kubevirt 架构设计

Kubevirt 主要实现了下面几种资源，以实现对虚拟机的管理：

+ `VirtualMachineInstance（VMI）` : 类似于 kubernetes Pod，是管理虚拟机的最小资源。一个 `VirtualMachineInstance` 对象即表示一台正在运行的虚拟机实例，包含一个虚拟机所需要的各种配置。
+ `VirtualMachine（VM）` : 为群集内的 `VirtualMachineInstance` 提供管理功能，例如开机/关机/重启虚拟机，确保虚拟机实例的启动状态，与虚拟机实例是 1:1 的关系，类似与 `spec.replica` 为 1 的 StatefulSet。
+ `VirtualMachineInstanceReplicaSet` : 类似 `ReplicaSet`，可以启动指定数量的 `VirtualMachineInstance`，并且保证指定数量的 `VirtualMachineInstance` 运行，可以配置 HPA。

Kubevirt 的整体架构如图：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@master/img/20201113233921.png)

+ **virt-api** : 负责提供一些 KubeVirt 特有的 api，像是 `console, vnc, startvm, stopvm` 等。
+ **virt-controller** : 管理和监控 VMI 对象及其关联的 Pod，对其状态进行更新。
+ **virt-handler** : 以 DaemonSet 运行在每一个节点上，监听 VMI 的状态向上汇报，管理 VMI 的生命周期。
+ **virt-launcher** : 以 Pod 方式运行，每个 VMI Object 都会对应一个 virt-launcher Pod，容器内有单独的 `libvirtd`，用于启动和管理虚拟机。

如果你嫌上面的架构图太繁琐，这里还有一个简化版：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@master/img/20201113234247.png)

这个图里的 Agent 其实就是 virt-handler。

## 2. 磁盘和卷

虚拟机镜像（磁盘）是启动虚拟机必不可少的部分，KubeVirt 中提供多种方式的虚拟机磁盘，虚拟机镜像（磁盘）使用方式非常灵活。这里列出几种比较常用的：

+ **PersistentVolumeClaim** : 使用 PVC 做为后端存储，适用于数据持久化，即在虚拟机重启或者重建后数据依旧存在。使用的 PV 类型可以是 block 和  filesystem，使用 filesystem 时，会使用 PVC 上的 /disk.img，格式为 RAW 格式的文件作为硬盘。block  模式时，使用 block volume 直接作为原始块设备提供给虚拟机。
+ **ephemeral** : 基于后端存储在本地做一个写时复制（COW）镜像层，所有的写入都在本地存储的镜像中，VM 实例停止时写入层就被删除，后端存储上的镜像不变化。
+ **containerDisk** : 基于 scratch 构建的一个 docker image，镜像中包含虚拟机启动所需要的虚拟机镜像，可以将该 docker image push 到 registry，使用时从 registry 拉取镜像，直接使用 containerDisk 作为 VMI 磁盘，数据是无法持久化的。
+ **hostDisk** : 使用节点上的磁盘镜像，类似于 `hostpath`，也可以在初始化时创建空的镜像。
+ **dataVolume** : 提供在虚拟机启动流程中自动将虚拟机磁盘导入 pvc 的功能，在不使用 DataVolume 的情况下，用户必须先准备带有磁盘映像的  pvc，然后再将其分配给 VM 或 VMI。dataVolume 拉取镜像的来源可以时 http，对象存储，另一块 PVC 等。

## 3. 准备工作

在安装 Kubevirt 之前，需要做一些准备工作。先安装 libvrt 和 qemu 软件包：

```bash
# Ubuntu
$ apt install -y qemu-kvm libvirt-bin bridge-utils virt-manager

# CentOS
$ yum install -y qemu-kvm libvirt virt-install bridge-utils
```

查看节点是否支持 kvm 硬件辅助虚拟化

```bash
$ virt-host-validate qemu
  QEMU: Checking for hardware virtualization                                 : PASS
  QEMU: Checking if device /dev/kvm exists                                   : PASS
  QEMU: Checking if device /dev/kvm is accessible                            : PASS
  QEMU: Checking if device /dev/vhost-net exists                             : PASS
  QEMU: Checking if device /dev/net/tun exists                               : PASS
  QEMU: Checking for cgroup 'memory' controller support                      : PASS
  QEMU: Checking for cgroup 'memory' controller mount-point                  : PASS
  QEMU: Checking for cgroup 'cpu' controller support                         : PASS
  QEMU: Checking for cgroup 'cpu' controller mount-point                     : PASS
  QEMU: Checking for cgroup 'cpuacct' controller support                     : PASS
  QEMU: Checking for cgroup 'cpuacct' controller mount-point                 : PASS
  QEMU: Checking for cgroup 'cpuset' controller support                      : PASS
  QEMU: Checking for cgroup 'cpuset' controller mount-point                  : PASS
  QEMU: Checking for cgroup 'devices' controller support                     : PASS
  QEMU: Checking for cgroup 'devices' controller mount-point                 : PASS
  QEMU: Checking for cgroup 'blkio' controller support                       : PASS
  QEMU: Checking for cgroup 'blkio' controller mount-point                   : PASS
  QEMU: Checking for device assignment IOMMU support                         : PASS
  QEMU: Checking if IOMMU is enabled by kernel                               : PASS
```

如果不支持，则先生成让 Kubevirt 使用软件虚拟化的配置：

```bash
$ kubectl create namespace kubevirt
$ kubectl create configmap -n kubevirt kubevirt-config \
    --from-literal debug.useEmulation=true
```

## 4. 安装 Kubevirt

### 部署最新版本的 Kubevirt

```bash
$ export VERSION=$(curl -s https://api.github.com/repos/kubevirt/kubevirt/releases | grep tag_name | grep -v -- '-rc' | head -1 | awk -F': ' '{print $2}' | sed 's/,//' | xargs)
$ kubectl apply -f https://github.com/kubevirt/kubevirt/releases/download/${VERSION}/kubevirt-operator.yaml
$ kubectl apply -f https://github.com/kubevirt/kubevirt/releases/download/${VERSION}/kubevirt-cr.yaml
```

查看部署结果：

```bash
$ kubectl -n kubevirt get pod
NAME                               READY   STATUS    RESTARTS   AGE
virt-api-64999f7bf5-n9kcl          1/1     Running   0          6d
virt-api-64999f7bf5-st5qv          1/1     Running   0          6d8h
virt-controller-8696ccdf44-v5wnq   1/1     Running   0          6d
virt-controller-8696ccdf44-vjvsw   1/1     Running   0          6d8h
virt-handler-85rdn                 1/1     Running   3          7d19h
virt-handler-bpgzp                 1/1     Running   21         7d19h
virt-handler-d55c7                 1/1     Running   1          7d19h
virt-operator-78fbcdfdf4-sf5dv     1/1     Running   0          6d8h
virt-operator-78fbcdfdf4-zf9qr     1/1     Running   0          6d
```

### 部署 CDI

`Containerized Data Importer`（CDI）项目提供了用于使 PVC 作为 KubeVirt VM 磁盘的功能。建议同时部署 CDI：

```bash
$ export VERSION=$(curl -s https://github.com/kubevirt/containerized-data-importer/releases/latest | grep -o "v[0-9]\.[0-9]*\.[0-9]*")
$ kubectl create -f https://github.com/kubevirt/containerized-data-importer/releases/download/$VERSION/cdi-operator.yaml
$ kubectl create -f https://github.com/kubevirt/containerized-data-importer/releases/download/$VERSION/cdi-cr.yaml
```

## 5. 客户端准备

Kubevirt 提供了一个命令行工具 `virtctl`，可以直接下载：

```bash
$ export VERSION=$(curl -s https://api.github.com/repos/kubevirt/kubevirt/releases | grep tag_name | grep -v -- '-rc' | head -1 | awk -F': ' '{print $2}' | sed 's/,//' | xargs)
$ curl -L -o /usr/local/bin/virtctl https://github.com/kubevirt/kubevirt/releases/download/$VERSION/virtctl-$VERSION-linux-amd64
$ chmod +x /usr/local/bin/virtctl
```

也可以通过 `krew` 安装为 kubectl 的插件：

```bash
$ kubectl krew install virt
```

## 6. 虚拟机镜像准备

### Windows 镜像下载

这里推荐两个 Windows 镜像下载站：

① [MSDN I Tell You](https://msdn.itellyou.cn/)。该网站提供的链接是 `ed2k` 格式，需要通过特殊下载工具进行下载，比如百度网盘离线下载、迅雷、eMule 等，其中百度网盘离线下载最好使，但下载限速又是个大问题，开了超级会员的当我没说。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201122173815.png)

② [TechBench by WZT](https://tb.rg-adguard.net/public.php)。该网站提供的是直链下载方式，可以用任意下载工具进行下载，比上面的网站方便多了，不过资源没有上面的网站丰富。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201122174051.jpg)

我推荐通过第二个网站来下载 Windows 镜像。

### 上传镜像

KubeVirt 可以使用 PVC 作为后端磁盘，使用 `filesystem` 类型的 PVC 时，默认使用的时 `/disk.img` 这个镜像，用户可以将镜像上传到 PVC，在创建 VMI 时使用此 PVC。使用这种方式需要注意下面几点：

- 一个 PVC 只允许存在一个镜像，只允许一个 VMI 使用，要创建多个 VMI，需要上传多次
- `/disk.img` 的格式必须是 RAW 格式

CDI 提供了使用使用 PVC 作为虚拟机磁盘的方案，在虚拟机启动前通过下面方式填充 PVC：

- 通过 URL 导入虚拟机镜像到 PVC，URL 可以是 http 链接，s3 链接
- Clone 一个已经存在的 PVC
- 通过 container registry 导入虚拟机磁盘到 PVC，需要结合 `ContainerDisk` 使用
- 通过客户端上传本地镜像到 PVC

通过命令行 `virtctl`，结合 CDI 项目，可以上传本地镜像到 PVC 上，支持的镜像格式有：

- .img
- .qcow2
- .iso
- 压缩为 .tar，.gz，.xz 格式的上述镜像

我们的目标是安装 Windows 10 虚拟机，所以需要将上面下载好的 Windows 镜像上传到 PVC：

```bash
$ virtctl image-upload \
  --image-path='Win10_20H2_Chinese(Simplified)_x64.iso' \
  --storage-class csi-rbd-sc \
  --pvc-name=iso-win10 \
  --pvc-size=7G \
  --uploadproxy-url=https://<cdi-uploadproxy_svc_ip> \
  --insecure \
  --wait-secs=240

PersistentVolumeClaim default/iso-win10 created
Waiting for PVC iso-win10 upload pod to be ready...
Pod now ready
Uploading data to https://10.111.29.156

 5.63 GiB / 5.63 GiB [======================================================================================================================================================] 100.00% 27s

Uploading data completed successfully, waiting for processing to complete, you can hit ctrl-c without interrupting the progress
Processing completed successfully
Uploading Win10_20H2_Chinese(Simplified)_x64.iso completed successfully
```

参数解释：

+ **--image-path** : 操作系统镜像地址。
+ **--pvc-name** : 指定存储操作系统镜像的 PVC，这个 PVC 不需要提前准备好，镜像上传过程中会自动创建。
+ **--pvc-size** : PVC 大小，根据操作系统镜像大小来设定，一般略大一个 G 就行。
+ **--uploadproxy-url** : cdi-uploadproxy 的 Service IP，可以通过命令 `kubectl -n cdi get svc -l cdi.kubevirt.io=cdi-uploadproxy` 来查看。

## 7. 增加 hostDisk 支持

Kubevirt 默认没有开启对 `hostDisk` 的支持，需要手动开启。步骤也很简单，只需新建个 ConfigMap，增加 `hostDisk` 的特性：

**kubevet-config.yaml**

```yaml
apiVersion: v1
data:
  feature-gates: LiveMigration,DataVolumes,HostDisk
kind: ConfigMap
metadata:
  labels:
    kubevirt.io: ""
  name: kubevirt-config
  namespace: kubevirt
```

## 7. 创建虚拟机

创建 Windows 虚拟机的模板文件如下：

**win10.yaml**

```yaml
apiVersion: kubevirt.io/v1alpha3
kind: VirtualMachine
metadata:
  name: win10
spec:
  running: false
  template:
    metadata:
      labels:
        kubevirt.io/domain: win10
    spec:
      domain:
        cpu:
          cores: 4
        devices:
          disks:
          - bootOrder: 1
            cdrom:
              bus: sata
            name: cdromiso
          - disk:
              bus: virtio
            name: harddrive
          - cdrom:
              bus: sata
            name: virtiocontainerdisk
          interfaces:
          - masquerade: {}
            model: e1000 
            name: default
        machine:
          type: q35
        resources:
          requests:
            memory: 16G
      networks:
      - name: default
        pod: {}
      volumes:
      - name: cdromiso
        persistentVolumeClaim:
          claimName: iso-win10
      - name: harddrive
        hostDisk:
          capacity: 50Gi
          path: /data/disk.img
          type: DiskOrCreate
      - containerDisk:
          image: kubevirt/virtio-container-disk
        name: virtiocontainerdisk
```

这里用到了 3 个 Volume：

+ **cdromiso** : 提供操作系统安装镜像，即上文上传镜像后生成的 PVC `iso-win10`。
+ **harddrive** : 虚拟机使用的磁盘，即操作系统就会安装在该磁盘上。这里选择 `hostDisk` 直接挂载到宿主机以提升性能，如果使用分布式存储则体验非常不好。
+ **containerDisk** : 由于 Windows 默认无法识别 raw 格式的磁盘，所以需要安装 virtio 驱动。 containerDisk 可以将打包好 virtio 驱动的容器镜像挂载到虚拟机中。

关于网络部分，`spec.template.spec.networks` 定义了一个网络叫 `default`，这里表示使用 Kubernetes 默认的 CNI。`spec.template.spec.domain.devices.interfaces` 选择定义的网络 default，并开启 `masquerade`，以使用网络地址转换 (NAT) 来通过 Linux 网桥将虚拟机连接至 Pod 网络后端。

使用模板文件创建虚拟机：

```bash
$ kubectl apply -f win10.yaml
```

启动虚拟机实例：

```bash
$ virtctl start win10
# 如果 virtctl 安装为 kubectl 的插件，命令格式如下：
$ kubectl virt start win10
```

查看实例运行状态：

```bash
$ kubectl get pod
NAME                              READY   STATUS    RESTARTS   AGE
virt-launcher-win10-s742j         2/2     Running   0          15s
```

然后就可以通过 VNC 工具来访问 Windows 虚拟机了。首先需要在本地安装一个 VNC 客户端，对于 macOS 来说，可以安装 Tiger VNC 或者 Real VNC。我选择安装 Real VNC：

```bash
$ brew cask install vnc-viewer
```

连接到 Windows 虚拟机：

```bash
$ virtctl vnc win10
# 如果 virtctl 安装为 kubectl 的插件，命令格式如下：
$ kubectl virt vnc win10
```

执行完上面的命令后，就会打开本地的 VNC 客户端连接到虚拟机：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201122185926.png)

下面就是安装正常的安装步骤往下进行，到选择硬盘那一步的时候，你会发现没有一个硬盘可供使用，这时就需要安装 virtio 驱动了。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201122190331.png)

不过不用担心，virtio 驱动已经被挂载进来了，直接点击**加载驱动程序**就可以安装驱动了：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201122190505.png)

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201122190628.png)

安装好驱动后，硬盘就能正确显示了：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201122194231.png)

下面就可以继续安装了。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201122194711.png)

安装成功后会自动重启进行初始化设置，那个熟悉的“海内存知己，天涯若比邻”又回来了：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201122195000.png)

设置完成后，进入系统，打开设备管理器，可以看到有几个未配置的设备。选择其中一个右键单击，然后选择“更新驱动程序”。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201122202548.png)

选择“浏览我的电脑以查找驱动程序”。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201122202658.png)

选择“CD 驱动器（E:）virtio-win-0.1.1”，然后点击确定。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201122202755.png)

设备管理器将自动找到正确的驱动程序，不需要指定驱动程序的路径。

在提示符下，单击“安装”。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201122203249.png)

其他的设备驱动可以复制上面的步骤一一安装。

## 8. CNI 插件问题解决

如果你的 Kubernetes 集群 CNI 插件用的是 Calico，这里会遇到虚拟机无法联网的问题。因为 Calico 默认禁用了容器的 ip forward 功能，而 `masquerade` 需要开启这个功能才能生效。

我们只需要修改 Calico 的 ConfigMap 就可以启用容器的 ip forward 功能了，执行以下命令打开 configmap `calico-config`：

```bash
$ kubectl -n kube-system edit cm calico-config
```

在 CNI 配置文件中加上以下的内容：

```json
"container_settings": {
    "allow_ip_forwarding": true
},
```

修改完的配置文件内容：

```json
  cni_network_config: |-
    {
      "name": "k8s-pod-network",
      "cniVersion": "0.3.1",
      "plugins": [
        {
          "type": "calico",
          "log_level": "info",
          "log_file_path": "/var/log/calico/cni/cni.log",
          "etcd_endpoints": "__ETCD_ENDPOINTS__",
          "etcd_key_file": "__ETCD_KEY_FILE__",
          "etcd_cert_file": "__ETCD_CERT_FILE__",
          "etcd_ca_cert_file": "__ETCD_CA_CERT_FILE__",
          "mtu": __CNI_MTU__,
          "ipam": {
              "type": "calico-ipam"
          },
          "container_settings": {
              "allow_ip_forwarding": true
          },
          "policy": {
              "type": "k8s"
          },
          "kubernetes": {
              "kubeconfig": "__KUBECONFIG_FILEPATH__"
          }
        },
        {
          "type": "portmap",
          "snat": true,
          "capabilities": {"portMappings": true}
        },
        {
          "type": "bandwidth",
          "capabilities": {"bandwidth": true}
        }
      ]
    }
```

然后重启 calico-node 容器：

```bash
$ kubectl -n kube-system delete pod -l k8s-app=calico-node
```

## 8. 远程连接

在系统未安装好之前，只能用 VNC 来远程控制，但 VNC 的体验实在让人难受。现在系统装好了，就可以使用 Windows 的远程连接协议 RDP（Remote Desktop Protocol） 了。选择**开始** >**设置** >**系统**>**远程桌面**，打开**启用远程桌面**就好了。

现在可以通过 telnet 来测试一下 RDP 端口（`3389`）的连通性：

```bash
$ kubectl get pod -owide
NAME                              READY   STATUS    RESTARTS   AGE     IP               NODE    NOMINATED NODE   READINESS GATES
virt-launcher-win10-s742j         2/2     Running   0          139m    100.92.235.131   k8s03   <none>           <none>

$ telnet 100.92.235.131 3389
Trying 100.92.235.131...
Connected to 100.92.235.131.
Escape character is '^]'.
```

如果你的本地电脑能够直连 `Pod IP` 和 `SVC IP`，现在就可以直接通过 RDP 客户端来远程连接 Windows 了。如果你的本地电脑不能直连 `Pod IP` 和 `SVC IP`，但可以直连 Kubernetes 集群的 `Node IP`，可以通过 `NodePort` 来暴露 RDP 端口。具体操作是创建一个 Service，类型为 NodePort：

```bash
$ kubectl virt expose vm win10 --name win10-rdp --port 3389 --target-port 3389 --type NodePort

$ kubectl get svc
NAME                     TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE
kubernetes               ClusterIP   10.96.0.1       <none>        443/TCP          17d
win10-rdp                NodePort    10.98.20.203    <none>        3389:31192/TCP   20m
```

然后就可以通过 `Node IP` 来远程连接 Windows 了。

如果你的本地操作系统是 **Windows 10**，可以在任务栏的搜索框中，键入“**远程桌面连接**”，然后选择“**远程桌面连接**”。在“远程桌面连接”中，键入你想要连接的电脑的名称（从步骤 1），然后选择“**连接**”。

如果你的本地操作系统是 `macOS`，需要在 App Store 中安装 `Microsoft Remote Desktop`。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201122211440.png)

安装完之后打开应用，选择 **Add PC**：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201122211718.png)

在 **PC name** 一栏中输入 `NodeIP+NodePort`，然后点击 **Add**。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201122212017.png)

然后右击创建好的配置，选择 **Connect**：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201122212258.png)

输入账号密码后就可以连接到 Windows 了。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting@second/img/20201122212610.jpg)

全屏之后就可以获得完美的远程桌面体验了，尽情玩耍吧！

## 9. 参考

+ [在 Kubernetes 上使用 KubeVirt 管理虚拟机负载](http://blog.meoop.me/post/use-kubevirt-to-manage-virtualization-workloads-on-kubernetes/)
+ [kubevirt-crc-windows-tutorial](https://redhat-developer-demos.github.io/kubevirt-crc-windows-tutorial/)
+ [kubevirt user guide](https://kubevirt.io/user-guide/)