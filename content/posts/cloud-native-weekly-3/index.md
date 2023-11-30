---
keywords:
- 米开朗基杨
- kubernetes
- cloud-native
title: "云原生周报：第 3 期"
subtitle: "每周最新云原生开源项目和相关资讯推荐"
description: 这是云原生周报第 3 期，主要分享云原生社区最新开源项目和相关资讯。
date: 2019-07-21T21:25:34+08:00
draft: false
author: 米开朗基杨
toc: true
categories: cloud-native
tags: ["kubernetes"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-07-21-0_iYMUwPiX5y-9wavN.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

本文首发于：微信公众号「云原生实验室」，公众号ID：cloud_native_yang。

这是云原生周报第 3 期，主要分享云原生社区最新开源项目和相关资讯。

## 开源项目推荐

---

[diving](https://github.com/vicanso/diving) : 基于 [dive](https://github.com/wagoodman/dive) 分析 docker 镜像，界面化展示了镜像每层的变动（增加、修改、删除等）、用户层数据大小等信息。便捷获取镜像信息和每层镜像内容的文件树，可以方便地浏览镜像信息。对于需要优化镜像体积时非常方便。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/demo.gif)

[Wave](https://github.com/pusher/wave) : Kubernetes 的配置文件有两种，一种是 ConfigMap，用来存储明文；另一种是 Secret，用来存储密文。这两种配置文件应用都比较广泛，但遗憾的是，目前它们在大多数场景下都不支持热更新，只有当 ConfigMap 挂载为 Volume 时，才能支持热更新，其他场景均不支持。Wave 的做法比较机智，它向 API server 订阅来自指定的 Deployment（通过 annotations 识别） 的事件，一旦某个 Deployment 被执行了任何操作（Create/Read/Update/Delete），它就会通过算法来计算该 Deployment 中每个挂载的 ConfigMap and Secret 的 hash 值，如果挂载点发生了变化，或者挂载的数据发生了变化，都会改变 hash 值。由于该 hash 值被写到 [Pod Template](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#pod-template) 的 Annotation 中，所以 hash 更新就会触发 Deployment 的滚动更新。

[kube-eventer](https://github.com/AliyunContainerService/kube-eventer) : Kubernetes 的核心设计思想是状态机。在 Kubernetes 中，事件分为两种，一种是 `Warning` 事件，表示产生这个事件的状态转换是在非预期的状态之间产生的；另外一种是 `Normal` 事件，表示期望到达的状态，和目前达到的状态是一致的。通过事件的机制，可以丰富 Kuernetes 在监控方面的维度和准确性，弥补其他监控方案的缺欠。kube-eventer 是为了弥补事件监控场景的缺失，支持将 Kubernetes 事件发送到钉钉机器人、SLS 日志服务、Kafka 开源消息队列、InfluxDB 时序数据库等等。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-07-21-021027.jpg)

[Kubernetes 修仙路径](https://github.com/caicloud/kube-ladder) : 目前云计算行业对于 Kubernetes 学习的需求日益增加，但市面上关于 Kubernetes 的资源良莠不齐，存在几个问题：

+ 官方文档缺少明确的"梯度"，信息错综复杂
+ 资料较为分散，查找信息费时费力
+ Kubernetes 发展很快，书籍或者网上教程容易过时

为了给广大从业者提供一个 Kubernetes 学习路径，为大家提供一定的指引，[才云科技（Caicloud）](https://caicloud.io/) 推出了 Kubernetes 打怪升级指南，目标是让所有人剥茧抽丝般地了解 Kubernetes，不仅仅知道怎么用 Kubernetes，还知道 Kubernetes 各个功能是如何设计的。在学习路径后期，我们还可以很"自然"的联想到正确的设计思路。

[YugaByte DB](https://www.yugabyte.com/) : YugaByte DB 是一个高性能、云原生的分布式 SQL 数据库。YugaByte DB 具有基于 Google Spanner 的存储架构和基于 `PostgreSQL` 的查询层，旨在为现代应用程序在云原生基础架构上提供分布式 SQL 中的体验（类似 Oracle）。完全开源之后，其工程团队将带领 YugaByte DB 比以往更快地向云原生模式发展。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-07-21-061938.jpg)

[GetEnvoy Project](https://www.getenvoy.io) : 如果你的工作内容涉及到大型分布式系统，那你可能会听说过 `Envoy`，它是一款为云原生应用而设计、开源的边缘和服务代理，也是 Istio Service Mesh 默认的数据平面。但目前最痛苦的问题是 Envoy 很难编译，为了解决这个问题，Tetrate 的工程师（包括 Envoy 的核心贡献者和维护者）发起了 `GetEnvoy` 项目，目标是利用一套经过验证的构建工具来构建 Envoy，并通过常用的软件包管理器来分发，包括：`apt`、`yum` 和 `Homebrew`。下图是我通过 Homebrew 安装的 Envoy：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-07-21-065746.jpg)

[GRBAC](https://github.com/storyicon/grbac) : Grbac 是一个快速，优雅和简洁的 RBAC 框架。它支持增强的通配符并使用 Radix 树匹配 HTTP 请求。令人惊奇的是，您可以在任何现有的数据库和数据结构中轻松使用它。

[ccheck](https://github.com/brendanjryan/ccheck) : 一个用来验证 Kubernetes 资源配置的命令行工具。它通过使用 [reg 查询语言](https://www.openpolicyagent.org/docs/latest)来编写针对 yaml 文件的测试。

[ceph-study](https://github.com/blueboay/ceph-study) : Ceph 是一个可靠、自动均衡、自动恢复的分布式存储系统，通常可用于对象存储，块设备存储和文件系统存储。 Ceph 在存储的时候充分利用存储节点的计算能力，在存储每一个数据时都会通过计算得出该数据的位置，尽量的分布均衡。ceph-study 是网友整理的一份 ceph 学习指南，写的十分详细，欢迎初学者浏览学习。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-07-21-072619.png)

## 博客推荐

---

[到底要不要把数据库运行在 Kubernetes 中](https://cloud.google.com/blog/products/databases/to-run-or-not-to-run-a-database-on-kubernetes-what-to-consider) : 如今越来越多的应用都跑在 Kubernetes 上，Kubernetes 已经成为云时代的 Linux 操作系统。尽管如此，数据库的部署方式并没有因为 Kubernetes 的浪潮而受到太多影响，因为要想容器化，就要考虑数据库能否自动重启、横向扩展，能否适应容器隔离技术的限制。本文将会通过合理的逻辑推理告诉你到底要不要把数据库运行在 Kubernetes。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-07-21-073917.jpg)

[Kubernetes 中的 Java 应用性能优化](https://medium.com/faun/java-application-optimization-on-kubernetes-on-the-example-of-a-spring-boot-microservice-cf3737a2219c) : 在 Kubernetes 中部署应用并没有想象中那么简单，如果配置不恰当，就会遇到频繁的 oom kills 和 重启，尤其是 Java 应用需要特别关注。本文以一个 Spring Boot 微服务应用为例，分析应用启动消耗的 CPU 和内存资源，然后告诉我们如何调整资源的 `requests` 和 `limits` 来提高应用的启动速度，并防止因为 OOM 机制被 kill 掉。

[K8S 避坑指南 - Deployment 更新 POD 内容器无法收到 SIGTERM 信号](https://juejin.im/post/5d208bc8e51d4556f76e8111) : 正常情况下，在 Deployment 滚动更新时，当 pod 被 terminate 的时候，应用进程应该能够正确处理 `SIGTERM` 信号。如果应用不能正确处理 `SIGTERM` 信号，一般都是因为应用进程不是容器内的 1 号进程，需要调整容器的启动命令来解决问题。

[为容器提供更好的隔离：沙箱容器技术概览](https://blog.fleeto.us/post/an-overview-of-sandboxed-container/) : Docker、LXC 以及 RKT 等传统容器都是共享主机操作系统核心的，因此不能称之为真正的沙箱。这些技术的资源利用率很高，但是受攻击面积和潜在的攻击影响都很大，在多租户的云环境中，不同客户的容器会被同样的进行编排，这种威胁就尤其明显。主机操作系统在为每个容器创建虚拟的用户空间时，不同容器之间的隔离是很薄弱的，这是造成上述问题的根本原因。基于这样的现状，真正的沙箱式容器，成为很多研发工作的焦点。多数方案都对容器之间的边界进行了重新架构，以增强隔离。本文覆盖了四个项目，分别来自于 IBM、Google、Amazon 以及 OpenStack，几个方案的目标是一致的：为容器提供更强的隔离。如果你想抓住即将到来的转型机会，不妨关注一下这些新项目。

[解决在 Kubernetes 中删除 namespace 一直处于 terminating 状态的问题](https://medium.com/@newtondev/how-to-fix-kubernetes-namespace-deleting-stuck-in-terminating-state-5ed75792647e) : 作者在生产环境中删除某个 namespace 时一直处于 terminating 状态，最后发现是因为在 namespace 中通过 [Finalizers](https://kubernetes.io/docs/tasks/access-kubernetes-api/custom-resources/custom-resource-definitions/#finalizers) 调用了 pre-delete hooks，所以一直卡在那边。具体的解决办法请查阅文章。

[papers-notebook](https://github.com/dyweb/papers-notebook) : 这是一篇论文阅读笔记，其中的论文一部分来自于在上海交通大学软件学院的研究生课上需要阅读的论文，这部分会比较偏安全和虚拟化。还有一部分论文是作者感兴趣，想去了解的，这部分可能比较偏虚拟化和分布式。论文笔记希望能够记录自己在读论文的时候的想法，其中包括但不限于论文的大致 idea，实现方式，以及自己对论文的评价等等。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-07-21-082510.png)

[从CNI到OVN](https://sealyun.com/blog/2019/07/08/ovn-vni/) : 本文主要介绍了 ovn ovs 怎么与 kubernetes 擦出火花。全文主要分为两个部分，第一部分先简单介绍 CNI 的工作原理，然后开始安装 OVS 和 OVN，并测试跨主机容器的连通性。第二部分主要介绍 Openflow 和 OVN 的工作原理和相关实践。

[gRPC 服务发现与服务治理技术选型](https://juejin.im/post/5d282476f265da1b80207252) : gRPC 服务发现与服务治理,目前常见解决方案有以下两种：

+ Nginx + consul + consul-template
+ Envoy

本文粗略讲解了两种方案的优缺点，最后总结相对于 nginx，更倾向于 envoy。首先 envoy 就是为微服务而生的负载匀衡工具，grpc 健康检查是微服务中重要的一环。但是 nginx 拥有活跃的社区，说不定不久将来也会有支持 grpc 健康检查的插件。

[在 Golang 中操作 Istio 和其他 CRD](https://dwmkerr.com/manipulating-istio-and-other-custom-kubernetes-resources-in-golang/) : 本文以 Istio 为例，演示如何使用 Golang 来对 Kubernetes 中的 CRD 资源进行增删改查。

[服务监听 pod id 在 istio 中路由异常分析](http://imfox.io/2019/07/11/istio-xds-podip/) : 在 Istio 服务网格中，绝大部分场景下用户服务进程监听的 ip 是 `0.0.0.0`，这种服务可以透明加入 istio 服务网格，但是如果用户进程监听的本机具体 ip(pod ip)，这种服务就无法直接加入当前 isito 服务网格，因为在 Envoy 的 inbound cluster 配置中，`socket_address` 被写死了，值为 `127.0.0.1`。本文描述了如何尝试修复这个问题。

[使用 Kyverno 定义 Kubernetes 策略](https://blog.fleeto.us/post/introduce-kyverno/) : Kubernetes 的日常使用过程中，在对象提交给集群之前，我们会有很多机会，很多方法对资源的 Yaml 定义进行检查和处理。很多读者应该也会知道，资源提交之后，还有机会使用 Admission Controller 对资源动动手脚，这其中其实有很多可以提炼出来的标准动作，可以用统一的控制器来进行处理，Kyverno 就是这样一个工具。有了 Kyverno 的帮助，YAML 程序员可以根据条件对资源进行筛选。

## 视频推荐

---

只有大气磅礴的 BGM，才配得上史诗级的《权力的游戏》。So，只有大气磅礴的 BGM，才配得上云原生时代的操作系统。

{{< bilibili BV1ct411J7w1 >}}

## 电子书推荐

---

**CIS Kubernetes Benchmark** : 该文档提供了一份为 Kubernetes 1.13 创建安全配置的说明指南，主要用来帮助应用管理员、安全专家和平台部署人员规划在 Kubernetes 平台上开发部署应用的解决方案。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-07-21-134240.png)

获取方式：公众号后台回复：kubernetes benchmark

## 福利篇

---

[ENFI下载器](http://enfi.cloud/) : 这可能是最骚的百度网盘不限速下载器，不仅能为你提供高速下载，还能同时让你赚取收入，支持 Windows 和 MacOS 哦。来看看我赚的钱：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-07-21-101718.png)

下载速度基本满速，具体取决于你的带宽：

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-07-21-101849.jpg)

测试链接：https://pan.baidu.com/s/1JlsJsTN0JpwzA3DUzvyeIA 提取码: 7uak

[Pandownload 网页版](https://www.baiduwp.com/) : 这可能是最没有存在感的百度网盘不限速下载工具。用过 Pandownload 的同学都知道，这是一款老牌的百度网盘第三方下载器。但是它只有 Windows 版本的客户端，macOS 用户只能无奈地摇摇头。最近 Pandownload 推出了网页版本，前段时间测试了一下确实好用，只需输入百度网盘下载链接和提取码，即可高速下载，亲测可以跑满带宽。**相比之下，比下载各种客户端算是解决了 Mac 用户不支持的福利。**

还嫌不够方便？没关系，热心网友开发了一款油猴脚本，可以将百度网盘分享链接自动跳转到 PanDownload 网页版去下载。脚本地址：[百度网盘不限速直链下载](https://greasyfork.org/zh-CN/scripts/383059-pandownload%E7%BD%91%E9%A1%B5%E7%89%88-%E7%99%BE%E5%BA%A6%E7%BD%91%E7%9B%98%E4%B8%8D%E9%99%90%E9%80%9F%E7%9B%B4%E9%93%BE%E4%B8%8B%E8%BD%BD-jaeger)

[baidu-netdisk-downloaderx](https://github.com/b3log/baidu-netdisk-downloaderx) : 另一款图形界面的百度网盘不限速下载器，支持 Windows、Linux 和 Mac。又是 Golang 写的，不多介绍了，自己看吧。

![](https://jsdelivr.icloudnative.io/gh/yangchuansheng/imghosting6@main/uPic/2019-07-21-103824.jpg)
