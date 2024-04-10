---
keywords:
- dockershim
- docker
- containerd
- kubernetes
title: "Kubernetes 教程：在 Containerd 容器中使用 GPU"
date: 2020-12-03T23:09:23+08:00
lastmod: 2020-12-03T23:09:23+08:00
description: 本文介绍了如何在使用 Containerd 作为运行时的 Kubernetes 集群中使用 GPU 资源。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocLevels: ["h2", "h3", "h4"]
tags:
- Kubernetes
- Containerd
categories: 
- cloud-native
img: https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@second/img/20201207155224.jpg
---

Kubernetes 具有对机器的资源进行分配和使用的能力，比如可以指定容器最多使用多少内存以及使用多少 CPU 计算资源。那么问题来了，一般来说容器就是使用 CPU 和内存资源，那么对于需要使用显卡的 Pod，Kubernetes 也能够支持吗？答案当然是可以啦！目前 Kubernetes 不仅支持容器请求 `GPU` 资源，还支持请求几块显卡的 GPU 资源，这使得 Kubernetes 在深度学习和区块链等场景下也有了用武之地。

关于 Kubernetes 集群中 Docker 如何使用 GPU，Kubernetes 的官方文档已经说的很清楚了，网上也有铺天盖地的博客手把手教你怎么做。至于以 Containerd 作为容器运行时的集群如何使用 GPU，网上还找不到一篇像样的文档来告诉大家怎么做，今天我就来做吃螃蟹的第一人。

要想在容器里使用 GPU，本质上就是我们要在容器里能看到并且使用宿主机上的显卡，所有的步骤都是围绕这个来做的。当然，本文不会涉及如何安装 Containerd，也不会涉及如何安装 Kubernetes，如果这些都搞不定，建议不要往下看。

## 1. Nvidia 驱动

某些命令以 Ubuntu 作为示例。 首先宿主机上必现安装 Nvidia 驱动。这里推荐从 Nvidia 官网下载脚本安装，安装和卸载都比较方便并且适用于任何 Linux 发行版，包括 CentOS，Ubuntu 等。 NVIDIA Telsa GPU 的 Linux 驱动在安装过程中需要编译 kernel module，系统需提前安装 gcc 和编译 Linux Kernel Module 所依赖的包，例如 kernel-devel-$(uname -r) 等。

- 安装 gcc 和 kernel-dev(如果没有) `sudo apt install gcc kernel-dev -y`。

