---
keywords:
- Device Mapper
- devicemapper
- docker
- 容器
- 云原生
- Thin Provisioning
title: "Device Mapper系列基础教程：Thin Provisioning 实践"
subtitle: "Thin Provisioning Snapshot 演练"
date: 2018-01-22T16:00:22+08:00
draft: false
author: 米开朗基杨
toc: true
categories:
- cloud-native
tags:
- Docker
- Device Mapper
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191205105752.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

## Thin Provisioning Snapshot 演示
------

上一篇我们介绍了 `Device Mapper` 框架的技术原理及其核心概念，下面，我们用一系列的命令来演示一下 Device Mapper 的 `Thin Provisioning Snapshot` 是怎么玩的。

首先，我们需要先建两个文件，一个是data.img，一个是meta.data.img：

```bash
$ dd if=/dev/zero of=/tmp/data.img bs=1K count=1 seek=10M

1+0 records in
1+0 records out
1024 bytes (1.0 kB) copied, 0.000621428 s, 1.6 MB/s

$ dd if=/dev/zero of=/tmp/meta.data.img bs=1K count=1 seek=1G

1+0 records in
1+0 records out
1024 bytes (1.0 kB) copied, 0.000140858 s, 7.3 MB/s
```

注意命令中 `seek` 选项，其表示为略过 `of` 选项指定的输出文件的前 10G 个 output 的 `bloksize` 的空间后再写入内容。

因为 bs 是 1 个字节，所以也就是 10G 的尺寸，但其实在硬盘上是没有占有空间的，占有空间只有 1k 的内容。当向其写入内容时，才会在硬盘上为其分配空间。

我们可以用 `ls` 命令看一下，实际分配了 12K 和 4K。

```bash
$ ls -lsh /tmp/data.img

12K -rw-r--r--. 1 root root 11G Aug 25 23:01 /tmp/data.img

$ ls -slh /tmp/meta.data.img

4.0K -rw-r--r--. 1 root root 101M Aug 25 23:17 /tmp/meta.data.img
```

然后，我们为这个文件创建一个 `loopback` 设备。（loop2015 和 loop2016 是我乱取的两个名字）

```bash
$ losetup /dev/loop2015 /tmp/data.img
$ losetup /dev/loop2016 /tmp/meta.data.img

$ losetup -a

/dev/loop2015: [64768]:103991768 (/tmp/data.img)
/dev/loop2016: [64768]:103991765 (/tmp/meta.data.img)
```

现在，我们为这个设备建一个 `Thin Provisioning` 的 Pool，用 `dmsetup` 命令：

```bash
$ dmsetup create hchen-thin-pool \
  --table "0 20971522 thin-pool /dev/loop2016 /dev/loop2015 \
  128 65536 1 skip_block_zeroing"
```

其中的参数解释如下（更多信息可参看 `Thin Provisioning` 的 man page）:

+ `dmsetup create` 是用来创建 thin pool 的命令
+ `hchen-thin-pool` 是自定义的一个 pool 名，不冲突就好。
+ `–-table` 是这个 pool 的参数设置
  + `0` 代表起的 sector 位置
  + `20971522` 代表结尾的 sector 号，前面说过，一个 sector 是 512 字节，所以，20971522 个正好是 10GB
  + `/dev/loop2016` 是 meta 文件的设备（前面我们建好了）
  + `/dev/loop2015` 是 data 文件的设备
  + `128` 是最小的可分配的 sector 数
  + `65536` 是最少可用 sector 的 water mark，也就是一个 threshold
  + `1` 代表有一个附加参数
  + `skip_block_zeroing` 是个附加参数，表示略过用 0 填充的块

然后，我们就可以看到一个 `Device Mapper` 的设备了：

```bash
$ ll /dev/mapper/hchen-thin-pool

lrwxrwxrwx. 1 root root 7 Aug 25 23:24 /dev/mapper/hchen-thin-pool -> ../dm-4
```

接下来，我们的初始还没有完成，还要创建一个 `Thin Provisioning` 的 Volume：

```bash
$ dmsetup message /dev/mapper/hchen-thin-pool 0 "create_thin 0"

$ dmsetup create hchen-thin-volumn-001 \
  --table "0 2097152 thin /dev/mapper/hchen-thin-pool 0"
```

其中：

+ 第一个命令中的 `create_thin` 是关键字，后面的 0 表示这个 Volume 的 device 的  id。
+ 第二个命令，是真正的为这个 Volumn 创建一个可以 mount 的设备，名字叫 `hchen-thin-volumn-001`。`2097152` 只有 1GB。

好了，在 mount 前，我们还要格式化一下：

```bash
$ mkfs.ext4 /dev/mapper/hchen-thin-volumn-001

mke2fs 1.42.9 (28-Dec-2013)
Discarding device blocks: done
Filesystem label=
OS type: Linux
Block size=4096 (log=2)
Fragment size=4096 (log=2)
Stride=16 blocks, Stripe width=16 blocks
65536 inodes, 262144 blocks
13107 blocks (5.00%) reserved for the super user
First data block=0
Maximum filesystem blocks=268435456
8 block groups
32768 blocks per group, 32768 fragments per group
8192 inodes per group
Superblock backups stored on blocks:
32768, 98304, 163840, 229376
 
Allocating group tables: done
Writing inode tables: done
Creating journal (8192 blocks): done
Writing superblocks and filesystem accounting information: done
```

