---
title: "KubeRBS 助力 Kubernetes 自动回滚，让你晚上睡得更香"
subtitle: "浅析 KubeRBS 的原理和使用方法"
date: 2018-11-28T11:43:54+08:00
draft: false
author: 米开朗基杨
categories: cloud-native
tags: ["kubernetes"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/0_Djiqa1Rs5VBdIy4O.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

随着越来越多的企业开始大量使用 Kubernetes，持续交付越来越趋向于标准化，软件版本的更新也越来越趋向于自动化。但你有没有想过，如果新发布的版本有缺陷时该怎么办？你需要多少时间和精力来回滚到之前的版本？

人生苦短，不能把有限的精力浪费在无限的手动回滚中，最好的办法还是让系统自己决定要不要回滚，通过设定一系列指标，并对这些指标进行监控，就可以在应用不满足该指标时触发控制器对应用进行回滚。[kuberbs](https://github.com/doitintl/kuberbs)（Kubernetes Rollback System）就是对该方案的一种尝试，它会监控 Kubernetes 的 `Deployment` 资源，如果该应用的错误率（用户定义的度量标准）高于指定的阈值，就会将该 `Deployment` 回滚到之前的版本。

到目前为止，`kuberbs` 支持使用 `Stackdriver` 和 `Datadog` 的指标作为错误率指标，未来还计划增加更多对其他监控系统的支持。

kuberbs 是一个 `Operator` 控制器，使用 [CRD](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/) 来管理需要监控的 Deployment 的配置、指标和阈值。下面是一个示例：

```yaml
apiVersion: "doit-intl.com/v1"
kind: Rbs
metadata:
    name: my-rbs-example
spec:
  watchperiod: 5
  metricssource: stackdriver
  namespaces:
  - name: default
    deployments:
    - deployment:
        name: hello-kubernetes-app
        #Stack driver metric
        metric: logging.googleapis.com/user/hello-kubernetes-app-errors
        threshold: 1
    - deployment:
        name: kubernetes-app-2
        # DataDog metric
        metric: gcp.container.cpu.usage_time{*}
        threshold: 85
  - name: kube-system
    deployments:
    - deployment:
        name: kube-dns
        metric: logging.googleapis.com/user/dig
        threshold: 30
```

可以看到指标和阈值都是通过 CRD 资源 `Rbs` 来定义的，配置是通过 deployment 中的环境变量来定义的，而环境变量被存储在 kuberbs 的 `ConfigMap` 中。

```yaml
apiVersion: v1
data:
  KUBERBS_CHECKMETRICSINTERVAL: "10"
  KUBERBS_APIKEY: ""
  KUBERBS_APPKEY: ""
  KUBERBS_DEBUG: "false"
kind: ConfigMap
metadata:
  labels:
    app: kuberbs
  name: kuberbs-config
  namespace: kube-system
```

你可以通过下面的小视频看到 KubeRBS 的运行状况：

{{< bilibili BV12J411z7X6 >}}
