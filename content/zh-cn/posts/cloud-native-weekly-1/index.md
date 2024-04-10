---
keywords:
- 米开朗基杨
- kubernetes
- cloud-native
title: "云原生周报第 1 期"
subtitle: "每周最新云原生项目与博客推荐"
description: 每周最新云原生项目与博客推荐
date: 2019-06-27T16:12:50+08:00
draft: false
author: 米开朗基杨
toc: true
categories: cloud-native
tags: ["kubernetes"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-06-27-D2pZj7NX0AAMG97.jpg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

## 前言

----

云原生不但可以很好的支持互联网应用，也在深刻影响着新的计算架构、新的智能数据应用。以容器、服务网格、微服务、Serverless 为代表的云原生技术，带来一种全新的方式来构建应用。笔者是一名云原生狂热信徒，长期以来我都不知道该怎么整理自己的收藏夹。最近想到，为了让大家能够掌握云原生最新资讯，我决定把我的收藏夹共享出来，大家一起嗨~~

## 开源项目推荐

----

[kubeasy](https://github.com/marcenacp/kubeasy) : 用来管理 Kubernetes 集群的 CLI 工具，提供了沉浸式的命令行界面

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/1_IXbGxeofG5r4FUOUE0k9_g.gif)

[kui](https://github.com/IBM/kui) : 也是一个 CLI 工具，与 kubeasy 目的相同，都是希望使用者能获取更多的集群信息，然后利用这些信息来做很多事。不同的是，kui 把网页内嵌到终端里了，你可以通过鼠标点击来操作。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/1_YyWzawiJBmvrxfXnegJTzA.gif)

[Configurable HPA](https://github.com/postmates/configurable-hpa) : 通过 `CRD` 来扩展 Kubernetes 原生 HPA 的功能，提供了更多可选参数。例如，原生的 HPA 不支持自定义弹性伸缩的速度，通过 CHPA 即可自定义。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/2019-06-24-060828.jpg)

[k8s-sidecar-injector](github.com/tumblr/k8s-sidecar-injector) : Tumblr（汤不热，你懂得）开源的一款自动注入 Sidecar 的工具。你只需要在 Pod 的 annotaion 中加上 `injector.tumblr.com/request=sidecar-prod-v1` 字段，就会自动在业务 Pod 中注入 `sidecar-prod-v1` 中定义的 Sidecar 容器、环境变量和存储卷。

[dns-discovery](https://github.com/istio-ecosystem/dns-discovery) : 默认情况下，Istio 服务网格内的 Pod 无法与集群外的 URL 通信，如果想与集群外的 URL 通信，你必须显式地为每个 URL 创建相应的 [Service Entry](https://istio.io/docs/reference/config/networking/v1alpha3/service-entry/)。dns-discovery 是一个运行在 Kubernetes DNS 前面的代理，它会监控集群内所有的 DNS 查询，然后为监控到的集群外 URL 自动创建 Service Entry。

[k-vswitch](https://github.com/k-vswitch/k-vswitch) : 基于 Open vSwitch 的高性能 Kubernetes CNI 网络插件，网络协议支持 `GRE` 和 `VxLAN`，支持 Network Policy。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/2019-06-24-064500.jpg)

[krontab](https://github.com/jacobtomlinson/krontab) : 如果你想在 Kubernetes 中创建一个 Cronjob，你得先编写一个 YAML 文件，然后再 apply 一下。krontab 可以让你免去这些繁琐的步骤，它类似于 Linux 系统中的 `crontab`，当你想创建一个 Cronjob 时，直接在终端输入命令 `krontab -e` 就会使用 vim 打开一个虚拟的文件，写好定时任务（语法和 crontab 一样）后输入 `:wq` 退出就会立即创建一个 Cronjob。是不是很爽？？

[Autocert](https://github.com/smallstep/autocert) : 一个 Kubernetes 附加组件，可自动向容器中注入 TLS/HTTPS 证书，加密容器之间的通信流量。

## 博客推荐

----

1. [Kubernetes Pod 驱逐详解](/posts/kubernetes-eviction/) : 本文详细分析了在什么情况下 Pod 会被 Kubernetes 从运行节点中驱逐，以及不同 QoS 等级 Pod 的驱逐顺序。

2. [基于 RabbitMQ 队列大小进行弹性伸缩](https://itnext.io/kubernetes-workers-autoscaling-based-on-rabbitmq-queue-size-cb0803193cdf) : 本文示范了如何使用 Custom Metrics，使得在 `RabbitMQ` 有太多未被消费的 Job 时，可以自动增加副本数量，让 Job 可以马上被处理。 

3. [Kubernetes Operator 最佳实践](https://blog.openshift.com/kubernetes-operators-best-practices/) : Openshift 写的一篇关于开发 `Operator` 的最佳守则，从 Operator 的主要精髓介绍，如 Operator 会 watch Master API 的事件，当相关事件发生后便会执行对应的动作。接着便提到了开发人员应该如何创建 Watches，Reconciliation Cycle，怎么对资源进行验证等。有想要开发 operator 的同学千万不要错过哦！

4. [使 Kubernetes 的 Service IP 路由可达](https://www.projectcalico.org/kubernetes-service-ip-route-advertisement/) : Calico 官方博客，介绍了 Calico `v3.4` 引进的新特性。之前 calico 只能传播 Pod IP 的路由，引入该特性之后，calico 也能传播 Service IP 的路由了，同时还支持 [ECMP](https://www.wikiwand.com/zh/%E7%AD%89%E5%83%B9%E5%A4%9A%E8%B7%AF%E5%BE%91%E8%B7%AF%E7%94%B1) 三层负载均衡策略。这个特性使得打通集群内外之间的流量更加容易。

5. [如何重启高可用 Kubernetes 集群](https://medium.com/@liejuntao001/how-to-reboot-highly-available-kubernetes-cluster-5a9df4daecf) : 该篇文章介绍了如何安全地重启高可用 Kubernetes 集群，以及重启后对集群中服务造成的影响。

6. [如何使用 Istio 和 Kubernetes 进行金丝雀部署](https://www.digitalocean.com/community/tutorials/how-to-do-canary-deployments-with-istio-and-kubernetes) : 本文主要讲述了如何通过 Kubernetes 和 Istio 来进行金丝雀部署，包括应用的打包、部署和流量拆分。

7. [在 Kubernetes 上通过 InfluxDB 和 Grafana 来收集 Twitter 统计信息](https://opensource.com/article/19/2/deploy-influxdb-grafana-kubernetes) : 本文主要介绍了如何在 Kubernetes 上部署 InfluxDB 和 Grafana，通过 python 模块来收集你的 Twitter 账号统计信息，然后存储到 InfluxDB 中，最后通过 Grafana Dashboard 展现出来。 

8. 内核集成容器特性的年度进展 : 本视频主要介绍了近几年尝试在内核中直接集成容器特性的工作进展，并通过代码来展示其中的大部分原理。

{{< bilibili BV1Dx411X7oj >}}

## 电子书推荐

----

+ **Docker and Kubernetes for Java Developers: Scale, deploy, and monitor multi-container applications** : 本书主要内容是如何使用 Docker 和 Kubernetes 来构建、部署和管理 Java 应用。

获取方式：公众号后台回复：java

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/2019-06-24-080754.jpg)

+ [learning-k8s-source-code](https://github.com/Kevin-fqh/learning-k8s-source-code) : k8s、docker源码分析笔记，记录源码学习和一些原理译文，力从应用出发，再去深究某个概念的原理。以 apiserver、controller-manager、scheduler、kubelet、proxy 和 kubectl 6个命令为主线。

+ **Cloud Native DevOps with Kubernetes** : 本书向开发人员和运维人员展示了如何在云原生环境中将行业标准 DevOps 实践应用于 Kubernetes。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/2019-06-24-103854.jpg)

获取方式：公众号后台回复：devops

+ **The Gorilla Guide to Kubernetes in the Enterprise** : Gorilla 出版的一本小册子，用来指导如何在生产环境中部署和维护 Kubernetes，包括如何部署高可用控制平面，如何集成监控工具以及如何对集群进行在线升级。

![](https://cdn.jsdelivr.net/gh/yangchuansheng/imghosting6@main/uPic/2019-06-27-2019-06-27-055136.2.jpg)

获取方式：公众号后台回复：gorilla