好了，我们可以 mount 了（下面的命令中，我还创建了一个文件）

```zsh
$ mkdir -p /mnt/base

$ mount /dev/mapper/hchen-thin-volumn-001 /mnt/base

$ echo "hello world, I am a base" > /mnt/base/id.txt

$ cat /mnt/base/id.txt

hello world, I am a base
```

接下来，我们来看看 snapshot 怎么搞：

```bash
$ dmsetup message /dev/mapper/hchen-thin-pool 0 "create_snap 1 0"

$ dmsetup create mysnap1 \
  --table "0 2097152 thin /dev/mapper/hchen-thin-pool 1"
  
$ ll /dev/mapper/mysnap1

lrwxrwxrwx. 1 root root 7 Aug 25 23:49 /dev/mapper/mysnap1 -> ../dm-5
```

上面的命令中：

+ 第一条命令是向 `hchen-thin-pool` 发一个 `create_snap` 的消息，后面跟两个 `id`，第一个是新的 dev id，第二个是要从哪个已有的 dev id 上做 `snapshot`（0 这个 dev id 是我们前面就创建了了）
+ 第二条命令是创建一个 `mysnap1` 的 device，并可以被 mount。

下面我们来看看：

```bash
$ mkdir -p /mnt/mysnap1

$ mount /dev/mapper/mysnap1 /mnt/mysnap1

$ ll /mnt/mysnap1/

total 20
-rw-r--r--. 1 root root 25 Aug 25 23:46 id.txt
drwx------. 2 root root 16384 Aug 25 23:43 lost+found

$ cat /mnt/mysnap1/id.txt

hello world, I am a base
```

我们来修改一下 `/mnt/mysnap1/id.txt`，并加上一个 `snap1.txt` 的文件：

```bash
$ echo "I am snap1" >> /mnt/mysnap1/id.txt

$ echo "I am snap1" > /mnt/mysnap1/snap1.txt

$ cat /mnt/mysnap1/id.txt

hello world, I am a base
I am snap1

$ cat /mnt/mysnap1/snap1.txt

I am snap1
```

我们再看一下 `/mnt/base`，你会发现没有什么变化：

```bash
$ ls /mnt/base

id.txt      lost+found

$ cat /mnt/base/id.txt

hello world, I am a base
```

好了，我相信你看到了分层镜像的样子了。

## Docker 的 devicemapper
------

上面基本上就是 Docker 的玩法了，我们可以看一下 docker 的 loopback 设备：

```bash
$ losetup -a

/dev/loop0: [64768]:38050288 (/var/lib/docker/devicemapper/devicemapper/data)
/dev/loop1: [64768]:38050289 (/var/lib/docker/devicemapper/devicemapper/metadata)
```

其中 data `100GB`，metadata `2.0GB`

```bash
$ ls -alsh /var/lib/docker/devicemapper/devicemapper

506M -rw-------. 1 root root 100G Sep 10 20:15 data
1.1M -rw-------. 1 root root 2.0G Sep 10 20:15 metadata
```

下面是相关的 `thin-pool`。其中，有个当一大串 hash 串的 device 是正在启动的容器：

```bash
$ ll /dev/mapper/dock*

lrwxrwxrwx. 1 root root 7 Aug 25 07:57 /dev/mapper/docker-253:0-104108535-pool -> ../dm-2
lrwxrwxrwx. 1 root root 7 Aug 25 11:13 /dev/mapper/docker-253:0-104108535-deefcd630a60aa5ad3e69249f58a68e717324be4258296653406ff062f605edf -> ../dm-3
```

我们可以看一下它的 `device id`（Docker 都把它们记下来了）：

```bash
$ cat /var/lib/docker/devicemapper/metadata/deefcd630a60aa5ad3e69249f58a68e717324be4258296653406ff062f605edf
```

`device_id` 是 24，size 是 `10737418240`，除以 512，就是 `20971520` 个 `sector`。

我们用这些信息来做个 `snapshot` 看看（注：我用了一个比较大的 dev id – 1024）：

```bash
$ dmsetup message "/dev/mapper/docker-253:0-104108535-pool" 0 \
  "create_snap 1024 24"
  
$ dmsetup create dockersnap --table \
  "0 20971520 thin /dev/mapper/docker-253:0-104108535-pool 1024"
  
$ mkdir /mnt/docker

$ mount /dev/mapper/dockersnap /mnt/docker/

$ ls /mnt/docker/

id lost+found rootfs

$ ls /mnt/docker/rootfs/

bin dev etc home lib lib64 lost+found media mnt opt proc root run sbin srv sys tmp usr var
```

我们在 docker 的容器里用 `findmnt` 命令也可以看到相关的 mount 的情况（因为太长，下面只是摘要）：

```bash
$ findmnt

TARGET                SOURCE               
/                 /dev/mapper/docker-253:0-104108535-deefcd630a60[/rootfs]
/etc/resolv.conf  /dev/mapper/centos-root[/var/lib/docker/containers/deefcd630a60/resolv.conf]
/etc/hostname     /dev/mapper/centos-root[/var/lib/docker/containers/deefcd630a60/hostname]
/etc/hosts        /dev/mapper/centos-root[/var/lib/docker/containers/deefcd630a60/hosts]
```
