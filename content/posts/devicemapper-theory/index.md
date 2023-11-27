---
keywords:
- Device Mapper
- devicemapper
- docker
- 容器
- 云原生
title: "Device Mapper系列基础教程：Device Mapper 的原理"
subtitle: "Device Mapper 原理剖析"
date: 2018-01-21T09:28:41Z
draft: false
author: 米开朗基杨
toc: true
categories:
- cloud-native
tags:
- Docker
- Device Mapper
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191205115406.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

## Device Mapper 简介
------

{{< alert >}}
<code>Device Mapper</code> 是 linux 的内核用来将块设备映射到虚拟块设备的 framework，它支持许多高级卷管理技术。docker 的 devicemapper 存储驱动程序利用此框架的<code>自动精简配置</code>(thin provisioning) 和快照功能来管理 docker 镜像和容器。本文将 Device Mapper 存储驱动称为 <code>devicemapper</code>，将它的内核框架称为 <code>Device Mapper</code>。
{{< /alert >}}

`Device Mapper` 不同于 AUFS、ext4、NFS 等，因为它并不是一个文件系统（File System），而是 Linux 内核映射块设备的一种技术框架。提供的一种从逻辑设备（虚拟设备）到物理设备的映射框架机制，在该机制下，用户可以很方便的根据自己的需要制定实现存储资源的管理策略。

当前比较流行的 Linux 下的逻辑卷管理器如 `LVM2`（Linux Volume Manager 2 version)、`EVMS`(Enterprise Volume Management System)、`dmraid`(Device Mapper Raid Tool)等都是基于该机制实现的。

值得一提的是 `Device Mapper` 工作在块级别（block），并不工作在文件级别（file）。`Device Mapper` 自 Linux 2.6.9 后编入 Linux 内核，所有基于 Linux 内核 2.6.9 以后的发行版都内置 `Device Mapper`，但你需要进行一些额外的配置才能在 `docker` 中使用它。比如在 `RHEL` 和 `CentOS` 系统中，`docker` 默认使用的存储驱动是 `overlay`。

`devicemapper` 存储驱动使用专用于 `docker` 的块设备，它运行在块级别上而不是文件级别。使用块设备比直接使用文件系统性能更好，通过向 `Docker` 的宿主机添加物理存储可以扩展块设备的存储空间。

## 用户空间和内核空间
------

**Device Mapper主要分为用户空间部分和内核空间部分**

用户空间相关部分主要负责配置具体的策略和控制逻辑，比如逻辑设备和哪些物理设备建立映射，怎么建立这些映射关系等，包含 `device mapper` 库和 `dmsetup` 工具。对用户空间创建删除 `device mapper` 设备的操作进行封装。

内核中主要提供完成这些用户空间策略所需要的机制，负责具体过滤和重定向 IO 请求。通过不同的驱动插件，转发 IO 请求至目的设备上。附上 `Device Mapper` 架构图。

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/wazQIK.jpg)

## Device Mapper 技术分析
------

**`Device Mapper`** 作为 Linux 块设备映射技术框架，向外部提供逻辑设备。包含三个重要概念，映射设备（mapped device），映射表（map table），目标设备（target device）。

+ 映射设备即对外提供的逻辑设备，映射设备向下寻找必须找到支撑的目标设备。
+ 映射表存储映射设备和目标设备的映射关系。
+ 目标设备可以是映射设备或者物理设备，如果目标设备是一块映射设备，则属于嵌套，理论上可以无限迭代下去。

简而言之，`Device Mapper` 对外提供一个虚拟设备供使用，而这块虚拟设备可以通过映射表找到相应的地址，该地址可以指向一块物理设备，也可以指向一个虚拟设备。

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/JRQI4L.jpg)

映射表，是由用户空间创建，传递到内核空间。映射表里有映射设备逻辑的起始地址、范围、和表示在目标设备所在物理设备的地址偏移量以及Target 类型等信息（注：这些地址和偏移量都是以磁盘的扇区为单位的，即 512 个字节大小，所以，当你看到 128 的时候，其实表示的是 128*512=64K）。

映射驱动在内核空间是插件，`Device Mapper` 在内核中通过一个一个模块化的 `Target Driver` 插件实现对 IO 请求的过滤或者重新定向等工作，当前已经实现的插件包括软 Raid、加密、多路径、镜像、快照等，这体现了在 Linux 内核设计中策略和机制分离的原则。

