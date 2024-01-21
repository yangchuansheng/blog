---
keywords:
- docker
- 容器
- 镜像
title: "docker 在本地如何管理 image（镜像）?"
subtitle: "探索 image 的获取和存储方式"
date: 2018-04-02T05:12:18Z
draft: false
author: 米开朗基杨
toc: true
categories:
- cloud-native
tags:
- Docker
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191204213400.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

docker 里面可以通过 `docker pull`、`docker build`、`docker commit`、`docker load`、`docker import` 等方式得到一个 image，得到 image 之后 docker 在本地是怎么存储的呢？本篇将以 `docker pull` 为例，简述 image 的获取和存储方式。

## 镜像相关的配置

----

docker 里面和 image 有关的目录为 `/var/lib/docker`，里面存放着 image 的所有信息，可以通过下面这个 dockerd 的启动参数来修改这个目录的路径。

```bash
--graph, -g /var/lib/docker Root of the Docker runtime
```

## 镜像的引用方式

----

在需要引用 image 的时候，比如 docker pull 的时候，或者运行容器的时候，都需要指定一个image名称，引用一个镜像有多种方式，下面以 `alpine` 为例进行说明.

{{< alert >}}
由于 sha256 码太长，所以用 abcdef... 来表示完整的 sha256，节约空间
{{< /alert >}}

### docker hub 上的官方镜像

+ **alpine:** 官方提供的最新 alpine 镜像，对应的完整名称为 `docker.io/library/alpine:latest`
+ **alpine:3.7:** 官方提供的 alpine 3.7 镜像，对应的完整名称为 `docker.io/library/alpine:3.7`
+ **alpine:@sha256:abcdef...:** 官方提供的 digest 码为 sha256:abcdef... 的 alpine 镜像，对应的完整名称为 `docker.io/library/alpine@sha256:abcdef...`

### docker hub 上的非官方（个人）镜像

引用方式和官方镜像一样，唯一不同的是需要在镜像名称前面带上用户前缀，如：

+ **user1/alpine:** 由 user1 提供的最新 alpine 镜像， 对应的完整名称为 `docker.io/user1/alpine:latest`

`user1/alpine:3.7` 和 `user1/alpine:@sha256:abcdef...` 这两种方式也是和上面一样，等同于 `docker.io/user1/alpine:3.7` 和 `docker.io/user1/alpine:@sha256:abcdef...`

### 自己搭建的 registry 里的镜像

引用方式和 `docker hub` 一样，唯一不同的是需要在镜像名称最前面带上地址，如：

+ **localhost:5000/alpine:** 本地自己搭建的 registry（localhost:5000）里面的官方 alpine 的最新镜像，对应的完整名称为 `localhost:5000/library/alpine:latest`
+ **localhost:5000/user1/alpine@sha256:a123def...:** 本地自己搭建的 registry（localhost:5000）里面由用户 user1 提供的 digest 为 sha256:a123def 的 alpine 镜像

其它的几种情况和上面的类似。

### 为什么需要镜像的 digest？

对于某些 `image` 来说，可能在发布之后还会做一些更新，比如安全方面的，这时虽然镜像的内容变了，但镜像的名称和 `tag` 没有变，所以会造成前后两次通过同样的名称和 `tag` 从服务器得到不同的两个镜像的问题，于是 docker 引入了镜像的 `digest` 的概念，一个镜像的 `digest` 就是镜像的 `manifes` 文件的 `sha256` 码，当镜像的内容发生变化的时候，即镜像的 `layer` 发生变化，从而 `layer` 的 `sha256` 发生变化，而 `manifest` 里面包含了每一个 `layer` 的 `sha256`，所以 `manifest` 的 `sha256` 也会发生变化，即镜像的 `digest` 发生变化，这样就保证了 `digest` 能唯一的对应一个镜像。

## docker pull的大概过程

----

