---
keywords:
- 米开朗基杨
- kubernetes
- cgroup
- oom
- linux cgroup
title: "Kubernetes 内存资源限制实战"
subtitle: "通过实验来探索容器在什么情况下会被 OOM killed"
description: 本文将会通过实验来探索容器在什么情况下会被 OOM killed，同时帮助你深入理解 Kubernetes 是如何通过 cgroup 来限制内存资源的。
date: 2019-04-29T11:43:29+08:00
draft: false
author: 米开朗基杨
toc: true
categories: 
- cloud-native
tags:
- Cgroup
- Kubernetes
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/0_htOFoCBI9_8VXPLa.jpg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

<!--more-->

Kubernetes 对内存资源的限制实际上是通过 cgroup 来控制的，cgroup 是容器的一组用来控制内核如何运行进程的相关属性集合。针对内存、CPU 和各种设备都有对应的 cgroup。cgroup 是具有层级的，这意味着每个 cgroup 拥有一个它可以继承属性的父亲，往上一直直到系统启动时创建的 root cgroup。关于其背后的原理可以参考：[深入理解Kubernetes资源限制：内存](https://medium.com/@betz.mark/understanding-resource-limits-in-kubernetes-memory-6b41e9a955f9)。

今天我们将通过实验来探索容器在什么情况下会被 oom-killed。

## 实验准备

---

首先你需要一个 Kubernetes 集群，然后通过 kubectl 创建一个 Pod，内存限制为 `123Mi`。

```bash
$ kubectl run --restart=Never --rm -it --image=ubuntu --limits='memory=123Mi' -- sh
If you don't see a command prompt, try pressing enter.
root@sh:/#
```

重新打开一个 shell 窗口，找出刚创建的 Pod 的 uid：

```bash
$ kubectl get pods sh -o yaml | grep uid
  uid: bc001ffa-68fc-11e9-92d7-5ef9efd9374c
```

在运行该 Pod 的节点上找出其 cgroup 的内存设置：

```bash
$ cd /sys/fs/cgroup/memory/kubepods/burstable/podbc001ffa-68fc-11e9-92d7-5ef9efd9374c

$ cat memory.limit_in_bytes
128974848
```

其中 `memory.limit_in_bytes` 表示当前限制的内存额度。`128974848` 正好等于 `123*1024*1024`。

如果你查看一下这个 Pod 的 cgroup 目录，就会发现 Pod 中的每个容器都会在该目录下创建一个子 cgroup 目录：

```bash
$ ll /sys/fs/cgroup/memory/kubepods/burstable/podbc001ffa-68fc-11e9-92d7-5ef9efd9374c

总用量 0
drwxr-xr-x 2 root root 0 4月  28 18:46 64ae20d221399e618bbf8c15f3b5ae5050062d497971d0af5346d5532fa5c585
drwxr-xr-x 2 root root 0 4月  28 18:25 a398d3c012bb37dd9fe5fef524842a8699de931bce3a4e3753a49ef1694b33ee
-rw-r--r-- 1 root root 0 4月  28 18:46 cgroup.clone_children
--w--w--w- 1 root root 0 4月  28 18:46 cgroup.event_control
-rw-r--r-- 1 root root 0 4月  28 18:46 cgroup.procs
-rw-r--r-- 1 root root 0 4月  28 18:46 memory.failcnt
--w------- 1 root root 0 4月  28 18:46 memory.force_empty
-rw-r--r-- 1 root root 0 4月  28 18:46 memory.kmem.failcnt
-rw-r--r-- 1 root root 0 4月  28 18:24 memory.kmem.limit_in_bytes
-rw-r--r-- 1 root root 0 4月  28 18:46 memory.kmem.max_usage_in_bytes
-r--r--r-- 1 root root 0 4月  28 18:46 memory.kmem.slabinfo
-rw-r--r-- 1 root root 0 4月  28 18:46 memory.kmem.tcp.failcnt
-rw-r--r-- 1 root root 0 4月  28 18:46 memory.kmem.tcp.limit_in_bytes
-rw-r--r-- 1 root root 0 4月  28 18:46 memory.kmem.tcp.max_usage_in_bytes
-r--r--r-- 1 root root 0 4月  28 18:46 memory.kmem.tcp.usage_in_bytes
-r--r--r-- 1 root root 0 4月  28 18:46 memory.kmem.usage_in_bytes
-rw-r--r-- 1 root root 0 4月  28 18:24 memory.limit_in_bytes
-rw-r--r-- 1 root root 0 4月  28 18:46 memory.max_usage_in_bytes
-rw-r--r-- 1 root root 0 4月  28 18:46 memory.memsw.failcnt
-rw-r--r-- 1 root root 0 4月  28 18:46 memory.memsw.limit_in_bytes
-rw-r--r-- 1 root root 0 4月  28 18:46 memory.memsw.max_usage_in_bytes
-r--r--r-- 1 root root 0 4月  28 18:46 memory.memsw.usage_in_bytes
-rw-r--r-- 1 root root 0 4月  28 18:46 memory.move_charge_at_immigrate
-r--r--r-- 1 root root 0 4月  28 18:46 memory.numa_stat
-rw-r--r-- 1 root root 0 4月  28 18:46 memory.oom_control
---------- 1 root root 0 4月  28 18:46 memory.pressure_level
-rw-r--r-- 1 root root 0 4月  28 18:46 memory.soft_limit_in_bytes
-r--r--r-- 1 root root 0 4月  28 18:46 memory.stat
-rw-r--r-- 1 root root 0 4月  28 18:46 memory.swappiness
-r--r--r-- 1 root root 0 4月  28 18:46 memory.usage_in_bytes
-rw-r--r-- 1 root root 0 4月  28 18:46 memory.use_hierarchy
-rw-r--r-- 1 root root 0 4月  28 18:46 notify_on_release
-rw-r--r-- 1 root root 0 4月  28 18:46 tasks
```

输出结果的前两个目录其实就是 pause 容器的 `pause` 进程和业务容器的 `bash` 进程创建的两个子 cgroup 目录。可以来证实一下，我的环境使用的容器运行时是 containerd，可以通过 crictl 工具来查看，如果你使用的是 docker，方法类似。

先在运行该容器的节点上找到该业务容器的 ID：

```bash
$ crictl ps|grep "CONTAINER_RUNNING   sh"

64ae20d221399       sha256:d131e0fa2585a7efbfb187f70d648aa50e251d9d3b7031edf4730ca6154e221e   17 hours ago        CONTAINER_RUNNING   sh                           0
```

查看该容器的 pid：

```bash
$ crictl inspect 64ae20d221399|grep pid

    "pid": 32308,
            "pid": 1
            "type": "pid"
```

查看该进程所属的 cgroup，即进程在 cgroup 树中的路径：

```bash
$ cat /proc/32308/cgroup

...
4:memory:/kubepods/burstable/podbc001ffa-68fc-11e9-92d7-5ef9efd9374c/64ae20d221399e618bbf8c15f3b5ae5050062d497971d0af5346d5532fa5c585
...
```

进入该目录，查看内存限制：

```bash
$ cd /sys/fs/cgroup/memory/kubepods/burstable/podbc001ffa-68fc-11e9-92d7-5ef9efd9374c/64ae20d221399e618bbf8c15f3b5ae5050062d497971d0af5346d5532fa5c585

$ cat memory.limit_in_bytes
128974848
```

可以看到该 cgroup 的内存限制和父 cgroup 一样，而父 cgroup 其实就是 Pod 级别的 cgroup。

按照预想，一旦 Pod 消耗的内存资源超过这个限制，cgroup 就会杀死容器进程，我们来测试一下。

## 压力测试

---

先在容器中安装压力测试工具：

```bash
root@sh:/# apt update; apt install -y stress
```

在另一个一个 shell 窗口中执行 `dmesg -Tw` 命令查看系统的 Syslog。

回到第一个 shell 窗口进行压力测试，限制内存在 100M 以内：

```bash
root@sh:/# stress --vm 1 --vm-bytes 100M &
[1] 271
root@sh:/# stress: info: [271] dispatching hogs: 0 cpu, 0 io, 1 vm, 0 hdd
```

执行第二次压力测试：

```bash
root@sh:/# stress --vm 1 --vm-bytes 50M
stress: info: [273] dispatching hogs: 0 cpu, 0 io, 1 vm, 0 hdd
stress: FAIL: [271] (415) <-- worker 272 got signal 9
stress: WARN: [271] (417) now reaping child worker processes
stress: FAIL: [271] (451) failed run completed in 7s
```

可以看到系统通过发送 signal 9（SIGKILL） 信号杀死了第一次压力测试的进程（进程 ID 为 `271`）。

可以在另一个 shell 窗口中看到系统的 syslog 日志输出：

```bash
[Sat Apr 27 22:56:09 2019] stress invoked oom-killer: gfp_mask=0x14000c0(GFP_KERNEL), nodemask=(null), order=0, oom_score_adj=939
[Sat Apr 27 22:56:09 2019] stress cpuset=a2ed67c63e828da3849bf9f506ae2b36b4dac5b402a57f2981c9bdc07b23e672 mems_allowed=0
[Sat Apr 27 22:56:09 2019] CPU: 0 PID: 32332 Comm: stress Not tainted 4.15.0-46-generic #49-Ubuntu
[Sat Apr 27 22:56:09 2019] Hardware name:  BHYVE, BIOS 1.00 03/14/2014
[Sat Apr 27 22:56:09 2019] Call Trace:
[Sat Apr 27 22:56:09 2019]  dump_stack+0x63/0x8b
[Sat Apr 27 22:56:09 2019]  dump_header+0x71/0x285
[Sat Apr 27 22:56:09 2019]  oom_kill_process+0x220/0x440
[Sat Apr 27 22:56:09 2019]  out_of_memory+0x2d1/0x4f0
[Sat Apr 27 22:56:09 2019]  mem_cgroup_out_of_memory+0x4b/0x80
[Sat Apr 27 22:56:09 2019]  mem_cgroup_oom_synchronize+0x2e8/0x320
[Sat Apr 27 22:56:09 2019]  ? mem_cgroup_css_online+0x40/0x40
[Sat Apr 27 22:56:09 2019]  pagefault_out_of_memory+0x36/0x7b
[Sat Apr 27 22:56:09 2019]  mm_fault_error+0x90/0x180
[Sat Apr 27 22:56:09 2019]  __do_page_fault+0x4a5/0x4d0
[Sat Apr 27 22:56:09 2019]  do_page_fault+0x2e/0xe0
[Sat Apr 27 22:56:09 2019]  ? page_fault+0x2f/0x50
[Sat Apr 27 22:56:09 2019]  page_fault+0x45/0x50
[Sat Apr 27 22:56:09 2019] RIP: 0033:0x558182259cf0
[Sat Apr 27 22:56:09 2019] RSP: 002b:00007fff01a47940 EFLAGS: 00010206
[Sat Apr 27 22:56:09 2019] RAX: 00007fdc18cdf010 RBX: 00007fdc1763a010 RCX: 00007fdc1763a010
[Sat Apr 27 22:56:09 2019] RDX: 00000000016a5000 RSI: 0000000003201000 RDI: 0000000000000000
[Sat Apr 27 22:56:09 2019] RBP: 0000000003200000 R08: 00000000ffffffff R09: 0000000000000000
[Sat Apr 27 22:56:09 2019] R10: 0000000000000022 R11: 0000000000000246 R12: ffffffffffffffff
[Sat Apr 27 22:56:09 2019] R13: 0000000000000002 R14: fffffffffffff000 R15: 0000000000001000
[Sat Apr 27 22:56:09 2019] Task in /kubepods/burstable/podbc001ffa-68fc-11e9-92d7-5ef9efd9374c/a2ed67c63e828da3849bf9f506ae2b36b4dac5b402a57f2981c9bdc07b23e672 killed as a result of limit of /kubepods/burstable/podbc001ffa-68fc-11e9-92d7-5ef9efd9374c
[Sat Apr 27 22:56:09 2019] memory: usage 125952kB, limit 125952kB, failcnt 3632
[Sat Apr 27 22:56:09 2019] memory+swap: usage 0kB, limit 9007199254740988kB, failcnt 0
[Sat Apr 27 22:56:09 2019] kmem: usage 2352kB, limit 9007199254740988kB, failcnt 0
[Sat Apr 27 22:56:09 2019] Memory cgroup stats for /kubepods/burstable/podbc001ffa-68fc-11e9-92d7-5ef9efd9374c: cache:0KB rss:0KB rss_huge:0KB shmem:0KB mapped_file:0KB dirty:0KB writeback:0KB inactive_anon:0KB active_anon:0KB inactive_file:0KB active_file:0KB unevictable:0KB
[Sat Apr 27 22:56:09 2019] Memory cgroup stats for /kubepods/burstable/podbc001ffa-68fc-11e9-92d7-5ef9efd9374c/79fae7c2724ea1b19caa343fed8da3ea84bbe5eb370e5af8a6a94a090d9e4ac2: cache:0KB rss:48KB rss_huge:0KB shmem:0KB mapped_file:0KB dirty:0KB writeback:0KB inactive_anon:0KB active_anon:48KB inactive_file:0KB active_file:0KB unevictable:0KB
[Sat Apr 27 22:56:09 2019] Memory cgroup stats for /kubepods/burstable/podbc001ffa-68fc-11e9-92d7-5ef9efd9374c/a2ed67c63e828da3849bf9f506ae2b36b4dac5b402a57f2981c9bdc07b23e672: cache:0KB rss:123552KB rss_huge:0KB shmem:0KB mapped_file:0KB dirty:0KB writeback:0KB inactive_anon:0KB active_anon:123548KB inactive_file:0KB active_file:0KB unevictable:0KB
[Sat Apr 27 22:56:09 2019] [ pid ]   uid  tgid total_vm      rss pgtables_bytes swapents oom_score_adj name
[Sat Apr 27 22:56:09 2019] [25160]     0 25160      256        1    28672        0          -998 pause
[Sat Apr 27 22:56:09 2019] [25218]     0 25218     4627      872    77824        0           939 bash
[Sat Apr 27 22:56:09 2019] [32307]     0 32307     2060      275    57344        0           939 stress
[Sat Apr 27 22:56:09 2019] [32308]     0 32308    27661    24953   253952        0           939 stress
[Sat Apr 27 22:56:09 2019] [32331]     0 32331     2060      304    53248        0           939 stress
[Sat Apr 27 22:56:09 2019] [32332]     0 32332    14861     5829   102400        0           939 stress
[Sat Apr 27 22:56:09 2019] Memory cgroup out of memory: Kill process 32308 (stress) score 1718 or sacrifice child
[Sat Apr 27 22:56:09 2019] Killed process 32308 (stress) total-vm:110644kB, anon-rss:99620kB, file-rss:192kB, shmem-rss:0kB
[Sat Apr 27 22:56:09 2019] oom_reaper: reaped process 32308 (stress), now anon-rss:0kB, file-rss:0kB, shmem-rss:0kB
```

从宿主机的视角来看，PID 为 `32308` 的进程被 oom-killed 了，我们需要重点关注最后一段日志输出：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-04-28-144115.jpg)

