---
keywords:
- kubernetes
- pod uid
- go template
- jq
title: "Kubernetes 教程：根据 PID 获取 Pod 名称"
date: 2020-07-14T16:31:59+08:00
lastmod: 2020-07-14T16:31:59+08:00
description: 根据进程对应的 PID 获取该容器的 Pod 名称。
draft: false 
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocLevels: ["h2", "h3", "h4"]
tags:
- kubernetes
categories: cloud-native
img: https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@master/img/20200714184130.png
---

在管理 `Kubernetes` 集群的过程中，我们经常会遇到这样一种情况：在某台节点上发现某个进程资源占用量很高，却又不知道是哪个容器里的进程。有没有办法可以根据 `PID` 快速找到 `Pod` 名称呢？

假设现在有一个 prometheus 进程的 PID 是 `14338`：

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting@master/img/20200714165733.png)

为了进一步挖掘信息，有两种思路，一种是挖掘 `PID` 对应的容器的信息，另一种是挖掘 PID 对应的 `Pod` 的信息。

## 1. Container ID

要获取容器的 ID，可以查看 PID 对应的 `cgroup` 信息：

```bash
$ cat /proc/14338/cgroup

11:blkio:/kubepods/burstable/pod8e018a8e-4aaa-4ac6-986a-1a5133a4bcf1/d6f24b62ea28e9e67f7bc06f98de083cc49454f353389cd396f5d3ac6448f19c
10:cpuset:/kubepods/burstable/pod8e018a8e-4aaa-4ac6-986a-1a5133a4bcf1/d6f24b62ea28e9e67f7bc06f98de083cc49454f353389cd396f5d3ac6448f19c
9:freezer:/kubepods/burstable/pod8e018a8e-4aaa-4ac6-986a-1a5133a4bcf1/d6f24b62ea28e9e67f7bc06f98de083cc49454f353389cd396f5d3ac6448f19c
8:hugetlb:/kubepods/burstable/pod8e018a8e-4aaa-4ac6-986a-1a5133a4bcf1/d6f24b62ea28e9e67f7bc06f98de083cc49454f353389cd396f5d3ac6448f19c
7:perf_event:/kubepods/burstable/pod8e018a8e-4aaa-4ac6-986a-1a5133a4bcf1/d6f24b62ea28e9e67f7bc06f98de083cc49454f353389cd396f5d3ac6448f19c
6:cpuacct,cpu:/kubepods/burstable/pod8e018a8e-4aaa-4ac6-986a-1a5133a4bcf1/d6f24b62ea28e9e67f7bc06f98de083cc49454f353389cd396f5d3ac6448f19c
5:pids:/kubepods/burstable/pod8e018a8e-4aaa-4ac6-986a-1a5133a4bcf1/d6f24b62ea28e9e67f7bc06f98de083cc49454f353389cd396f5d3ac6448f19c
4:devices:/kubepods/burstable/pod8e018a8e-4aaa-4ac6-986a-1a5133a4bcf1/d6f24b62ea28e9e67f7bc06f98de083cc49454f353389cd396f5d3ac6448f19c
3:net_prio,net_cls:/kubepods/burstable/pod8e018a8e-4aaa-4ac6-986a-1a5133a4bcf1/d6f24b62ea28e9e67f7bc06f98de083cc49454f353389cd396f5d3ac6448f19c
2:memory:/kubepods/burstable/pod8e018a8e-4aaa-4ac6-986a-1a5133a4bcf1/d6f24b62ea28e9e67f7bc06f98de083cc49454f353389cd396f5d3ac6448f19c
1:name=systemd:/kubepods/burstable/pod8e018a8e-4aaa-4ac6-986a-1a5133a4bcf1/d6f24b62ea28e9e67f7bc06f98de083cc49454f353389cd396f5d3ac6448f19c
```

可以看到该进程对应的容器 ID 为 `d6f24b62...`，可以再优化一下上面的命令，直接获取容器 ID：

```bash
$ CID=$(cat /proc/14338/cgroup | awk -F '/' '{print $5}')

$ echo ${CID:0:8}
d6f24b62
```

最后一步根据容器 ID 获取 Pod 名称，如果你的容器运行时是 `containerd` 或 `crio`，可以使用 `crictl` 来获取容器信息：

```bash
# Go Template
$ crictl inspect -o go-template --template='{{index .status.labels "io.kubernetes.pod.name"}}' d6f24b62
prometheus-k8s-0

# jq
$ crictl inspect d6f24b62|jq '.status.labels["io.kubernetes.pod.name"]'
"prometheus-k8s-0"
```

使用 `Go template` 或 `jq` 都能获取 Pod 名称，看个人喜好。

如果你的容器运行时是 Docker，可以使用命令行工具 `docker` 来获取，方法和上面类似。

## 2. Pod UID

下面来看看第二种方法，先根据 PID 直接获取 `Pod UID`：

```bash
$ cat /proc/14338/mountinfo | grep "etc-hosts" | awk -F / {'print $6'}
8e018a8e-4aaa-4ac6-986a-1a5133a4bcf1
```

然后根据 Pod UID 获取 Pod 名称：

```bash
$ crictl ps -o json | jq  '.[][].labels | select (.["io.kubernetes.pod.uid"] == "8e018a8e-4aaa-4ac6-986a-1a5133a4bcf1") | .["io.kubernetes.pod.name"]'|uniq
"prometheus-k8s-0"
```

## 3. 整合

