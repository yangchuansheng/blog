---
keywords:
- 米开朗基杨 
- capabilities
- linux
- no_new_privs
title: "Linux Capabilities 入门教程：基础实战篇"
subtitle: "管理文件的 capabilities"
description: 本文通过两种工具演示了如何对可执行文件的 capabilities 进行管理，并以 docker 为例，展现了 no_new_privs 的强大之处。
date: 2019-11-03T23:23:19-05:00
draft: false
author: 米开朗基杨
toc: true
categories: "linux"
tags: ["linux", "capabilities"]
series:
- Linux Capabilities 入门系列
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/2020-04-24-linux-capabilities-in-practice.webp"
---

该系列文章总共分为三篇：

+ [Linux Capabilities 入门教程：概念篇](https://icloudnative.io/posts/linux-capabilities-why-they-exist-and-how-they-work/)
+ [Linux Capabilities 入门教程：基础实战篇](https://icloudnative.io/posts/linux-capabilities-in-practice-1/)
+ [Linux Capabilities 入门教程：进阶实战篇](https://icloudnative.io/posts/linux-capabilities-in-practice-2/)

[上篇文章](https://icloudnative.io/posts/linux-capabilities-why-they-exist-and-how-they-work/)介绍了 Linux capabilities 的诞生背景和基本原理，本文将会通过具体的示例来展示如何查看和设置文件的 capabilities。

Linux 系统中主要提供了两种工具来管理 capabilities：`libcap` 和 `libcap-ng`。`libcap` 提供了 `getcap` 和 `setcap` 两个命令来分别查看和设置文件的 capabilities，同时还提供了 `capsh` 来查看当前 shell 进程的 capabilities。`libcap-ng` 更易于使用，使用同一个命令 `filecap` 来查看和设置 capabilities。

## <span id="inline-toc">1.</span> libcap

----

安装很简单，以 CentOS 为例，可以通过以下命令安装：

```bash
$ yum install -y libcap
```

如果想查看当前 shell 进程的 capabilities，可以用 `capsh` 命令。下面是 CentOS 系统中的 root 用户执行 `capsh` 的输出：

```bash
$ capsh --print

Current: = cap_chown,cap_dac_override,cap_dac_read_search,cap_fowner,cap_fsetid,cap_kill,cap_setgid,cap_setuid,cap_setpcap,cap_linux_immutable,cap_net_bind_service,cap_net_broadcast,cap_net_admin,cap_net_raw,cap_ipc_lock,cap_ipc_owner,cap_sys_module,cap_sys_rawio,cap_sys_chroot,cap_sys_ptrace,cap_sys_pacct,cap_sys_admin,cap_sys_boot,cap_sys_nice,cap_sys_resource,cap_sys_time,cap_sys_tty_config,cap_mknod,cap_lease,cap_audit_write,cap_audit_control,cap_setfcap,cap_mac_override,cap_mac_admin,cap_syslog,cap_wake_alarm,cap_block_suspend,cap_audit_read+ep
Bounding set =cap_chown,cap_dac_override,cap_dac_read_search,cap_fowner,cap_fsetid,cap_kill,cap_setgid,cap_setuid,cap_setpcap,cap_linux_immutable,cap_net_bind_service,cap_net_broadcast,cap_net_admin,cap_net_raw,cap_ipc_lock,cap_ipc_owner,cap_sys_module,cap_sys_rawio,cap_sys_chroot,cap_sys_ptrace,cap_sys_pacct,cap_sys_admin,cap_sys_boot,cap_sys_nice,cap_sys_resource,cap_sys_time,cap_sys_tty_config,cap_mknod,cap_lease,cap_audit_write,cap_audit_control,cap_setfcap,cap_mac_override,cap_mac_admin,cap_syslog,cap_wake_alarm,cap_block_suspend,cap_audit_read
Securebits: 00/0x0/1'b0
 secure-noroot: no (unlocked)
 secure-no-suid-fixup: no (unlocked)
 secure-keep-caps: no (unlocked)
uid=0(root)
gid=0(root)
groups=0(root)
```

解释一下：

+ **Current** : 表示当前 shell 进程的 Effective capabilities 和 Permitted capabilities。可以包含多个分组，每一个分组的表示形式为 `capability[,capability…]+(e|i|p)`，其中 `e` 表示 effective，`i` 表示 inheritable，`p` 表示 permitted。不同的分组之间通过空格隔开，例如：`Current: = cap_sys_chroot+ep cap_net_bind_service+eip`。再举一个例子，`cap_net_bind_service+e cap_net_bind_service+ip` 和 `cap_net_bind_service+eip` 等价。
+ **Bounding set** : 这里仅仅表示 Bounding 集合中的 capabilities，不包括其他集合，所以分组的末尾不用加上 `+...` 。
+ **Securebits** : 我也没搞清楚这是个什么鬼。

这个命令输出的信息比较有限，完整的信息可以查看 /proc 文件系统，比如当前 shell 进程就可以查看 `/proc/$$/status`。其中一个重要的状态就是 `NoNewPrivs`，可以通过以下命令查看：

```bash
grep NoNewPrivs /proc/$$/status

NoNewPrivs:    0
```

根据 [prctl(2)](http://man7.org/linux/man-pages/man2/prctl.2.html) 中的描述，自从 Linux 4.10 开始，`/proc/[pid]/status` 中的 `NoNewPrivs` 值表示了线程的 `no_new_privs` 属性。至于 `no_new_privs`究竟是干嘛的，下面我单独解释一下。

### no_new_privs

一般情况下，`execve()` 系统调用能够赋予新启动的进程其父进程没有的权限，最常见的例子就是通过 `setuid` 和 `setgid` 来设置程序进程的 uid 和 gid 以及文件的访问权限。这就给不怀好意者钻了不少空子，可以直接通过 fork 来提升进程的权限，从而达到不可告人的目的。

为了解决这个问题，Linux 内核从 3.5 版本开始，引入了 `no_new_privs` 属性（实际上就是一个 bit，可以开启和关闭），提供给进程一种能够在 `execve()` 调用整个阶段都能持续有效且安全的方法。

+ 开启了 `no_new_privs` 之后，execve 函数可以确保所有操作都必须调用 `execve()` 判断并赋予权限后才能被执行。这就确保了线程及子线程都无法获得额外的权限，因为无法执行 setuid 和 setgid，也不能设置文件的权限。
+ 一旦当前线程的 `no_new_privs` 被置位后，不论通过 fork，clone 或 execve 生成的子线程都无法将该位清零。

Docker 中可以通过参数 `--security-opt` 来开启 `no_new_privs` 属性，例如：`docker run --security-opt=no_new_privs busybox`。下面通过一个例子来体会一下 `no_new_privs` 属性的作用。

首先撸一段 C 代码，显示当前进程的有效用户 id：

```c
$ cat testnnp.c

#include <stdio.h>
#include <unistd.h>
#include <sys/types.h>

int main(int argc, char *argv[])
{
        printf("Effective uid: %d\n", geteuid());
        return 0;
}
```

```bash
$ make testnnp
cc     testnnp.c   -o testnnp
```

将可执行文件打入 docker 镜像中：

```dockerfile
FROM fedora:latest
ADD testnnp /root/testnnp
RUN chmod +s /root/testnnp
ENTRYPOINT /root/testnnp
```

构建镜像：

```bash
$ docker build -t testnnp .
Step 1 : FROM fedora:latest
 ---> 760a896a323f
Step 2 : ADD testnnp /root/testnnp
 ---> 6c700f277948
Removing intermediate container 0981144fe404
Step 3 : RUN chmod +s /root/testnnp
 ---> Running in c1215bfbe825
 ---> f1f07d05a691
Removing intermediate container c1215bfbe825
Step 4 : ENTRYPOINT /root/testnnp
 ---> Running in 5a4d324d54fa
 ---> 44f767c67e30
Removing intermediate container 5a4d324d54fa
Successfully built 44f767c67e30
```

下面来做两个实验，先在没有开启 `no-new-privileges` 的情况下启动容器：

```bash
$ docker run -it --rm --user=1000  testnnp
Effective uid: 0
```

从输出结果来看，只要给可执行文件设置了 SUID 标识，即使我们使用普通用户（UID=1000）来运行容器，进程的有效用户也会变成 root。

接着在开启 `no-new-privileges` 的前提下启动容器，以防止执行设置了 SUID 标识的可执行文件进行 UID 转换：

```bash
$ docker run -it --rm --user=1000 --security-opt=no-new-privileges testnnp
Effective uid: 1000
```

可以看到，开启了 `no_new_privs` 属性之后，即使可执行文件设置了 SUID 标识，线程的有效用户 ID 也不会变成 root。这样即使镜像中的代码有安全风险，仍然可以通过防止其提升权限来避免受到攻击。

Kubernetes 也可以开启 `no_new_privs`，不过逻辑稍微复杂一点。当 Pod 的 `SecurityContext` 定义下的 `allowPrivilegeEscalation` 字段值为 false 时（默认就是 false），如果不满足以下任何一个条件，就会开启 `no_new_privs` 属性：

+ 设置了 `privileged=true`
+ 增加了 `CAP_SYS_ADMIN` capabilities，即 `capAdd=CAP_SYS_ADMIN`
+ 以 root 用户运行，即 UID=0

例如，当设置了 `privileged=true` 和 `allowPrivilegeEscalation=false` 时，就不会开启 `no_new_privs` 属性。同理，设置了 `capAdd=CAP_SYS_ADMIN` 和 `allowPrivilegeEscalation=false` 也不会开启 `no_new_privs` 属性。

### 管理 capabilities

可以通过 `getcap` 来查看文件的 capabilities，例如：

```bash
$ getcap /bin/ping /usr/sbin/arping

/bin/ping = cap_net_admin,cap_net_raw+p
/usr/sbin/arping = cap_net_raw+p
```

也可以使用 `-r` 参数来递归查询：

```bash
$ getcap -r /usr 2>/dev/null

/usr/bin/ping = cap_net_admin,cap_net_raw+p
/usr/bin/newgidmap = cap_setgid+ep
/usr/bin/newuidmap = cap_setuid+ep
/usr/sbin/arping = cap_net_raw+p
/usr/sbin/clockdiff = cap_net_raw+p
```

如果想查看某个进程的 capabilities，可以直接使用 `getpcaps`，后面跟上进程的 PID：

```bash
$ getpcaps 1234
```

如果想查看一组相互关联的线程的 capabilities（比如 nginx），可以这么来看：

```bash
$ getpcaps $(pgrep nginx)
```

这里你会看到只有主线程才有 capabilities，子线程和其他 workers 都没有 capabilities，这是因为只有 master 才需要特殊权限，例如监听网络端口，其他线程只需要响应请求就好了。

设置文件的 capabilities 可以使用 `setcap`，语法如下：

```bash
$ setcap CAP+set filename
```

例如，将 `CAP_CHOWN` 和 `CAP_DAC_OVERRIDE` capabilities 添加到 `permitted` 和 `effective` 集合：

```bash
$ setcap CAP_CHOWN,CAP_DAC_OVERRIDE+ep file1
```

如果想移除某个文件的 capabilities，可以使用 `-r` 参数：

```bash
$ setcap -r filename
```

## <span id="inline-toc">2.</span> libcap-ng

----

安装也很简单，以 CentOS 为例：

```bash
$ yum install libcap-ng-utils
```

### 用法

libcap-ng 使用 `filecap` 命令来管理文件的 capabilities。有几个需要注意的地方：

+ filecap 添加删除或查看 capabilities 时，capabilities 的名字不需要带 `CAP_` 前缀（例如，使用 `NET_ADMIN` 代替 `CAP_NET_ADMIN`）；
+ filecap 不支持相对路径，只支持绝对路径；
+ filecap 不允许指定 capabilities 作用的集合，capabilities 只会被添加到 `permitted` 和 `effective` 集合。

查看文件的 capabilities：

```bash
$ filecap /full/path/to/file
```

递归查看某个目录下所有文件的 capabilities：

```bash
$ filecap /full/path/to/dir
```

例如：

```bash
$ filecap /usr/bin

file                 capabilities
/usr/bin/newgidmap     setgid
/usr/bin/newuidmap     setuid
```

> **注意 :**  filecap 只会显示“capabilities 被添加到 `permitted` 和 `effective` 集合中”的文件。所以这里没有显示 ping 和 arping。

递归查看整个系统所有文件的 capabilities：

```bash
$ filecap /
# or
$ filecap -a
```

设置文件的 capabilities 语法如下：

```bash
$ filecap /full/path/to/file cap_name
```

例如：

```bash
$ filecap /usr/bin/tac dac_override
```

移除某个文件的 capabilities：

```bash
$ filecap /full/path/to/file none
```

## <span id="inline-toc">3.</span> 总结

----

本文通过两种工具演示了如何对可执行文件的 capabilities 进行管理，并以 docker 为例，展现了 `no_new_privs` 的强大之处。如果条件允许，推荐大家以后尽量用 capabilities 来替代完整的 root 权限或者设置 SUID 标识。

## <span id="inline-toc">4.</span> 参考资料

----

+ [Added no-new-privileges Security Flag to Docker](https://www.projectatomic.io/blog/2016/03/no-new-privs-docker/)
+ [关于 no new privs 翻译稿](https://turbin.github.io/2017/01/28/no_new_privs%E4%B8%AD%E6%96%87%E8%AF%B4%E6%98%8E%E7%BF%BB%E8%AF%91/)

