---
keywords:
- 米开朗基杨 
- podman
- envoy
- conmon
- cgroup
title: "Podman 使用指南"
subtitle: "使用 Podman 部署 hugo 静态博客"
description: 本文介绍了 podman 相对于 docker 的优势，并成功将hugo静态博客从 docker 迁移到 podman。
date: 2019-10-18T00:16:16-04:00
draft: false
author: 米开朗基杨
toc: true
categories:
- cloud-native
tags:
- Podman
- Envoy
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/2020-04-24-2019-10-18-072928.webp"
---

> **郑重声明**：本文不是 Podman 的入门篇，入门请阅读这篇文章：[再见 Docker，是时候拥抱下一代容器工具了](https://mp.weixin.qq.com/s/MDi4RB5V60EGl3ii9usD0Q)

`Podman` 原来是 [CRI-O](https://github.com/kubernetes-incubator/cri-o) 项目的一部分，后来被分离成一个单独的项目叫 [libpod](https://github.com/containers/libpod)。Podman 的使用体验和 `Docker` 类似，不同的是 Podman 没有 daemon。以前使用 Docker CLI 的时候，Docker CLI 会通过 gRPC API 去跟 Docker Engine 说「我要启动一个容器」，然后 Docker Engine 才会通过 OCI Container runtime（默认是 `runc`）来启动一个容器。这就意味着容器的进程不可能是 Docker CLI 的子进程，而是 Docker Engine 的子进程。

Podman 比较简单粗暴，它不使用 Daemon，而是直接通过 OCI runtime（默认也是 `runc`）来启动容器，所以容器的进程是 podman 的子进程。这比较像 Linux 的 `fork/exec` 模型，而 Docker 采用的是 `C/S`（客户端/服务器）模型。与 C/S 模型相比，`fork/exec` 模型有很多优势，比如：

+ 系统管理员可以知道某个容器进程到底是谁启动的。
+ 如果利用 `cgroup` 对 podman 做一些限制，那么所有创建的容器都会被限制。
+ **SD_NOTIFY** : 如果将 podman 命令放入 `systemd` 单元文件中，容器进程可以通过 podman 返回通知，表明服务已准备好接收任务。
+ **socket 激活** : 可以将连接的 `socket` 从 systemd 传递到 podman，并传递到容器进程以便使用它们。

废话不多说，下面我们直接进入实战环节，本文将手把手教你如何用 podman 来部署静态博客，并通过 Sidecar 模式将博客所在的容器加入到 `Envoy` mesh 之中。

## 方案架构

----

我的部署方案涉及到两层 Envoy：

+ 首先会有一个前端代理单独跑一个容器。前端代理的工作是给访问者提供一个入口，将来自外部的访问请求转发到具体的后端服务。
+ 其次，博客静态页面由 nginx 提供，同时以 Sidecar 模式运行一个 `Envoy` 容器，它与 nginx 共享 `network nemspace`。
+ 所有的 Envoy 形成一个 mesh，然后在他们之间共享路由信息。

我之前写过一篇用 `Docker` 部署 hugo 静态博客并配置 `HTTPS` 证书的文章，本文采用的是相同的方案，只是将 docker 换成了 podman，具体参考[为 Envoy 开启 TLS 验证实战](/posts/setting-up-ssl-in-envoy-practice/)。

## 部署 hugo 和 sidecar proxy

----

我的博客是通过 hugo 生成的静态页面，可以将其放到 `nginx` 中，其他静态网站工具类似（比如 hexo 等），都可以这么做。现在我要做的是**让 nginx 容器和 envoy 容器共享同一个 network namespace，同时还要让前端代理能够通过域名来进行服务发现**。以前用 docker 很简单，直接用 docker-compose 就搞定了，podman 就比较麻烦了，它又不能用 `docker-compose`，服务发现看来是搞不定了。

好不容易在 Github 上发现了一个项目叫 [podman-compose](https://github.com/containers/podman-compose)，以为有救了，试用了一下发现还是不行，podman-compose 创建容器时会将字段 `network_mode: "service:hugo"` 转化为 podman CLI 的参数 `--network service:hugo`（真脑残），导致容器创建失败，报错信息为 `CNI network "service:hugo" not found`。将该字段值改为 `network_mode: "container:hugo_hugo_1"` 可以启动成功，然而又引来了另一个问题：podman-compose 的做法是为每一个 `service` 创建一个 `pod`（pod 的名字为 docker-compose.yml 所在目录名称），然后往这个 pod 中添加容器。我总不能将前端代理和后端服务塞进同一个 pod 中吧？只能分别为前端代理和 hugo 创建两个目录，然后分别创建 docker-compose.yml。这个问题解决了，下个问题又来了，podman-compose 不支持通过 service name 进行服务发现，扒了一圈发现支持 `links`（其实就是加个参数 `--add-host`），然而 links 只在同一个 pod 下才生效，我都拆分成两个 pod 了，links 鞭长莫及啊，还是没什么卵用。我能怎么办，现在唯一的办法就是手撸命令行了。

上面我提到了一个新名词叫 `pod`，这里花 30 秒的时间给大家简单介绍一下，如果你是 `Kubernetes` 的重度使用者，对这个词应该不陌生，但这里确实说的是 podman 的 pod，意思还是一样的，先创建一个 `pause` 容器，然后再创建业务容器，业务容器共享 `pause` 容器的各种 linux namespace，因此同一个 pod 中的容器之间可以通过 localhost 轻松地相互通信。不仅如此，podman 还可以将 pod 导出为 Kubernetes 的声明式资源定义，举个栗子：

先创建一个 pod：

```bash
$ podman pod create --name hugo
```

查看 pod：

```bash
$ podman pod ls

POD ID         NAME   STATUS    CREATED         # OF CONTAINERS   INFRA ID
88226423c4d2   hugo   Running   2 minutes ago   2                 7e030ef2e7ca
```

在这个 pod 中启动一个 hugo 容器：

```bash
$ podman run -d --pod hugo nginx:alpine
```

查看容器：

```bash
$ podman ps

CONTAINER ID  IMAGE                           COMMAND               CREATED        STATUS            PORTS  NAMES
3c91cab1e99d  docker.io/library/nginx:alpine  nginx -g daemon o...  3 minutes ago  Up 3 minutes ago         reverent_kirch
```

查看所有容器，包括 pause 容器：

```bash
$ podman ps -a

CONTAINER ID  IMAGE                           COMMAND               CREATED        STATUS            PORTS  NAMES
3c91cab1e99d  docker.io/library/nginx:alpine  nginx -g daemon o...  4 minutes ago  Up 4 minutes ago         reverent_kirch
7e030ef2e7ca  k8s.gcr.io/pause:3.1                                  6 minutes ago  Up 6 minutes ago         88226423c4d2-infra
```

查看所有容器，包括 pause 容器，并显示容器所属的 pod id：

```bash
$ podman ps -ap

CONTAINER ID  IMAGE                           COMMAND               CREATED        STATUS            PORTS  NAMES               POD
3c91cab1e99d  docker.io/library/nginx:alpine  nginx -g daemon o...  4 minutes ago  Up 4 minutes ago         reverent_kirch      88226423c4d2
7e030ef2e7ca  k8s.gcr.io/pause:3.1                                  6 minutes ago  Up 6 minutes ago         88226423c4d2-infra  88226423c4d2
```

查看 pod 中进程的资源使用情况：

```bash
$ podman pod top hugo

USER    PID   PPID   %CPU    ELAPSED           TTY   TIME   COMMAND
root    1     0      0.000   8m5.045493912s    ?     0s     nginx: master process nginx -g daemon off;
nginx   6     1      0.000   8m5.045600833s    ?     0s     nginx: worker process
nginx   7     1      0.000   8m5.045638877s    ?     0s     nginx: worker process
0       1     0      0.000   9m41.051039367s   ?     0s     /pause
```

将 pod 导出为声明式部署清单：

```bash
$ podman generate kube hugo > hugo.yaml
```

查看部署清单内容：

```bash
$ cat hugo.yaml

# Generation of Kubernetes YAML is still under development!
#
# Save the output of this file and use kubectl create -f to import
# it into Kubernetes.
#
# Created with podman-1.0.2-dev
apiVersion: v1
kind: Pod
metadata:
  creationTimestamp: 2019-10-17T04:17:40Z
  labels:
    app: hugo
  name: hugo
spec:
  containers:
  - command:
    - nginx
    - -g
    - daemon off;
    env:
    - name: PATH
      value: /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
    - name: TERM
      value: xterm
    - name: HOSTNAME
    - name: container
      value: podman
    - name: NGINX_VERSION
      value: 1.17.4
    - name: NJS_VERSION
      value: 0.3.5
    - name: PKG_RELEASE
      value: "1"
    image: docker.io/library/nginx:alpine
    name: reverentkirch
    resources: {}
    securityContext:
      allowPrivilegeEscalation: true
      capabilities: {}
      privileged: false
      readOnlyRootFilesystem: false
    workingDir: /
status: {}
```

怎么样，是不是有种熟悉的味道？这是一个兼容 kubernetes 的 pod 定义，你可以直接通过 `kubectl apply -f hugo.yaml` 将其部署在 Kubernetes 集群中，也可以直接通过 podman 部署，步骤大致是这样的：

先删除之前创建的 pod：

```bash
$ podman pod rm -f hugo
```

然后通过部署清单创建 pod：

```bash
$ podman play kube hugo.yaml
```

回到之前的问题，如果通过声明式定义来创建 pod，还是无法解决服务发现的问题，除非换个支持静态 IP 的 `CNI` 插件，而支持静态 IP 的这些 CNI 插件又需要 etcd 作为数据库，我就这么点资源，可不想再加个 etcd，还是手撸命令行吧。

首先我要创建一个 hugo 容器，并指定容器的 IP：

```bash
$ podman run -d --name hugo \
  --ip=10.88.0.10 \
  -v /opt/hugo/public:/usr/share/nginx/html \
  -v /etc/localtime:/etc/localtime \
  nginx:alpine
```

再创建一个 envoy 容器，与 hugo 容器共享 network namespace：

```bash
$ podman run -d --name hugo-envoy \
  -v /opt/hugo/service-envoy.yaml:/etc/envoy/envoy.yaml \
  -v /etc/localtime:/etc/localtime \
  --net=container:hugo envoyproxy/envoy-alpine:latest
```

service-envoy.yaml 的内容如下：

```yaml
static_resources:
  listeners:
  - address:
      socket_address:
        address: 0.0.0.0
        port_value: 8080
    filter_chains:
    - filters:
      - name: envoy.http_connection_manager
        config:
          codec_type: auto
          stat_prefix: ingress_http
          access_log:
          - name: envoy.file_access_log
            config:
              path: "/dev/stdout"
          route_config:
            name: local_route
            virtual_hosts:
            - name: service
              domains:
              - "*"
              routes:
              - match:
                  prefix: "/"
                route:
                  cluster: local_service
          http_filters:
          - name: envoy.router
            config: {}
  clusters:
  - name: local_service
    connect_timeout: 0.25s
    type: strict_dns
    lb_policy: round_robin
    hosts:
    - socket_address:
        address: 127.0.0.1
        port_value: 80
admin:
  access_log_path: "/dev/null"
  address:
    socket_address:
      address: 0.0.0.0
      port_value: 8081
```

具体的含义请参考[为 Envoy 开启 TLS 验证实战](/posts/setting-up-ssl-in-envoy-practice/)。

本文开头提到 podman 创建的容器是 podman 的子进程，这个表述可能比较模糊，实际上 podman 由两部分组成，一个是 podman CLI，还有一个是 container runtime，container runtime 由 `conmon` 来负责，主要包括监控、日志、TTY 分配以及类似 `out-of-memory` 情况的杂事。也就是说，conmon 是所有容器的父进程。

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/2019-10-17-064233.png)

conmon 需要去做所有 `systemd` 不做或者不想做的事情。即使 CRI-O 不直接使用 systemd 来管理容器，它也将容器分配到 sytemd 兼容的 `cgroup` 中，这样常规的 systemd 工具比如 `systemctl` 就可以看见容器资源使用情况了。

```bash
$ podman ps

CONTAINER ID  IMAGE                                     COMMAND               CREATED             STATUS                 PORTS  NAMES
42762bf7d37a  docker.io/envoyproxy/envoy-alpine:latest  /docker-entrypoin...  About a minute ago  Up About a minute ago         hugo-envoy
f0204fdc9524  docker.io/library/nginx:alpine            nginx -g daemon o...  2 minutes ago       Up 2 minutes ago              hugo
```

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/2019-10-17-%E6%88%AA%E5%B1%8F2019-10-17%E4%B8%8B%E5%8D%882.18.30.png)

对 cgroup 不熟的同学，可以参考下面这个系列：

+ [深入理解 Linux Cgroup 系列（一）：基本概念](/posts/understanding-cgroups-part-1-basics/)
+ [深入理解 Linux Cgroup 系列（二）：玩转 CPU](/posts/understanding-cgroups-part-2-cpu/)
+ [深入理解 Linux Cgroup 系列（三）：内存](/posts/understanding-cgroups-part-3-memory/)
+ [深入理解 Kubernetes 资源限制：CPU](/posts/understanding-resource-limits-in-kubernetes-cpu-time/)
+ [Kubernetes 内存资源限制实战](/posts/memory-limit-of-pod-and-oom-killer/)
+ [Kubernetes Pod 驱逐详解](/posts/kubernetes-eviction/)

零基础的同学建议按照上面的目录从上到下打怪升级，祝你好运！

## 部署前端代理

----

这个很简单，直接创建容器就好了：

```bash
$ podman run -d --name front-envoy \
--add-host=hugo:10.88.0.10 \
-v /opt/hugo/front-envoy.yaml:/etc/envoy/envoy.yaml \
-v /etc/localtime:/etc/localtime \
-v /root/.acme.sh/yangcs.net:/root/.acme.sh/yangcs.net \
--net host envoyproxy/envoy
```

由于没办法自动服务发现，需要通过参数 `--add-host` 手动添加 hosts 到容器中。envoy 的配置文件中是通过域名来添加 cluster 的，front-envoy.yaml 内容如下：

```yaml
static_resources:
  listeners:
  - address:
      socket_address:
        address: 0.0.0.0
        port_value: 80
    filter_chains:
    - filters:
      - name: envoy.http_connection_manager
        config:
          codec_type: auto
          stat_prefix: ingress_http
          access_log:
          - name: envoy.file_access_log
            config:
              path: "/dev/stdout"
          route_config:
            virtual_hosts:
            - name: backend
              domains:
              - "*"
              routes:
              - match:
                  prefix: "/"
                redirect:
                  https_redirect: true
                  response_code: "FOUND"
          http_filters:
          - name: envoy.router
            config: {}
  - address:
      socket_address:
        address: 0.0.0.0
        port_value: 443
    filter_chains:
    - filter_chain_match:
        server_names: ["yangcs.net", "icloudnative.io"]
      tls_context:
        common_tls_context:
          alpn_protocols: h2
          tls_params:
            tls_maximum_protocol_version: TLSv1_3
          tls_certificates:
            - certificate_chain:
                filename: "/root/.acme.sh/yangcs.net/fullchain.cer"
              private_key:
                filename: "/root/.acme.sh/yangcs.net/yangcs.net.key"
      filters:
      - name: envoy.http_connection_manager
        config:
          codec_type: auto
          stat_prefix: ingress_http
          route_config:
            name: local_route
            virtual_hosts:
            - name: backend
              domains:
              - "yangcs.net"
              - "icloudnative.io"
              routes:
              - match:
                  prefix: "/admin"
                route:
                  prefix_rewrite: "/"
                  cluster: envoy-ui
              - match:
                  prefix: "/"
                route:
                  cluster: hugo
                  response_headers_to_add:
                    - header:
                        key: "Strict-Transport-Security"
                        value: "max-age=63072000; includeSubDomains; preload"
          http_filters:
          - name: envoy.router
            config: {}
  clusters:
  - name: hugo
    connect_timeout: 0.25s
    type: strict_dns
    lb_policy: round_robin
    http2_protocol_options: {}
    hosts:
    - socket_address:
        address: hugo
        port_value: 8080
admin:
  access_log_path: "/dev/null"
  address:
    socket_address:
      address: 0.0.0.0
      port_value: 8001
```

具体的含义请参考[为 Envoy 开启 TLS 验证实战](/posts/setting-up-ssl-in-envoy-practice/)。

现在就可以通过公网域名访问博客网站了，如果后续还有其他应用，都可以参考第二节的步骤，然后重新创建前端代理，添加 `--add-host `参数。以我的网站 [https://icloudnative.io](https://icloudnative.io) 为例：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/2019-10-17-%E6%88%AA%E5%B1%8F2019-10-17%E4%B8%8B%E5%8D%883.07.30.png)

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/2019-10-17-%E6%88%AA%E5%B1%8F2019-10-17%E4%B8%8B%E5%8D%883.19.21.png)

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/2019-10-17-072659.png)