`Device Mapper` 中的 IO 流处理，从虚拟设备（逻辑设备）根据映射表并指定特定的映射驱动转发到目标设备上。

## Docker 中的 Device Mapper 核心技术
------

Docker 的 `devicemapper` 驱动有三个核心概念，`copy on-write（写复制）`，`thin-provisioning（精简配置）`。`snapshot（快照）`，首先简单介绍一下这三种技术。

+ **`CoW（copy on write）写复制`**：一些文件系统提供的写时复制策略。

  `aufs` 的 cow 原理如下：
  
  当容器需要修改一个文件，而该文件位于低层 `branch` 时，顶层 `branch` 会直接复制低层 `branch` 的文件至顶层再进行修改，而低层的文件不变，这种方式即是 CoW 技术（写复制）。

  当容器删除一个低层 `branch` 文件时，只是在顶层 `branch` 对该文件进行重命名并隐藏，实际并未删除文件，只是不可见。
  
  下图所示，容器层所见 file1 文件为镜像层文件，当需要修改 file1 时，会从镜像层把文件复制到容器层，然后进行修改，从而保证镜像层数据的完整性和复用性。
  
  ![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/Qhtdrp.jpg)
  
  下图所示，当需要删除 file1 时，由于 file1 是镜像层文件，容器层会创建一个 .wh 前置的隐藏文件，从而实现对 file1 的隐藏，实际并未删除 file1，从而保证镜像层数据的完整性和复用性。
  
  ![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/m4tMby.jpg)
  
  `devicemapper` 支持在块级别（block）写复制。
  
+ **`Snapshot（快照技术）`**：关于指定数据集合的一个完全可用拷贝，该拷贝包括相应数据在某个时间点（拷贝开始的时间点）的映像。快照可以是其所表示的数据的一个副本，也可以是数据的一个复制品。而从具体的技术细节来讲，快照是指向保存在存储设备中的数据的引用标记或指针。
+ **`Thin-provisioning（精简配置）`**，直译为精简配置。`Thin-provisioning` 是动态分配，需要多少分配多少，区别于传统分配固定空间从而造成的资源浪费。

  它是什么意思呢？你可以联想一下我们计算机中的内存管理中用到的——“虚拟内存技术”——操作系统给每个进程 N 多 N 多用不完的内址地址（32 位下，每个进程可以有最多 2GB 的内存空间），但是呢，我们知道，物理内存是没有那么多的，如果按照进程内存和物理内存一一映射来玩的话，那么，我们得要多少的物理内存啊。所以，操作系统引入了虚拟内存的设计，意思是，我逻辑上给你无限多的内存，但是实际上是实报实销，因为我知道你一定用不了那么多，于是，达到了内存使用率提高的效果。（今天云计算中很多所谓的虚拟化其实完全都是在用和“虚拟内存”相似的 `Thin Provisioning` 的技术，所谓的超配，或是超卖）。
  
  好了，话题拉回来，我们这里说的是存储。看下面两个图，第一个是 `Fat Provisioning`，第二个是 `Thin Provisioning`，其很好的说明了是个怎么一回事（和虚拟内存是一个概念）。
  
  ![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/Dou0uN.jpg)
  
  ![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/lMhtJG.jpg)

  下图中展示了某位用户向服务器管理员请求分配 10TB 的资源的情形。实际情况中这个数值往往是峰值，根据使用情况，分配 2TB 就已足够。因此，系统管理员准备 2TB 的物理存储，并给服务器分配 10TB 的虚拟卷。服务器即可基于仅占虚拟卷容量 1/5 的现有物理磁盘池开始运行。这样的“始于小”方案能够实现更高效地利用存储容量。

  ![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/udMvqc.jpg)

那么，Docker 是怎么使用 <code>Thin Provisioning</code> 这个技术做到像 UnionFS 那样的分层镜像的呢？答案是，Docker 使用了 <code>Thin Provisioning</code> 的 <code>Snapshot</code> 的技术。下面一篇我们来介绍一下 <code>Thin Provisioning</code> 的 <code>Snapshot</code>。

## 参考资料

----

+ [DOCKER基础技术：DEVICEMAPPER](https://coolshell.cn/articles/17200.html)
+ [Docker存储驱动DeviceMapper](https://robinle.github.io/docker/2017/03/13/Docker%E5%AD%98%E5%82%A8%E9%A9%B1%E5%8A%A8%E4%B9%8BDeviceMapper/)