对于刚刚创建的 Pod 而言，有好几个进程作为 OOM killer 的候选人，其中最重要的进程是 `pause`，用来为业务容器创建共享的 network namespace，其 `oom_score_adj` 值为 `-998`，可以确保不被杀死。`oom_score_adj` 值越低就越不容易被杀死。关于 Pod 的 QoS 与 OOM 值的对应关系，可以参考：[Kubernetes 资源管理概述](/posts/kubernetes-resource-management/#qos-%E6%9C%8D%E5%8A%A1%E8%B4%A8%E9%87%8F)。

除了 `pause` 进程外，剩下的进程 `oom_score_adj` 值均为 `939`，我们可以根据 [Kubernetes 官方文档](https://kubernetes.io/docs/tasks/administer-cluster/out-of-resource/#node-oom-behavior)中公式来验证一下：

```bash
min(max(2, 1000 - (1000 * memoryRequestBytes) / machineMemoryCapacityBytes), 999)
```

进程的 `oom_score_adj` 值可以通过以下命令来查看：

```bash
$ cat /proc/32308/oom_score_adj

939
```

> 其中 `memoryRequest` 是 pod 申请的资源，`memoryCapacity` 是节点的内存总量。可以看到，申请的内存越多，oom 值越低，也就越不容易被杀死。

查看运行该 Pod 的节点内存总量：

```bash
$ kubectl describe nodes k3s | grep Allocatable -A 5
Allocatable:
 cpu:                1
 ephemeral-storage:  49255941901
 hugepages-1Gi:      0
 hugepages-2Mi:      0
 memory:             2041888Ki
```

如果只设置了 limits，Kubernetes 会自动把 Pod 的 requests 设置成和 limits 一样。所以其他进程的 `oom_score_adj` 值为 `1000–123*1024/2041888=938.32`，这个值已经很接近 syslog 中输出的 939 了。

{{< alert >}}
OOM killer 会根据进程的内存使用情况来计算 `oom_score` 的值，并根据 `oom_score_adj` 的值来进行微调。
{{< /alert >}}

进程的 `oom_score` 值可以通过以下命令来查看：

```bash
$ cat /proc/32308/oom_score

1718
```

因为业务容器内所有进程的 `oom_score_adj` 值都相同，所以谁的内存使用量最多，`oom_score` 值就越高，也就越容易被杀死。因为第一个 stress 进程使的内存使用量最多（100M），`oom_score` 值最高（值为 1718），所以被杀死。

## 总结

---

Kubernetes 通过 cgroup 和 OOM killer 来限制 Pod 的内存资源，在实际使用中我们需要小心区分 OS 级别的 OOM 和 Pod 级别的 OOM。