如果对 Image manifest，Image Config 和 Filesystem Layers 等概念不是很了解，请先参考 [image(镜像)是什么](https://segmentfault.com/a/1190000009309347)。

取 image 的大概过程如下：

+ docker 发送 `image` 的名称+tag（或者 digest）给 `registry` 服务器，服务器根据收到的 image 的名称+tag（或者 digest），找到相应 image 的 `manifest`，然后将 manifest 返回给 docker
+ docker 得到 `manifest` 后，读取里面 image 配置文件的 `digest`(sha256)，这个 sha256 码就是 image 的 `ID`
+ 根据 `ID` 在本地找有没有存在同样 `ID` 的 image，有的话就不用继续下载了
+ 如果没有，那么会给 registry 服务器发请求（里面包含配置文件的 `sha256` 和 `media type`），拿到 image 的配置文件（`Image Config`）
+ 根据配置文件中的 `diff_ids`（每个 diffid 对应一个 layer tar 包的 sha256，tar 包相当于 layer 的原始格式），在本地找对应的 layer 是否存在
+ 如果 layer 不存在，则根据 `manifest` 里面 layer 的 `sha256` 和 `media type` 去服务器拿相应的 layer（相当去拿压缩格式的包）。
+ 拿到后进行解压，并检查解压后 tar 包的 sha256 能否和配置文件（`Image Config`）中的 `diff_id` 对的上，对不上说明有问题，下载失败
+ 根据 docker 所用的后台文件系统类型，解压 tar 包并放到指定的目录
+ 等所有的 layer 都下载完成后，整个 image 下载完成，就可以使用了

{{< alert >}}
对于 layer 来说，<code>config</code> 文件中 diffid 是 layer 的 <code>tar</code> 包的 sha256，而 <code>manifest</code> 文件中的 digest 依赖于 media type，比如 media type 是 <code>tar+gzip</code>，那 digest 就是 layer 的 tar 包经过 gzip 压缩后的内容的 sha256，如果 media type 就是 tar 的话，diffid 和 digest 就会一样。
{{< /alert >}}

> dockerd 和 registry 服务器之间的协议为 [Registry HTTP API V2](https://docs.docker.com/registry/spec/api/)。

## image 本地存放位置

----

这里以 `ubuntu` 的 image 为例，展示 docker 的 image 存储方式。

先看看 ubuntu 的 `image id` 和 `digest`，然后再分析 image 数据都存在哪里。

```bash
$ docker images --digests

REPOSITORY                                           TAG                 DIGEST                                                                    IMAGE ID            CREATED             SIZE
ubuntu                                               latest              sha256:e348fbbea0e0a0e73ab0370de151e7800684445c509d46195aef73e090a49bd6   f975c5035748        3 weeks ago         112MB
......
```

{{< alert >}}
对于本地生成的镜像来说，由于没有上传到 registry 上去，所以没有 digest，因为镜像的 manifest 由 registry 生成。
{{< /alert >}}

### repositories.json

`repositories.json` 中记录了和本地 image 相关的 `repository` 信息，主要是 `name` 和 `image id` 的对应关系，当 image 从 registry 上被 pull 下来后，就会更新该文件：

```bash
#这里目录中的 overlay2 为 docker 后台所采用的存储文件系统名称，
#如果是其他的文件系统的话，名字会是其他的，比如btrfs、aufs、devicemapper等。
$ cat /var/lib/docker/image/overlay2/repositories.json|jq .

{
    "Repositories": {
        "ubuntu": {
            "ubuntu:latest": "sha256:f975c50357489439eb9145dbfa16bb7cd06c02c31aa4df45c77de4d2baa4e232",
            "ubuntu@sha256:e348fbbea0e0a0e73ab0370de151e7800684445c509d46195aef73e090a49bd6": "sha256:f975c50357489439eb9145dbfa16bb7cd06c02c31aa4df45c77de4d2baa4e232"
        }
        ......
    }
}
```

+ **ubuntu:** `repository` 的名称，前面没有服务器信息的表示这是官方 registry(docker hub) 里面的 repository，里面包含的都是 image 标识和 image ID 的对应关系

+ **ubuntu:latest 和 ubuntu@sha256:e348fbb...:** 他们都指向同一个image（`sha256:f975c5...`）

### 配置文件（image config）

docker 根据后台所采用的文件系统不同，在 `/var/lib/docker` 目录下创建了不同的子目录，对于 `CentOS` 来说，默认文件系统是 `overlay2`。本文以 <span id="inline-purple">CentOS</span> 为例。

docker 根据第一步得到的 manifest，从 registry 拿到 config 文件，然后保存在 `image/overlay2/imagedb/content/sha256/` 目录下，文件名称就是文件内容的 `sha256` 码，即 `image id`：

```bash
$ sha256sum /var/lib/docker/image/overlay2/imagedb/content/sha256/f975c50357489439eb9145dbfa16bb7cd06c02c31aa4df45c77de4d2baa4e232

f975c50357489439eb9145dbfa16bb7cd06c02c31aa4df45c77de4d2baa4e232  /var/lib/docker/image/overlay2/imagedb/content/sha256/f975c50357489439eb9145dbfa16bb7cd06c02c31aa4df45c77de4d2baa4e232

#这里我们只关注这个 image 的 rootfs，
#从 diff_ids 里可以看出 ubuntu:latest 这个 image 包含了 5 个 layer，
#从上到下依次是从底层到顶层，a94e0d...是最底层，db584c...是最顶层
$ cat /var/lib/docker/image/overlay2/imagedb/content/sha256/f975c50357489439eb9145dbfa16bb7cd06c02c31aa4df45c77de4d2baa4e232|jq .

......
  "rootfs": {
    "type": "layers",
    "diff_ids": [
      "sha256:a94e0d5a7c404d0e6fa15d8cd4010e69663bd8813b5117fbad71365a73656df9",
      "sha256:88888b9b1b5b7bce5db41267e669e6da63ee95736cb904485f96f29be648bfda",
      "sha256:52f389ea437ebf419d1c9754d0184b57edb45c951666ee86951d9f6afd26035e",
      "sha256:52a7ea2bb533dc2a91614795760a67fb807561e8a588204c4858a300074c082b",
      "sha256:db584c622b50c3b8f9b8b94c270cc5fe235e5f23ec4aacea8ce67a8c16e0fbad"
    ]
  }

......
```

### layer 的 diff_id 和 digest 的对应关系

layer 的 `diff_id` 存在 image 的配置文件中，而 layer 的 `digest` 存在 image 的 manifest 中，他们的对应关系被存储在了 `image/overlay2/distribution` 目录下：

```bash
$ tree -d /var/lib/docker/image/overlay2/distribution

/var/lib/docker/image/overlay2/distribution
├── diffid-by-digest
│   └── sha256
└── v2metadata-by-diffid
    └── sha256
```

+ **diffid-by-digest :**  存放 `digest` 到 `diffid` 的对应关系
+ **v2metadata-by-diffid :**  存放 `diffid` 到 `digest` 的对应关系

```bash
#这里以最底层 layer(a94e0d...) 为例，查看其 digest 信息
$ cat /var/lib/docker/image/overlay2/distribution/v2metadata-by-diffid/sha256/db584c622b50c3b8f9b8b94c270cc5fe235e5f23ec4aacea8ce67a8c16e0fbad|jq .

[
  {
    "Digest": "sha256:b78396653dae2bc0d9c02c0178bd904bb12195b2b4e541a92cd8793ac7d7d689",
    "SourceRepository": "docker.io/library/ubuntu",
    "HMAC": ""
  }
]

#根据 digest 得到 diffid
$ cat /var/lib/docker/image/overlay2/distribution/diffid-by-digest/sha256/b78396653dae2bc0d9c02c0178bd904bb12195b2b4e541a92cd8793ac7d7d689

sha256:db584c622b50c3b8f9b8b94c270cc5fe235e5f23ec4aacea8ce67a8c16e0fbad
```

### layer 的元数据

layer 的属性信息都放在了 `image/overlay2/layerdb` 目录下，目录名称是 layer 的 `chainid`，由于最底层的 layer 的 chainid 和 diffid 相同，所以这里我们用第二层（fe9a3f...）作为示例：

{{< alert >}}
计算 chainid 时，用到了所有祖先 layer 的信息，从而能保证根据 chainid 得到的 rootfs 是唯一的。比如我在 debian 和 ubuntu 的 image 基础上都添加了一个同样的文件，那么 commit 之后新增加的这两个 layer 具有相同的内容，相同的 diffid，但由于他们的父 layer 不一样，所以他们的 chainid 会不一样，从而根据 chainid 能找到唯一的 rootfs。计算 chainid 的方法请参考 <a href="https://github.com/opencontainers/image-spec/blob/master/config.md" target="_blank">image spec</a>
{{< /alert >}}

```bash
#计算 chainid
#这里 88888b... 是第二层的 diffid，而 a94e0d... 是 88888b... 父层的 chainid，
#由于a94e0d...是最底层，它没有父层，所以 a94e0d... 的 chainid 就是 a94e0d...
$ echo -n "sha256:a94e0d5a7c404d0e6fa15d8cd4010e69663bd8813b5117fbad71365a73656df9 sha256:88888b9b1b5b7bce5db41267e669e6da63ee95736cb904485f96f29be648bfda"|sha256sum -

14a40a140881d18382e13b37588b3aa70097bb4f3fb44085bc95663bdc68fe20  -

#根据 chainid 来看看相应目录的内容
$ ll /var/lib/docker/image/overlay2/layerdb/sha256/14a40a140881d18382e13b37588b3aa70097bb4f3fb44085bc95663bdc68fe20

total 20K
-rw-r--r-- 1 root root   64 Apr  1 22:16 cache-id
-rw-r--r-- 1 root root   71 Apr  1 22:16 diff
-rw-r--r-- 1 root root   71 Apr  1 22:16 parent
-rw-r--r-- 1 root root    3 Apr  1 22:16 size
-rw-r--r-- 1 root root 1.5K Apr  1 22:16 tar-split.json.gz

#每个 layer 都有这样一个对应的文件夹
#cache-id 是 docker 下载 layer 的时候在本地生成的一个随机 uuid，
#指向真正存放 layer 文件的地方
$ cat /var/lib/docker/image/overlay2/layerdb/sha256/14a40a140881d18382e13b37588b3aa70097bb4f3fb44085bc95663bdc68fe20/cache-id

658299560be0fd7eaf4a14b0927e134049d13eb31070a9902b0d275836a13cfb

#diff 文件存放 layer 的 diffid
$ cat /var/lib/docker/image/overlay2/layerdb/sha256/14a40a140881d18382e13b37588b3aa70097bb4f3fb44085bc95663bdc68fe20/diff

sha256:88888b9b1b5b7bce5db41267e669e6da63ee95736cb904485f96f29be648bfda

#parent 文件存放当前 layer 的父 layer 的 diffid，
#注意：对于最底层的 layer 来说，由于没有父 layer，所以没有这个文件
$ cat /var/lib/docker/image/overlay2/layerdb/sha256/14a40a140881d18382e13b37588b3aa70097bb4f3fb44085bc95663bdc68fe20/parent

sha256:a94e0d5a7c404d0e6fa15d8cd4010e69663bd8813b5117fbad71365a73656df9

#当前 layer 的大小，单位是字节
$ cat /var/lib/docker/image/overlay2/layerdb/sha256/14a40a140881d18382e13b37588b3aa70097bb4f3fb44085bc95663bdc68fe20/size

745

#tar-split.json.gz，layer 压缩包的 split 文件，通过这个文件可以还原 layer 的 tar 包，
#在 docker save 导出 image 的时候会用到
#详情可参考 https://github.com/vbatts/tar-split
$ ll /var/lib/docker/image/overlay2/layerdb/sha256/14a40a140881d18382e13b37588b3aa70097bb4f3fb44085bc95663bdc68fe20/tar-split.json.gz

-rw-r--r-- 1 root root 1.5K Apr  1 22:16 /var/lib/docker/image/overlay2/layerdb/sha256/14a40a140881d18382e13b37588b3aa70097bb4f3fb44085bc95663bdc68fe20/tar-split.json.gz
```

## layer数据

----

以 `CentOS` 为例，所有 layer 的文件都放在了 `/var/lib/docker/overlay2` 目录下。

```bash
$ tree -d -L 2 /var/lib/docker/overlay2

├── 658299560be0fd7eaf4a14b0927e134049d13eb31070a9902b0d275836a13cfb
│   ├── diff
│   └── work
├── 66ce99b5da081f65afea7ebaf612229179b620dc728b7407adcb44a51a27ae24
│   ├── diff
│   └── work
...
└── l
    ├── DYWQJVCIPQ2P2VFWZ4KBCV2JFW -> ../658299560be0fd7eaf4a14b0927e134049d13eb31070a9902b0d275836a13cfb/diff
    ├── 27O3MGWIL6SIN7K4GLVU4DLPSQ -> ../9028bae38f520a09220f67fbcf698aae2326c8318390a1d6005457d51ad97369/diff
...
```

`”l“` 目录包含一些符号链接作为缩短的层标识符. 这些缩短的标识符用来避免挂载时超出页面大小的限制。

```bash
$ ll /var/lib/docker/overlay2/l/

total 0
lrwxrwxrwx 1 root root 72 Mar 29 06:25 27O3MGWIL6SIN7K4GLVU4DLPSQ -> ../9028bae38f520a09220f67fbcf698aae2326c8318390a1d6005457d51ad97369/diff/
lrwxrwxrwx 1 root root 72 Mar 21 00:55 2AYPFAXSXLNCCEA6WRFCAPFPX3 -> ../23eb8415aec245a0291cca62d2da322de241263b8cbdfc690c0a77b353530b10/diff/
lrwxrwxrwx 1 root root 72 Mar 29 02:55 2H2XLZTCOYYSDT3XU2BDJRC2SB -> ../6b27128471bdfc742696ff9820bdfcdda73020753c26efeecea29b98096f0c5d/diff/
lrwxrwxrwx 1 root root 77 Mar 29 05:44 2JQ3OQVJBRYD75J4WTG4CSWA4Z -> ../641300d147b30f162167fed340cebcaae25f46db608939f6af09dbdb7078dcd4-init/diff/
lrwxrwxrwx 1 root root 72 Mar 21 00:55 2TCUOOM7Y7HMGIERRS4CX4YHVA -> ../cd3a3bd11269dc846ee9f79fca86c05336b8dd475d5ca8151991dc5d9fd7261f/diff/
lrwxrwxrwx 1 root root 77 Mar 29 06:24 36WQQRTYLT4P3J7DYLQAUMUPJE -> ../7ee9cc176abeb603ab0461650edd87890d167c579011813d0e864b7524f9fe24-init/diff/
...
```

{{< alert >}}
注意：由于 docker 所采用的文件系统不同，<code>/var/lib/docker/<storage-driver></code> 目录下的目录结构及组织方式也会不一样，要具体文件系统具体分析，本文只介绍 overlay2 这种情况。
关于 aufs 和 btrfs 的相关特性可以参考 <a href="https://segmentfault.com/a/1190000008489207" target="_blank">Linux 文件系统之 aufs</a> 和 <a href="https://segmentfault.com/a/1190000008605135" target="_blank">Btrfs 文件系统之 subvolume 与 snapshot</a>
{{< /alert >}}

还是以刚才的第二层 layer（88888b...）为例，看看实际的数据：

最底层包含 `link` 文件(不包含 lower 文件，因为是最底层)，在上面的结果中 `a94e0d...` 为最底层。 这个文件记录着作为标识符的更短的符号链接的名字、最底层还有一个 `diff` 目录(包含实际内容)。

```bash
# 查看底层 a94e0d... 的 layer 存放的地方
$ cat /var/lib/docker/image/overlay2/layerdb/sha256/a94e0d5a7c404d0e6fa15d8cd4010e69663bd8813b5117fbad71365a73656df9/cache-id

8feee71ff338d03a22ef090f8e5a49771ca8c1f418db345782ff0fb9b9fff3ce

$ ll /var/lib/docker/overlay2/8feee71ff338d03a22ef090f8e5a49771ca8c1f418db345782ff0fb9b9fff3ce/

total 4.0K
drwxr-xr-x 21 root root 224 Apr  1 22:16 diff/
-rw-r--r--  1 root root  26 Apr  1 22:15 link

$ cat  /var/lib/docker/overlay2/8feee71ff338d03a22ef090f8e5a49771ca8c1f418db345782ff0fb9b9fff3ce/link

3GQZNQYZNRAXT6X453L5O73Y5U

$ ll /var/lib/docker/overlay2/l/|grep 3GQZNQYZNRAXT6X453L5O73Y5U

lrwxrwxrwx 1 root root 72 Apr  1 22:15 3GQZNQYZNRAXT6X453L5O73Y5U -> ../8feee71ff338d03a22ef090f8e5a49771ca8c1f418db345782ff0fb9b9fff3ce/diff/

# diff 目录下面是层的内容
$ ll /var/lib/docker/overlay2/8feee71ff338d03a22ef090f8e5a49771ca8c1f418db345782ff0fb9b9fff3ce/diff/

total 16K
drwxr-xr-x  2 root root 4.0K Feb 28 14:14 bin/
drwxr-xr-x  2 root root    6 Apr 12  2016 boot/
drwxr-xr-x  4 root root 4.0K Feb 28 14:14 dev/
drwxr-xr-x 42 root root 4.0K Feb 28 14:14 etc/
drwxr-xr-x  2 root root    6 Apr 12  2016 home/
...
```

从第二层开始，每层镜像层包含 `lower` 文件，该文件的内容表示父层镜像的符号链接，根据这个文件可以索引构建出整个镜像的层次结构。同时还包含 `merged` 和 `work` 目录。

+ 每当启动一个容器时，会将 `link` 指向的镜像层目录以及 `lower` 指向的镜像层目录联合挂载到 `merged` 目录，因此，容器内的视角就是 `merged` 目录下的内容。
+ 而 work 目录则是用来完成如 `copy-on_write` 的操作。

```bash
$ tree -L 1 /var/lib/docker/overlay2/658299560be0fd7eaf4a14b0927e134049d13eb31070a9902b0d275836a13cfb

/var/lib/docker/overlay2/658299560be0fd7eaf4a14b0927e134049d13eb31070a9902b0d275836a13cfb
├── diff
├── link
├── lower
└── work

# 父层镜像的符号链接
$ cat /var/lib/docker/overlay2/658299560be0fd7eaf4a14b0927e134049d13eb31070a9902b0d275836a13cfb/lower

l/3GQZNQYZNRAXT6X453L5O73Y5U

$ ll /var/lib/docker/overlay2/658299560be0fd7eaf4a14b0927e134049d13eb31070a9902b0d275836a13cfb/diff

total 0
drwxr-xr-x 4 root root 29 Mar  6 17:17 etc/
drwxr-xr-x 2 root root 21 Mar  6 17:17 sbin/
drwxr-xr-x 3 root root 18 Feb 28 14:13 usr/
drwxr-xr-x 3 root root 17 Feb 28 14:14 var/
```

## manifest文件去哪了？

----

从前面介绍 docker pull 的过程中得知，docker 是先得到 `manifest`，然后根据 manifest 得到 `config` 文件和 `layer`。

前面已经介绍了 config 文件和 layer 的存储位置，但唯独不见 manifest，去哪了呢？

manifest 里面包含的内容就是对 config 和 layer 的 `sha256 + media type` 描述，目的就是为了下载 config 和 layer，等 image 下载完成后，manifest 的使命就完成了，里面的信息对于 image 的本地管理来说没什么用，所以 docker 在本地没有单独的存储一份 manifest 文件与之对应。

## 结束语

----

本篇介绍了image在本地的存储方式，包括了 `/var/lib/docker/image` 和 `/var/lib/docker/overlay2` 这两个目录，但 /var/lib/docker/image 下面有两个目录没有涉及：

+ `/var/lib/docker/image/overlay2/imagedb/metadata`：里面存放的是本地 image 的一些信息，从服务器上 pull 下来的 image 不会存数据到这个目录，下次有机会再补充这部分内容。

+ `/var/lib/docker/image/overlay2/layerdb/mounts`: 创建 container 时，docker 会为每个 container 在 image 的基础上创建一层新的 layer，里面主要包含 /etc/hosts、/etc/hostname、/etc/resolv.conf 等文件，创建的这一层 layer 信息就放在这里，后续在介绍容器的时候，会专门介绍这个目录的内容。

## 参考

----

+ [docker源代码](https://github.com/moby/moby)

