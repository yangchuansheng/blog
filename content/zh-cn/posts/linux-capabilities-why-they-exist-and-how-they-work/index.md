---
keywords:
- 米开朗基杨 
- linux
- capabilities
- suid
- ambient
- permitted
- effective
- inheritable
title: "Linux Capabilities 入门教程：概念篇"
subtitle: "深入理解 Linux Capabilities 的原理"
description: 本文介绍了 linux capabilities 的产生背景，详细解读了 capabilities 的获得和继承算法，最后通过具体的示例来解释这一切。 
date: 2019-10-27T09:57:11-04:00
draft: false
author: 米开朗基杨
toc: true
categories:
- Linux
tags:
- Capabilities
series:
- Linux Capabilities 入门系列
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/2020-04-24-LinuxPenguin.webp"
---

该系列文章总共分为三篇：

+ [Linux Capabilities 入门教程：概念篇](/posts/linux-capabilities-why-they-exist-and-how-they-work/)
+ [Linux Capabilities 入门教程：基础实战篇](/posts/linux-capabilities-in-practice-1/)
+ [Linux Capabilities 入门教程：进阶实战篇](/posts/linux-capabilities-in-practice-2/)

Linux 是一种安全的操作系统，它把所有的系统权限都赋予了一个单一的 root 用户，只给普通用户保留有限的权限。root 用户拥有超级管理员权限，可以安装软件、允许某些服务、管理用户等。

