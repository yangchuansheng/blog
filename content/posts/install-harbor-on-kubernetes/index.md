---
keywords:
- harbor
- kubernetes
- containerd
- harbor 安装
- harbor 部署
title: "在 Kubernetes 中部署高可用 Harbor 镜像仓库"
date: 2020-12-30T00:31:35+08:00
lastmod: 2020-12-30T00:31:35+08:00
description: 本文介绍了如何使用 Helm 来部署高可用 Harbor 镜像仓库，以及如何为 Containerd 配置私有镜像仓库。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- Harbor
- Kubernetes
categories: 
- cloud-native
img: https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@second/img/20210107115844.jpg
---

**系统环境：**

- kubernetes 版本：1.18.10
- Harbor Chart 版本：1.5.2
- Harbor 版本：2.1.2
- Helm 版本：3.3.4
- 持久化存储驱动：Ceph RBD

## 1. Harbor 简介

### 简介

Harbor 是一个开放源代码容器镜像注册表，可通过基于角色权限的访问控制来管理镜像，还能扫描镜像中的漏洞并将映像签名为受信任。Harbor 是 CNCF 孵化项目，可提供合规性，性能和互操作性，以帮助跨 Kubernetes 和 Docker 等云原生计算平台持续，安全地管理镜像。

### 特性

- 管理：多租户、可扩展
- 安全：安全和漏洞分析、内容签名与验证

## 2. 创建自定义证书

安装 Harbor 我们会默认使用 HTTPS 协议，需要 TLS 证书，如果我们没用自己设定自定义证书文件，那么 Harbor 将自动创建证书文件，不过这个有效期只有一年时间，所以这里我们生成自签名证书，为了避免频繁修改证书，将证书有效期为 100 年，操作如下：

### 安装 cfssl

fssl 是 CloudFlare 开源的一款 PKI/TLS 工具,cfssl 包含一个`命令行工具`和一个用于`签名`，验证并且捆绑 TLS 证书的`HTTP API服务`,使用 Go 语言编写.

github: https://github.com/cloudflare/cfssl

下载地址: https://pkg.cfssl.org/

macOS 安装步骤：

```bash
🐳 → brew install cfssl
```

通用安装方式：

```bash
🐳 → wget https://pkg.cfssl.org/R1.2/cfssl_linux-amd64 -O /usr/local/bin/cfssl
🐳 → wget https://pkg.cfssl.org/R1.2/cfssljson_linux-amd64 -O /usr/local/bin/cfssljson
🐳 → wget https://pkg.cfssl.org/R1.2/cfssl-certinfo_linux-amd64 -O /usr/local/bin/cfssl-certinfo
🐳 → chmod +x /usr/local/bin/cfssl*
```

### 获取默认配置

```bash
🐳 → cfssl print-defaults config > ca-config.json
🐳 → cfssl print-defaults csr > ca-csr.json
```

### 生成 CA 证书

将`ca-config.json`内容修改为：

```json
{
    "signing": {
        "default": {
            "expiry": "876000h"
        },
        "profiles": {
            "harbor": {
                "expiry": "876000h",
                "usages": [
                    "signing",
                    "key encipherment",
                    "server auth"
                ]
            }
        }
    }
}
```

修改`ca-csr.json`文件内容为：

```json
{
  "CN": "CA",
  "key": {
    "algo": "rsa",
    "size": 2048
  },
  "names": [
    {
      "C": "CN",
      "ST": "hangzhou",
      "L": "hangzhou",
      "O": "harbor",
      "OU": "System"
    }
  ]
}
```

修改好配置文件后,接下来就可以生成 CA 证书了：

