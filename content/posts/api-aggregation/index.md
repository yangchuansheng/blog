---
title: "Kubernetes API 扩展"
subtitle: "使用聚合层扩展 Kubernetes API"
date: 2018-06-19T06:15:06Z
draft: false
author: 米开朗基杨
toc: true
categories: "kubernetes"
tags: ["kubernetes"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/20191204125153.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

`Aggregated（聚合的）API server` 是为了将原来的 API server 这个巨石（monolithic）应用给拆分开，为了方便用户开发自己的 API server 集成进来，而不用直接修改 Kubernetes 官方仓库的代码，这样一来也能将 API server 解耦，方便用户使用实验特性。这些 API server 可以跟 `core API server` 无缝衔接，使用 kubectl 也可以管理它们。

在 `1.7+` 版本中，聚合层和 kube-apiserver 一起运行。在扩展资源被注册前，聚合层不执行任何操，要注册其 API,用户必需添加一个 `APIService` 对象，该对象需在 Kubernetes API 中声明 URL 路径，聚合层将发送到该 API 路径(e.g. /apis/myextension.mycompany.io/v1/…)的所有对象代理到注册的 APIService。

通常，通过在集群中的一个 Pod 中运行一个 `extension-apiserver` 来实现 APIService。如果已添加的资源需要主动管理，这个 extension-apiserver 通常需要和一个或多个控制器配对。

## <span id="inline-toc">1.</span> 创建聚合层 API 证书

----

如果想开启聚合层 API，需要创建几个与聚合层 API 相关的证书。

### 安装 cfssl

**方式一：直接使用二进制源码包安装**

```bash
$ wget https://pkg.cfssl.org/R1.2/cfssl_linux-amd64
$ chmod +x cfssl_linux-amd64
$ mv cfssl_linux-amd64 /usr/local/bin/cfssl

$ wget https://pkg.cfssl.org/R1.2/cfssljson_linux-amd64
$ chmod +x cfssljson_linux-amd64
$ mv cfssljson_linux-amd64 /usr/local/bin/cfssljson

$ wget https://pkg.cfssl.org/R1.2/cfssl-certinfo_linux-amd64
$ chmod +x cfssl-certinfo_linux-amd64
$ mv cfssl-certinfo_linux-amd64 /usr/local/bin/cfssl-certinfo

$ export PATH=/usr/local/bin:$PATH
```

**方式二：使用go命令安装**

```bash
$ go get -u github.com/cloudflare/cfssl/cmd/...
$ls $GOPATH/bin/cfssl*
cfssl cfssl-bundle cfssl-certinfo cfssljson cfssl-newkey cfssl-scan
```

在 `$GOPATH/bin` 目录下得到以 cfssl 开头的几个命令。

注意：以下文章中出现的 cat 的文件名如果不存在需要手工创建。

### 创建 CA (Certificate Authority)

**创建 CA 配置文件**

```bash
$ mkdir /root/ssl
$ cd /root/ssl
$ cfssl print-defaults config > config.json
$ cfssl print-defaults csr > csr.json
# 根据config.json文件的格式创建如下的ca-config.json文件
# 过期时间设置成了 87600h
$ cat > aggregator-ca-config.json <<EOF
{
  "signing": {
    "default": {
      "expiry": "87600h"
    },
    "profiles": {
      "aggregator": {
        "usages": [
            "signing",
            "key encipherment",
            "server auth",
            "client auth"
        ],
        "expiry": "87600h"
      }
    }
  }
}
EOF
```

字段说明：

+ `profiles` : 可以定义多个 profiles，分别指定不同的过期时间、使用场景等参数；后续在签名证书时使用某个 profile。
+ `signing` ：表示该证书可用于签名其它证书；生成的 aggregator-ca.pem 证书中 `CA=TRUE`。
+ `server auth` ：表示 Client 可以用该 CA 对 Server 提供的证书进行验证。
+ `client auth` ：表示 Server 可以用该 CA 对 Client 提供的证书进行验证。

**创建 CA 证书签名请求**

创建 `aggregator-ca-csr.json` 文件，内容如下：

```json
{
  "CN": "aggregator",
  "key": {
    "algo": "rsa",
    "size": 2048
  },
  "names": [
    {
      "C": "CN",
      "ST": "Shanghai",
      "L": "Shanghai",
      "O": "k8s",
      "OU": "System"
    }
  ],
    "ca": {
       "expiry": "87600h"
    }
}
```

字段说明：

+ <span id="inline-blue">"CN"</span> ：`Common Name`，kube-apiserver 从证书中提取该字段作为请求的用户名 (User Name)；浏览器使用该字段验证网站是否合法。
+ <span id="inline-blue">"O"</span> ：`Organization`，kube-apiserver 从证书中提取该字段作为请求用户所属的组 (Group)；

**生成 CA 证书和私钥**

```bash
$ cfssl gencert -initca aggregator-ca-csr.json | cfssljson -bare aggregator-ca
$ ls aggregator-ca*
aggregator-ca-config.json  aggregator-ca.csr  aggregator-ca-csr.json  aggregator-ca-key.pem  aggregator-ca.pem
```

### 创建 kubernetes 证书

创建 aggregator 证书签名请求文件 `aggregator-csr.json` ：

```json
{
    "CN": "aggregator",
    "hosts": [
      "127.0.0.1",
      "192.168.123.250",
      "192.168.123.248",
      "192.168.123.249",
      "10.254.0.1",
      "kubernetes",
      "kubernetes.default",
      "kubernetes.default.svc",
      "kubernetes.default.svc.cluster",
      "kubernetes.default.svc.cluster.local"
    ],
    "key": {
        "algo": "rsa",
        "size": 2048
    },
    "names": [
        {
            "C": "CN",
            "ST": "Shanghai",
            "L": "Shanghai",
            "O": "k8s",
            "OU": "System"
        }
    ]
}
```

+ 如果 hosts 字段不为空则需要指定授权使用该证书的 IP 或域名列表，由于该证书后续被 etcd 集群和 kubernetes master 集群使用，所以上面分别指定了 `etcd` 集群、`kubernetes master` 集群的主机 IP 和 kubernetes 服务的服务 IP（一般是 kube-apiserver 指定的 `service-cluster-ip-range` 网段的第一个 IP，如 10.254.0.1）。
+ 以上物理节点的 IP 也可以更换为主机名。

**生成 aggregator 证书和私钥**

```bash
$ cfssl gencert -ca=aggregator-ca.pem -ca-key=aggregator-ca-key.pem -config=aggregator-ca-config.json -profile=aggregator aggregator-csr.json | cfssljson -bare aggregator
$ ls aggregator*
aggregator.csr  aggregator-csr.json  aggregator-key.pem  aggregator.pem
```

### 分发证书

将生成的证书和秘钥文件（后缀名为.pem）拷贝到 Master 节点的 `/etc/kubernetes/ssl` 目录下备用。

```bash
$ cp *.pem /etc/kubernetes/ssl
```

## <span id="inline-toc">2.</span> 开启聚合层 API

----

`kube-apiserver` 增加以下配置：

```bash
--requestheader-client-ca-file=/etc/kubernetes/ssl/aggregator-ca.pem
--requestheader-allowed-names=aggregator
--requestheader-extra-headers-prefix=X-Remote-Extra-
--requestheader-group-headers=X-Remote-Group
--requestheader-username-headers=X-Remote-User
--proxy-client-cert-file=/etc/kubernetes/ssl/aggregator.pem
--proxy-client-key-file=/etc/kubernetes/ssl/aggregator-key.pem
```

{{< notice note >}}
前面创建的证书的 <code>CN</code> 字段的值必须和参数 <code>--requestheader-allowed-names</code> 指定的值 <code>aggregator</code> 相同。
{{< /notice >}}

重启 kube-apiserver：

```bash
$ systemctl daemon-reload
$ systemctl restart kube-apiserver
```

如果 `kube-proxy` 没有在 Master 上面运行，`kube-proxy` 还需要添加配置：

```bash
--enable-aggregator-routing=true
```

## <span id="inline-toc">3.</span> 参考

----

+ [Extending the Kubernetes API with the aggregation layer](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/apiserver-aggregation/)
+ [Configure the aggregation layer](https://kubernetes.io/docs/tasks/access-kubernetes-api/configure-aggregation-layer/)
+ [创建TLS证书和秘钥](https://jimmysong.io/kubernetes-handbook/practice/create-tls-and-secret-key.html)

