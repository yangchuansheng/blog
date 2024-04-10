---
keywords:
- Device Mapper
- devicemapper
- docker
- 容器
- 云原生
title: "Device Mapper基础教程：Docker 中使用 devicemapper 存储驱动"
subtitle: "配置 Docker 使用 devicemapper"
date: 2018-01-22T16:17:11+08:00
draft: false
author: 米开朗基杨
toc: true
categories:
- cloud-native
tags:
- Docker
- Device Mapper
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191205104948.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

## 准备条件
------

+ `devicemapper` 存储驱动是 `RHEL`, `CentOS` 和 `Oracle Linux` 系统上唯一一个支持 `Docker EE` 和 `Commercially Supported Docker Engine` (CS-Engine) 的存储驱动，具体参考 [Product compatibility matrix](https://success.docker.com/Policies/Compatibility_Matrix).

+ `devicemapper` 在 `CentOS`, `Fedora`, `Ubuntu` 和 `Debian` 上也支持 `Docker CE`。

+ 如果你更改了 `Docker` 的存储驱动，那么你之前在本地创建的所有容器都将无法访问。

## 配置Docker使用devicemapper
------

Docker 主机运行 `devicemapper` 存储驱动时，默认的配置模式为 `loop-lvm`。此模式使用空闲的文件来构建用于镜像和容器快照的精简存储池。该模式设计为无需额外配置开箱即用(out-of-the-box)。不过生产部署不应该以 `loop-lvm` 模式运行。

### 2.1 生产环境配置direct-lvm模式

CentOS7 从 `Docker 17.06` 开始支持通过 Docker 自动配置  `direct-lvm`，所以推荐使用该工具配置。当然也可以手动配置 `lvm`，添加相关配置选项，不过过程较为繁琐一点。

#### 自动配置 direct-lvm 模式

该方法只适用于一个块设备，如果你有多个块设备，请通过手动配置 `direct-lvm` 模式。

示例配置文件位置 `/usr/lib/docker-storage-setup/docker-storage-setup`，可以查看其中相关配置的详细说明，或者通过 `man docker-storage-setup` 获取帮助，以下介绍几个关键的选项：

| 参数 | 解释 | 是否必须 | 默认值 | 示例 |
| :-- | :-- | :-- | :-- | :-- |
| dm.directlvm_device | 准备配置 direct-lvm 的块设备的路径 | 是 |  | dm.directlvm_device="/dev/xvdf" |
| dm.thinp_percent | 定义创建 data thin pool 的大小 | 否 | 95 | dm.thinp_percent=95 |
| dm.thinp_metapercent | 定义创建 metadata thin pool 的大小 | 否 | 1 | dm.thinp_metapercent=1 |
| dm.thinp_autoextend_threshold | 定义自动扩容的百分比，100 表示 disable，最小为 50，参考 [lvmthin — LVM thin provisioning](http://man7.org/linux/man-pages/man7/lvmthin.7.html) | 否 | 80 | dm.thinp_autoextend_threshold=80 |
| dm.thinp_autoextend_percent | 定义每次扩容的大小，100 表示 disable | 否 | 20 | dm.thinp_autoextend_percent=20 |
| dm.directlvm_device_force | 当块设备已经存在文件系统时，是否格式化块设备 | 否 | false | dm.directlvm_device_force=true |

编辑 `/etc/docker/daemon.json`，设置好参数后重新启动 Docker 使更改生效。下面是一个示例：

```bash
{
  "storage-driver": "devicemapper",
  "storage-opts": [
    "dm.directlvm_device=/dev/xdf",
    "dm.thinp_percent=95",
    "dm.thinp_metapercent=1",
    "dm.thinp_autoextend_threshold=80",
    "dm.thinp_autoextend_percent=20",
    "dm.directlvm_device_force=false"
  ]
}
```

关于存储的更多参数请参考：

+ [Stable](https://docs.docker.com/engine/reference/commandline/dockerd/#storage-driver-options)

+ [Edge](https://docs.docker.com/edge/engine/reference/commandline/dockerd/#storage-driver-options)

#### 手动配置 direct-lvm 模式

下面的步骤创建一个逻辑卷，配置用作存储池的后端。我们假设你有在 `/dev/xvdf` 的充足空闲空间的块设备。也假设你的 Docker daemon 已停止。

+ 1.登录你要配置的 `Docker` 主机并停止 `Docker daemon`。
+ 2.安装LVM2软件包。LVM2软件包含管理Linux上逻辑卷的用户空间工具集。
  + **RHEL / CentOS:** `device-mapper-persistent-data`, `lvm2` 以及相关依赖
  + **Ubuntu / Debian:** `thin-provisioning-tools`, `lvm2` 以及相关依赖

+ 3.创建物理卷。

```bash
$ pvcreate /dev/xvdf

Physical volume "/dev/xvdf" successfully created.
```

+ 4.创建一个 “docker” 卷组。

```bash
$ vgcreate docker /dev/xvdf

Volume group "docker" successfully created
```

+ 5.创建一个名为thinpool的存储池。

  在此示例中，设置池大小为 “docker” 卷组大小的 `95％`。 其余的空闲空间可以用来自动扩展数据或元数据。

```bash
$ lvcreate --wipesignatures y -n thinpool docker -l 95%VG

Logical volume "thinpool" created.

$ lvcreate --wipesignatures y -n thinpoolmeta docker -l 1%VG

Logical volume "thinpoolmeta" created.
```

+ 6.将存储池转换为 `thinpool` 格式。

```bash
$ lvconvert -y \
--zero n \
-c 512K \
--thinpool docker/thinpool \
--poolmetadata docker/thinpoolmeta

WARNING: Converting logical volume docker/thinpool and docker/thinpoolmeta to
thin pool's data and metadata volumes with metadata wiping.
THIS WILL DESTROY CONTENT OF LOGICAL VOLUME (filesystem etc.)
Converted docker/thinpool to thin pool.
```

+ 7.通过 `lvm profile` 配置存储池的自动扩展。

```bash
$ vi /etc/lvm/profile/docker-thinpool.profile
```

+ 8.设置参数 `thin_pool_autoextend_threshold` 和 `thin_pool_autoextend_percent` 的值。

> 设置 `thin_pool_autoextend_threshold` 值。这个值应该是之前设置存储池余下空间的百分比(100 = disabled)。

```bash
thin_pool_autoextend_threshold = 80
```

> 设置当存储池自动扩容时，增加存储池的空间百分比（100 =禁用）

```bash
thin_pool_autoextend_percent = 20
```

检查你的 `docker-thinpool.profile` 的设置。一个示例 `/etc/lvm/profile/docker-thinpool.profile` 应该类似如下：

```bash
activation {
  thin_pool_autoextend_threshold=80
  thin_pool_autoextend_percent=20
}
```

+ 9.应用新的 `lvm` 配置。

```bash
$ lvchange --metadataprofile docker-thinpool docker/thinpool

Logical volume docker/thinpool changed.
```

+ 10.查看卷的信息，验证 lv 是否受监控。

```bash
$ lvs -o+seg_monitor

LV       VG     Attr       LSize  Pool Origin Data%  Meta%  Move Log Cpy%Sync Convert Monitor
thinpool docker twi-a-t--- 95.00g             0.00   0.01                             monitored
```

+ 11.备份 `Docker` 存储。

```bash
$ mkdir /var/lib/docker.bk
$ mv /var/lib/docker/* /var/lib/docker.bk
```

+ 12.配置一些特定的 `devicemapper` 选项。

```bash
$ cat /etc/docker/daemon.json

{
    "storage-driver": "devicemapper",
    "storage-opts": [
    "dm.thinpooldev=/dev/mapper/docker-thinpool",
    "dm.use_deferred_removal=true",
    "dm.use_deferred_deletion=true"
    ]
}
```

{{< alert >}}
Note: Always set both `dm.use_deferred_removal=true` and `dm.use_deferred_deletion=true` to prevent unintentionally leaking mount points.

启用上述2个参数来阻止可能意外产生的挂载点泄漏问题
{{< /alert >}}

#### 检查主机上的 `devicemapper` 结构

你可以使用 `lsblk` 命令来查看以上创建的设备文件和存储池。

```bash
$ lsblk
NAME               MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
xvda               202:0    0    8G  0 disk
└─xvda1            202:1    0    8G  0 part /
xvdf               202:80   0   10G  0 disk
├─vg--docker-data          253:0    0   90G  0 lvm
│ └─docker-202:1-1032-pool 253:2    0   10G  0 dm
└─vg--docker-metadata      253:1    0    4G  0 lvm
  └─docker-202:1-1032-pool 253:2    0   10G  0 dm
```

下图显示由 `lsblk` 命令输出的之前镜像的详细信息。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/devicemapper-in-practice-pic4.jpg)

可以看出，名为 `Docker-202:1-1032-pool` 的 pool 横跨在 `data` 和 `metadata` 设备之上。pool 的命名规则为：

> Docker-主设备号:二级设备号-inode号-pool

## 管理 devicemapper
------

### 3.1 监控 thin pool

不要过于依赖 `lvm` 的自动扩展，通常情况下 `Volume Group` 会自动扩展，但有时候 `volume` 还是会被塞满，你可以通过命令 `lvs` 或 `lvs -a` 来监控 volume 剩余的空间。也可以考虑使用 `nagios` 等监控工具来进行监控。

> 可以查看 `lvm` 日志，了解 `thin pool` 在自动扩容触及阈值时的状态：

```bash
$ journalctl -fu dm-event.service
```

{{< alert >}}
如果你在使用精简池（thin pool）的过程中频繁遇到问题，你可以在 <code>/etc/docker.daemon.json</code> 中设置参数 <code>dm.min_free_space</code> 的值（表示百分比）。例如将其设置为 10，以确保当可用空间达到或接近 10％ 时操作失败，并发出警告。参考 <a href="https://docs.docker.com/engine/reference/commandline/dockerd/#storage-driver-options">storage driver options in the Engine daemon reference</a>.
{{< /alert >}}

### 3.2 为正在运行的设备增加容量

如果 lv 的存储空间已满，并且 vg 处于满负荷状态，你可以为正在运行的 `thin-pool` 设备增加存储卷的容量，具体过程取决于您是使用 `loop-lvm` 精简池还是使用 `direct-lvm` 精简池。

#### 调整 `loop-lvm` 精简池的大小

调整 `loop-lvm` 精简池的最简单方法是使用 `device_tool` 工具，你也可以使用操作系统自带的工具。

##### a. 使用 `device_tool` 工具

在 `docker` 官方 `github` 仓库的 `contrib/` 目录中有一个社区贡献的脚本 [device_tool.go](https://raw.githubusercontent.com/docker/docker-ce/master/components/engine/contrib/docker-device-tool/device_tool.go)，你可以通过此工具免去繁琐的步骤来调整 `loop-lvm` 精简池的大小。这个工具不能保证 100% 有效，最好不要在生产环境中使用 `loop-lvm` 模式。

1. `clone` 整个仓库 [docker-ce](https://github.com/docker/docker-ce)，切换到目录 `contrib/docker-device-tool` ，按照 `README.md` 中的说明编译该工具。
  
2. 使用该工具。例如调整 `thin pool` 的大小为 200GB。

```bash
$ ./device_tool resize 200GB
```
  
##### b. 使用操作系统工具
  
如果你不想使用 `device_tool` 工具，可以通过操作系统工具手动调整 `loop-lvm` 精简池的大小。

> 在 `loop-lvm` 模式中，Docker 使用的 Device Mapper 设备默认使用 loopback 设备，后端为自动生成的稀疏文件，如下:

```bash
$ ls -lsh /var/lib/docker/devicemapper/devicemapper/
总用量 510M
508M -rw-------. 1 root root 100G 10月 30 00:00 data
1.9M -rw-------. 1 root root 2.0G 10月 30 00:00 metadata
```

`data` [存放数据] 和 `metadata` [存放元数据] 的大小从输出可以看出初始化默认为 100G 和 2G 大小，都是稀疏文件，使用多少占用多少。

Docker 在初始化的过程中，创建 data 和 metadata 这两个稀疏文件，并分别附加到回环设备 `/dev/loop0` 和 `/dev/loop1` 上，然后基于回环设备创建 thin pool。 默认一个 container 最大存放数据不超过 10G。

> 查看 `data` 和 `metadata` 的文件路径：

```bash
$ docker info |grep 'loop file'

 Data loop file: /var/lib/docker/devicemapper/data
 Metadata loop file: /var/lib/docker/devicemapper/metadata
```

按照以下步骤来增加精简池的大小。在这个例子中，thin-pool 原来的容量为 100GB，增加到200GB。

1. 查看 data 和 metadata 的大小。

    ```bash
    $ ls -lh /var/lib/docker/devicemapper/

    total 1175492
    -rw------- 1 root root 100G Mar 30 05:22 data
    -rw------- 1 root root 2.0G Mar 31 11:17 metadata
    ```
  
2. 使用 truncate 命令将数据文件的大小增加到 200G。

    ```bash
    $ truncate -s 200G /var/lib/docker/devicemapper/data
    ```
  
    <p markdown="1" style="display: block;padding: 10px;margin: 10px 0;border: 1px solid #ccc;border-top-width: 5px;border-radius: 3px;border-top-color: #9954bb;">
    注意：减小数据文件的大小有可能会对数据造成破坏，请慎重考虑。
    </p> 
  
3. 验证文件大小。

    ```bash
    $ ls -lh /var/lib/docker/devicemapper/

    total 1.2G
    -rw------- 1 root root 200G Apr 14 08:47 data
    -rw------- 1 root root 2.0G Apr 19 13:27 metadata
    ```
    可以看到 `loopback` 文件的大小已经改变，但还没有保存到内存中。
  
4. 在内存中列出环回设备的大小，重新加载该设备，然后再次列出大小。

    ```bash
    $ echo $[ $(sudo blockdev --getsize64 /dev/loop0) / 1024 / 1024 / 1024 ]

    100

    $ losetup -c /dev/loop0

    $ echo $[ $(sudo blockdev --getsize64 /dev/loop0) / 1024 / 1024 / 1024 ]

    200
    ```
  
    重新加载之后，`loopback` 设备的大小变为 200GB。

5. 重新加载 `devicemapper thin pool`。

    + 查看 thin pool 的名称

    ```bash
    $ dmsetup status | grep ' thin-pool ' | awk -F ': ' {'print $1'}
    ```
  
    + 查看当前卷的信息表

    ```bash
    $ dmsetup table docker-8:1-123141-pool
  
    0 209715200 thin-pool 7:1 7:0 128 32768 1 skip_block_zeroing
    ```
  
    > + 第二个数字是设备的大小，表示有多少个 512－bytes 的扇区。<br />
    > + 128 是最小的可分配的 sector 数。    
    > + 32768 是最少可用 sector 的 water mark，也就是一个 threshold。
    > + 1 代表有一个附加参数。
    > + skip_block_zeroing是个附加参数，表示略过用0填充的块。

    + 使用输出的第二个字段计算扩展后的 `thin pool` 总大小，该字段表示有多少个扇区。100G 的文件含有 209715200 个扇区，扩展到 200G 后，扇区数为 419430400。

    + 使用新的扇区数重新加载 thin pool。

    ```bash
    $ dmsetup suspend docker-8:1-123141-pool
  
    $ dmsetup reload docker-8:1-123141-pool --table '0 419430400 thin-pool 7:1 7:0 128 32768 1 skip_block_zeroing'
  
    $ dmsetup resume docker-8:1-123141-pool
    ```
  
#### 调整 `direct-lvm` 精简池的大小

要调整 `direct-lvm` 精简池的大小，需要添加一块新的块设备到 Docker 的宿主机。并记下内核分配给它的设备名称。例如新的块设备名称为 `/dev/xvdg`。

按照以下步骤来增加 `direct-lvm` 精简池的大小，请根据实际情况替换以下部分参数。

1. 查看卷组的信息。

    > 使用 `pvdisplay` 命令查看精简池当前正在使用的物理块设备以及卷组的名称

    ```bash
    $ pvdisplay |grep 'VG Name'

    PV Name               /dev/xvdf
    VG Name               docker
    ```
    
2. 扩展卷组。

    ```bash
    $ vgextend docker /dev/xvdg

    Physical volume "/dev/xvdg" successfully created.
    Volume group "docker" successfully extended
    ```
    
3. 扩展逻辑卷 `docker/thinpool`。
     
    ```bash
    $ lvextend -l+100%FREE -n docker/thinpool
     
     Size of logical volume docker/thinpool_tdata changed from 95.00 GiB (24319 extents) to 198.00 GiB (50688 extents).
    Logical volume docker/thinpool_tdata successfully resized.
    ```
     
     该命令使用了存储卷的全部空间，没有配置自动扩展。如果要扩展 metadata 精简池，请使用 `docker/thinpool_tmeta` 替换 `docker/thinpool`。
     
4. 验证新的 `thin pool` 的大小。

    ```bash
    $ docker info
    
    ......
    Storage Driver: devicemapper
     Pool Name: docker-thinpool
     Pool Blocksize: 524.3 kB
     Base Device Size: 10.74 GB
     Backing Filesystem: xfs
     Data file:
     Metadata file:
     Data Space Used: 212.3 MB
     Data Space Total: 212.6 GB
     Data Space Available: 212.4 GB
     Metadata Space Used: 286.7 kB
     Metadata Space Total: 1.07 GB
     Metadata Space Available: 1.069 GB
    <output truncated>
    ```
    
    通过 `Data Space Available` 字段的值查看 `thin pool` 的大小。
    
#### 重启操作系统后重新激活 devicemapper

如果重启系统后发现 docker 服务启动失败，你会看到像 “Non existing device” 这样的报错信息。这时需要重新激活逻辑卷。

```bash
$ lvchange -ay docker/thinpool
```

## devicemapper 存储驱动的工作原理
------

<p markdown="1" style="display: block;padding: 10px;margin: 10px 0;border: 1px solid #ccc;border-top-width: 5px;border-radius: 3px;border-top-color: #9954bb;">
<strong>注意</strong>：不要直接操作 <code>/var/lib/docker/</code> 中的任何文件或目录，这些文件和目录由 docker 自动管理。
</p>

> 查看设备和存储池：

```bash
$ lsblk

NAME                    MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
xvda                    202:0    0    8G  0 disk
└─xvda1                 202:1    0    8G  0 part /
xvdf                    202:80   0  100G  0 disk
├─docker-thinpool_tmeta 253:0    0 1020M  0 lvm
│ └─docker-thinpool     253:2    0   95G  0 lvm
└─docker-thinpool_tdata 253:1    0   95G  0 lvm
  └─docker-thinpool     253:2    0   95G  0 lvm
```

> 查看 docker 正在使用的挂载点：

```bash
$ mount |grep devicemapper
/dev/xvda1 on /var/lib/docker/devicemapper type xfs (rw,relatime,seclabel,attr2,inode64,noquota)
```

使用 `devicemapper` 后，Docker 将镜像和层级内容存储在 thin pool 中，并将它们挂载到 `/var/lib/docker/devicemapper/` 目录中暴露给容器使用。

### 4.1 磁盘上的镜像和容器层

`/var/lib/docker/devicemapper/metadata/` 目录中包含了有关 devicemapper 配置本身的元数据，以及卷、快照和每个卷的块或者快照同存储池中块的映射信息。`devicemapper` 使用了快照技术，元数据中也包含了这些快照的信息，以 json 格式保存在文本中。

`/var/lib/devicemapper/mnt/` 目录包含了所有镜像和容器层的挂载点。镜像层的挂载点表现为空目录，容器层的挂载点显示的是容器内部的文件系统。

### 4.2 镜像分层与共享

`devicemapper` 存储驱动使用专用块设备而不是格式化的文件系统，通过在块级别上对文件进行操作，能够在写时复制（CoW）期间实现最佳性能。

`devicemapper` 驱动将所有的镜像和容器存储到 `/var/lib/docker/devicemapper/` 目录，该目录由一个或多个块级设备、环回设备（仅测试）或物理硬盘组成。

使用 `devicemapper` 创建一个镜像的过程如下：

+ `devicemapper` 存储驱动创建一个精简池(thin pool)。这个池是从块设备或循环挂载的文件。

+ 下一步是创建一个 base 设备。一个 base 设备是具有文件系统的精简设备。你可以通过运行 `docker info` 命令检查 `Backing filesystem` 来查看使用的是哪个文件系统。

+ 每一个新镜像(和镜像数据层)是这个 base 设备的一个快照。这些是精简置备写时拷贝快照。这意味着它们初始为空，只在往它们写入数据时才消耗池中的空间。

使用 `devicemapper` 驱动时，容器数据层是从其创建的镜像的快照。与镜像一样，容器快照是精简置备写时拷贝快照。容器快照存储着容器的所有更改。当数据写入容器时，`devicemapper` 从存储池按需分配空间。

下图显示一个具有一个base设备和两个镜像的精简池。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/devicemapper-in-practice-pic1.jpg)

如果你仔细查看图表你会发现快照一个连着一个。每一个镜像数据层是它下面数据层的一个快照。每个镜像的最底端数据层是存储池中 `base` 设备的快照。此 `base` 设备是 `Device Mapper` 的工件，而不是 Docker 镜像数据层。

一个容器是从其创建的镜像的一个快照。下图显示两个容器： 一个基于 `Ubuntu` 镜像和另一个基于 `Busybox` 镜像。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/devicemapper-in-practice-pic2.jpg)

## devicemapper 读写数据的过程
------

### 5.1 读数据

我们来看下使用 `devicemapper` 存储驱动如何进行读文件。下图显示在示例容器中读取一个单独的块 [0x44f] 的过程。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/devicemapper-in-practice-pic3.jpg)

  1. 一个应用程序请求读取容器中 `0x44f` 数据块。由于容器是一个镜像的一个精简快照，它没有那个数据，只有一个指向镜像存储的地方的指针。

  2. 存储驱动根据指针，到镜像快照的 `a005e` 镜像层寻找 `0xf33` 块区。

  3. `devicemapper` 从镜像快照复制数据块 `0xf33` 的内容到容器内存中。

  4. 存储驱动最后将数据返回给请求的应用。

### 5.2 写数据

+ **写入新数据 :**  使用 `devicemapper` 驱动，通过按需分配（allocate-on-demand）操作来实现写入新数据到容器，所有的新数据都被写入容器的可写层中。

{{< alert >}}
例如要写入 56KB 的新数据到容器：

1. 一个应用程序请求写入56KB的新数据到容器。
2. 按需分配操作给容器快照分配一个新的64KB数据块。如果写操作大于64KB，就分配多个新数据块给容器快照。
3. 新的数据写入到新分配的数据块。
{{< /alert >}}

+ **覆盖存在的数据 :** 更新存在的数据使用写时拷贝（copy-on-write）操作，先从最近的镜像层中读取与该文件相关的数据块；然后分配新的空白数据块给容器快照并复制数据到这些数据块；最后更新好的数据写入到新分配的数据块。

+ **删除数据 :** 当从容器的可写层中删除文件或目录时，或者从镜像层中删除其父层镜像中已存在的文件时，`devicemapper` 存储驱动会截获对该文件或目录的进一步读取尝试，并响应该文件或目录不存在。

+ **写入新数据并删除旧数据 :** 当你向容器中写入新数据并删除旧数据时，所有这些操作都发生在容器的可写层。如果你使用的是 `direct-lvm` 模式，删除的数据块将会被释放；如果你使用的是 `loop-lvm` 模式，那么这些数据块就不会被释放。因此不建议在生产环境中使用 `loop-lvm` 模式。

## Device Mapper 对 Docker 性能的影响
------

了解按需分配和写时拷贝操作对整体容器性能的影响很重要。

### 6.1 按需分配对性能的影响

`devicemapper` 存储驱动通过按需分配操作给容器分配新的数据块。这意味着每次应用程序写入容器内的某处时，一个或多个空数据块从存储池中分配并映射到容器中。

所有数据块为 `64KB`。 写小于 `64KB` 的数据仍然分配一个 `64KB` 数据块。写入超过 `64KB` 的数据分配多个 `64KB` 数据块。所以，特别是当发生很多小的写操作时，就会比较影响容器的性能。不过一旦数据块分配给容器，后续的读和写可以直接在该数据块上操作。

### 6.2 写时拷贝对性能的影响

每当容器首次更新现有数据时，`devicemapper` 存储驱动必须执行写时拷贝操作。这会从镜像快照复制数据到容器快照。此过程对容器性能产生显着影响。因此，更新一个 `1GB` 文件的 `32KB` 数据只复制一个 `64KB` 数据块到容器快照。这比在文件级别操作需要复制整个 `1GB` 文件到容器数据层有明显的性能优势。

不过在实践中，当容器执行很多小于 `64KB` 的写操作时，`devicemapper` 的性能会比 `AUFS` 要差。

### 6.3 其他注意事项

还有其他一些影响 `devicemapper` 存储驱动性能的因素。

+ **模式**

Docker 使用的 devicemapper 存储驱动的默认模式是 `loop-lvm`。这个模式使用空闲文件来构建存储池，性能非常低。不建议用到生产环境。推荐用在生产环境的模式是 `direct-lvm`。

+ **存取速度**

如果希望获得更佳的性能，可以将数据文件和元数据文件放在 `SSD` 这样的高速存储上。

+ **内存使用**

`devicemapper` 并不是一个有效使用内存的存储驱动。当一个容器运行 n 个时，它的文件也会被拷贝 n 份到内存中，这对 `docker` 宿主机的内存使用会造成明显影响。因此，不建议在 `PaaS` 或者资源密集场合使用。

**对于写操作较大的，可以采用挂载 `data volumes`。使用 `data volumes` 可以绕过存储驱动，从而避免 `thin provisioning` 和 `copy-on-write` 引入的额外开销。**