```bash
🐳 → cfssl gencert -initca ca-csr.json | cfssljson -bare ca
2020/12/30 00:45:55 [INFO] generating a new CA key and certificate from CSR
2020/12/30 00:45:55 [INFO] generate received request
2020/12/30 00:45:55 [INFO] received CSR
2020/12/30 00:45:55 [INFO] generating key: rsa-2048
2020/12/30 00:45:56 [INFO] encoded CSR
2020/12/30 00:45:56 [INFO] signed certificate with serial number 529798847867094212963042958391637272775966762165
```

此时目录下会出现三个文件：

```bash
🐳 → tree
├── ca-config.json #这是刚才的json
├── ca.csr
├── ca-csr.json    #这也是刚才申请证书的json
├── ca-key.pem
├── ca.pem

```

这样 我们就生成了:

- 根证书文件: `ca.pem`
- 根证书私钥: `ca-key.pem`
- 根证书申请文件: `ca.csr` (csr 是不是 client ssl request?)

### 签发证书

创建`harbor-csr.json`,内容为：

```json
{
    "CN": "harbor",
    "hosts": [
        "example.net",
        "*.example.net"
    ],
    "key": {
        "algo": "rsa",
        "size": 2048
    },
    "names": [
        {
            "C": "US",
            "ST": "CA",
            "L": "San Francisco",
	    "O": "harbor",
	    "OU": "System"
        }
    ]
}
```

使用之前的 CA 证书签发 harbor 证书：

```bash
🐳 → cfssl gencert -ca=ca.pem -ca-key=ca-key.pem -config=ca-config.json -profile=harbor harbor-csr.json | cfssljson -bare harbor
2020/12/30 00:50:31 [INFO] generate received request
2020/12/30 00:50:31 [INFO] received CSR
2020/12/30 00:50:31 [INFO] generating key: rsa-2048
2020/12/30 00:50:31 [INFO] encoded CSR
2020/12/30 00:50:31 [INFO] signed certificate with serial number 372641098655462687944401141126722021767151134362
```

此时目录下会多几个文件：

```bash
🐳 → tree -L 1
├── etcd.csr
├── etcd-csr.json
├── etcd-key.pem
├── etcd.pem
```

至此，harbor 的证书生成完成。

### 生成 Secret 资源

创建 Kubernetes 的 Secret 资源，且将证书文件导入：

- \- n：指定创建资源的 Namespace
- --from-file：指定要导入的文件地址

```bash
🐳 → kubectl create ns harbor
🐳 → kubectl -n harbor create secret generic harbor-tls --from-file=tls.crt=harbor.pem --from-file=tls.key=harbor-key.pem --from-file=ca.crt=ca.pem
```

查看是否创建成功：

```bash
🐳 → kubectl -n harbor get secret harbor-tls
NAME         TYPE     DATA   AGE
harbor-tls   Opaque   3      1m
```

## 3. 使用 Ceph S3 为 Harbor chart 提供后端存储

### 创建 radosgw

如果你是通过 `ceph-deploy` 部署的，可以通过以下步骤创建 `radosgw`：

先安装 radosgw：

```bash
🐳 → ceph-deploy install --rgw 172.16.7.1 172.16.7.2 172.16.7.3
```

然后创建 radosgw：

```bash
🐳 → ceph-deploy rgw create 172.16.7.1 172.16.7.2 172.16.7.3
```

如果你是通过 `cephadm` 部署的，可以通过以下步骤创建 `radosgw`：

cephadm 将 radosgw 部署为管理特定**领域**和**区域**的守护程序的集合。例如，要在 `172.16.7.1` 上部署 1 个服务于 mytest 领域和 myzone 区域的 rgw 守护程序：

```bash
#如果尚未创建领域，请首先创建一个领域：
🐳 → radosgw-admin realm create --rgw-realm=mytest --default

#接下来创建一个新的区域组：
🐳 → radosgw-admin zonegroup create --rgw-zonegroup=myzg --master --default

#接下来创建一个区域：
🐳 → radosgw-admin zone create --rgw-zonegroup=myzg --rgw-zone=myzone --master --default

#为特定领域和区域部署一组radosgw守护程序：
🐳 → ceph orch apply rgw mytest myzone --placement="1 172.16.7.1"
```