方法是有了，怎么才能将所有的步骤合并成一个步骤，一步到位获取 Pod 名称呢？可以在 `~/.bashrc` 中添加一个 `shell` 函数，选择上面的方法 1，并使用 go template 来格式化（你也可以使用上面提到的其他方法，但需要安装 jq）：

```bash
podinfo() {
  CID=$(cat /proc/$1/cgroup | awk -F '/' '{print $5}')
  CID=$(echo ${CID:0:8})
  crictl inspect -o go-template --template='{{index .status.labels "io.kubernetes.pod.name"}}' $CID
}
```

执行下面的命令使修改立即生效：

```bash
$ source ~/.bashrc
```

然后就可以使用该函数来获取 Pod 名称啦：

```bash
$ podinfo 14338
prometheus-k8s-0
```

## 4. 举一反三

这个思路也可以用来解决其他问题，大家要学会举一反三，我举个例子。Kubernetes 中的很多组件都是通过 `HTTPS` 协议来暴露指标，比如 `kubelet`，那么如何使用 API 来访问这些指标呢？

先选取一个容器，比如 `prometheus`，找到它的 PID：

```bash
$ ps -ef|grep "/bin/prometheus"

1000     14338 14246  4 7月10 ?       04:29:02 /bin/prometheus --web.console.templates=/etc/prometheus/consoles --web.console.libraries=/etc/prometheus/console_libraries --config.file=/etc/prometheus/config_out/prometheus.env.yaml --storage.tsdb.path=/prometheus --storage.tsdb.retention.time=24h --web.enable-lifecycle --storage.tsdb.no-lockfile --web.route-prefix=/
1000     14402 14246  0 7月10 ?       00:00:10 /bin/prometheus-config-reloader --log-format=logfmt --reload-url=http://localhost:9090/-/reload --config-file=/etc/prometheus/config/prometheus.yaml.gz --config-envsubst-file=/etc/prometheus/config_out/prometheus.env.yaml
root     15956   555  0 18:19 pts/0    00:00:00 grep --color=auto /bin/prometheus
```

根据 PID 找到 Pod UID：

```bash
$ cat /proc/14338/mountinfo | grep "etc-hosts" | awk -F / {'print $6'}
8e018a8e-4aaa-4ac6-986a-1a5133a4bcf1
```

根据 Pod UID 找到 `Service Account` 的 token 挂载目录：

```bash
$ ll /var/lib/kubelet/pods/8e018a8e-4aaa-4ac6-986a-1a5133a4bcf1/volumes/kubernetes.io~secret/prometheus-k8s-token-p7bgb/

总用量 0
lrwxrwxrwx 1 root root 13 7月  10 21:24 ca.crt -> ..data/ca.crt
lrwxrwxrwx 1 root root 16 7月  10 21:24 namespace -> ..data/namespace
lrwxrwxrwx 1 root root 12 7月  10 21:24 token -> ..data/token
```

获取 token 信息：

```bash
$ export TOKEN=$(cat /var/lib/kubelet/pods/8e018a8e-4aaa-4ac6-986a-1a5133a4bcf1/volumes/kubernetes.io~secret/prometheus-k8s-token-p7bgb/token)
```

通过 curl 直接访问指标：

```bash
$ curl -s -H "Authorization: Bearer $TOKEN" --cacert /var/lib/kubelet/pods/8e018a8e-4aaa-4ac6-986a-1a5133a4bcf1/volumes/kubernetes.io~secret/prometheus-k8s-token-p7bgb/ca.crt --insecure https://127.0.0.1:10250/metrics/cadvisor
```

当然，如果你能找到集群管理员的证书、密钥和 CA 证书，也可以直接使用它们来访问，我就不展开说了。

## 5. 真奇技淫巧

最后再介绍一个思路清奇的方案，虽然有点小瑕疵，但思路很巧妙，大家可以借鉴一下。Kubernetes 创建的容器中的主机名对应的就是 Pod 名称，沿着这个思路，我们可以得到一个更巧妙的方法，通过 PID 的 `uts namespace` 来获得容器的主机名，进而就可以知道 Pod 名称，具体可以借助 `nsenter` 这个工具：

```bash
$ nsenter -t 14338 --uts hostname
prometheus-k8s-0
```

这么一看，确实比上面的方法优雅多了，但这个方法会有一点小问题，当容器使用 `HostNetwork` 模式运行时，hostname 是宿主机的 hostname，通过这种方法就得不到 Pod 名称。虽然不是通用的方法，但思路还是可以借鉴的，除了使用 `nsenter` 获取主机名外，还可以通过环境变量来获取，命令如下：

```bash
$ xargs -0 -L1 -a /proc/14338/environ | grep HOSTNAME
HOSTNAME=prometheus-k8s-0
```

解释一下这几个参数：

+ **-0** : 表示使用 `null` 作为分隔符
+ **-L** : 表示指定多少行作为一个命令行参数。-L1 就表示指定 1 行作为命令行参数，即每一行分别运行一次命令。xargs 的作用就是将标准输入转换为命令行参数，如果 xargs 后面没有跟上真正要执行的命令，就表示使用默认的 `echo`。所以这里的 `-L1` 就表示分隔出来的每一行分别运行一次 `echo` 命令。
+ **-a** : 从文件中读取内容，而不是从标准输入读取。

如果你还不理解，好吧我尽力了。

最后再推荐一个项目，可以找到所有容器的 PID 以及对应的 Pod 信息，项目地址：[pid2pod](https://github.com/heptiolabs/pid2pod)。