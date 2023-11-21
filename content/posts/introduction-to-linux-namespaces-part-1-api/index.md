---
keywords:
- 米开朗基杨
- namespace
- linux namespace
- unshare
- uts namespace
- setns
title: "Linux Namespace 基础教程：namespace API"
subtitle: "了解不同 namespace API 的原理和用法"
description: 本文仔细研究了 namespace API 的每个组成部分，并将它们结合起来一起使用。
date: 2020-01-17T21:35:19+08:00
draft: false
author: 米开朗基杨
toc: true
categories: "linux"
tags: ["linux", "namespace"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/2020-04-24-20200117181939.webp"
---

`Linux Namespace` 是 Linux 提供的一种内核级别环境隔离的方法。用官方的话来说，Linux Namespace 将全局系统资源封装在一个抽象中，从而使 namespace 内的进程认为自己具有独立的资源实例。这项技术本来没有掀起多大的波澜，是容器技术的崛起让他重新引起了大家的注意。

Linux Namespace 有如下 6 个种类：

| **分类**           | **系统调用参数** | **相关内核版本**                                             |
| ------------------ | ---------------- | ------------------------------------------------------------ |
| Mount namespaces   | CLONE_NEWNS      | [Linux 2.4.19](http://lwn.net/2001/0301/a/namespaces.php3)   |
| UTS namespaces     | CLONE_NEWUTS     | [Linux 2.6.19](http://lwn.net/Articles/179345/)              |
| IPC namespaces     | CLONE_NEWIPC     | [Linux 2.6.19](http://lwn.net/Articles/187274/)              |
| PID namespaces     | CLONE_NEWPID     | [Linux 2.6.24](http://lwn.net/Articles/259217/)              |
| Network namespaces | CLONE_NEWNET     | [始于Linux 2.6.24 完成于 Linux 2.6.29](http://lwn.net/Articles/219794/) |
| User namespaces    | CLONE_NEWUSER    | [始于 Linux 2.6.23 完成于 Linux 3.8](http://lwn.net/Articles/528078/) |

namespace 的 API 由三个系统调用和一系列 `/proc` 文件组成，本文将会详细介绍这些系统调用和 `/proc` 文件。为了指定要操作的 namespace 类型，需要在系统调用的 flag 中通过常量 `CLONE_NEW*` 指定（包括 `CLONE_NEWIPC`，`CLONE_NEWNS`， `CLONE_NEWNET`，`CLONE_NEWPID`，`CLONE_NEWUSER` 和 `CLONE_NEWUTS`），可以指定多个常量，通过 **|**（位或）操作来实现。

简单描述一下三个系统调用的功能：

+ **clone()** : 实现线程的系统调用，用来创建一个新的进程，并可以通过设计上述系统调用参数达到隔离的目的。
+ **unshare()** : 使某进程脱离某个 namespace。
+ **setns()** : 把某进程加入到某个 namespace。

具体的实现原理请往下看。

## 1. clone()

----

`clone()` 的原型如下：

```c
int clone(int (*child_func)(void *), void *child_stack, int flags, void *arg);
```

+ **child_func** : 传入子进程运行的程序主函数。
+ **child_stack** : 传入子进程使用的栈空间。
+ **flags** : 表示使用哪些 `CLONE_*` 标志位。
+ **args** : 用于传入用户参数。

`clone()` 与 `fork()` 类似，都相当于把当前进程复制了一份，但 `clone()` 可以更细粒度地控制与子进程共享的资源（其实就是通过 flags 来控制），包括虚拟内存、打开的文件描述符和信号量等等。一旦指定了标志位 `CLONE_NEW*`，相对应类型的 namespace 就会被创建，新创建的进程也会成为该 namespace 中的一员。

clone() 的原型并不是最底层的系统调用，而是封装过的，真正的系统调用内核实现函数为 `do_fork()`，形式如下：

```c
long do_fork(unsigned long clone_flags,
	      unsigned long stack_start,
	      unsigned long stack_size,
	      int __user *parent_tidptr,
	      int __user *child_tidptr)
```

其中 `clone_flags` 可以赋值为上面提到的标志。

下面来看一个例子：

```c
/* demo_uts_namespaces.c

   Copyright 2013, Michael Kerrisk
   Licensed under GNU General Public License v2 or later

   Demonstrate the operation of UTS namespaces.
*/
#define _GNU_SOURCE
#include <sys/wait.h>
#include <sys/utsname.h>
#include <sched.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

/* A simple error-handling function: print an error message based
   on the value in 'errno' and terminate the calling process */

#define errExit(msg)    do { perror(msg); exit(EXIT_FAILURE); \
                        } while (0)

static int              /* Start function for cloned child */
childFunc(void *arg)
{
    struct utsname uts;

    /* 在新的 UTS namespace 中修改主机名 */

    if (sethostname(arg, strlen(arg)) == -1)
        errExit("sethostname");

    /* 获取并显示主机名 */

    if (uname(&uts) == -1)
        errExit("uname");
    printf("uts.nodename in child:  %s\n", uts.nodename);

    /* Keep the namespace open for a while, by sleeping.
       This allows some experimentation--for example, another
       process might join the namespace. */
     
    sleep(100);

    return 0;           /* Terminates child */
}

/* 定义一个给 clone 用的栈，栈大小1M */
#define STACK_SIZE (1024 * 1024) 

static char child_stack[STACK_SIZE];

int
main(int argc, char *argv[])
{
    pid_t child_pid;
    struct utsname uts;

    if (argc < 2) {
        fprintf(stderr, "Usage: %s <child-hostname>\n", argv[0]);
        exit(EXIT_FAILURE);
    }

    /* 调用 clone 函数创建一个新的 UTS namespace，其中传出一个函数，还有一个栈空间（为什么传尾指针，因为栈是反着的）;
       新的进程将在用户定义的函数 childFunc() 中执行 */

    child_pid = clone(childFunc, 
                    child_stack + STACK_SIZE,   /* 因为栈是反着的， 
                                                   所以传尾指针 */ 
                    CLONE_NEWUTS | SIGCHLD, argv[1]);
    if (child_pid == -1)
        errExit("clone");
    printf("PID of child created by clone() is %ld\n", (long) child_pid);

    /* Parent falls through to here */

    sleep(1);           /* 给子进程预留一定的时间来改变主机名 */

    /* 显示当前 UTS namespace 中的主机名，和 
       子进程所在的 UTS namespace 中的主机名不同 */

    if (uname(&uts) == -1)
        errExit("uname");
    printf("uts.nodename in parent: %s\n", uts.nodename);

    if (waitpid(child_pid, NULL, 0) == -1)      /* 等待子进程结束 */
        errExit("waitpid");
    printf("child has terminated\n");

    exit(EXIT_SUCCESS);
}
```

该程序通过标志位 `CLONE_NEWUTS` 调用 `clone()` 函数创建一个 UTS namespace。UTS namespace 隔离了两个系统标识符 — **主机名**和 **NIS 域名** —它们分别通过 `sethostname()` 和 `setdomainname()` 这两个系统调用来设置，并通过系统调用 `uname()` 来获取。

下面将对程序中的一些关键部分进行解读（为了简单起见，我们将省略其中的错误检查）。

程序运行时后面需要跟上一个命令行参数，它将会创建一个在新的 UTS namespace 中执行的子进程，该子进程会在新的 UTS namespace 中将主机名改为命令行参数中提供的值。

主程序的第一个关键部分是通过系统调用 `clone()` 来创建子进程：

```c
child_pid = clone(childFunc, 
                  child_stack + STACK_SIZE,   /* Points to start of 
                                                 downwardly growing stack */ 
                  CLONE_NEWUTS | SIGCHLD, argv[1]);

printf("PID of child created by clone() is %ld\n", (long) child_pid);
```

子进程将会在用户定义的函数 `childFunc()` 中开始执行，该函数将会接收 `clone()` 最后的参数（argv[1]）作为自己的参数，并且标志位包含了 `CLONE_NEWUTS`，所以子进程会在新创建的 UTS namespace 中执行。

接下来主进程睡眠一段时间，让子进程能够有时间更改其 UTS namespace 中的主机名。然后调用 `uname()` 来检索当前 UTS namespace 中的主机名，并显示该主机名：

```c
sleep(1);           /* Give child time to change its hostname */

uname(&uts);
printf("uts.nodename in parent: %s\n", uts.nodename);
```

与此同时，由 `clone()` 创建的子进程执行的函数 `childFunc()` 首先将主机名改为命令行参数中提供的值，然后检索并显示修改后的主机名：

```c
sethostname(arg, strlen(arg);
    
uname(&uts);
printf("uts.nodename in child:  %s\n", uts.nodename);
```

子进程退出之前也睡眠了一段时间，这样可以防止新的 UTS namespace 不会被关闭，让我们能够有机会进行后续的实验。

执行程序，观察父进程和子进程是否处于不同的 UTS namespace 中：

```bash
$ su                   # 需要特权才能创建 UTS namespace
Password: 
# uname -n
antero
# ./demo_uts_namespaces bizarro
PID of child created by clone() is 27514
uts.nodename in child:  bizarro
uts.nodename in parent: antero
```

除了 User namespace 之外，创建其他的 namespace 都需要特权，更确切地说，是需要相应的 `Linux Capabilities`，即 `CAP_SYS_ADMIN`。这样就可以避免设置了 SUID（Set User ID on execution）的程序因为主机名不同而做出一些愚蠢的行为。如果对 Linux Capabilities 不是很熟悉，可以参考我之前的文章：[Linux Capabilities 入门教程：概念篇](https://icloudnative.io/posts/linux-capabilities-why-they-exist-and-how-they-work/)。

## 2. proc 文件

----

每个进程都有一个 `/proc/PID/ns` 目录，其下面的文件依次表示每个 namespace, 例如 user 就表示 user namespace。从 3.8 版本的内核开始，该目录下的每个文件都是一个特殊的符号链接，链接指向 `$namespace:[$namespace-inode-number]`，前半部份为 namespace 的名称，后半部份的数字表示这个 namespace 的句柄号。句柄号用来对进程所关联的 namespace 执行某些操作。

```bash
$ ls -l /proc/$$/ns         # $$ 表示当前所在的 shell 的 PID
total 0
lrwxrwxrwx. 1 mtk mtk 0 Jan  8 04:12 ipc -> ipc:[4026531839]
lrwxrwxrwx. 1 mtk mtk 0 Jan  8 04:12 mnt -> mnt:[4026531840]
lrwxrwxrwx. 1 mtk mtk 0 Jan  8 04:12 net -> net:[4026531956]
lrwxrwxrwx. 1 mtk mtk 0 Jan  8 04:12 pid -> pid:[4026531836]
lrwxrwxrwx. 1 mtk mtk 0 Jan  8 04:12 user -> user:[4026531837]
lrwxrwxrwx. 1 mtk mtk 0 Jan  8 04:12 uts -> uts:[4026531838]
```

这些符号链接的用途之一是用来**确认两个不同的进程是否处于同一 namespace 中**。如果两个进程指向的 namespace inode number 相同，就说明他们在同一个 namespace 下，否则就在不同的 namespace 下。这些符号链接指向的文件比较特殊，不能直接访问，事实上指向的文件存放在被称为 `nsfs` 的文件系统中，该文件系统用户不可见，可以使用系统调用 [stat()](http://man7.org/linux/man-pages/man2/stat.2.html) 在返回的结构体的 `st_ino` 字段中获取 inode number。在 shell 终端中可以用命令（实际上就是调用了 stat()）看到指向文件的 inode 信息：

```bash
$ stat -L /proc/$$/ns/net
  File: /proc/3232/ns/net
  Size: 0         	Blocks: 0          IO Block: 4096   regular empty file
Device: 4h/4d	Inode: 4026531956  Links: 1
Access: (0444/-r--r--r--)  Uid: (    0/    root)   Gid: (    0/    root)
Access: 2020-01-17 15:45:23.783304900 +0800
Modify: 2020-01-17 15:45:23.783304900 +0800
Change: 2020-01-17 15:45:23.783304900 +0800
 Birth: -
```

除了上述用途之外，这些符号链接还有其他的用途，**如果我们打开了其中一个文件，那么只要与该文件相关联的文件描述符处于打开状态，即使该 namespace 中的所有进程都终止了，该 namespace 依然不会被删除**。通过 bind mount 将符号链接挂载到系统的其他位置，也可以获得相同的效果：

```bash
$ touch ~/uts
$ mount --bind /proc/27514/ns/uts ~/uts
```

## 3. setns()

----

加入一个已经存在的 namespace 可以通过系统调用 `setns()` 来完成。它的原型如下：

```c
int setns(int fd, int nstype);
```

更确切的说法是：`setns()` 将调用的进程与特定类型 namespace 的一个实例分离，并将该进程与该类型 namespace 的另一个实例重新关联。

+ `fd` 表示要加入的 namespace 的文件描述符，可以通过打开其中一个符号链接来获取，也可以通过打开 bind mount  到其中一个链接的文件来获取。
+ `nstype` 让调用者可以去检查 fd 指向的 namespace 类型，值可以设置为前文提到的常量 `CLONE_NEW*`，填 `0` 表示不检查。如果调用者已经明确知道自己要加入了 namespace 类型，或者不关心 namespace 类型，就可以使用该参数来自动校验。

结合 `setns()` 和 `execve()` 可以实现一个简单但非常有用的功能：将某个进程加入某个特定的 namespace，然后在该 namespace 中执行命令。直接来看例子：

```c
/* ns_exec.c 

   Copyright 2013, Michael Kerrisk
   Licensed under GNU General Public License v2 or later

   Join a namespace and execute a command in the namespace
*/
#define _GNU_SOURCE
#include <fcntl.h>
#include <sched.h>
#include <unistd.h>
#include <stdlib.h>
#include <stdio.h>

/* A simple error-handling function: print an error message based
   on the value in 'errno' and terminate the calling process */

#define errExit(msg)    do { perror(msg); exit(EXIT_FAILURE); \
                        } while (0)

int
main(int argc, char *argv[])
{
    int fd;

    if (argc < 3) {
        fprintf(stderr, "%s /proc/PID/ns/FILE cmd [arg...]\n", argv[0]);
        exit(EXIT_FAILURE);
    }

    fd = open(argv[1], O_RDONLY);   /* 获取想要加入的 namespace 的文件描述符 */
    if (fd == -1)
        errExit("open");

    if (setns(fd, 0) == -1)         /* 加入该 namespace */
        errExit("setns");

    execvp(argv[2], &argv[2]);      /* 在加入的 namespace 中执行相应的命令 */
    errExit("execvp");
}
```

该程序运行需要两个或两个以上的命令行参数，第一个参数表示特定的 namespace 符号链接的路径（或者 bind mount 到这些符号链接的文件路径）；第二个参数表示要在该符号链接相对应的 namespace 中执行的程序名称，以及执行这个程序所需的命令行参数。关键步骤如下：

```c
fd = open(argv[1], O_RDONLY);   /* 获取想要加入的 namespace 的文件描述符 */

setns(fd, 0);                   /* 加入该 namespace */

execvp(argv[2], &argv[2]);      /* 在加入的 namespace 中执行相应的命令 */
```

还记得我们之前已经通过 bind mount 将 `demo_uts_namespaces` 创建的 UTS namespace 挂载到 `~/uts` 中了吗？可以将本例中的程序与之结合，让新进程可以在该 UTS namespace 中执行 shell：

```bash
    $ ./ns_exec ~/uts /bin/bash     # ~/uts 被 bind mount 到了 /proc/27514/ns/uts
    My PID is: 28788
```

验证新的 shell 是否与 `demo_uts_namespaces` 创建的子进程处于同一个 UTS namespace：

```bash
$ hostname
bizarro
$ readlink /proc/27514/ns/uts
uts:[4026532338]
$ readlink /proc/$$/ns/uts      # $$ 表示当前 shell 的 PID
uts:[4026532338]
```

在早期的内核版本中，不能使用 `setns()` 来加入 mount namespace、PID namespace 和 user namespace，从 3.8 版本的内核开始，`setns()` 支持加入所有的 namespace。

util-linux 包里提供了`nsenter` 命令，其提供了一种方式将新创建的进程运行在指定的 namespace 里面，它的实现很简单，就是通过命令行（-t 参数）指定要进入的 namespace 的符号链接，然后利用 `setns()` 将当前的进程放到指定的 namespace 里面，再调用 `clone()` 运行指定的执行文件。我们可以用 `strace` 来看看它的运行情况：

```bash
# strace nsenter -t 27242 -i -m -n -p -u /bin/bash
execve("/usr/bin/nsenter", ["nsenter", "-t", "27242", "-i", "-m", "-n", "-p", "-u", "/bin/bash"], [/* 21 vars */]) = 0
…………
…………
pen("/proc/27242/ns/ipc", O_RDONLY)    = 3
open("/proc/27242/ns/uts", O_RDONLY)    = 4
open("/proc/27242/ns/net", O_RDONLY)    = 5
open("/proc/27242/ns/pid", O_RDONLY)    = 6
open("/proc/27242/ns/mnt", O_RDONLY)    = 7
setns(3, CLONE_NEWIPC)                  = 0
close(3)                                = 0
setns(4, CLONE_NEWUTS)                  = 0
close(4)                                = 0
setns(5, CLONE_NEWNET)                  = 0
close(5)                                = 0
setns(6, CLONE_NEWPID)                  = 0
close(6)                                = 0
setns(7, CLONE_NEWNS)                   = 0
close(7)                                = 0
clone(child_stack=0, flags=CLONE_CHILD_CLEARTID|CLONE_CHILD_SETTID|SIGCHLD, child_tidptr=0x7f4deb1faad0) = 4968
```

## 4. unshare()

----

最后一个要介绍的系统调用是 `unshare()`，它的原型如下：

```c
int unshare(int flags);
```

`unshare()` 与 `clone()` 类似，但它运行在原先的进程上，不需要创建一个新进程，即：先通过指定的 flags 参数 `CLONE_NEW*` 创建一个新的 namespace，然后将调用者加入该 namespace。最后实现的效果其实就是将调用者从当前的 namespace 分离，然后加入一个新的 namespace。

Linux 中自带的 `unshare` 命令，就是通过 unshare() 系统调用实现的，使用方法如下：

```bash
$ unshare [options] program [arguments]
```

`options` 指定要创建的 namespace 类型。

unshare 命令的主要实现如下：

```c
/* 通过提供的命令行参数初始化 'flags' */

unshare(flags);

/* Now execute 'program' with 'arguments'; 'optind' is the index
   of the next command-line argument after options */

execvp(argv[optind], &argv[optind]);
```

 unshare 命令的完整实现如下：

```c
/* unshare.c 

   Copyright 2013, Michael Kerrisk
   Licensed under GNU General Public License v2 or later

   A simple implementation of the unshare(1) command: unshare
   namespaces and execute a command.
*/

#define _GNU_SOURCE
#include <sched.h>
#include <unistd.h>
#include <stdlib.h>
#include <stdio.h>

/* A simple error-handling function: print an error message based
   on the value in 'errno' and terminate the calling process */

#define errExit(msg)    do { perror(msg); exit(EXIT_FAILURE); \
                        } while (0)

static void
usage(char *pname)
{
    fprintf(stderr, "Usage: %s [options] program [arg...]\n", pname);
    fprintf(stderr, "Options can be:\n");
    fprintf(stderr, "    -i   unshare IPC namespace\n");
    fprintf(stderr, "    -m   unshare mount namespace\n");
    fprintf(stderr, "    -n   unshare network namespace\n");
    fprintf(stderr, "    -p   unshare PID namespace\n");
    fprintf(stderr, "    -u   unshare UTS namespace\n");
    fprintf(stderr, "    -U   unshare user namespace\n");
    exit(EXIT_FAILURE);
}

int
main(int argc, char *argv[])
{
    int flags, opt;

    flags = 0;

    while ((opt = getopt(argc, argv, "imnpuU")) != -1) {
        switch (opt) {
        case 'i': flags |= CLONE_NEWIPC;        break;
        case 'm': flags |= CLONE_NEWNS;         break;
        case 'n': flags |= CLONE_NEWNET;        break;
        case 'p': flags |= CLONE_NEWPID;        break;
        case 'u': flags |= CLONE_NEWUTS;        break;
        case 'U': flags |= CLONE_NEWUSER;       break;
        default:  usage(argv[0]);
        }
    }

    if (optind >= argc)
        usage(argv[0]);

    if (unshare(flags) == -1)
        errExit("unshare");

    execvp(argv[optind], &argv[optind]);  
    errExit("execvp");
}
```

下面我们执行 `unshare.c` 程序在一个新的 mount namespace 中执行 shell：

```bash
$ echo $$                             # 显示当前 shell 的 PID
8490
$ cat /proc/8490/mounts | grep mq     # 显示当前 namespace 中的某个挂载点
mqueue /dev/mqueue mqueue rw,seclabel,relatime 0 0
$ readlink /proc/8490/ns/mnt          # 显示当前 namespace 的 ID 
mnt:[4026531840]
$ ./unshare -m /bin/bash              # 在新创建的 mount namespace 中执行新的 shell
$ readlink /proc/$$/ns/mnt            # 显示新 namespace 的 ID 
mnt:[4026532325]
```

对比两个 `readlink` 命令的输出，可以知道两个shell 处于不同的 mount namespace 中。改变新的 namespace 中的某个挂载点，然后观察两个 namespace 的挂载点是否有变化：

```bash
$ umount /dev/mqueue                  # 移除新 namespace 中的挂载点
$ cat /proc/$$/mounts | grep mq       # 检查是否生效
$ cat /proc/8490/mounts | grep mq     # 查看原来的 namespace 中的挂载点是否依然存在?
mqueue /dev/mqueue mqueue rw,seclabel,relatime 0 0
```

可以看出，新的 namespace 中的挂载点 `/dev/mqueue` 已经消失了，但在原来的 namespace 中依然存在。

## 5. 总结

----

本文仔细研究了 namespace API 的每个组成部分，并将它们结合起来一起使用。后续的文章将会继续深入研究每个单独的 namespace，尤其是 PID namespace 和 user namespace。

## 参考链接

- [Namespaces in operation, part 2: the namespaces API](https://lwn.net/Articles/531381/)
- [Docker 基础技术：Linux Namespace（上）](https://coolshell.cn/articles/17010.html)