查看服务状态：

```bash
🐳 → ceph orch ls|grep rgw
rgw.mytest.myzone      1/1  5m ago     7w   count:1 k8s01  docker.io/ceph/ceph:v15     4405f6339e35
```

测试服务是否正常：

```bash
🐳 → curl -s http://172.16.7.1
```

正常返回如下数据：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Owner>
    <ID>anonymous</ID>
    <DisplayName></DisplayName>
  </Owner>
  <Buckets></Buckets>
</ListAllMyBucketsResult>
```

查看 `zonegroup`：

```bash
🐳 → radosgw-admin zonegroup get
{
    "id": "ed34ba6e-7089-4b7f-91c4-82fc856fc16c",
    "name": "myzg",
    "api_name": "myzg",
    "is_master": "true",
    "endpoints": [],
    "hostnames": [],
    "hostnames_s3website": [],
    "master_zone": "650e7cca-aacb-4610-a589-acd605d53d23",
    "zones": [
        {
            "id": "650e7cca-aacb-4610-a589-acd605d53d23",
            "name": "myzone",
            "endpoints": [],
            "log_meta": "false",
            "log_data": "false",
            "bucket_index_max_shards": 11,
            "read_only": "false",
            "tier_type": "",
            "sync_from_all": "true",
            "sync_from": [],
            "redirect_zone": ""
        }
    ],
    "placement_targets": [
        {
            "name": "default-placement",
            "tags": [],
            "storage_classes": [
                "STANDARD"
            ]
        }
    ],
    "default_placement": "default-placement",
    "realm_id": "e63c234c-e069-4a0d-866d-1ebdc69ec5fe",
    "sync_policy": {
        "groups": []
    }
}
```

### Create Auth Key

```bash
🐳 → ceph auth get-or-create client.radosgw.gateway osd 'allow rwx' mon 'allow rwx' -o /etc/ceph/ceph.client.radosgw.keyring
```

分发 `/etc/ceph/ceph.client.radosgw.keyring` 到其它 radosgw 节点。

### 创建对象存储用户和访问凭证

1. Create a radosgw user for s3 access

   ```bash
   🐳 → radosgw-admin user create --uid="harbor" --display-name="Harbor Registry"
   ```

2. Create a swift user

   ```bash
   🐳 → adosgw-admin subuser create --uid=harbor --subuser=harbor:swift --access=full
   ```

3. Create Secret Key

   ```bash
   🐳 → radosgw-admin key create --subuser=harbor:swift --key-type=swift --gen-secret
   ```

   记住 `keys` 字段中的 `access_key` & `secret_key`

### 创建存储桶（bucket）

首先需要安装 `awscli`：

```bash
🐳 → pip3 install awscli  -i https://pypi.tuna.tsinghua.edu.cn/simple
```

查看秘钥：

```bash
🐳 → radosgw-admin user info --uid="harbor"|jq .keys
[
  {
    "user": "harbor",
    "access_key": "VGZQY32LMFQOQPVNTDSJ",
    "secret_key": "YZMMYqoy1ypHaqGOUfwLvdAj9A731iDYDjYqwkU5"
  }
]
```

配置 awscli：

```bash
🐳 → aws configure --profile=ceph
AWS Access Key ID [None]: VGZQY32LMFQOQPVNTDSJ
AWS Secret Access Key [None]: YZMMYqoy1ypHaqGOUfwLvdAj9A731iDYDjYqwkU5
Default region name [None]:
Default output format [None]: json
```

配置完成后，凭证将会存储到 `~/.aws/credentials`：

```bash
🐳 → cat ~/.aws/credentials
[ceph]
aws_access_key_id = VGZQY32LMFQOQPVNTDSJ
aws_secret_access_key = YZMMYqoy1ypHaqGOUfwLvdAj9A731iDYDjYqwkU5
```

配置将会存储到 `~/.aws/config`：

```bash
🐳 → cat ~/.aws/config
[profile ceph]
region = cn-hangzhou-1
output = json
```

创建存储桶（bucket）：

```bash
🐳 → aws --profile=ceph --endpoint=http://172.16.7.1 s3api create-bucket --bucket harbor
```

查看存储桶（bucket）列表：

```
🐳 → radosgw-admin bucket list
[
    "harbor"
]
```

查看存储桶状态：

```bash
🐳 → radosgw-admin bucket stats
[
    {
        "bucket": "harbor",
        "num_shards": 11,
        "tenant": "",
        "zonegroup": "ed34ba6e-7089-4b7f-91c4-82fc856fc16c",
        "placement_rule": "default-placement",
        "explicit_placement": {
            "data_pool": "",
            "data_extra_pool": "",
            "index_pool": ""
        },
        "id": "650e7cca-aacb-4610-a589-acd605d53d23.194274.1",
        "marker": "650e7cca-aacb-4610-a589-acd605d53d23.194274.1",
        "index_type": "Normal",
        "owner": "harbor",
        "ver": "0#1,1#1,2#1,3#1,4#1,5#1,6#1,7#1,8#1,9#1,10#1",
        "master_ver": "0#0,1#0,2#0,3#0,4#0,5#0,6#0,7#0,8#0,9#0,10#0",
        "mtime": "2020-12-29T17:19:02.481567Z",
        "creation_time": "2020-12-29T17:18:58.940915Z",
        "max_marker": "0#,1#,2#,3#,4#,5#,6#,7#,8#,9#,10#",
        "usage": {},
        "bucket_quota": {
            "enabled": false,
            "check_on_raw": false,
            "max_size": -1,
            "max_size_kb": 0,
            "max_objects": -1
        }
    }
]
```

查看存储池状态

```bash
🐳 → rados df
POOL_NAME                    USED  OBJECTS  CLONES  COPIES  MISSING_ON_PRIMARY  UNFOUND  DEGRADED    RD_OPS       RD     WR_OPS       WR  USED COMPR  UNDER COMPR
.rgw.root                 2.3 MiB       13       0      39                   0        0         0       533  533 KiB         21   16 KiB         0 B          0 B
cache                         0 B        0       0       0                   0        0         0         0      0 B          0      0 B         0 B          0 B
device_health_metrics     3.2 MiB       18       0      54                   0        0         0       925  929 KiB        951  951 KiB         0 B          0 B
kubernetes                735 GiB    72646      99  217938                   0        0         0  48345148  242 GiB  283283048  7.3 TiB         0 B          0 B
myzone.rgw.buckets.index  8.6 MiB       11       0      33                   0        0         0        44   44 KiB         11      0 B         0 B          0 B
myzone.rgw.control            0 B        8       0      24                   0        0         0         0      0 B          0      0 B         0 B          0 B
myzone.rgw.log              6 MiB      206       0     618                   0        0         0   2188882  2.1 GiB    1457026   32 KiB         0 B          0 B
myzone.rgw.meta           960 KiB        6       0      18                   0        0         0        99   80 KiB         17    8 KiB         0 B          0 B