- 访问[官网](https://www.nvidia.com/Download/Find.aspx)下载。

- 选择操作系统和安装包，并单击【SEARCH】搜寻驱动，选择要下载的驱动版本

  ![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@second/img/20201204003108.png)

- 下载对应版本安装脚本 在宿主机上执行：

  ```bash
  $ wget  https://www.nvidia.com/content/DriverDownload-March2009/confirmation.php?url=/tesla/450.80.02/NVIDIA-Linux-x86_64-450.80.02.run&lang=us&type=Tesla
  ```

- 安装 执行脚本安装：

  ```bash
  $ chmod +x NVIDIA-Linux-x86_64-450.80.02.run && ./NVIDIA-Linux-x86_64-450.80.02.run
  ```

- 验证 使用如下命令验证是否安装成功 `nvidia-smi` 如果输出类似下图则驱动安装成功。

  ![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@second/img/20201204003306.png)

## 2. CUDA 驱动

> CUDA（Compute Unified Device Architecture）是显卡厂商 NVIDIA 推出的运算平台。CUDA™ 是一种由 NVIDIA 推出的通用并行计算架构，该架构使 GPU 能够解决复杂的计算问题。它包含了 CUDA 指令集架构（ISA）以及 GPU  内部的并行计算引擎。 这里安装的方式和显卡驱动安装类似。

+ 访问[官网](https://developer.nvidia.com/cuda-toolkit-archive)下载

+ 下载对应版本如下图

  ![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@second/img/20201204003439.png)

+ 配置环境变量

  ```bash
  $ echo 'export PATH=/usr/local/cuda/bin:$PATH' | sudo tee /etc/profile.d/cuda.sh
  $ source /etc/profile
  ```

  ## 3. nvidia-container-runtime
  
  nvidia-container-runtime 是在 runc 基础上多实现了  nvidia-container-runime-hook(现在叫 nvidia-container-toolkit)，该 hook  是在容器启动后（Namespace已创建完成），容器自定义命令(Entrypoint)启动前执行。当检测到  NVIDIA_VISIBLE_DEVICES 环境变量时，会调用 libnvidia-container 挂载 GPU Device 和  CUDA Driver。如果没有检测到 NVIDIA_VISIBLE_DEVICES 就会执行默认的 runc。
  
  下面分两步安装：
  
  先设置 repository 和 GPG key：
  
  ```bash
  $ curl -s -L https://nvidia.github.io/nvidia-container-runtime/gpgkey | sudo apt-key add -
  
  $ curl -s -L https://nvidia.github.io/nvidia-container-runtime/$(. /etc/os-release;echo $ID$VERSION_ID)/nvidia-container-runtime.list | sudo tee /etc/apt/sources.list.d/nvidia-container-runtime.list
  ```
  
  安装：
  
  ```bash
  $ apt install nvidia-container-runtime -y
  ```
  
  ### 配置 Containerd 使用 Nvidia container runtime
  
  如果 `/etc/containerd` 目录不存在，就先创建它：
  
  ```bash
  $ mkdir /etc/containerd
  ```
  
  生成默认配置：
  
  ```bash
  $ containerd config default > /etc/containerd/config.toml
  ```
  
  Kubernetes 使用[设备插件（Device Plugins）](https://v1-18.docs.kubernetes.io/zh/docs/concepts/extend-kubernetes/compute-storage-net/device-plugins/) 来允许 Pod 访问类似 GPU 这类特殊的硬件功能特性，但前提是默认的 OCI runtime 必须改成 `nvidia-container-runtime`，需要修改的内容如下：
  
  **/etc/containerd/config.toml**
  
  ```toml
  ...
      [plugins."io.containerd.grpc.v1.cri".containerd]
        snapshotter = "overlayfs"
        default_runtime_name = "runc"
        no_pivot = false
  ...
        [plugins."io.containerd.grpc.v1.cri".containerd.runtimes]
          [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc]
            runtime_type = "io.containerd.runtime.v1.linux" # 将此处 runtime_type 的值改成 io.containerd.runtime.v1.linux
  ...
    [plugins."io.containerd.runtime.v1.linux"]
      shim = "containerd-shim"
      runtime = "nvidia-container-runtime" # 将此处 runtime 的值改成 nvidia-container-runtime
  ...
  ```
  
  重启 containerd 服务：
  
  ```bash
  $ systemctl restart containerd
  ```
  
  ## 4. 部署 NVIDIA GPU 设备插件
  
  一条命令解决战斗：
  
  ```bash
  $ kubectl apply -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/v0.7.1/nvidia-device-plugin.yml
  ```
  
  查看日志：
  
  ```bash
  $ kubectl -n kube-system logs nvidia-device-plugin-daemonset-xxx
  2020/12/04 06:30:28 Loading NVML
  2020/12/04 06:30:28 Starting FS watcher.
  2020/12/04 06:30:28 Starting OS watcher.
  2020/12/04 06:30:28 Retreiving plugins.
  2020/12/04 06:30:28 Starting GRPC server for 'nvidia.com/gpu'
  2020/12/04 06:30:28 Starting to serve 'nvidia.com/gpu' on /var/lib/kubelet/device-plugins/nvidia-gpu.sock
  2020/12/04 06:30:28 Registered device plugin for 'nvidia.com/gpu' with Kubelet
  ```
  
  可以看到设备插件部署成功了。在 Node 上面可以看到设备插件目录下的 socket：
  
  ```bash
  $ ll /var/lib/kubelet/device-plugins/
  total 12
  drwxr-xr-x 2 root root 4096 Dec  4 01:30 ./
  drwxr-xr-x 8 root root 4096 Dec  3 05:05 ../
  -rw-r--r-- 1 root root    0 Dec  4 01:11 DEPRECATION
  -rw------- 1 root root 3804 Dec  4 01:30 kubelet_internal_checkpoint
  srwxr-xr-x 1 root root    0 Dec  4 01:11 kubelet.sock=
  srwxr-xr-x 1 root root    0 Dec  4 01:11 kubevirt-kvm.sock=
  srwxr-xr-x 1 root root    0 Dec  4 01:11 kubevirt-tun.sock=
  srwxr-xr-x 1 root root    0 Dec  4 01:11 kubevirt-vhost-net.sock=
  srwxr-xr-x 1 root root    0 Dec  4 01:30 nvidia-gpu.sock=
  ```
  
  ## 5. 测试 GPU
  
  首先测试本地命令行工具 ctr，这个应该没啥问题：
  
  ```bash
  $ ctr images pull docker.io/nvidia/cuda:9.0-base
  
  $ ctr run --rm -t --gpus 0 docker.io/nvidia/cuda:9.0-base nvidia-smi nvidia-smi
  Fri Dec  4 07:01:38 2020
  +-----------------------------------------------------------------------------+
  | NVIDIA-SMI 440.95.01    Driver Version: 440.95.01    CUDA Version: 10.2     |
  |-------------------------------+----------------------+----------------------+
  | GPU  Name        Persistence-M| Bus-Id        Disp.A | Volatile Uncorr. ECC |
  | Fan  Temp  Perf  Pwr:Usage/Cap|         Memory-Usage | GPU-Util  Compute M. |
  |===============================+======================+======================|
  |   0  GeForce RTX 208...  Off  | 00000000:A1:00.0 Off |                  N/A |
  | 30%   33C    P8     9W / 250W |      0MiB / 11019MiB |      0%      Default |
  +-------------------------------+----------------------+----------------------+
  
  +-----------------------------------------------------------------------------+
  | Processes:                                                       GPU Memory |
  |  GPU       PID   Type   Process name                             Usage      |
  |=============================================================================|
  |  No running processes found                                                 |
  +-----------------------------------------------------------------------------+
  ```
  
  最后进入终极测试：在 Pod 中测试 GPU 可用性。先创建部署清单：
  
  **gpu-pod.yaml**
  
  ```yaml
  apiVersion: v1
  kind: Pod
  metadata:
    name: cuda-vector-add
  spec:
    restartPolicy: OnFailure
    containers:
      - name: cuda-vector-add
        image: "k8s.gcr.io/cuda-vector-add:v0.1"
        resources:
          limits:
            nvidia.com/gpu: 1
  ```
  
  执行 `kubectl apply -f ./gpu-pod.yaml` 创建 Pod。使用 `kubectl get pod` 可以看到该 Pod 已经启动成功：
  
  ```bash
  $ kubectl get pod
  NAME                              READY   STATUS      RESTARTS   AGE
  cuda-vector-add                   0/1     Completed   0          3s
  ```
  
  查看 Pod 日志：
  
  ```bash
  $ kubectl logs cuda-vector-add
  [Vector addition of 50000 elements]
  Copy input data from the host memory to the CUDA device
  CUDA kernel launch with 196 blocks of 256 threads
  Copy output data from the CUDA device to the host memory
  Test PASSED
  Done
  ```
  
  可以看到成功运行。这也说明 Kubernetes 完成了对 GPU 资源的调用。需要注意的是，目前 Kubernetes 只支持卡级别的调度，并且显卡资源是独占，无法在多个容器之间分享。
  
## 参考资料

+ [容器中使用 GPU 的基础环境搭建](https://lxkaka.wang/docker-nvidia/)
  
  

