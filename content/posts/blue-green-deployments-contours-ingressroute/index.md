---
keywords:
- envoy
- contour
- kubernetes
- 蓝绿部署
- 金丝雀
- 级联
title: "Contour 学习笔记（二）：使用级联功能实现蓝绿部署和金丝雀发布"
subtitle: "IngressRoute 级联功能不完全指南"
description: 本文主要介绍了 IngressRoute 级联功能的用法，探讨了如何使用级联功能来实现蓝绿部署和金丝雀发布。
date: 2019-09-06T02:08:54+08:00
draft: false
author: 米开朗基杨
toc: true
categories: 
- cloud-native
tags:
- Envoy
- Contour
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-09-05-182130.jpg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

[上篇文章](/posts/use-envoy-as-a-kubernetes-ingress/)介绍了 Contour 分布式架构的工作原理，顺便简单介绍了下 IngressRoute 的使用方式。本文将探讨 IngressRoute 更高级的用法，其中级联功能是重点。

## IngressRoute 大入门

----

上篇文章在 `examples/example-workload` 目录下创建了一个示例应用，我们来回顾一下它的 `IngressRoute` 配置：

```yaml
apiVersion: contour.heptio.com/v1beta1
kind: IngressRoute
metadata: 
  labels:
    app: kuard
  name: kuard
  namespace: default
spec: 
  virtualhost:
    fqdn: kuard.local
  routes: 
    - match: /
      services: 
        - name: kuard
          port: 80
```

+ **virtualhost** : 该字段是 root IngressRoute，表示此域的顶级入口点。
+ **fqdn** : 该字段指定了[完整的域名](https://www.wikiwand.com/zh/%E5%AE%8C%E6%95%B4%E7%B6%B2%E5%9F%9F%E5%90%8D%E7%A8%B1)，可以通过在 HTTP 请求头中指定 `Host:` 字段来访问该服务。

这是最简单是使用方法，看起来没什么特别的，我们来稍作修改一下：

```yaml
apiVersion: contour.heptio.com/v1beta1
kind: IngressRoute
metadata: 
  labels:
    app: kuard
  name: kuard
  namespace: default
spec: 
  virtualhost:
    fqdn: kuard.local
  routes: 
    - match: /test
      services: 
        - name: kuard
          port: 80
```

将 `match: /` 改为 `match: /test`，然后重新应用新规则。这时如果你访问 url `kuard.local/test` 是不通的，因为 kuard 服务本身并没有 `/test` 这个路径，我们可以强制将路径重写为 `/`：

```yaml
apiVersion: contour.heptio.com/v1beta1
kind: IngressRoute
metadata: 
  labels:
    app: kuard
  name: kuard
  namespace: default
spec: 
  virtualhost:
    fqdn: kuard.local
  routes: 
    - match: /test
      prefixRewrite: "/"
      services: 
        - name: kuard
          port: 80
```

重新 apply 之后，再次访问 url `kuard.local/test` 就通了。

这里可以和标准的 `ingress` 对象对比一下，`IngressRoute` 的优势在于它可以分别对每个路由设置 rewrite 规则，而 Nginx Ingress Controller 只能设置全局的 rewrite 规则，因为它用的是 `annotations`。虽然可以通过其他手段来实现，但相对来说会比较麻烦。

## 级联功能介绍

----

下面我们来看看 `IngressRoute` 的级联功能，这是个非常有特色的功能，你可以通过级联多个路由规则，上层 IngressRoute 的配置被下层继承。例如，我们可以将 url 路径 `/` 的路由规则级联到其他的 `IngressRoute` 中，其他的 `IngressRoute` 可以来自不同的 namespace。

举个例子，我们可以先创建一个这样的 IngressRoute：

```yaml
$ cat > delegate-from-main.yaml <<EOF
apiVersion: contour.heptio.com/v1beta1
kind: IngressRoute
metadata:
  name: delegate-from-main
spec:
  routes:
    - match: /
      services:
        - name: kuard
          port: 80
EOF
```

```bash
$ kubectl apply -f delegate-from-main.yaml

$ kubectl get ingressroute delegate-from-main -o jsonpath='{.status.currentStatus}'
orphaned
```

该 IngressRoute 的状态为 `orphaned`，因为它没有包含一个合法的 fqdn。接下来需要创建一个 root IngressRoute 来和它进行级联：

```yaml
apiVersion: contour.heptio.com/v1beta1
kind: IngressRoute
metadata: 
  labels:
    app: kuard
  name: kuard
  namespace: default
spec: 
  virtualhost:
    fqdn: kuard.local
  routes: 
    - match: /
      delegate:
        name: delegate-from-main
        namespace: default
```

这时如果再检查 IngressRoute delegate-from-main 的状态，就会发现它从 `orphaned` 状态变成了 `valid` 状态，`kuard.local` 也能够顺利访问。

了解了级联功能的用法之后，下面就来看看它的应用场景。

+ **场景一 :** 可以使用级联功能来做蓝绿部署和灰度发布，只需要在上层 IngressRoute 中稍作修改，切换到另一个下层 IngressRoute，就可以切换流量的处理规则。
+ **场景二 :** 管理员可以利用级联功能将部分 ingress 的权限放行到其他的 `namespace` 中，在这些 namespace 中，用户可以自由更新与 root IngressRoute 级联的相关的 IngressRoute。例如，如果管理员想防止其他用户配置非法的域名或路径，可以将该部分的配置权限放到 root IngressRoute 中，其他 `namespace` 中的下层 IngressRoute 中只能配置各自的路径相关信息。

接下来主要探讨场景一。

## 蓝绿部署

----

蓝绿部署简单来讲就是在生产环境中有两套系统：一套是**正在提供服务**的系统，标记为“绿色”；另一套是**准备发布**的系统，标记为“蓝色”。两套系统都是功能完善的，并且正在运行的系统，只是系统版本和对外服务情况不同。

最初，没有任何系统，没有蓝绿之分。

然后，第一套系统开发完成，直接上线，这个过程只有一个系统，也没有蓝绿之分。

后来，开发了新版本，要用新版本替换线上的旧版本，在线上的系统之外，搭建了一个使用新版本代码的全新系统。 这时候，一共有两套系统在运行，正在对外提供服务的老系统是绿色系统，新部署的系统是蓝色系统。

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/2019-09-05-134200.jpg)