total_objects    72908
total_used       745 GiB
total_avail      87 TiB
total_space      88 TiB
```

## 3. 设置 Harbor 配置清单

由于我们需要通过 Helm 安装 Harbor 仓库，需要提前创建 Harbor Chart 的配置清单文件，里面是对要创建的应用 Harbor 进行一系列参数配置，由于参数过多，关于都有 Harbor Chart 都能够配置哪些参数这里就不一一罗列，可以通过访问 [Harbor-helm 的 Github 地址](https://github.com/goharbor/harbor-helm) 进行了解。

下面描述下，需要的一些配置参数：

**values.yaml**

```yaml
#入口配置，我只在内网使用，所以直接使用 cluserIP
expose:
  type: clusterIP
  tls:
    ### 是否启用 https 协议
    enabled: true
    certSource: secret
    auto:
      # The common name used to generate the certificate, it's necessary
      # when the type isn't "ingress"
      commonName: "harbor.example.net"
    secret:
      # The name of secret which contains keys named:
      # "tls.crt" - the certificate
      # "tls.key" - the private key
      secretName: "harbor-tls"
      # The name of secret which contains keys named:
      # "tls.crt" - the certificate
      # "tls.key" - the private key
      # Only needed when the "expose.type" is "ingress".
      notarySecretName: ""