我好像透露了一些什么不得了的东西，就此打住，你也不要说，你也不要问。

## 开机自启

----

由于 podman 不再使用 daemon 管理服务，`--restart` 参数被废弃了，要想实现开机自动启动容器，只能通过 systemd 来管理了。先创建 systemd 服务配置文件：

```bash
$ vim /etc/systemd/system/hugo_container.service

[Unit]
Description=Podman Hugo Service
After=network.target
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/podman start -a hugo
ExecStop=/usr/bin/podman stop -t 10 hugo
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
$ vim /etc/systemd/system/hugo-envoy_container.service

[Unit]
Description=Podman Hugo Sidecar Service
After=network.target
After=network-online.target
After=hugo_container.service

[Service]
Type=simple
ExecStart=/usr/bin/podman start -a hugo-envoy
ExecStop=/usr/bin/podman stop -t 10 hugo-envoy
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
$ vim /etc/systemd/system/front-envoy_container.service

[Unit]
Description=Podman Front Envoy Service
After=network.target
After=network-online.target
After=hugo_container.service hugo-envoy_container.service

[Service]
Type=simple
ExecStart=/usr/bin/podman start -a front-envoy
ExecStop=/usr/bin/podman stop -t 10 front-envoy
Restart=always

[Install]
WantedBy=multi-user.target
```

然后将之前停止之前创建的容器，**注意：是停止，不是删除！**

```bash
$ podman stop $(podman ps -aq)
```

最后通过 systemd 服务启动这些容器。

```bash
$ systemctl start hugo_container
$ systemctl start hugo-envoy_container
$ systemctl start front-envoy_container
```

设置开机自启。

```bash
$ systemctl enable hugo_container
$ systemctl enable hugo-envoy_container
$ systemctl enable front-envoy_container
```

之后每次系统重启后 systemd 都会自动启动这个服务所对应的容器。

## 总结

----

以上就是将博客从 Docker 迁移到 Podman 的所有变更操作，总体看下来还是比较曲折，因为 Podman 是为 Kubernetes 而设计的，而我要求太高了，就一个资源紧张的 vps，即不想上 `Kubernetes`，也不想上 `etcd`，既想搞 sidecar，又想搞自动服务发现，我能怎么办，我也很绝望啊，这个事怨不得 podman，为了防止在大家心里留下 **“podman 不好用”** 的印象，特此声明一下。啥都不想要，只能自己想办法了~~