蓝色系统不对外提供服务，用来做啥？

用来做发布前测试，测试过程中发现任何问题，可以直接在蓝色系统上修改，不干扰用户正在使用的系统。（注意，两套系统没有耦合的时候才能百分百保证不干扰）

蓝色系统经过反复的测试、修改、验证，确定达到上线标准之后，直接将用户切换到蓝色系统：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/2019-09-05-134255.jpg)

切换后的一段时间内，依旧是蓝绿两套系统并存，但是用户访问的已经是蓝色系统。这段时间内观察蓝色系统（新系统）工作状态，如果出现问题，直接切换回绿色系统。

当确信对外提供服务的蓝色系统工作正常，不对外提供服务的绿色系统已经不再需要的时候，蓝色系统正式成为对外提供服务系统，成为新的绿色系统。 原先的绿色系统可以销毁，将资源释放出来，用于部署下一个蓝色系统。

通过 IngressRoute 的级联功能可以很方便地实现蓝绿部署策略，首先创建一个上层的 root IngressRoute（假设名为 `root-blog`），然后将域名 `yangcs.net/blogs` 的路由策略级联到下层的 IngressRoute（名为 `blog`）。我们会同时部署”蓝色“版本和”绿色“版本的应用，此时只有”绿色“版本接收流量。