## 如果Harbor部署在代理后，将其设置为代理的URL
externalURL: https://harbor.example.net

### Harbor 各个组件的持久化配置，并将 storageClass 设置为集群默认的 storageClass
persistence:
  enabled: true
  # Setting it to "keep" to avoid removing PVCs during a helm delete
  # operation. Leaving it empty will delete PVCs after the chart deleted
  # (this does not apply for PVCs that are created for internal database
  # and redis components, i.e. they are never deleted automatically)
  resourcePolicy: "keep"
  persistentVolumeClaim:
    registry:
      # Use the existing PVC which must be created manually before bound,
      # and specify the "subPath" if the PVC is shared with other components
      existingClaim: ""
      # Specify the "storageClass" used to provision the volume. Or the default
      # StorageClass will be used(the default).
      # Set it to "-" to disable dynamic provisioning
      storageClass: "csi-rbd-sc"
      subPath: ""
      accessMode: ReadWriteOnce
      size: 100Gi
    chartmuseum:
      existingClaim: ""
      storageClass: "csi-rbd-sc"
      subPath: ""
      accessMode: ReadWriteOnce
      size: 5Gi
    jobservice:
      existingClaim: ""
      storageClass: "csi-rbd-sc"
      subPath: ""
      accessMode: ReadWriteOnce
      size: 5Gi
    # If external database is used, the following settings for database will
    # be ignored
    database:
      existingClaim: ""
      storageClass: "csi-rbd-sc"
      subPath: ""
      accessMode: ReadWriteOnce
      size: 5Gi
    # If external Redis is used, the following settings for Redis will
    # be ignored
    redis:
      existingClaim: ""
      storageClass: "csi-rbd-sc"
      subPath: ""
      accessMode: ReadWriteOnce
      size: 5Gi
    trivy:
      existingClaim: ""
      storageClass: "csi-rbd-sc"
      subPath: ""
      accessMode: ReadWriteOnce
      size: 5Gi

### 默认用户名 admin 的密码配置，注意：密码中一定要包含大小写字母与数字
harborAdminPassword: "Mydlq123456"

### 设置日志级别
logLevel: info

#各个组件 CPU & Memory 资源相关配置
nginx:
  resources:
    requests:
      memory: 256Mi
      cpu: 500m
portal:
  resources:
    requests:
      memory: 256Mi
      cpu: 500m
core:
  resources:
    requests:
      memory: 256Mi
      cpu: 1000m
jobservice:
  resources:
    requests:
      memory: 256Mi
      cpu: 500m
registry:
  registry:
    resources:
      requests:
        memory: 256Mi
        cpu: 500m
  controller:
    resources:
      requests:
        memory: 256Mi
        cpu: 500m
clair:
  clair:
    resources:
      requests:
        memory: 256Mi
        cpu: 500m
  adapter:
    resources:
      requests:
        memory: 256Mi
        cpu: 500m
notary:
  server:
    resources:
      requests:
        memory: 256Mi
        cpu: 500m
  signer:
    resources:
      requests:
        memory: 256Mi
        cpu: 500m
database:
  internal:
    resources:
      requests:
        memory: 256Mi
        cpu: 500m
redis:
  internal:
    resources:
      requests:
        memory: 256Mi
        cpu: 500m
