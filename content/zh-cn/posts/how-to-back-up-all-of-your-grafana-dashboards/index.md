---
keywords:
- grafana
- grafana-backup-tool
- provisioning
- podman
title: "Grafana 备份恢复教程"
date: 2020-12-02T12:03:00+08:00
lastmod: 2020-12-02T12:03:00+08:00
description: 通过调用 Grafana Admin API 批量导出备份 Grafana Dashboard。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocLevels: ["h2", "h3", "h4"]
tags:
- Grafana
categories: 
- monitoring
img: https://images.icloudnative.io/uPic/20201215135816.jpg
---

目前我们 k8s 集群的 `Grafana` 使用 ceph 作为持久化存储，一但我将 Grafana 的 Deployment 删除重建之后，之前的所有数据都会丢失，重建的 PV 会映射到后端存储的新位置。万幸的是，我真的手欠重建了，还没有提前备份。。。万幸个鬼啊我。

在我历经 250 分钟重建 Dashboard 之后，心里久久不能平静，一句 MMP 差点就要脱口而出。

## 1. 低级方案

再这样下去我真的要变成 250 了，这怎么能忍，立马打开 Google 研究了一把 Grafana 备份的各种骚操作，发现大部分备份方案都是通过 `shell` 脚本调用 Grafana 的 `API` 来导出各种配置。备份脚本大部分都集中在这个 gist 中：