作为普通用户，如果想执行某些只有管理员才有权限的操作，以前只有两种办法：一是通过 `sudo` 提升权限，如果用户很多，配置管理和权限控制会很麻烦；二是通过 [SUID](https://en.wikipedia.org/wiki/Setuid)（Set User ID on execution）来实现，它可以让普通用户允许一个 `owner` 为 root 的可执行文件时具有 root 的权限。

`SUID` 的概念比较晦涩难懂，举个例子就明白了，以常用的 `passwd` 命令为例，修改用户密码是需要 root 权限的，但普通用户却可以通过这个命令来修改密码，这就是因为 `/bin/passwd` 被设置了 `SUID` 标识，所以普通用户执行 passwd 命令时，进程的 owner 就是 passwd 的所有者，也就是 root 用户。

`SUID` 虽然可以解决问题，但却带来了安全隐患。当运行设置了 `SUID` 的命令时，通常只是需要很小一部分的特权，但是 `SUID` 给了它 root 具有的全部权限。这些可执行文件是黑客的主要目标，如果他们发现了其中的漏洞，就很容易利用它来进行安全攻击。简而言之，**`SUID` 机制增大了系统的安全攻击面。**

为了对 root 权限进行更细粒度的控制，实现按需授权，Linux 引入了另一种机制叫 `capabilities`。

## Linux capabilities 是什么？

----

`Capabilities` 机制是在 Linux 内核 `2.2` 之后引入的，原理很简单，就是将之前与超级用户 root（UID=0）关联的特权细分为不同的功能组，Capabilites 作为线程（**Linux 并不真正区分进程和线程**）的属性存在，每个功能组都可以独立启用和禁用。其本质上就是将内核调用分门别类，具有相似功能的内核调用被分到同一组中。

这样一来，权限检查的过程就变成了：在执行特权操作时，如果线程的有效身份不是 root，就去检查其是否具有该特权操作所对应的 capabilities，并以此为依据，决定是否可以执行特权操作。

Capabilities 可以在进程执行时赋予，也可以直接从父进程继承。所以理论上如果给 nginx 可执行文件赋予了 `CAP_NET_BIND_SERVICE` capabilities，那么它就能以普通用户运行并监听在 80 端口上。

| capability 名称        | 描述                                          |
| -------------------- | ------------------------------------------- |
| CAP_AUDIT_CONTROL    | 启用和禁用内核审计；改变审计过滤规则；检索审计状态和过滤规则              |
| CAP_AUDIT_READ       | 允许通过 multicast netlink 套接字读取审计日志            |
| CAP_AUDIT_WRITE      | 将记录写入内核审计日志                                 |
| CAP_BLOCK_SUSPEND    | 使用可以阻止系统挂起的特性                               |
| CAP_CHOWN            | 修改文件所有者的权限                                  |
| CAP_DAC_OVERRIDE     | 忽略文件的 DAC 访问限制                              |
| CAP_DAC_READ_SEARCH  | 忽略文件读及目录搜索的 DAC 访问限制                        |
| CAP_FOWNER           | 忽略文件属主 ID 必须和进程用户 ID 相匹配的限制                 |
| CAP_FSETID           | 允许设置文件的 setuid 位                            |
| CAP_IPC_LOCK         | 允许锁定共享内存片段                                  |
| CAP_IPC_OWNER        | 忽略 IPC 所有权检查                                |
| CAP_KILL             | 允许对不属于自己的进程发送信号                             |
| CAP_LEASE            | 允许修改文件锁的 FL_LEASE 标志                        |
| CAP_LINUX_IMMUTABLE  | 允许修改文件的 IMMUTABLE 和 APPEND 属性标志             |
| CAP_MAC_ADMIN        | 允许 MAC 配置或状态更改                              |
| CAP_MAC_OVERRIDE     | 忽略文件的 DAC 访问限制                              |
| CAP_MKNOD            | 允许使用 mknod() 系统调用                           |
| CAP_NET_ADMIN        | 允许执行网络管理任务                                  |
| CAP_NET_BIND_SERVICE | 允许绑定到小于 1024 的端口                            |
| CAP_NET_BROADCAST    | 允许网络广播和多播访问                                 |
| CAP_NET_RAW          | 允许使用原始套接字                                   |
| CAP_SETGID           | 允许改变进程的 GID                                 |
| CAP_SETFCAP          | 允许为文件设置任意的 capabilities                     |
| CAP_SETPCAP          | 参考 capabilities man page                    |
| CAP_SETUID           | 允许改变进程的 UID                                 |
| CAP_SYS_ADMIN        | 允许执行系统管理任务，如加载或卸载文件系统、设置磁盘配额等               |
| CAP_SYS_BOOT         | 允许重新启动系统                                    |
| CAP_SYS_CHROOT       | 允许使用 chroot() 系统调用                          |
| CAP_SYS_MODULE       | 允许插入和删除内核模块                                 |
| CAP_SYS_NICE         | 允许提升优先级及设置其他进程的优先级                          |
| CAP_SYS_PACCT        | 允许执行进程的 BSD 式审计                             |
| CAP_SYS_PTRACE       | 允许跟踪任何进程                                    |
| CAP_SYS_RAWIO        | 允许直接访问 /devport、/dev/mem、/dev/kmem 及原始块设备   |
| CAP_SYS_RESOURCE     | 忽略资源限制                                      |
| CAP_SYS_TIME         | 允许改变系统时钟                                    |
| CAP_SYS_TTY_CONFIG   | 允许配置 TTY 设备                                 |
| CAP_SYSLOG           | 允许使用 syslog() 系统调用                          |
| CAP_WAKE_ALARM       | 允许触发一些能唤醒系统的东西(比如 CLOCK_BOOTTIME_ALARM 计时器) |

## capabilities 的赋予和继承

----

Linux capabilities 分为进程 capabilities 和文件 capabilities。对于进程来说，capabilities 是细分到线程的，即每个线程可以有自己的capabilities。对于文件来说，capabilities 保存在文件的扩展属性中。

下面分别介绍线程（进程）的 capabilities 和文件的 capabilities。

### 线程的 capabilities

每一个线程，具有 5 个 capabilities 集合，每一个集合使用 `64` 位掩码来表示，显示为 `16` 进制格式。这 5 个 capabilities 集合分别是：

+ Permitted
+ Effective
+ Inheritable
+ Bounding
+ Ambient

每个集合中都包含零个或多个 capabilities。这5个集合的具体含义如下：

#### Permitted

定义了线程能够使用的 capabilities 的上限。它并不使能线程的 capabilities，而是作为一个规定。也就是说，线程可以通过系统调用 `capset()` 来从 `Effective` 或 `Inheritable` 集合中添加或删除 capability，前提是添加或删除的 capability 必须包含在 `Permitted` 集合中（其中 Bounding 集合也会有影响，具体参考下文）。 如果某个线程想向 `Inheritable` 集合中添加或删除 capability，首先它的 `Effective` 集合中得包含 `CAP_SETPCAP` 这个 capabiliy。

#### Effective

内核检查线程是否可以进行特权操作时，检查的对象便是 `Effective` 集合。如之前所说，`Permitted` 集合定义了上限，线程可以删除 Effective 集合中的某 capability，随后在需要时，再从 Permitted 集合中恢复该 capability，以此达到临时禁用 capability 的功能。

#### Inheritable

当执行`exec()` 系统调用时，能够被新的可执行文件继承的 capabilities，被包含在 `Inheritable` 集合中。这里需要说明一下，包含在该集合中的 capabilities 并不会自动继承给新的可执行文件，即不会添加到新线程的 `Effective` 集合中，它只会影响新线程的 `Permitted` 集合。

#### Bounding

`Bounding` 集合是 `Inheritable` 集合的超集，如果某个 capability 不在 `Bounding` 集合中，即使它在 `Permitted` 集合中，该线程也不能将该 capability 添加到它的 `Inheritable` 集合中。

Bounding 集合的 capabilities 在执行 `fork()` 系统调用时会传递给子进程的 Bounding 集合，并且在执行 `execve` 系统调用后保持不变。

+ 当线程运行时，不能向 Bounding 集合中添加 capabilities。
+ 一旦某个 capability 被从 Bounding 集合中删除，便不能再添加回来。
+ 将某个 capability 从 Bounding 集合中删除后，如果之前 `Inherited` 集合包含该 capability，将继续保留。但如果后续从 `Inheritable` 集合中删除了该 capability，便不能再添加回来。

#### Ambient

Linux `4.3` 内核新增了一个 capabilities 集合叫 `Ambient` ，用来弥补 `Inheritable` 的不足。`Ambient` 具有如下特性：

+ `Permitted` 和 `Inheritable` 未设置的 capabilities，`Ambient` 也不能设置。
+ 当 `Permitted` 和 `Inheritable` 关闭某权限（比如 `CAP_SYS_BOOT`）后，`Ambient` 也随之关闭对应权限。这样就确保了降低权限后子进程也会降低权限。
+ 非特权用户如果在 `Permitted` 集合中有一个 capability，那么可以添加到 `Ambient` 集合中，这样它的子进程便可以在 `Ambient`、`Permitted` 和 `Effective` 集合中获取这个 capability。现在不知道为什么也没关系，后面会通过具体的公式来告诉你。

`Ambient` 的好处显而易见，举个例子，如果你将 `CAP_NET_ADMIN` 添加到当前进程的 `Ambient` 集合中，它便可以通过 `fork()` 和 `execve()` 调用 shell 脚本来执行网络管理任务，因为 `CAP_NET_ADMIN` 会自动继承下去。

### 文件的 capabilities

文件的 capabilities 被保存在文件的扩展属性中。如果想修改这些属性，需要具有 `CAP_SETFCAP` 的 capability。文件与线程的 capabilities 共同决定了通过 `execve()` 运行该文件后的线程的 capabilities。

文件的 capabilities 功能，需要文件系统的支持。如果文件系统使用了 `nouuid` 选项进行挂载，那么文件的 capabilities 将会被忽略。

类似于线程的 capabilities，文件的 capabilities 包含了 3 个集合：

+ Permitted
+ Inheritable
+ Effective

这3个集合的具体含义如下：

#### Permitted

这个集合中包含的 capabilities，在文件被执行时，会与线程的 Bounding 集合计算交集，然后添加到线程的 `Permitted` 集合中。

#### Inheritable

这个集合与线程的 `Inheritable` 集合的交集，会被添加到执行完 `execve()` 后的线程的 `Permitted` 集合中。

#### Effective

这不是一个集合，仅仅是一个标志位。如果设置开启，那么在执行完 `execve()` 后，线程 `Permitted` 集合中的 capabilities 会自动添加到它的 `Effective` 集合中。对于一些旧的可执行文件，由于其不会调用 capabilities 相关函数设置自身的 `Effective` 集合，所以可以将可执行文件的 Effective bit 开启，从而可以将 `Permitted` 集合中的 capabilities 自动添加到 `Effective` 集合中。

详情请参考 [Linux capabilities 的 man page](http://man7.org/linux/man-pages/man7/capabilities.7.html)。

## 运行 execve() 后 capabilities 的变化

----

上面介绍了线程和文件的 capabilities，你们可能会觉得有些抽象难懂。下面通过具体的计算公式，来说明执行 `execve()` 后 capabilities 是如何被确定的。

我们用 `P` 代表执行 `execve()` 前线程的 capabilities，`P'` 代表执行 `execve()` 后线程的 capabilities，`F` 代表可执行文件的 capabilities。那么：

> P'(ambient)     = (file is privileged) ? 0 : P(ambient)
> 
> P'(permitted)   = (P(inheritable) & F(inheritable)) |  
>                       (F(permitted) & P(bounding))) | P'(ambient)
> 
> P'(effective)   = F(effective) ? P'(permitted) : P'(ambient)
> 
> P'(inheritable) = P(inheritable)    [i.e., unchanged]
> 
> P'(bounding)    = P(bounding)       [i.e., unchanged]

我们一条一条来解释：

+ 如果用户是 root 用户，那么执行 `execve()` 后线程的 `Ambient` 集合是空集；如果是普通用户，那么执行 `execve()` 后线程的 `Ambient` 集合将会继承执行 `execve()` 前线程的 `Ambient` 集合。
+ 执行 `execve()` 前线程的 `Inheritable` 集合与可执行文件的 `Inheritable` 集合取交集，会被添加到执行 `execve()` 后线程的 `Permitted` 集合；可执行文件的 capability bounding 集合与可执行文件的 `Permitted` 集合取交集，也会被添加到执行 `execve()` 后线程的 `Permitted` 集合；同时执行 `execve()` 后线程的 `Ambient` 集合中的 capabilities 会被自动添加到该线程的 `Permitted` 集合中。
+ 如果可执行文件开启了 Effective 标志位，那么在执行完 `execve()` 后，线程 `Permitted` 集合中的 capabilities 会自动添加到它的 `Effective` 集合中。
+ 执行 `execve()` 前线程的 `Inheritable` 集合会继承给执行 `execve()` 后线程的 `Inheritable` 集合。

这里有几点需要着重强调：

1. 上面的公式是针对系统调用 `execve()` 的，如果是 `fork()`，那么子线程的 capabilities 信息完全复制父进程的 capabilities 信息。

2. 可执行文件的 `Inheritable` 集合与线程的 `Inheritable` 集合并没有什么关系，可执行文件 `Inheritable` 集合中的 capabilities 不会被添加到执行 `execve()` 后线程的 `Inheritable` 集合中。如果想让新线程的 `Inheritable` 集合包含某个 capability，只能通过 `capset()` 将该 capability 添加到当前线程的 `Inheritable` 集合中（因为 P'(inheritable) = P(inheritable)）。

3. 如果想让当前线程 `Inheritable` 集合中的 capabilities 传递给新的可执行文件，该文件的 `Inheritable` 集合中也必须包含这些 capabilities（因为 P'(permitted)   = (P(inheritable) & F(inheritable))|...）。

4. 将当前线程的 capabilities 传递给新的可执行文件时，仅仅只是传递给新线程的 `Permitted` 集合。如果想让其生效，新线程必须通过 `capset()` 将 capabilities 添加到 `Effective` 集合中。或者开启新的可执行文件的 Effective 标志位（因为 P'(effective)   = F(effective) ? P'(permitted) : P'(ambient)）。

5. 在没有 `Ambient` 集合之前，如果某个脚本不能调用 `capset()`，但想让脚本中的线程都能获得该脚本的 `Permitted` 集合中的 capabilities，只能将 `Permitted` 集合中的 capabilities 添加到 `Inheritable` 集合中（P'(permitted)  = P(inheritable) & F(inheritable)|...），同时开启 Effective 标志位（P'(effective)   = F(effective) ? P'(permitted) : P'(ambient)）。有 有 `Ambient` 集合之后，事情就变得简单多了，后续的文章会详细解释。

6. 如果某个 UID 非零（普通用户）的线程执行了 `execve()`，那么 `Permitted` 和 `Effective` 集合中的 capabilities 都会被清空。

7. 从 root 用户切换到普通用户，那么 `Permitted` 和 `Effective` 集合中的 capabilities 都会被清空，除非设置了 SECBIT_KEEP_CAPS 或者更宽泛的 SECBIT_NO_SETUID_FIXUP。

关于上述计算公式的逻辑流程图如下所示（不包括 `Ambient` 集合）：

![](https://images.icloudnative.io/uPic/20200723163240.png)

## 简单示例

----

下面我们用一个例子来演示上述公式的计算逻辑，以 `ping` 文件为例。如果我们将 `CAP_NET_RAW`  capability添加到 ping 文件的 `Permitted` 集合中（F(Permitted)），它就会添加到执行后的线程的 `Permitted` 集合中（P'(Permitted)）。由于 ping 文件具有 **capabilities 感知能力**，即能够调用 `capset()` 和 `capget()` ，它在运行时会调用 `capset()` 将 `CAP_NET_RAW` capability 添加到线程的 `Effective` 集合中。

换句话说，如果可执行文件不具有 **capabilities 感知能力**，我们就必须要开启 Effective 标志位（F(Effective)），这样就会将该 capability 自动添加到线程的 `Effective` 集合中。具有**capabilities 感知能力**的可执行文件更安全，因为它会限制线程使用该 capability 的时间。

我们也可以将 capabilities 添加到文件的 `Inheritable` 集合中，文件的 `Inheritable` 集合会与当前线程的 `Inheritable` 集合取交集，然后添加到新线程的 `Permitted` 集合中。这样就可以控制可执行文件的运行环境。

看起来很有道理，但有一个问题：如果可执行文件的有效用户是普通用户，且没有 `Inheritable` 集合，即 `F(inheritable) = 0`，那么 `P(inheritable)` 将会被忽略（P(inheritable) & F(inheritable)）。由于绝大多数可执行文件都是这种情况，因此 `Inheritable` 集合的可用性受到了限制。我们无法让脚本中的线程自动继承该脚本文件中的 capabilities，除非让脚本具有 **capabilities 感知能力**。

要想改变这种状况，可以使用 `Ambient` 集合。`Ambient` 集合会自动从父线程中继承，同时会自动添加到当前线程的 `Permitted` 集合中。举个例子，在一个 Bash 环境中（例如某个正在执行的脚本），该环境所在的线程的 `Ambient` 集合中包含 `CAP_NET_RAW` capability，那么在该环境中执行 ping 文件可以正常工作，即使该文件是普通文件（没有任何 capabilities，也没有设置 SUID）。

## 终极案例

----

最后拿 docker 举例，如果你使用普通用户来启动官方的 nginx 容器，会出现以下错误：

```bash
bind() to 0.0.0.0:80 failed (13: Permission denied)
```

因为 nginx 进程的 `Effective` 集合中不包含 `CAP_NET_BIND_SERVICE` capability，且不具有 **capabilities 感知能力**（普通用户），所以启动失败。要想启动成功，至少需要将该 capability 添加到 nginx 文件的 `Inheritable` 集合中，同时开启 Effective 标志位，并且在 Kubernetes Pod 的部署清单中的 securityContext --> capabilities 字段下面添加 `NET_BIND_SERVICE`（这个 capability 会被添加到 nginx 进程的 `Bounding` 集合中），最后还要将 capability 添加到 nginx 文件的 `Permitted` 集合中。如此一来就大功告成了，参考公式：P'(permitted) = ...|(F(permitted) & P(bounding)))|...，P'(effective)   = F(effective) ? P'(permitted) : P'(ambient)。

如果容器开启了 `securityContext/allowPrivilegeEscalation`，上述设置仍然可以生效。如果 nginx 文件具有 **capabilities 感知能力**，那么只需要将 `CAP_NET_BIND_SERVICE` capability 添加到它的 `Inheritable` 集合中就可以正常工作了。

当然了，除了上述使用文件扩展属性的方法外，还可以使用 `Ambient` 集合来让非 root 容器进程正常工作，但 Kubernetes 目前还不支持这个属性，具体参考 [Kubernetes 项目的 issue](https://github.com/kubernetes/kubernetes/issues/56374)。

虽然 Kubernetes 官方不支持，但我们可以自己来实现，具体实现方式可以关注我后续的文章。

## 参考资料

----

+ [Linux Capabilities: Why They Exist and How They Work](https://blog.container-solutions.com/linux-capabilities-why-they-exist-and-how-they-work)
+ [Understanding Capabilities in Linux](https://blog.ploetzli.ch/2014/understanding-linux-capabilities/)
+ [Linux Capabilities in a nutshell](https://k3a.me/linux-capabilities-in-a-nutshell/)
+ [Linux的capabilities机制](http://rk700.github.io/2016/10/26/linux-capabilities/)