trivy:
  enabled: true
  resources:
    requests:
      cpu: 200m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 1024Mi

#开启 chartmuseum，使 Harbor 能够存储 Helm 的 chart
chartmuseum:
  enabled: true
  resources:
    requests:
     memory: 256Mi
     cpu: 500m

  imageChartStorage:
    # Specify whether to disable `redirect` for images and chart storage, for
    # backends which not supported it (such as using minio for `s3` storage type), please disable
    # it. To disable redirects, simply set `disableredirect` to `true` instead.
    # Refer to
    # https://github.com/docker/distribution/blob/master/docs/configuration.md#redirect
    # for the detail.
    disableredirect: false
    # Specify the "caBundleSecretName" if the storage service uses a self-signed certificate.
    # The secret must contain keys named "ca.crt" which will be injected into the trust store
    # of registry's and chartmuseum's containers.
    # caBundleSecretName:

    # Specify the type of storage: "filesystem", "azure", "gcs", "s3", "swift",
    # "oss" and fill the information needed in the corresponding section. The type
    # must be "filesystem" if you want to use persistent volumes for registry
    # and chartmuseum
    type: s3
    s3:
      region: cn-hangzhou-1
      bucket: harbor
      accesskey: VGZQY32LMFQOQPVNTDSJ
      secretkey: YZMMYqoy1ypHaqGOUfwLvdAj9A731iDYDjYqwkU5
      regionendpoint: http://172.16.7.1
      #encrypt: false
      #keyid: mykeyid
      secure: false
      #skipverify: false
      #v4auth: true
      #chunksize: "5242880"
      #rootdirectory: /s3/object/name/prefix
      #storageclass: STANDARD
      #multipartcopychunksize: "33554432"
      #multipartcopymaxconcurrency: 100
      #multipartcopythresholdsize: "33554432"
```

## 4. 安装 Harbor

### 添加 Helm 仓库

```bash
🐳 → helm repo add harbor https://helm.goharbor.io
```

### 部署 Harbor

```bash
🐳 → helm install harbor harbor/harbor -f values.yaml -n harbor
```

### 查看应用是否部署完成

```bash
🐳 → kubectl -n harbor get pod
NAME                                          READY   STATUS    RESTARTS   AGE
harbor-harbor-chartmuseum-55fb975fbd-74vnh    1/1     Running   0          3m
harbor-harbor-clair-695c7f9c69-7gpkh          2/2     Running   0          3m
harbor-harbor-core-687cfb49b6-zmwxr           1/1     Running   0          3m
harbor-harbor-database-0                      1/1     Running   0          3m
harbor-harbor-jobservice-88994b9b7-684vb      1/1     Running   0          3m
harbor-harbor-nginx-6758559548-x9pq6          1/1     Running   0          3m
harbor-harbor-notary-server-6d55b785f-6jsq9   1/1     Running   0          3m
harbor-harbor-notary-signer-9696cbdd8-8tfw9   1/1     Running   0          3m
harbor-harbor-portal-6f474574c4-8jzh2         1/1     Running   0          3m
harbor-harbor-redis-0                         1/1     Running   0          3m
harbor-harbor-registry-5b6cbfb4cf-42fm9       2/2     Running   0          3m
harbor-harbor-trivy-0                         1/1     Running   0          3m
```

### Host 配置域名

接下来配置 Hosts，客户端想通过域名访问服务，必须要进行 DNS 解析，由于这里没有 DNS 服务器进行域名解析，所以修改 hosts 文件将 Harbor 指定 `clusterIP` 和自定义 host 绑定。首先查看 nginx 的 clusterIP：

```bash
🐳 → kubectl -n harbor get svc harbor-harbor-nginx
NAME                  TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE
harbor-harbor-nginx   ClusterIP   10.109.50.142   <none>        80/TCP,443/TCP   22h
```

打开主机的 Hosts 配置文件，往其加入下面配置：

```bash
10.109.50.142 harbor.example.net
```

如果想在集群外访问，建议将 Service nginx 的 type 改为 `nodePort` 或者通过 `ingress` 来代理。当然，如果你在集群外能够直接访问 clusterIP，那更好。

输入地址 `https://harbor.example.net` 访问 Harbor 仓库。

