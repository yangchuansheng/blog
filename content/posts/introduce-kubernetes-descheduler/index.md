---
keywords:
- 米开朗基杨
- descheduler 
- kubernetes
- scheduler
title: "Descheduler 使用指南"
subtitle: "通过 Descheduler 来实现更高级的调度策略"
date: 2018-05-23T10:23:29Z
draft: false
author: 米开朗基杨
toc: true
categories: cloud-native
tags: ["kubernetes"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191204134049.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

`kube-scheduler` 是 Kubernetes 中负责调度的组件，它本身的调度功能已经很强大了。但由于 Kubernetes 集群非常活跃，它的状态会随时间而改变，由于各种原因，你可能需要将已经运行的 Pod 移动到其他节点：

+ 某些节点负载过高
+ 某些资源对象被添加了 [node 亲和性](https://kubernetes.io/docs/concepts/configuration/assign-pod-node/#node-affinity-beta-feature) 或 [pod （反）亲和性](https://kubernetes.io/docs/concepts/configuration/assign-pod-node/#inter-pod-affinity-and-anti-affinity-beta-feature)
+ 集群中加入了新节点

一旦 Pod 启动之后 `kube-scheduler` 便不会再尝试重新调度它。根据环境的不同，你可能会有很多需要手动调整 Pod 的分布，例如：如果集群中新加入了一个节点，那么已经运行的 Pod 并不会被分摊到这台节点上，这台节点可能只运行了少量的几个 Pod，这并不理想，对吧？

## <span id="inline-toc">1.</span> Descheduler 如何工作？

----

[Descheduler](https://github.com/kubernetes-incubator/descheduler) 会检查 Pod 的状态，并根据自定义的策略将不满足要求的 Pod 从该节点上驱逐出去。Descheduler 并不是 `kube-scheduler` 的替代品，而是要依赖于它。该项目目前放在 Kubernetes 的孵化项目中，还没准备投入生产，但经过我实验发现它的运行效果很好，而且非常稳定。那么该如何安装呢？

## <span id="inline-toc">2.</span> 部署方法

----

你可以通过 `Job` 或 `CronJob` 来运行 descheduler。我已经创建了一个镜像 `komljen/descheduler:v0.5.0-4-ga7ceb671`（包含在下面的 yaml 文件中），但由于这个项目的更新速度很快，你可以通过以下的命令创建你自己的镜像：

```bash
$ git clone https://github.com/kubernetes-incubator/descheduler
$ cd descheduler && make image
```

然后打好标签 push 到自己的镜像仓库中。

通过我创建的 chart 模板，你可以用 `Helm` 来部署 descheduler，该模板支持 RBAC 并且已经在 Kubernetes v1.9 上测试通过。

添加我的 helm 私有仓库，然后部署 descheduler：

```bash
$ helm repo add akomljen-charts \
  https://raw.githubusercontent.com/komljen/helm-charts/master/charts/
  
$ helm install --name ds \
  --namespace kube-system \
  akomljen-charts/descheduler
```

你也可以不使用 helm，通过手动部署。首先创建 serviceaccount 和 clusterrolebinding：

```bash
# Create a cluster role
$ cat << EOF| kubectl create -n kube-system -f -
apiVersion: rbac.authorization.k8s.io/v1beta1
kind: ClusterRole
metadata:
  name: descheduler
rules:
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["get", "watch", "list"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "watch", "list", "delete"]
- apiGroups: [""]
  resources: ["pods/eviction"]
  verbs: ["create"]
EOF

# Create a service account
$ kubectl create sa descheduler -n kube-system

# Bind the cluster role to the service account
$ kubectl create clusterrolebinding descheduler \
    -n kube-system \
    --clusterrole=descheduler \
    --serviceaccount=kube-system:descheduler
```

然后通过 `configmap` 创建 descheduler 策略。目前只支持四种策略：

+ [RemoveDuplicates](https://github.com/kubernetes-incubator/descheduler#removeduplicates)
+ [LowNodeUtilization](https://github.com/kubernetes-incubator/descheduler#lownodeutilization)
+ [RemovePodsViolatingInterPodAntiAffinity](https://github.com/kubernetes-incubator/descheduler#removepodsviolatinginterpodantiaffinity)
+ [RemovePodsViolatingNodeAffinity](https://github.com/kubernetes-incubator/descheduler#removepodsviolatingnodeaffinity)

默认这四种策略全部开启，你可以根据需要关闭它们。下面在 `kube-suystem` 命名空间中创建一个 configmap：

```yaml
$ cat << EOF| kubectl create -n kube-system -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: descheduler
data:
  policy.yaml: |-  
    apiVersion: descheduler/v1alpha1
    kind: DeschedulerPolicy
    strategies:
      RemoveDuplicates:
         enabled: false
      LowNodeUtilization:
         enabled: true
         params:
           nodeResourceUtilizationThresholds:
             thresholds:
               cpu: 20
               memory: 20
               pods: 20
             targetThresholds:
               cpu: 50
               memory: 50
               pods: 50
      RemovePodsViolatingInterPodAntiAffinity:
        enabled: true
      RemovePodsViolatingNodeAffinity:
        enabled: true
        params:
          nodeAffinityType:
          - requiredDuringSchedulingIgnoredDuringExecution
EOF
```

在 `kube-system` 命名空间中创建一个 CronJob：

```yaml
$ cat << EOF| kubectl create -n kube-system -f -
apiVersion: batch/v1beta1
kind: CronJob
metadata:
  name: descheduler
spec:
  schedule: "*/30 * * * *"
  jobTemplate:
    metadata:
      name: descheduler
      annotations:
        scheduler.alpha.kubernetes.io/critical-pod: "true"
    spec:
      template:
        spec:
          serviceAccountName: descheduler
          containers:
          - name: descheduler
            image: komljen/descheduler:v0.5.0-4-ga7ceb671
            volumeMounts:
            - mountPath: /policy-dir
              name: policy-volume
            command:
            - /bin/descheduler
            - --v=4
            - --max-pods-to-evict-per-node=10
            - --policy-config-file=/policy-dir/policy.yaml
          restartPolicy: "OnFailure"
          volumes:
          - name: policy-volume
            configMap:
              name: descheduler
EOF
```

```bash
$ kubectl get cronjobs -n kube-system

NAME             SCHEDULE       SUSPEND   ACTIVE    LAST SCHEDULE   AGE
descheduler      */30 * * * *   False     0         2m              32m
```

该 CroJob 每 30 分钟运行一次，当 CronJob 开始工作后，可以通过以下命令查看已经成功结束的 Pod：

```bash
$ kubectl get pods -n kube-system -a | grep Completed

descheduler-1525520700-297pq          0/1       Completed   0          1h
descheduler-1525521000-tz2ch          0/1       Completed   0          32m
descheduler-1525521300-mrw4t          0/1       Completed   0          2m
```

也可以查看这些 Pod 的日志，然后根据需要调整 descheduler 策略：

```bash
$ kubectl logs descheduler-1525521300-mrw4t -n kube-system

I0505 11:55:07.554195       1 reflector.go:202] Starting reflector *v1.Node (1h0m0s) from github.com/kubernetes-incubator/descheduler/pkg/descheduler/node/node.go:84
I0505 11:55:07.554255       1 reflector.go:240] Listing and watching *v1.Node from github.com/kubernetes-incubator/descheduler/pkg/descheduler/node/node.go:84
I0505 11:55:07.767903       1 lownodeutilization.go:147] Node "ip-10-4-63-172.eu-west-1.compute.internal" is appropriately utilized with usage: api.ResourceThresholds{"cpu":41.5, "memory":1.3635487207675927, "pods":8.181818181818182}
I0505 11:55:07.767942       1 lownodeutilization.go:149] allPods:9, nonRemovablePods:9, bePods:0, bPods:0, gPods:0
I0505 11:55:07.768141       1 lownodeutilization.go:144] Node "ip-10-4-36-223.eu-west-1.compute.internal" is over utilized with usage: api.ResourceThresholds{"cpu":48.75, "memory":61.05259502942694, "pods":30}
I0505 11:55:07.768156       1 lownodeutilization.go:149] allPods:33, nonRemovablePods:12, bePods:1, bPods:19, gPods:1
I0505 11:55:07.768376       1 lownodeutilization.go:144] Node "ip-10-4-41-14.eu-west-1.compute.internal" is over utilized with usage: api.ResourceThresholds{"cpu":39.125, "memory":98.19259268881142, "pods":33.63636363636363}
I0505 11:55:07.768390       1 lownodeutilization.go:149] allPods:37, nonRemovablePods:8, bePods:0, bPods:29, gPods:0
I0505 11:55:07.768538       1 lownodeutilization.go:147] Node "ip-10-4-34-29.eu-west-1.compute.internal" is appropriately utilized with usage: api.ResourceThresholds{"memory":43.19826999287199, "pods":30.90909090909091, "cpu":35.25}
I0505 11:55:07.768552       1 lownodeutilization.go:149] allPods:34, nonRemovablePods:11, bePods:8, bPods:15, gPods:0
I0505 11:55:07.768556       1 lownodeutilization.go:65] Criteria for a node under utilization: CPU: 20, Mem: 20, Pods: 20
I0505 11:55:07.768571       1 lownodeutilization.go:69] No node is underutilized, nothing to do here, you might tune your thersholds further
I0505 11:55:07.768576       1 pod_antiaffinity.go:45] Processing node: "ip-10-4-63-172.eu-west-1.compute.internal"
I0505 11:55:07.779313       1 pod_antiaffinity.go:45] Processing node: "ip-10-4-36-223.eu-west-1.compute.internal"
I0505 11:55:07.796766       1 pod_antiaffinity.go:45] Processing node: "ip-10-4-41-14.eu-west-1.compute.internal"
I0505 11:55:07.813303       1 pod_antiaffinity.go:45] Processing node: "ip-10-4-34-29.eu-west-1.compute.internal"
I0505 11:55:07.829109       1 node_affinity.go:40] Executing for nodeAffinityType: requiredDuringSchedulingIgnoredDuringExecution
I0505 11:55:07.829133       1 node_affinity.go:45] Processing node: "ip-10-4-63-172.eu-west-1.compute.internal"
I0505 11:55:07.840416       1 node_affinity.go:45] Processing node: "ip-10-4-36-223.eu-west-1.compute.internal"
I0505 11:55:07.856735       1 node_affinity.go:45] Processing node: "ip-10-4-41-14.eu-west-1.compute.internal"
I0505 11:55:07.945566       1 request.go:480] Throttling request took 88.738917ms, request: GET:https://100.64.0.1:443/api/v1/pods?fieldSelector=spec.nodeName%3Dip-10-4-41-14.eu-west-1.compute.internal%2Cstatus.phase%21%3DFailed%2Cstatus.phase%21%3DSucceeded
I0505 11:55:07.972702       1 node_affinity.go:45] Processing node: "ip-10-4-34-29.eu-west-1.compute.internal"
I0505 11:55:08.145559       1 request.go:480] Throttling request took 172.751657ms, request: GET:https://100.64.0.1:443/api/v1/pods?fieldSelector=spec.nodeName%3Dip-10-4-34-29.eu-west-1.compute.internal%2Cstatus.phase%21%3DFailed%2Cstatus.phase%21%3DSucceeded
I0505 11:55:08.160964       1 node_affinity.go:72] Evicted 0 pods
```

哇哦，现在你的集群中已经运行了一个 descheduler！

## <span id="inline-toc">3.</span> 总结

----

Kubernetes 的默认调度器已经做的很好，但由于集群处于不断变化的状态中，某些 Pod 可能运行在错误的节点上，或者你想要均衡集群资源的分配，这时候就需要 descheduler 来帮助你将某些节点上的 Pod 驱逐到正确的节点上去。我很期待正式版的发布！

## <span id="inline-toc">4.</span> 原文链接

----

+ [Meet a Kubernetes Descheduler](https://akomljen.com/meet-a-kubernetes-descheduler/)