+ [https://gist.github.com/crisidev/bd52bdcc7f029be2f295](https://gist.github.com/crisidev/bd52bdcc7f029be2f295)

我挑选出几个比较好用的，大家也可以自行挑选其他的。

### 导出脚本

```bash
#!/bin/bash

# Usage:
#
# export_grafana_dashboards.sh https://admin:REDACTED@grafana.dedevsecops.com

create_slug () {
  echo "$1" | iconv -t ascii//TRANSLIT | sed -r s/[^a-zA-Z0-9]+/-/g | sed -r s/^-+\|-+$//g | tr A-Z a-z
}

full_url=$1
username=$(echo "${full_url}" | cut -d/ -f 3 | cut -d: -f 1)
base_url=$(echo "${full_url}" | cut -d@ -f 2)
folder=$(create_slug "${username}-${base_url}")

mkdir "${folder}"
for db_uid in $(curl -s "${full_url}/api/search" | jq -r .[].uid); do
  db_json=$(curl -s "${full_url}/api/dashboards/uid/${db_uid}")
  db_slug=$(echo "${db_json}" | jq -r .meta.slug)
  db_title=$(echo "${db_json}" | jq -r .dashboard.title)
  filename="${folder}/${db_slug}.json"
  echo "Exporting \"${db_title}\" to \"${filename}\"..."
  echo "${db_json}" | jq -r . > "${filename}"
done
echo "Done"
```

这个脚本比较简单，直接导出了所有 Dashboard 的 `json` 配置，也没有标记目录信息，如果你用它导出的配置来恢复 Grafana，所有的 Dashboard 都会导入到 Grafana 的 `General` 目录下，不太友好。

### 导入脚本

**grafana-dashboard-importer.sh**

```bash
#!/bin/bash
#
# add the "-x" option to the shebang line if you want a more verbose output
#
#
OPTSPEC=":hp:t:k:"

show_help() {
cat << EOF
Usage: $0 [-p PATH] [-t TARGET_HOST] [-k API_KEY]
Script to import dashboards into Grafana
    -p      Required. Root path containing JSON exports of the dashboards you want imported.
    -t      Required. The full URL of the target host
    -k      Required. The API key to use on the target host

    -h      Display this help and exit.
EOF
}

###### Check script invocation options ######
while getopts "$OPTSPEC" optchar; do
    case "$optchar" in
        h)
            show_help
            exit
            ;;
        p)
            DASH_DIR="$OPTARG";;
        t)
            HOST="$OPTARG";;
        k)
            KEY="$OPTARG";;
        \?)
          echo "Invalid option: -$OPTARG" >&2
          exit 1
          ;;
        :)
          echo "Option -$OPTARG requires an argument." >&2
          exit 1
          ;;
    esac
done

if [ -z "$DASH_DIR" ] || [ -z "$HOST" ] || [ -z "$KEY" ]; then
    show_help
    exit 1
fi

# set some colors for status OK, FAIL and titles
SETCOLOR_SUCCESS="echo -en \\033[0;32m"
SETCOLOR_FAILURE="echo -en \\033[1;31m"
SETCOLOR_NORMAL="echo -en \\033[0;39m"
SETCOLOR_TITLE_PURPLE="echo -en \\033[0;35m" # purple

# usage log "string to log" "color option"
function log_success() {
   if [ $# -lt 1 ]; then
       ${SETCOLOR_FAILURE}
       echo "Not enough arguments for log function! Expecting 1 argument got $#"
       exit 1
   fi

   timestamp=$(date "+%Y-%m-%d %H:%M:%S %Z")

   ${SETCOLOR_SUCCESS}
   printf "[%s] $1\n" "$timestamp"
   ${SETCOLOR_NORMAL}
}

function log_failure() {
   if [ $# -lt 1 ]; then
       ${SETCOLOR_FAILURE}
       echo "Not enough arguments for log function! Expecting 1 argument got $#"
       exit 1
   fi

   timestamp=$(date "+%Y-%m-%d %H:%M:%S %Z")

   ${SETCOLOR_FAILURE}
   printf "[%s] $1\n" "$timestamp"
   ${SETCOLOR_NORMAL}
}

function log_title() {
   if [ $# -lt 1 ]; then
       ${SETCOLOR_FAILURE}
       log_failure "Not enough arguments for log function! Expecting 1 argument got $#"
       exit 1
   fi

   ${SETCOLOR_TITLE_PURPLE}
   printf "|-------------------------------------------------------------------------|\n"
   printf "|%s|\n" "$1";
   printf "|-------------------------------------------------------------------------|\n"
   ${SETCOLOR_NORMAL}
}

if [ -d "$DASH_DIR" ]; then
    DASH_LIST=$(find "$DASH_DIR" -mindepth 1 -name \*.json)
    if [ -z "$DASH_LIST" ]; then
        log_title "----------------- $DASH_DIR contains no JSON files! -----------------"
        log_failure "Directory $DASH_DIR does not appear to contain any JSON files for import. Check your path and try again."
        exit 1
    else
        FILESTOTAL=$(echo "$DASH_LIST" | wc -l)
        log_title "----------------- Starting import of $FILESTOTAL dashboards -----------------"
    fi
else
    log_title "----------------- $DASH_DIR directory not found! -----------------"
    log_failure "Directory $DASH_DIR does not exist. Check your path and try again."
    exit 1
fi

NUMSUCCESS=0
NUMFAILURE=0
COUNTER=0

for DASH_FILE in $DASH_LIST; do
    COUNTER=$((COUNTER + 1))
    echo "Import $COUNTER/$FILESTOTAL: $DASH_FILE..."
    RESULT=$(cat "$DASH_FILE" | jq '. * {overwrite: true, dashboard: {id: null}}' | curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" "$HOST"/api/dashboards/db -d @-)
    if [[ "$RESULT" == *"success"* ]]; then
        log_success "$RESULT"
        NUMSUCCESS=$((NUMSUCCESS + 1))
    else
        log_failure "$RESULT"
        NUMFAILURE=$((NUMFAILURE + 1))
    fi
done

log_title "Import complete. $NUMSUCCESS dashboards were successfully imported. $NUMFAILURE dashboard imports failed.";
log_title "------------------------------ FINISHED ---------------------------------";
```

导入脚本需要目标机器上的 Grafana 已经启动，而且需要提供管理员 API Key。登录 Grafana Web 界面，打开 API Keys：

![](https://images.icloudnative.io/uPic/20201211171659.jpg)

新建一个 API Key，角色选择 `Admin`，过期时间自己调整：

![](https://images.icloudnative.io/uPic/20201211171842.jpg)

导入方式：

```bash
$ ./grafana-dashboard-importer.sh -t http://<grafana_svc_ip>:<grafana_svc_port> -k <api_key> -p <backup folder>
```

其中 `-p` 参数指定的是之前导出的 json 所在的目录。

目前的方案痛点在于只能备份 Dashboard，不能备份其他的配置（例如，数据源、用户、秘钥等），而且没有将 Dashboard 和目录对应起来，即不支持备份 `Folder`。下面介绍一个比较完美的备份恢复方案，支持所有配置的备份恢复，简直不要太香。

## 2. 高级方案

更高级的方案已经有人写好了，项目地址是：

+ [https://github.com/ysde/grafana-backup-tool](https://github.com/ysde/grafana-backup-tool)

该备份工具支持以下几种配置：

+ 目录
+ Dashboard
+ 数据源
+ Grafana 告警频道（Alert Channel）
+ 组织（Organization）
+ 用户（User）

使用方法很简单，跑个容器就好了嘛，不过作者提供的 `Dockerfile` 我不是很满意，自己修改了点内容：

```dockerfile
FROM alpine:latest

LABEL maintainer="grafana-backup-tool Docker Maintainers https://icloudnative.io"

ENV ARCHIVE_FILE ""

RUN echo "@edge http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories; \
    apk --no-cache add python3 py3-pip py3-cffi py3-cryptography ca-certificates bash git; \
    git clone https://github.com/ysde/grafana-backup-tool /opt/grafana-backup-tool; \
    cd /opt/grafana-backup-tool; \
    pip3 --no-cache-dir install .; \
    chown -R 1337:1337 /opt/grafana-backup-tool

WORKDIR /opt/grafana-backup-tool

USER 1337
```

只有 `Dockerfile` 不行，还得通过 `CI/CD` 自动构建并推送到 `docker.io`。不要问我用什么，当然是白嫖 `GitHub Action`，`workflow` 内容如下：

```yaml
#=================================================
# https://github.com/yangchuansheng/docker-image
# Description: Build and push grafana-backup-tool Docker image
# Lisence: MIT
# Author: Ryan
# Blog: https://icloudnative.io
#=================================================

name: Build and push grafana-backup-tool Docker image

# Controls when the action will run. Triggers the workflow on push or pull request
# events but only for the master branch
on:
  push:
    branches: [ master ]
    paths: 
      - 'grafana-backup-tool/Dockerfile'
      - '.github/workflows/grafana-backup-tool.yml'
  pull_request:
    branches: [ master ]
    paths: 
      - 'grafana-backup-tool/Dockerfile'
  #watch:
    #types: started

# A workflow run is made up of one or more jobs that can run sequentially or in parallel
jobs:
  # This workflow contains a single job called "build"
  build:
    # The type of runner that the job will run on
    runs-on: ubuntu-latest

    # Steps represent a sequence of tasks that will be executed as part of the job
    steps:
    # Checks-out your repository under $GITHUB_WORKSPACE, so your job can access it
    - uses: actions/checkout@v2

    - name: Set up QEMU
      uses: docker/setup-qemu-action@v1

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v1

    - name: Login to DockerHub
      uses: docker/login-action@v1 
      with:
        username: ${{ secrets.DOCKER_USERNAME }}
        password: ${{ secrets.DOCKER_PASSWORD }}
        
    - name: Login to GitHub Package Registry
      env:
        username: ${{ github.repository_owner }}
        password: ${{ secrets.GHCR_TOKEN }}
      run: echo ${{ env.password }} | docker login ghcr.io -u ${{ env.username }} --password-stdin  

    # Runs a single command using the runners shell
    - name: Build and push Docker images to docker.io and ghcr.io
      uses: docker/build-push-action@v2
      with:
        file: 'grafana-backup-tool/Dockerfile'
        platforms: linux/386,linux/amd64,linux/arm/v6,linux/arm/v7,linux/arm64,linux/ppc64le,linux/s390x
        context: grafana-backup-tool
        push: true
        tags: |
          yangchuansheng/grafana-backup-tool:latest
          ghcr.io/yangchuansheng/grafana-backup-tool:latest

    #- name: Update repo description
      #uses: peter-evans/dockerhub-description@v2
      #env:
        #DOCKERHUB_USERNAME: ${{ secrets.DOCKER_USERNAME }}
        #DOCKERHUB_PASSWORD: ${{ secrets.DOCKER_PASSWORD }}
        #DOCKERHUB_REPOSITORY: yangchuansheng/grafana-backup-tool
        #README_FILEPATH: grafana-backup-tool/readme.md
```

这里我不打算解释 workflow 的内容，有点基础的应该都能看懂，实在不行，以后我会单独写文章解释（又可以继续水文了~）。这个 workflow 实现的功能就是自动构建各个 CPU 架构的镜像，并推送到 `docker.io` 和 `ghcr.io`，特么的真香！

就问爽不爽？

![](https://images.icloudnative.io/uPic/20201211175039.png)

你可以直接关注我的仓库：

+ [https://github.com/yangchuansheng/docker-image](https://github.com/yangchuansheng/docker-image)

构建好镜像后，就可以直接运行容器来进行备份和恢复操作了。如果你想在集群内操作，可以通过 Deployment 或 Job 来实现；如果你想在本地或 k8s 集群外操作，可以选择 docker run，我不反对，你也可以选择 docker-compose，这都没问题。但我要告诉你一个更骚的办法，可以骚到让你无法自拔。

首先需要在本地或集群外安装 Podman，如果操作系统是 `Win10`，可以考虑通过 `WSL` 来安装；如果操作系统是 Linux，那就不用说了；如果操作系统是 MacOS，请参考我的上篇文章：[在 macOS 中使用 Podman](/posts/use-podman-in-macos/)。

装好了 Podman 之后，就可以进行骚操作了，请睁大眼睛。

先编写一个 Deployment 配置清单（什么？Deployment？是的，你没听错）：

**grafana-backup-deployment.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana-backup
  labels:
    app: grafana-backup
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana-backup
  template:
    metadata:
      labels:
        app: grafana-backup
    spec:
      containers:
      - name: grafana-backup
        image: yangchuansheng/grafana-backup-tool:latest
        imagePullPolicy: IfNotPresent
        command: ["/bin/bash"]
        tty: true
        stdin: true
        env:
        - name: GRAFANA_TOKEN
          value: "eyJr0NkFBeWV1QVpMNjNYWXA3UXNOM2JWMWdZOTB2ZFoiLCJuIjoiYWRtaW4iLCJpZCI6MX0="
        - name: GRAFANA_URL
          value: "http://<grafana_ip>:<grafana_port>"
        - name: GRAFANA_ADMIN_ACCOUNT
          value: "admin"
        - name: GRAFANA_ADMIN_PASSWORD
          value: "admin"
        - name: VERIFY_SSL
          value: "False"
        volumeMounts:
        - mountPath: /opt/grafana-backup-tool
          name: data
      volumes:
      - name: data
        hostPath:
          path: /mnt/manifest/grafana/backup
```

这里面的环境变量根据自己的实际情况修改，一定不要照抄我的！

不要一脸懵逼，我先来解释一下为什么要准备这个 Deployment 配置清单，因为 Podman 可以直接通过这个配置清单运行容器，命令如下：

```bash
$ podman play kube grafana-backup-deployment.yaml
```

我第一次见到这个操作的时候也不禁连连我艹，这也可以？确实可以，不过呢，Podman 只是将其翻译一下，跑个容器而已，并不是真正运行 `Deployment`，因为它没有控制器啊，但是，还是真香！

想象一下，你可以将 k8s 集群中的配置清单拿到本地或测试机器直接跑，再也不用 k8s 集群准备一份 yaml，`docker-compose` 再准备一份 yaml 了，一份 yaml 走天下，服不服？

`docker-compose` 混到今天这个地步，也是蛮可怜的。

细心的读者应该能发现上面的配置清单有点奇怪，`Dockerfile` 也有点奇怪。Dockerfile 中没有写 `CMD` 或 `ENTRYPOINT`，Deployment 中直接将启动命令设置为 bash，这是因为在我之前测试的过程中发现该镜像启动的容器有点问题，它会陷入一个循环，备份完了之后又会继续备份，不断重复，导致备份目录下生成了一坨压缩包。目前还没找到比较好的解决办法，只能将容器的启动命令设置为 bash，等容器运行后再进入容器进行备份操作：

```bash
$ podman pod ls
POD ID        NAME                  STATUS   CREATED        # OF CONTAINERS  INFRA ID
728aec216d66  grafana-backup-pod-0  Running  3 minutes ago  2                92aa0824fe7d

$ podman ps
CONTAINER ID  IMAGE                                      COMMAND    CREATED        STATUS            PORTS   NAMES
b523fa8e4819  yangchuansheng/grafana-backup-tool:latest  /bin/bash  3 minutes ago  Up 3 minutes ago          grafana-backup-pod-0-grafana-backup
92aa0824fe7d  k8s.gcr.io/pause:3.2                                  3 minutes ago  Up 3 minutes ago          728aec216d66-infra

$ podman exec -it grafana-backup-pod-0-grafana-backup bash
bash-5.0$ grafana-backup save
...
...
########################################

backup folders at: _OUTPUT_/folders/202012111556
backup datasources at: _OUTPUT_/datasources/202012111556
backup dashboards at: _OUTPUT_/dashboards/202012111556
backup alert_channels at: _OUTPUT_/alert_channels/202012111556
backup organizations at: _OUTPUT_/organizations/202012111556
backup users at: _OUTPUT_/users/202012111556

created archive at: _OUTPUT_/202012111556.tar.gz
```

默认情况下会备份所有的组件，你也可以指定备份的组件：

```bash
$ grafana-backup save --components=<folders,dashboards,datasources,alert-channels,organizations,users>
```

比如，我只想备份 Dashboards 和 Folders：

```bash
$ grafana-backup save --components=folders,dashboards
```

当然，你也可以全部备份，恢复的时候再选择自己想恢复的组件：

```bash
$ grafana-backup restore --components=folders,dashboards
```

至此，再也不用怕 Dashboard 被改掉或删除啦。

最后提醒一下，Prometheus Operator 项目中的 Grafana 通过 [Provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/) 的方式**预导入**了一些默认的 Dashboards，这本来没有什么问题，但 `grafana-backup-tool` 工具无法忽略跳过已经存在的配置，如果恢复的过程中遇到已经存在的配置，会直接报错退出。本来这也很好解决，一般情况下到 Grafana Web 界面中删除所有的 Dashboard 就好了，但通过 [Provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/) 导入的 Dashboard 是无法删除的，这就很尴尬了。

在作者修复这个 bug 之前，要想解决这个问题，有两个办法：

第一个办法是在恢复之前将 Grafana Deployment 中关于  [Provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/) 的配置全部删除，就是这些配置：

```yaml
        volumeMounts:
        - mountPath: /etc/grafana/provisioning/datasources
          name: grafana-datasources
          readOnly: false
        - mountPath: /etc/grafana/provisioning/dashboards
          name: grafana-dashboards
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/apiserver
          name: grafana-dashboard-apiserver
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/cluster-total
          name: grafana-dashboard-cluster-total
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/controller-manager
          name: grafana-dashboard-controller-manager
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/k8s-resources-cluster
          name: grafana-dashboard-k8s-resources-cluster
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/k8s-resources-namespace
          name: grafana-dashboard-k8s-resources-namespace
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/k8s-resources-node
          name: grafana-dashboard-k8s-resources-node
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/k8s-resources-pod
          name: grafana-dashboard-k8s-resources-pod
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/k8s-resources-workload
          name: grafana-dashboard-k8s-resources-workload
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/k8s-resources-workloads-namespace
          name: grafana-dashboard-k8s-resources-workloads-namespace
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/kubelet
          name: grafana-dashboard-kubelet
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/namespace-by-pod
          name: grafana-dashboard-namespace-by-pod
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/namespace-by-workload
          name: grafana-dashboard-namespace-by-workload
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/node-cluster-rsrc-use
          name: grafana-dashboard-node-cluster-rsrc-use
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/node-rsrc-use
          name: grafana-dashboard-node-rsrc-use
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/nodes
          name: grafana-dashboard-nodes
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/persistentvolumesusage
          name: grafana-dashboard-persistentvolumesusage
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/pod-total
          name: grafana-dashboard-pod-total
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/prometheus-remote-write
          name: grafana-dashboard-prometheus-remote-write
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/prometheus
          name: grafana-dashboard-prometheus
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/proxy
          name: grafana-dashboard-proxy
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/scheduler
          name: grafana-dashboard-scheduler
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/statefulset
          name: grafana-dashboard-statefulset
          readOnly: false
        - mountPath: /grafana-dashboard-definitions/0/workload-total
          name: grafana-dashboard-workload-total
          readOnly: false
...
...
      volumes:
      - name: grafana-datasources
        secret:
          secretName: grafana-datasources
      - configMap:
          name: grafana-dashboards
        name: grafana-dashboards
      - configMap:
          name: grafana-dashboard-apiserver
        name: grafana-dashboard-apiserver
      - configMap:
          name: grafana-dashboard-cluster-total
        name: grafana-dashboard-cluster-total
      - configMap:
          name: grafana-dashboard-controller-manager
        name: grafana-dashboard-controller-manager
      - configMap:
          name: grafana-dashboard-k8s-resources-cluster
        name: grafana-dashboard-k8s-resources-cluster
      - configMap:
          name: grafana-dashboard-k8s-resources-namespace
        name: grafana-dashboard-k8s-resources-namespace
      - configMap:
          name: grafana-dashboard-k8s-resources-node
        name: grafana-dashboard-k8s-resources-node
      - configMap:
          name: grafana-dashboard-k8s-resources-pod
        name: grafana-dashboard-k8s-resources-pod
      - configMap:
          name: grafana-dashboard-k8s-resources-workload
        name: grafana-dashboard-k8s-resources-workload
      - configMap:
          name: grafana-dashboard-k8s-resources-workloads-namespace
        name: grafana-dashboard-k8s-resources-workloads-namespace
      - configMap:
          name: grafana-dashboard-kubelet
        name: grafana-dashboard-kubelet
      - configMap:
          name: grafana-dashboard-namespace-by-pod
        name: grafana-dashboard-namespace-by-pod
      - configMap:
          name: grafana-dashboard-namespace-by-workload
        name: grafana-dashboard-namespace-by-workload
      - configMap:
          name: grafana-dashboard-node-cluster-rsrc-use
        name: grafana-dashboard-node-cluster-rsrc-use
      - configMap:
          name: grafana-dashboard-node-rsrc-use
        name: grafana-dashboard-node-rsrc-use
      - configMap:
          name: grafana-dashboard-nodes
        name: grafana-dashboard-nodes
      - configMap:
          name: grafana-dashboard-persistentvolumesusage
        name: grafana-dashboard-persistentvolumesusage
      - configMap:
          name: grafana-dashboard-pod-total
        name: grafana-dashboard-pod-total
      - configMap:
          name: grafana-dashboard-prometheus-remote-write
        name: grafana-dashboard-prometheus-remote-write
      - configMap:
          name: grafana-dashboard-prometheus
        name: grafana-dashboard-prometheus
      - configMap:
          name: grafana-dashboard-proxy
        name: grafana-dashboard-proxy
      - configMap:
          name: grafana-dashboard-scheduler
        name: grafana-dashboard-scheduler
      - configMap:
          name: grafana-dashboard-statefulset
        name: grafana-dashboard-statefulset
      - configMap:
          name: grafana-dashboard-workload-total
        name: grafana-dashboard-workload-total
```

第二个办法就是删除 Prometheus Operator 自带的 Grafana，自己通过 `Helm` 或者 `manifest` 部署不使用 `Provisioning` 的 Grafana。

如果你既不想删除 Provisioning 的配置，也不想自己部署 Grafana，那只能使用上文提到的低级方案了。