- 用户：admin
- 密码：Mydlq123456 (在安装配置中自定义的密码)

进入后可以看到 Harbor 的管理后台：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@second/img/20201230163549.png)

## 5. 服务器配置镜像仓库

对于 Containerd 来说，不能像 docker 一样 `docker login` 登录到镜像仓库，需要修改其配置文件来进行认证。`/etc/containerd/config.toml` 需要添加如下内容：

```toml
    [plugins."io.containerd.grpc.v1.cri".registry]
      [plugins."io.containerd.grpc.v1.cri".registry.mirrors]
        ...
      [plugins."io.containerd.grpc.v1.cri".registry.configs]
        [plugins."io.containerd.grpc.v1.cri".registry.configs."harbor.example.net".tls]
          insecure_skip_verify = true
        [plugins."io.containerd.grpc.v1.cri".registry.configs."harbor.example.net".auth]
          username = "admin"
          password = "Mydlq123456"
```

由于 Harbor 是基于 Https 的，理论上需要提前配置 tls 证书，但可以通过 `insecure_skip_verify` 选项跳过证书认证。

当然，如果你想通过 Kubernetes 的 secret 来进行用户验证，配置还可以精简下：

```toml
    [plugins."io.containerd.grpc.v1.cri".registry]
      [plugins."io.containerd.grpc.v1.cri".registry.mirrors]
        ...
      [plugins."io.containerd.grpc.v1.cri".registry.configs]
        [plugins."io.containerd.grpc.v1.cri".registry.configs."harbor.example.net".tls]
          insecure_skip_verify = true
```

Kubernetes 集群使用 `docker-registry` 类型的 Secret 来通过镜像仓库的身份验证，进而拉取私有映像。所以需要创建 Secret，命名为 `regcred`：

```bash
🐳 → kubectl create secret docker-registry regcred \
  --docker-server=<你的镜像仓库服务器> \
  --docker-username=<你的用户名> \
  --docker-password=<你的密码> \
  --docker-email=<你的邮箱地址>
```

然后就可以在 Pod 中使用该 secret 来访问私有镜像仓库了，下面是一个示例 Pod 配置文件：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: private-reg
spec:
  containers:
  - name: private-reg-container
    image: <your-private-image>
  imagePullSecrets:
  - name: regcred
```

如果你不嫌麻烦，想更安全一点，那就老老实实将 CA、证书和秘钥拷贝到所有节点的 `/etc/ssl/certs/` 目录下。`/etc/containerd/config.toml` 需要添加的内容更多一点：

```toml
    [plugins."io.containerd.grpc.v1.cri".registry]
      [plugins."io.containerd.grpc.v1.cri".registry.mirrors]
        ...
      [plugins."io.containerd.grpc.v1.cri".registry.configs]
        [plugins."io.containerd.grpc.v1.cri".registry.configs."harbor.example.net".tls]
          ca_file = "/etc/ssl/certs/ca.pem"
          cert_file = "/etc/ssl/certs/harbor.pem"
          key_file  = "/etc/ssl/certs/harbor-key.pem"