```yaml
---
apiVersion: contour.heptio.com/v1beta1
kind: IngressRoute
metadata:
  name: root-blog
  namespace: root-ingressroute
spec:
  virtualhost:
    fqdn: yangcs.net
    tls:
      secretName: yangcs-net
  routes:
    - match: /blog
      delegate:
        name: blog
        namespace: marketing
---
apiVersion: contour.heptio.com/v1beta1
kind: IngressRoute
metadata:
  name: blog
  namespace: marketing
spec:
  routes:
    - match: /blog
      services:
        - name: green
          port: 80

---
apiVersion: contour.heptio.com/v1beta1
kind: IngressRoute
metadata:
  name: blog2
  namespace: marketing
spec:
  routes:
    - match: /blog
      services:
        - name: blue
          port: 80
```

在对蓝色版本进行测试验证之后，就可以将用户切换到蓝色应用了：

```yaml
apiVersion: contour.heptio.com/v1beta1
kind: IngressRoute
metadata:
  name: root-blog
  namespace: root-ingressroute
spec:
  virtualhost:
    fqdn: yangcs.net
    tls:
      secretName: yangcs-net
  routes:
    - match: /blog
      delegate:
        name: blog2
        namespace: marketing
```

## 金丝雀发布

----

金丝雀发布（Canary）也是一种发布策略，和国内常说的**灰度发布**是同一类策略。它和蓝绿有点像，但是它更加规避风险。你可以阶段性的进行，而不用一次性从蓝色版本切换到绿色版本。

采用金丝雀部署，你可以在生产环境的基础设施中小范围的部署新的应用代码。一旦应用签署发布，只有少数用户被路由到它，可以最大限度的降低影响。

如果没有错误发生，把剩余的 V1 版本全部升级为 V2 版本。如果有错误发生，则直接回退到老版本，发布失败。下图示范了金丝雀部署：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/2019-09-05-142053.jpg)

其实金丝雀发布的名称来源于一个典故。在 17 世纪，英国矿井工人发现，金丝雀对瓦斯这种气体特别敏感，空气中哪怕有极其微量的瓦斯，金丝雀也会停止唱歌。当瓦斯含量超过一定限度时，人类毫无察觉，但金丝雀却会毒发身亡。当时在采矿设备相对简陋的条件下，工人们每次下井都会带上一只金丝雀作为”瓦斯检测指标“，以便在危险情况下紧急撤离。映射到这里就是先发布一小部分来试探整体是否能够正常运行，如果能正常运行则进行完全部署的发布方式，目前仍然是不少成长型技术组织的主流发布方式。

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/2019-09-05-164538.jpg)

IngressRoute 可以通过分配权重来实现金丝雀发布，和蓝绿部署一样，首先创建一个上层的 root IngressRoute（名为 `root-blog`），然后将域名 `yangcs.net/blogs` 的路由策略级联到下层的 IngressRoute（名为 `blog`）。在下层的 IngressRoute 中将流量按不同权重转发到不同的后端服务。

```yaml
apiVersion: contour.heptio.com/v1beta1
kind: IngressRoute
metadata:
  name: blog
  namespace: marketing
spec:
  routes:
    - match: /blog
      services:
        - name: green
          port: 80
          weight: 5
        - name: blue
          port: 80
          weight: 95
```

如果没有错误发生，就将 green 的权重调整为 `100`，blue 的权重调整为 `0`。至此就完成了金丝雀发布。

本文主要介绍了 `IngressRoute` 级联功能的用法，探讨了如何使用级联功能来实现蓝绿部署和金丝雀发布，后面的文章将会陆续探讨其他的流量治理功能。

## 参考资料

----

+ [蓝绿部署、金丝雀发布（灰度发布）、A/B测试的准确定义](https://www.lijiaocn.com/%E6%96%B9%E6%B3%95/2018/10/23/devops-blue-green-deployment-ab-test-canary.html)

## 微信公众号

扫一扫下面的二维码关注微信公众号，在公众号中回复◉加群◉即可加入我们的云原生交流群，和孙宏亮、张馆长、阳明等大佬一起探讨云原生技术

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting6@main/uPic/wechat.gif)