```

**至于 Docker 的配置方式，大家可以自己去搜一下，这里就跳过了，谁让它现在不受待见呢。**

## 6. 测试功能

这里为了测试推送镜像，先下载一个用于测试的 `helloworld` 小镜像，然后推送到 `harbor.example.net` 仓库：

```bash
### 拉取 Helloworld 镜像
🐳 → ctr i pull bxsfpjcb.mirror.aliyuncs.com/library/hello-world:latest
bxsfpjcb.mirror.aliyuncs.com/library/hello-world:latest:                          resolved       |++++++++++++++++++++++++++++++++++++++|
index-sha256:1a523af650137b8accdaed439c17d684df61ee4d74feac151b5b337bd29e7eec:    done           |++++++++++++++++++++++++++++++++++++++|
manifest-sha256:90659bf80b44ce6be8234e6ff90a1ac34acbeb826903b02cfa0da11c82cbc042: done           |++++++++++++++++++++++++++++++++++++++|
layer-sha256:0e03bdcc26d7a9a57ef3b6f1bf1a210cff6239bff7c8cac72435984032851689:    done           |++++++++++++++++++++++++++++++++++++++|
config-sha256:bf756fb1ae65adf866bd8c456593cd24beb6a0a061dedf42b26a993176745f6b:   done           |++++++++++++++++++++++++++++++++++++++|
elapsed: 15.8s                                                                    total:  2.6 Ki (166.0 B/s)
unpacking linux/amd64 sha256:1a523af650137b8accdaed439c17d684df61ee4d74feac151b5b337bd29e7eec...
done

### 将下载的镜像使用 tag 命令改变镜像名
🐳 → ctr i tag bxsfpjcb.mirror.aliyuncs.com/library/hello-world:latest harbor.example.net/library/hello-world:latest
harbor.example.net/library/hello-world:latest

### 推送镜像到镜像仓库
🐳 → ctr i push --user admin:Mydlq123456 --platform linux/amd64 harbor.example.net/library/hello-world:latest
manifest-sha256:90659bf80b44ce6be8234e6ff90a1ac34acbeb826903b02cfa0da11c82cbc042: done           |++++++++++++++++++++++++++++++++++++++|
config-sha256:bf756fb1ae65adf866bd8c456593cd24beb6a0a061dedf42b26a993176745f6b:   done           |++++++++++++++++++++++++++++++++++++++|
layer-sha256:0e03bdcc26d7a9a57ef3b6f1bf1a210cff6239bff7c8cac72435984032851689:    done           |++++++++++++++++++++++++++++++++++++++|
elapsed: 2.2 s                                                                    total:  4.5 Ki (2.0 KiB/s)
```

镜像仓库中也能看到：

![](https://jsd.onmicrosoft.cn/gh/yangchuansheng/imghosting@second/img/20201230171408.png)

将之前的下载的镜像删除，然后测试从 `harbor.example.net` 下载镜像进行测试：

```bash
### 删除之前镜像
🐳 → ctr i rm harbor.example.net/library/hello-world:latest
🐳 → ctr i rm bxsfpjcb.mirror.aliyuncs.com/library/hello-world:latest

### 测试从 harbor.example.net 下载新镜像
🐳 → ctr i pull harbor.example.net/library/hello-world:latest
harbor.example.net/library/hello-world:latest:                                   resolved       |++++++++++++++++++++++++++++++++++++++|
manifest-sha256:90659bf80b44ce6be8234e6ff90a1ac34acbeb826903b02cfa0da11c82cbc042: done           |++++++++++++++++++++++++++++++++++++++|
layer-sha256:0e03bdcc26d7a9a57ef3b6f1bf1a210cff6239bff7c8cac72435984032851689:    done           |++++++++++++++++++++++++++++++++++++++|
config-sha256:bf756fb1ae65adf866bd8c456593cd24beb6a0a061dedf42b26a993176745f6b:   done           |++++++++++++++++++++++++++++++++++++++|
elapsed: 0.6 s                                                                    total:  525.0  (874.0 B/s)
unpacking linux/amd64 sha256:90659bf80b44ce6be8234e6ff90a1ac34acbeb826903b02cfa0da11c82cbc042...
done
```

## 参考

- [通过 Helm 搭建 Docker 镜像仓库 Harbor](http://www.mydlq.club/article/66/)