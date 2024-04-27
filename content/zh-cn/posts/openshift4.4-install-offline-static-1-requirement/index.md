---
keywords:
- openshift
- ocp
- openshift4
- ocp4
- quay
title: "Openshift 4.4 静态 IP 离线安装系列：准备离线资源"
date: 2020-05-28T21:44:45+08:00
lastmod: 2020-05-28T21:44:45+08:00
description: 本系列文章描述了离线环境下以 UPI (User Provisioned Infrastructure) 模式安装 Openshift Container Platform (OCP) 4.4.5 的步骤，本文涉及到离线资源的准备和 Quay 镜像仓库的创建。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocLevels: ["h2", "h3", "h4"]
tags:
- Openshift
- Quay
categories:
- cloud-native
img: https://images.icloudnative.io/uPic/20200601144925.png
---

本系列文章描述了离线环境下以 `UPI` (User Provisioned Infrastructure) 模式安装 `Openshift Container Platform` (OCP) 4.4.5 的步骤，我的环境是 `VMware ESXI` 虚拟化，也适用于其他方式提供的虚拟机或物理主机。离线资源包括安装镜像、所有样例 `Image Stream` 和 `OperatorHub` 中的所有 RedHat Operators。

本系列采用静态 IP 的方式安装 `OCP` 集群，如果你可以随意分配网络，建议采用 `DHCP` 的方式。

## 1. 离线环境

单独准备一台节点用来执行安装任务和离线资源准备，这台节点最好具备**魔法上网**的能力，以便可以同时访问内外网，我们称这台节点为**基础节点**。

除此之外还需要部署一个私有镜像仓库，以供 OCP 安装和运行时使用，**要求支持 version 2 schema 2 (manifest list)**，我这里选择的是 `Quay 3.3`。镜像仓库需要部署在另外一台节点，因为需要用到 `443` 端口，与后面的负载均衡端口冲突。

{{< alert >}}
很多人误以为必须联系 Red Hat 销售，签单之后才能使用 OCP4，其实不然，注册一个[开发者账号](https://developers.redhat.com/)后就可以获得 `quay.io` 和 `registry.redhat.io` 的拉取密钥了。
{{< /alert >}}

## 2. 准备离线安装介质

### 获取版本信息

目前最新的 OCP 版本是 4.4.5，可以从这里下载客户端：

+ [https://mirror.openshift.com/pub/openshift-v4/clients/ocp/latest-4.4/](https://mirror.openshift.com/pub/openshift-v4/clients/ocp/latest-4.4/)

解压出来的二进制文件放到基础节点的 `$PATH` 下，看下版本信息：
{{< details title="OCP 4.4.5 版本信息" closed="true" >}}

```bash
🐳 → oc adm release info quay.io/openshift-release-dev/ocp-release:4.4.5-x86_64

Name:      4.4.5
Digest:    sha256:4a461dc23a9d323c8bd7a8631bed078a9e5eec690ce073f78b645c83fb4cdf74
Created:   2020-05-21T16:03:01Z
OS/Arch:   linux/amd64
Manifests: 412

Pull From: quay.io/openshift-release-dev/ocp-release@sha256:4a461dc23a9d323c8bd7a8631bed078a9e5eec690ce073f78b645c83fb4cdf74

Release Metadata:
  Version:  4.4.5
  Upgrades: 4.3.18, 4.3.19, 4.3.21, 4.3.22, 4.4.2, 4.4.3, 4.4.4
  Metadata:
    description:
  Metadata:
    url: https://access.redhat.com/errata/RHBA-2020:2180

Component Versions:
  kubernetes 1.17.1
  machine-os 44.81.202005180831-0 Red Hat Enterprise Linux CoreOS

Images:
  NAME                                           DIGEST
  aws-machine-controllers                        sha256:7817d9e707bb51bc1e5110ef66bb67947df42dcf3c9b782a8f12f60b8f229dca
  azure-machine-controllers                      sha256:5e2320f92b7308a4f1ec4aca151c752f69265e8c5b705d78e2f2ee70d717711a
  baremetal-installer                            sha256:4c8c6d2895e065711cfcbffe7e8679d9890480a4975cad683b643d8502375fe3
  baremetal-machine-controllers                  sha256:5f1b312ac47b7f9e91950463e9a4ce5af7094a3a8b0bc064c9b4dcfc9c725ad5
  baremetal-operator                             sha256:a77ff02f349d96567da8e06018ad0dfbfb5fef6600a9a216ade15fadc574f4b4
  baremetal-runtimecfg                           sha256:715bc48eda04afc06827189883451958d8940ed8ab6dd491f602611fe98a6fba
  cli                                            sha256:43159f5486cc113d64d5ba04d781c16a084d18745a911a5ae7200bb895778a72
  cli-artifacts                                  sha256:ce7130db82f5a3bb2c806d7080f356e4c68c0405bf3956d3e290bc2078a8bf32
  cloud-credential-operator                      sha256:244ab9d0fcf7315eb5c399bd3fa7c2e662cf23f87f625757b13f415d484621c3
  cluster-authentication-operator                sha256:3145e4fbd62dde385fd0e33d220c42ec3d00ac1dab72288e584cc502b4b8b6db
  cluster-autoscaler                             sha256:66e47de69f685f2dd063fbce9f4e5a00264a5572140d255f2db4c367cb00bad9
  cluster-autoscaler-operator                    sha256:6a32eafdbea3d12c0681a1a1660c7a424f7082a1c42e22d1b301ab0ab6da191b
  cluster-bootstrap                              sha256:fbde2b1a3df7172ce5dbc5e8818bfe631718399eda8058b301a1ef059f549e95
  cluster-config-operator                        sha256:5437794d2309ebe65ca08d1bdeb9fcd665732207b3287df8a7c56e5a2813eccb
  cluster-csi-snapshot-controller-operator       sha256:bc4d8ad97b473316518dbd8906dd900feba383425671eb7d4d73ed1d705c105e
  cluster-dns-operator                           sha256:1a7469258e351d2d56a98a5ef4a3dfa0326b4677fdc1dd11279b6a193ccdbad1
  cluster-etcd-operator                          sha256:9f7a02df3a5d91326d95e444e2e249f8205632ae986d6dccc7f007ec65c8af77
  cluster-image-registry-operator                sha256:0aaa817389487d266faf89cecbfd3197405d87172ee2dcda169dfa90e2e9ca18
  cluster-ingress-operator                       sha256:4887544363e052e656aa1fd44d2844226ee2e4617e08b88ba0211a93bb3101fa
  cluster-kube-apiserver-operator                sha256:718ca346d5499cccb4de98c1f858c9a9a13bbf429624226f466c3ee2c14ebf40
  cluster-kube-controller-manager-operator       sha256:0aa16b4ff32fbb9bc7b32aa1bf6441a19a1deb775fb203f21bb8792ff1a26c2e
  cluster-kube-scheduler-operator                sha256:887eda5ce495f1a33c5adbba8772064d3a8b78192162e4c75bd84763c5a1fb01
  cluster-kube-storage-version-migrator-operator sha256:0fd3e25304a6e23e9699172a84dc134b9b5b81dd89496322a9f46f4cd82ecf71
  cluster-machine-approver                       sha256:c35b382d426ff03cfe07719f19e871ec3bd4189fa27452b3e2eb2fb4ab085afc
  cluster-monitoring-operator                    sha256:d7d5f3b6094c88cb1aa9d5bf1b29c574f13db7142e0a9fba03c6681fe4b592a5
  cluster-network-operator                       sha256:563018341e5b37e5cf370ee0a112aa85dd5e17a658b303714252cc59ddfadea5
  cluster-node-tuned                             sha256:0d1a3f66cd7cfc889ddf17cbdb4cb2e4b9188c341b165de1c9c1df578fb53212
  cluster-node-tuning-operator                   sha256:8e00331fd6b725b1d44687bafa2186920e2864fd4d04869ad4e9f5ba56d663ca
  cluster-openshift-apiserver-operator           sha256:087dd3801b15ca614be0998615a0d827383e9c9ab39e64107324074bddccfff8
  cluster-openshift-controller-manager-operator  sha256:a25afbcb148f3535372784e82c66a6cc2843fe9e7119b9198a39422edb95c2ae
  cluster-policy-controller                      sha256:6294d4af2061d23f52a2a439d20272280aa6e5fcff7a5559b4797fb8e6536790
  cluster-samples-operator                       sha256:7040633af70ceb19147687d948a389d392945cb57236165409e66e5101c0d0c0
  cluster-storage-operator                       sha256:bcfeab624513563c9e26629be2914770436c49318c321bd99028a7d1ffab30cf
  cluster-svcat-apiserver-operator               sha256:21a562f26c967ad6d83e1f4219fad858154c3df9854f1462331b244906c6ca9c
  cluster-svcat-controller-manager-operator      sha256:b635529e5843996a51ace6a2aea4854e46256669ef1773c7371e4f0407dbf843
  cluster-update-keys                            sha256:828e11d8132caf5533e18b8e5d292d56ccf52b08e4fe4c53d7825404b05b2844
  cluster-version-operator                       sha256:7a2a210bc07fead80b3f4276cf14692c39a70640a124326ee919d415f0dc5b2c
  configmap-reloader                             sha256:07d46699cb9810e3f629b5142a571db83106aa1190d5177a9944272080cd053d
  console                                        sha256:69f14151fe8681e5fa48912f8f4df753a0dcc3d616ad7991c463402517d1eab4
  console-operator                               sha256:85c9a48c9b1896f36cf061bd4890e7f85e0dc383148f2a1dc498e668dee961df
  container-networking-plugins                   sha256:1a2ecb28b80800c327ad79fb4c8fb6cc9f0b434fc42a4de5b663b907852ee9fb
  coredns                                        sha256:b25b8b2219e8c247c088af93e833c9ac390bc63459955e131d89b77c485d144d
  csi-snapshot-controller                        sha256:33f89dbd081d119aac8d7c56abcb060906b23d31bc801091b789dea14190493f
  deployer                                       sha256:b24cd515360ae4eba89d4d92afe2689a84043106f7defe34df28acf252cd45b4
  docker-builder                                 sha256:d3cf4e3ad3c3ce4bef52d9543c87a1c555861b726ac9cae0cc57486be1095f8a
  docker-registry                                sha256:8b6ab4a0c14118020fa56b70cab440883045003a8d9304c96691a0401ad7117c
  etcd                                           sha256:aba3c59eb6d088d61b268f83b034230b3396ce67da4f6f6d49201e55efebc6b2
  gcp-machine-controllers                        sha256:1c67b5186bbbdc6f424d611eeff83f11e1985847f4a98f82642dcd0938757b0e
  grafana                                        sha256:aa5c9d3d828b04418d17a4bc3a37043413bdd7c036a75c41cd5f57d8db8aa25a
  haproxy-router                                 sha256:7064737dd9d0a43de7a87a094487ab4d7b9e666675c53cf4806d1c9279bd6c2e
  hyperkube                                      sha256:187b9d29fea1bde9f1785584b4a7bbf9a0b9f93e1323d92d138e61c861b6286c
  insights-operator                              sha256:51dc869dc1a105165543d12eeee8229916fc15387210edc6702dbc944f7cedd7
  installer                                      sha256:a0f23a3292a23257a16189bdae75f7b5413364799e67a480dfad086737e248e0
  installer-artifacts                            sha256:afe926af218d506a7f64ef3df0d949aa6653a311a320bc833398512d1f000645
  ironic                                         sha256:80087bd97c28c69fc08cd291f6115b0e12698abf2e87a3d2bbe0e64f600bae93
  ironic-hardware-inventory-recorder             sha256:2336af8eb4949ec283dc22865637e3fec80a4f6b1d3b78178d58ea05afbd49c2
  ironic-inspector                               sha256:1f48cc344aab15c107e2fb381f9825613f586e116c218cdaf18d1e67b13e2252
  ironic-ipa-downloader                          sha256:a417b910e06ad030b480988d6864367c604027d6476e02e0c3d5dcd6f6ab4ccb
  ironic-machine-os-downloader                   sha256:10b751d8e4ba2975dabc256c7ac4dcf94f4de99be35242505bf8db922e968403
  ironic-static-ip-manager                       sha256:0c122317e3a6407a56a16067d518c18ce08f883883745b2e11a5a39ff695d3d0
  jenkins                                        sha256:d4ab77a119479a95a33beac0d94980a7a0a87cf792f5850b30dff4f1f90a9c4d
  jenkins-agent-maven                            sha256:10559ec206191a9931b1044260007fe8dcedacb8b171be737dfb1ccca9bbf0f5
  jenkins-agent-nodejs                           sha256:ad9e83ea1ea3f338af4dbc9461f8b243bd817df722909293fde33b4f9cbab2bc
  k8s-prometheus-adapter                         sha256:be548d31a65e56234e4b98d6541a14936bc0135875ec61e068578f7014aac31e
  keepalived-ipfailover                          sha256:a882a11b55b2fc41b538b59bf5db8e4cfc47c537890e4906fe6bf22f9da75575
  kube-client-agent                              sha256:8eb481214103d8e0b5fe982ffd682f838b969c8ff7d4f3ed4f83d4a444fb841b
  kube-etcd-signer-server                        sha256:8468b1c575906ed41aa7c3ac3b0a440bf3bc254d2975ecc5e23f84aa54395c81
  kube-proxy                                     sha256:886ae5bd5777773c7ef2fc76f1100cc8f592653ce46f73b816de80a20a113769
  kube-rbac-proxy                                sha256:f6351c3aa750fea93050673f66c5ddaaf9e1db241c7ebe31f555e011b20d8c30
  kube-state-metrics                             sha256:ca47160369e67e1d502e93175f6360645ae02933cceddadedabe53cd874f0f89
  kube-storage-version-migrator                  sha256:319e88c22ea618e7b013166eace41c52eb70c8ad950868205f52385f09e96023
  kuryr-cni                                      sha256:3eecf00fdfca50e90ba2d659bd765eb04b5c446579e121656badcfd41da87663
  kuryr-controller                               sha256:7d70c92699a69a589a3c2e1045a16855ba02af39ce09d6a6df9b1dbabacff4f5
  libvirt-machine-controllers                    sha256:cc3c7778de8d9e8e4ed543655392f942d871317f4b3b7ed31208312b4cc2e61f
  local-storage-static-provisioner               sha256:a7ff3ec289d426c7aaee35a459ef8c862b744d709099dedcd98a4579136f7d47
  machine-api-operator                           sha256:4ca2f1b93ad00364c053592aea0992bbb3cb4b2ea2f7d1d1af286c26659c11d3
  machine-config-operator                        sha256:31dfdca3584982ed5a82d3017322b7d65a491ab25080c427f3f07d9ce93c52e2
  machine-os-content                             sha256:b397960b7cc14c2e2603111b7385c6e8e4b0f683f9873cd9252a789175e5c4e1
  mdns-publisher                                 sha256:dea1fcb456eae4aabdf5d2d5c537a968a2dafc3da52fe20e8d99a176fccaabce
  multus-admission-controller                    sha256:377ed5566c062bd2a677ddc0c962924c81796f8d45346b2eefedf5350d7de6b3
  multus-cni                                     sha256:bc58468a736e75083e0771d88095229bdd6c1e58db8aa33ef60b326e0bfaf271
  multus-route-override-cni                      sha256:e078599fde3b974832c06312973fae7ed93334ea30247b11b9f1861e2b0da7d6
  multus-whereabouts-ipam-cni                    sha256:89c386f5c3940d88d9bc2520f422a2983514f928585a51ae376c43f19e5a6cad
  must-gather                                    sha256:a295d2568410a45f1ab403173ee84d7012bb3ec010c24aa0a17925d08d726e20
  oauth-proxy                                    sha256:619bdb128e410b52451dbf79c9efb089e138127812da19a1f69907117480827f
  oauth-server                                   sha256:58545567c899686cae51d2de4e53a5d49323183a7a3065c0b96ad674686acbe8
  openshift-apiserver                            sha256:8fd79797e6e0e9337fc9689863c3817540a003685a6dfc2a55ecb77059967cef
  openshift-controller-manager                   sha256:4485d6eb7625becf581473690858a01ab83244ecb03bb0319bf849068e98a86a
  openshift-state-metrics                        sha256:6de02ce03089b715e9f767142de33f006809226f037fe21544e1f79755ade920
  openstack-machine-controllers                  sha256:d61e611416196650c81174967e5f11cbdc051d696e38ba341de169375d985709
  operator-lifecycle-manager                     sha256:6e1bca545c35fb7ae4d0f57006acce9a9fabce792c4026944da68d7ddfdec244
  operator-marketplace                           sha256:f0750960873a7cc96f7106e20ea260dd41c09b8a30ce714092d3dcd8a7ec396d
  operator-registry                              sha256:7914f42c9274d263c6ba8623db8e6af4940753dcb4160deb291a9cbc61487414
  ovirt-machine-controllers                      sha256:44f9e65ccd39858bf3d7aa2929f5feac634407e36f912ca88585b445d161506c
  ovn-kubernetes                                 sha256:d80899ed1a6a9f99eb8c64856cd4e576f6534b7390777f3180afb8a634743d62
  pod                                            sha256:d7862a735f492a18cb127742b5c2252281aa8f3bd92189176dd46ae9620ee68a
  prom-label-proxy                               sha256:1cf614e8acbe3bcca3978a07489cd47627f3a3bd132a5c2fe0072d9e3e797210
  prometheus                                     sha256:5eea86e59ffb32fca37cacff22ad00838ea6b947272138f8a56062f68ec40c28
  prometheus-alertmanager                        sha256:bb710e91873ad50ac10c2821b2a28c29e5b89b5da7740a920235ecc33fb063f5
  prometheus-config-reloader                     sha256:7cadb408d7c78440ddacf2770028ee0389b6840651c753f4b24032548f56b7aa
  prometheus-node-exporter                       sha256:7d4e76fea0786f4025e37b5ad0fb30498db5586183fc560554626e91066f60f3
  prometheus-operator                            sha256:6e599a9a8691cce0b40bf1ac5373ddb8009113a2115b5617b2d3a3996174c8f7
  sdn                                            sha256:08c256b7b07c57f195faa33ea4273694dd3504d4a85a10dbf7616b91eaa8e661
  service-ca-operator                            sha256:8c9a3071040f956cce15d1e6da70f6f47dc55b609e4f19fe469ce581cd42bfe5
  service-catalog                                sha256:d9a5fbf60e3bbf1c9811e1707ce9bd04e8263552ba3a6bea8f8c7b604808fdf9
  telemeter                                      sha256:19cfc3e37e12d9dd4e4dd9307781368bbeb07929b6ab788e99aa5543badee3c9
  tests                                          sha256:fc56c9805e2e4a8416c1c5433d7974148f0bad88be4a62feeedcd5d9db4b6ad6
  thanos                                         sha256:a4ea116aec2f972991f5a22f39aa1dbc567dddc3429ddca873601714d003a51c
```
{{< /details >}}

### 创建内部镜像仓库

内部镜像仓库用于存放部署 OCP 集群所需的镜像，仓库本身使用 `Quay` 部署。Quay 包含了几个核心组件：

+ **数据库** : 主要存放镜像仓库的元数据（非镜像存储)
+ **Redis** : 存放构建日志和Quay的向导
+ **Quay** : 作为镜像仓库
+ **Clair** : 提供镜像扫描功能

首先修改镜像仓库节点的主机名：

```bash
$ hostnamectl set-hostname registry.openshift4.example.com
```

{{< alert >}}
所有节点主机名都要采用三级域名格式，如 `master1.aa.bb.com`。
{{< /alert >}}

接着安装 `podman`：

```bash
$ yum install -y podman
```

先创建一个 `Pod`，用来共享 Network Namespace：

```bash
🐳 → podman pod create --name quay -p 443:8443
```

安装 Mysql 数据库：

```bash
$ mkdir -p /data/quay/lib/mysql
$ chmod 777 /data/quay/lib/mysql
$ export MYSQL_CONTAINER_NAME=quay-mysql
$ export MYSQL_DATABASE=enterpriseregistrydb
$ export MYSQL_PASSWORD=<PASSWD>
$ export MYSQL_USER=quayuser
$ export MYSQL_ROOT_PASSWORD=<PASSWD>
$ podman run \
    --detach \
    --restart=always \
    --env MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD} \
    --env MYSQL_USER=${MYSQL_USER} \
    --env MYSQL_PASSWORD=${MYSQL_PASSWORD} \
    --env MYSQL_DATABASE=${MYSQL_DATABASE} \
    --name ${MYSQL_CONTAINER_NAME} \
    --privileged=true \
    --pod quay \
    -v /data/quay/lib/mysql:/var/lib/mysql/data:Z \
    registry.access.redhat.com/rhscl/mysql-57-rhel7
```

安装 Redis：

```bash
$ mkdir -p /data/quay/lib/redis
$ chmod 777 /data/quay/lib/redis
$ podman run -d --restart=always \
    --pod quay \
    --privileged=true \
    --name quay-redis \
    -v  /data/quay/lib/redis:/var/lib/redis/data:Z \
    registry.access.redhat.com/rhscl/redis-32-rhel7
```

获取 Red Hat Quay v3 镜像的访问权： 

```bash
$ podman login -u="redhat+quay" -p="O81WSHRSJR14UAZBK54GQHJS0P1V4CLWAJV1X2C4SD7KO59CQ9N3RE12612XU1HR" quay.io
```

参考：[https://access.redhat.com/solutions/3533201](https://access.redhat.com/solutions/3533201)

配置 Quay：

```bash
$ podman run --privileged=true \
    --name quay-config \
    --pod quay \
    --add-host mysql:127.0.0.1 \
    --add-host redis:127.0.0.1 \
    --add-host clair:127.0.0.1 \
    -d quay.io/redhat/quay:v3.3.0 config icloudnative.io
```

这一步会启动一个配置 Quay 的进程，打开浏览器访问：https://registry.openshift4.example.com，用户名/密码为：`quayconfig/icloudnative.io`：

![](https://images.icloudnative.io/uPic/20200531150958.png)

选择新建配置，然后设置数据库：

![](https://images.icloudnative.io/uPic/20200531151305.png)

设置超级管理员：

![](https://images.icloudnative.io/uPic/20200531152429.png)

下一个界面要设置两个地方，一个是 Server configuration 的 `Server Hostname`，另一个是 `Redis Hostname`，SSL 不用设置，后面直接通过命令行配置：

![](https://images.icloudnative.io/uPic/20200531152811.png)

![](https://images.icloudnative.io/uPic/20200531152931.png)

![](https://images.icloudnative.io/uPic/20200531153820.png)

配置检查通过后，就可以保存下载下来：

![](https://images.icloudnative.io/uPic/20200531154244.png)

最后会导出一个 `quay-config.tar.gz`，将其上传到 Quay 所在的服务器，解压到配置文件目录：

```bash
$ mkdir -p /data/quay/config
$ mkdir -p /data/quay/storage
$ cp quay-config.tar.gz /data/quay/config/
$ cd /data/quay/config/
$ tar zxvf quay-config.tar.gz
```

生成自签名证书：

```bash
# 生成私钥
$ openssl genrsa -out ssl.key 1024
```

根据私钥生成证书申请文件 `csr`：

```bash
$ openssl req -new -key ssl.key -out ssl.csr
```

这里根据命令行向导来进行信息输入：

![](https://images.icloudnative.io/uPic/20200529105713.png)

**Common Name 可以输入：`*.yourdomain.com`，这种方式可以生成通配符域名证书。**

使用私钥对证书申请进行签名从而生成证书：

```bash
$ openssl x509 -req -in ssl.csr -out ssl.cert -signkey ssl.key -days 3650
```

这样就生成了有效期为 10 年的证书文件，对于自己内网服务使用足够。

或者你也可以一步到位：

```bash
$ openssl req \
  -newkey rsa:2048 -nodes -keyout ssl.key \
  -x509 -days 3650 -out ssl.cert -subj \
  "/C=CN/ST=Shanghai/L=Shanghai/O=IBM/OU=IBM/CN=*.openshift4.example.com"
```

证书搞定了之后，还需要修改 `config.yaml`，将协议修改为 `https`：

```yaml
PREFERRED_URL_SCHEME: https
```

然后停止 quay-config：

```bash
$ podman stop quay-config
```

最后一步才是部署 Quay：

```bash
$ podman run --restart=always \
    --sysctl net.core.somaxconn=4096 \
    --privileged=true \
    --name quay-master \
    --pod quay \
    --add-host mysql:127.0.0.1 \
    --add-host redis:127.0.0.1 \
    --add-host clair:127.0.0.1 \
    -v /data/quay/config:/conf/stack:Z \
    -v /data/quay/storage:/datastorage:Z \
    -d quay.io/redhat/quay:v3.3.0
```

安装成功后，将自签名的证书复制到默认信任证书路径：

```bash
$ cp ssl.cert /etc/pki/ca-trust/source/anchors/ssl.crt
$ update-ca-trust extract
```

现在可以通过 `podman login` 命令来测试仓库的连通性，看到如下字样即表示安装成功（也可以通过浏览器访问 Web UI）：

```bash
🐳 → podman login registry.openshift4.example.com
Username: admin
Password: ********

Login Succeeded
```

如果使用 Docker 登录，需要将证书复制到 docker 的信任证书路径：

```bash
$ mkdir -p /etc/docker/certs.d/registry.openshift4.example.com
$ cp ssl.cert /etc/docker/certs.d/registry.openshift4.example.com/ssl.crt
$ systemctl restart docker
```

### 下载镜像文件

准备拉取镜像权限认证文件。 从 `Red Hat OpenShift Cluster Manager` 站点的 [Pull Secret 页面](https://cloud.redhat.com/openshift/install/pull-secret)下载 `registry.redhat.io` 的 `pull secret`。

```bash
# 把下载的 txt 文件转出 json 格式，如果没有 jq 命令，通过 epel 源安装
$ cat ./pull-secret.txt | jq . > pull-secret.json

$ yum install epel-release
$ yum install jq
```

JSON 内容如下：

```json
{
  "auths": {
    "cloud.openshift.com": {
      "auth": "b3BlbnNo...",
      "email": "you@example.com"
    },
    "quay.io": {
      "auth": "b3BlbnNo...",
      "email": "you@example.com"
    },
    "registry.connect.redhat.com": {
      "auth": "NTE3Njg5Nj...",
      "email": "you@example.com"
    },
    "registry.redhat.io": {
      "auth": "NTE3Njg5Nj...",
      "email": "you@example.com"
    }
  }
}
```

把本地仓库的用户密码转换成 `base64` 编码：

```bash
$ echo -n 'admin:password' | base64 -w0 
cm9vdDpwYXNzd29yZA==
```

然后在 `pull-secret.json` 里面加一段本地仓库的权限。第一行仓库域名和端口，第二行是上面的 `base64`，第三行随便填个邮箱：

```json
  "auths": {
...
    "registry.openshift4.example.com": {
      "auth": "cm9vdDpwYXNzd29yZA==",
      "email": "you@example.com"
   },
...
```

设置环境变量：

```bash
$ export OCP_RELEASE="4.4.5-x86_64"
$ export LOCAL_REGISTRY='registry.openshift4.example.com' 
$ export LOCAL_REPOSITORY='ocp4/openshift4'
$ export PRODUCT_REPO='openshift-release-dev'
$ export LOCAL_SECRET_JSON='/root/pull-secret.json'
$ export RELEASE_NAME="ocp-release"
```

+ **OCP_RELEASE** : OCP 版本，可以在[这个页面](https://quay.io/repository/openshift-release-dev/ocp-release?tab=tags)查看。如果版本不对，下面执行 `oc adm` 时会提示 `image does not exist`。
+ **LOCAL_REGISTRY** : 本地仓库的域名和端口。
+ **LOCAL_REPOSITORY** : 镜像存储库名称，使用 `ocp4/openshift4`。
+ `PRODUCT_REPO` 和 `RELEASE_NAME` 都不需要改，这些都是一些版本特征，保持不变即可。
+ **LOCAL_SECRET_JSON** : 密钥路径，就是上面 `pull-secret.json` 的存放路径。

在 Quay 中创建一个组织（`Organization`）`ocp4` 用来存放同步过来的镜像。

最后一步就是同步镜像，这一步的动作就是把 `quay` 官方仓库中的镜像同步到本地仓库，如果失败了可以重新执行命令，整体内容大概 `5G`。

```bash
$ oc adm -a ${LOCAL_SECRET_JSON} release mirror \
     --from=quay.io/${PRODUCT_REPO}/${RELEASE_NAME}:${OCP_RELEASE} \
     --to=${LOCAL_REGISTRY}/${LOCAL_REPOSITORY} \
     --to-release-image=${LOCAL_REGISTRY}/${LOCAL_REPOSITORY}:${OCP_RELEASE}
```

`oc adm release mirror` 命令执行完成后会输出下面类似的信息，保存下来，将来会用在 `install-config.yaml` 文件中：

```yaml
imageContentSources:
- mirrors:
  - registry.openshift4.example.com/ocp4/openshift4
  source: quay.io/openshift-release-dev/ocp-release
- mirrors:
  - registry.openshift4.example.com/ocp4/openshift4
  source: quay.io/openshift-release-dev/ocp-v4.0-art-dev
```

本地镜像仓库缓存好镜像之后，通过 `tag/list` 接口查看所有 tag，如果能列出来一堆就说明是正常的：

{{< details title="本地仓库 tag 信息" closed="true" >}}
```bash
$ curl -s -X GET -H "Authorization: Bearer <token>" https://registry.openshift4.example.com/api/v1/repository/ocp4/openshift4/tag/|jq .

{
  "has_additional": true,
  "page": 1,
  "tags": [
    {
      "name": "4.4.5-cluster-kube-scheduler-operator",
      "reversion": false,
      "start_ts": 1590821178,
      "image_id": "a778898a93d4fc5413abea38aa604d14d7efbd99ee1ea75d2d1bea3c27a05859",
      "last_modified": "Sat, 30 May 2020 06:46:18 -0000",
      "manifest_digest": "sha256:887eda5ce495f1a33c5adbba8772064d3a8b78192162e4c75bd84763c5a1fb01",
      "docker_image_id": "a778898a93d4fc5413abea38aa604d14d7efbd99ee1ea75d2d1bea3c27a05859",
      "is_manifest_list": false,
      "size": 103582366
    },
    {
      "name": "4.4.5-kube-rbac-proxy",
      "reversion": false,
      "start_ts": 1590821178,
      "image_id": "f1714cda6028bd7998fbba1eb79348f33b9ed9ccb0a69388da2eb0aefc222f85",
      "last_modified": "Sat, 30 May 2020 06:46:18 -0000",
      "manifest_digest": "sha256:f6351c3aa750fea93050673f66c5ddaaf9e1db241c7ebe31f555e011b20d8c30",
      "docker_image_id": "f1714cda6028bd7998fbba1eb79348f33b9ed9ccb0a69388da2eb0aefc222f85",
      "is_manifest_list": false,
      "size": 102366055
    },
    {
      "name": "4.4.5-cluster-kube-controller-manager-operator",
      "reversion": false,
      "start_ts": 1590821178,
      "image_id": "bc7e19d35ec08c1a93058db1705998da2f8bbe5cdbb7f3f5974e6176e2f79eb6",
      "last_modified": "Sat, 30 May 2020 06:46:18 -0000",
      "manifest_digest": "sha256:0aa16b4ff32fbb9bc7b32aa1bf6441a19a1deb775fb203f21bb8792ff1a26c2e",
      "docker_image_id": "bc7e19d35ec08c1a93058db1705998da2f8bbe5cdbb7f3f5974e6176e2f79eb6",
      "is_manifest_list": false,
      "size": 104264263
    },
    {
      "name": "4.4.5-baremetal-operator",
      "reversion": false,
      "start_ts": 1590821178,
      "image_id": "6ec90c0fb53125801d41b37f8f28c4679e49ce19427f7848803a2bc397e4c23b",
      "last_modified": "Sat, 30 May 2020 06:46:18 -0000",
      "manifest_digest": "sha256:a77ff02f349d96567da8e06018ad0dfbfb5fef6600a9a216ade15fadc574f4b4",
      "docker_image_id": "6ec90c0fb53125801d41b37f8f28c4679e49ce19427f7848803a2bc397e4c23b",
      "is_manifest_list": false,
      "size": 110117444
    },
    {
      "name": "4.4.5-cluster-etcd-operator",
      "reversion": false,
      "start_ts": 1590821178,
      "image_id": "d0cf3539496e075954e53fce5ed56445ae87f9f32cfb41e9352a23af4aa04d69",
      "last_modified": "Sat, 30 May 2020 06:46:18 -0000",
      "manifest_digest": "sha256:9f7a02df3a5d91326d95e444e2e249f8205632ae986d6dccc7f007ec65c8af77",
      "docker_image_id": "d0cf3539496e075954e53fce5ed56445ae87f9f32cfb41e9352a23af4aa04d69",
      "is_manifest_list": false,
      "size": 103890103
    },
    {
      "name": "4.4.5-openshift-apiserver",
      "reversion": false,
      "start_ts": 1590821177,
      "image_id": "eba5a051dcbab534228728c7295d31edc0323c7930fa44b40059cf8d22948363",
      "last_modified": "Sat, 30 May 2020 06:46:17 -0000",
      "manifest_digest": "sha256:8fd79797e6e0e9337fc9689863c3817540a003685a6dfc2a55ecb77059967cef",
      "docker_image_id": "eba5a051dcbab534228728c7295d31edc0323c7930fa44b40059cf8d22948363",
      "is_manifest_list": false,
      "size": 109243025
    },
    {
      "name": "4.4.5-kube-client-agent",
      "reversion": false,
      "start_ts": 1590821177,
      "image_id": "fc1fdfb96e9cd250024094b15efa79344c955c7d0c93253df312ffdae02b5524",
      "last_modified": "Sat, 30 May 2020 06:46:17 -0000",
      "manifest_digest": "sha256:8eb481214103d8e0b5fe982ffd682f838b969c8ff7d4f3ed4f83d4a444fb841b",
      "docker_image_id": "fc1fdfb96e9cd250024094b15efa79344c955c7d0c93253df312ffdae02b5524",
      "is_manifest_list": false,
      "size": 99721802
    },
    {
      "name": "4.4.5-kube-proxy",
      "reversion": false,
      "start_ts": 1590821177,
      "image_id": "d2577f4816cb81444ef3b441bf9769904c602cd6626982c2fd8ebba162fd0c08",
      "last_modified": "Sat, 30 May 2020 06:46:17 -0000",
      "manifest_digest": "sha256:886ae5bd5777773c7ef2fc76f1100cc8f592653ce46f73b816de80a20a113769",
      "docker_image_id": "d2577f4816cb81444ef3b441bf9769904c602cd6626982c2fd8ebba162fd0c08",
      "is_manifest_list": false,
      "size": 103473573
    },
    ...
}
```
{{< /details >}}

这里需要创建一个 `OAuth access token` 来访问 `Quay` 的 API，创建过程如下：

1. 浏览器登录 Red Hat Quay，选择一个组织（`Organization`），例如 `ocp4`。
2. 在左侧导航中选择 `Applications` 图标。
3. 选择 `Create New Application`，输入 Application 的名字然后回车。
4. 选择你新创建的 Application，在左侧导航栏中选择 `Generate Token`。
5. 选择相应的权限，然后点击 `Generate Access Token`。
6. 再次确认你设置的权限，然后点击 `Authorize Application`。
7. 保管好生成的 token。

Quay 的 API 文档可以参考这里：[Appendix A: Red Hat Quay Application Programming Interface (API)](https://access.redhat.com/documentation/en-us/red_hat_quay/3.3/html/red_hat_quay_api_guide/appendix_a_red_hat_quay_application_programming_interface_api)。

Quay 中也能看到所有的镜像：

![](https://images.icloudnative.io/uPic/20200531121844.png)

### 提取 openshift-install 命令

为了保证安装版本一致性，需要从镜像库中提取 `openshift-install` 二进制文件，不能直接从 https://mirror.openshift.com/pub/openshift-v4/clients/ocp/4.4.5 下载，不然后面会有 `sha256` 匹配不上的问题。

```bash
# 这一步需要用到上面的 export 变量
$ oc adm release extract \
  -a ${LOCAL_SECRET_JSON} \
  --command=openshift-install \
  "${LOCAL_REGISTRY}/${LOCAL_REPOSITORY}:${OCP_RELEASE}"
```

如果提示 `error: image dose not exist`，说明拉取的镜像不全，或者版本不对。

把文件移动到 `$PATH` 并确认版本：

```bash
$ chmod +x openshift-install
$ mv openshift-install /usr/local/bin/

$ openshift-install version
openshift-install 4.4.5
built from commit 15eac3785998a5bc250c9f72101a4a9cb767e494
release image registry.openshift4.example.com/ocp4/openshift4@sha256:4a461dc23a9d323c8bd7a8631bed078a9e5eec690ce073f78b645c83fb4cdf74
```

## 3. 准备 Image Stream 样例镜像

准备一个镜像列表，然后使用 `oc image mirror` 将镜像同步到私有仓库中：

```bash
cat sample-images.txt | while read line; do
  target=$(echo $line | sed 's/registry.redhat.io/registry.openshift4.example.com/')
  oc image mirror -a ${LOCAL_SECRET_JSON} $line $target
done
```

如果之前装过 OCP 4.4.5，把 `openshift-cluster-samples-operator` 项目下 `cluster-samples-operator` Pod 的 `/opt/openshift` 目录同步出来，简单 grep 一下就都有了完整的镜像列表。

完整列表参考[这里](https://gist.github.com/yuanlinios/7eea8207083e649cbe07e108a22df00b)。

同步过程中如果遇到报错，可根据报错信息到 `Quay` 中创建相应的 `Organization`，不用中断任务。这里给出一个参考，需要创建以下的 Organization：

```bash
rhscl
jboss-datavirt-6
3scale-amp21
3scale-amp22
3scale-amp23
3scale-amp24
3scale-amp25
3scale-amp26
jboss-eap-6
devtools
openshift3
rhpam-7
rhdm-7
jboss-amq-6
jboss-datagrid-7
jboss-datagrid-6
jboss-webserver-3
amq-broker-7
jboss-webserver-5
redhat-sso-7
openjdk
redhat-openjdk-18
fuse7
dotnet
```



## 4. 准备 OperatorHub 离线资源

首先在 Quay 中创建一个 `devinfra` 项目，然后构建 RedHat Operators 的 `catalog image`, 保存为 `registry.openshift4.example.com/devinfra/redhat-operators:v1`。

```bash
$ oc adm catalog build \
  -a ${LOCAL_SECRET_JSON} \
  --appregistry-endpoint https://quay.io/cnr \
  --from=registry.redhat.io/openshift4/ose-operator-registry:v4.4 \
  --appregistry-org redhat-operators \
  --to=registry.openshift4.example.com/devinfra/redhat-operators:v1
```

这个 catalog image 相当于 `RedHat Operators` 的一个目录，通过 `catalog image` 可以找到  `RedHat Operators` 的所有镜像。而且 catalog image 使用 `sha256 digest` 来引用镜像，能够确保应用有稳定可重复的部署。

然后使用 catalog image 同步 `RedHat Operators` 的所有镜像到私有仓库：

```bash
$ oc adm catalog mirror \
  -a ${LOCAL_SECRET_JSON} \
  registry.openshift4.example.com/devinfra/redhat-operators:v1 \
  registry.openshift4.example.com
```

**如果执行过程中遇到 `project not found` 之类的错误，可根据报错信息到 Quay 中创建相应的项目，不用中断任务。**

这里还会遇到一个 bug，执行到最后会有如下的报错信息：

```bash
...
I0409 08:04:48.342110   11331 mirror.go:231] wrote database to /tmp/db-225652515/bundles.db
W0409 08:04:48.347417   11331 mirror.go:258] errors during mirroring. the full contents of the catalog may not have been mirrored: couldn't parse image for mirroring (), skipping mirror: invalid reference format
I0409 08:04:48.385816   11331 mirror.go:329] wrote mirroring manifests to redhat-operators-manifests
```

先来看看有哪些 Operators：

```bash
$ sqlite3 /tmp/db-225652515/bundles.db 'select * from related_image'|grep '^|'
```

随便挑一个 Operator，查看其 `ClusterServiceVersion` 的 `spec.relatedImages` 字段内容：

```yaml
$ cat /tmp/cache-943388495/manifests-698804708/3scale-operator/3scale-operator-9re7jpyl/0.5.0/3scale-operator.v0.5.0.clusterserviceversion.yaml

...
spec:
  replaces: 3scale-operator.v0.4.2
  relatedImages:
  - name: apicast-gateway-rhel8
    image: registry.redhat.io/3scale-amp2/apicast-gateway-rhel8@sha256:21be62a6557846337dc0cf764be63442718fab03b95c198a301363886a9e74f9
  - name: backend-rhel7
    image: registry.redhat.io/3scale-amp2/backend-rhel7@sha256:ea8a31345d3c2a56b02998b019db2e17f61eeaa26790a07962d5e3b66032d8e5
  - name: system-rhel7
    image: registry.redhat.io/3scale-amp2/system-rhel7@sha256:93819c324831353bb8f7cb6e9910694b88609c3a20d4c1b9a22d9c2bbfbad16f
  - name: zync-rhel7
    image: registry.redhat.io/3scale-amp2/zync-rhel7@sha256:f4d5c1fdebe306f4e891ddfc4d3045a622d2f01db21ecfc9397cab25c9baa91a
  - name: memcached-rhel7
    image: registry.redhat.io/3scale-amp2/memcached-rhel7@sha256:ff5f3d2d131631d5db8985a5855ff4607e91f0aa86d07dafdcec4f7da13c9e05
  - name: redis-32-rhel7
    value: registry.redhat.io/rhscl/redis-32-rhel7@sha256:a9bdf52384a222635efc0284db47d12fbde8c3d0fcb66517ba8eefad1d4e9dc9
  - name: mysql-57-rhel7
    value: registry.redhat.io/rhscl/mysql-57-rhel7@sha256:9a781abe7581cc141e14a7e404ec34125b3e89c008b14f4e7b41e094fd3049fe
  - name: postgresql-10-rhel7
    value: registry.redhat.io/rhscl/postgresql-10-rhel7@sha256:de3ab628b403dc5eed986a7f392c34687bddafee7bdfccfd65cecf137ade3dfd
...
```

**可以看到 `relatedImages` 列表中有些条目的键是 `value` 而不是 `image`，这就是问题所在！** 那些没有 image 的条目在反序列化时会将 image 的值当成空字符串 `""`：

```bash
$ sqlite3 /tmp/db-225652515/bundles.db 'select * from related_image where operatorbundle_name="3scale-operator.v0.5.0"'

registry.redhat.io/3scale-amp2/zync-rhel7@sha256:f4d5c1fdebe306f4e891ddfc4d3045a622d2f01db21ecfc9397cab25c9baa91a|3scale-operator.v0.5.0
registry.redhat.io/3scale-amp2/memcached-rhel7@sha256:ff5f3d2d131631d5db8985a5855ff4607e91f0aa86d07dafdcec4f7da13c9e05|3scale-operator.v0.5.0
|3scale-operator.v0.5.0
registry.redhat.io/3scale-amp2/apicast-gateway-rhel8@sha256:21be62a6557846337dc0cf764be63442718fab03b95c198a301363886a9e74f9|3scale-operator.v0.5.0
registry.redhat.io/3scale-amp2/backend-rhel7@sha256:ea8a31345d3c2a56b02998b019db2e17f61eeaa26790a07962d5e3b66032d8e5|3scale-operator.v0.5.0
registry.redhat.io/3scale-amp2/3scale-rhel7-operator@sha256:2ba16314ee046b3c3814fe4e356b728da6853743bd72f8651e1a338e8bbf4f81|3scale-operator.v0.5.0
registry.redhat.io/3scale-amp2/system-rhel7@sha256:93819c324831353bb8f7cb6e9910694b88609c3a20d4c1b9a22d9c2bbfbad16f|3scale-operator.v0.5.0
```

从上面的输出可以看到键为 `value` 的那几个条目都反序列化失败了，具体的讨论参考：[bundle validate should validate that there are no empty relatedImages](https://bugzilla.redhat.com/show_bug.cgi?id=1821515)。

这里给出一个临时解决方案，先打开另外一个窗口，然后回到原来的窗口执行命令：

```bash
$ oc adm catalog mirror \
  -a ${LOCAL_SECRET_JSON} \
  registry.openshift4.example.com/devinfra/redhat-operators:v1 \
  registry.openshift4.example.com
```

然后迅速切到下一个窗口，查找最新的 manifest 缓存目录：

```bash
$ ls -l /tmp/cache-*/
```

根据日期判断最新的缓存目录，假设是 `/tmp/cache-320634009`，然后将所有的 `value` 替换为 `image`：

```bash
$ sed -i "s/value: registry/image: registry/g" $(egrep -rl "value: registry" /tmp/cache-320634009/)
```

同步完成后会产生 `redhat-operators-manifests` 目录，下面有两个文件: 

+ **imageContentSourcePolicy.yaml** : 定义了一个 `ImageContentSourcePolicy` 对象，该对象可以配置节点将其对官方 Operator manifests 中镜像的引用改为对本地镜像仓库中镜像的引用。
+ **mapping.txt** : 包含了所有的源镜像在本地镜像仓库中的映射位置。`oc image mirror` 命令可以引用该文件进一步修改镜像配置。

然而目前这么做还是有问题 [1800674](https://bugzilla.redhat.com/show_bug.cgi?id=1800674): 同步出来的镜像 `manifest digest` 不对，导致后面离线安装 Operator 时会报镜像无法获取的错误。

暂时可以使用上面 bugzilla 链接里给出的临时解决方案，先安装 skopeo：

```bash
$ yum install -y golang gpgme-devel libassuan-devel btrfs-progs-devel device-mapper-devel
$ git clone https://github.com/containers/skopeo
$ cd skopeo
$ make binary-local
$ mv skopeo /usr/local/bin/
```

从 `pull-secret.json` 中解码 `quay.io`、`registry.redhat.io` 和 `registry.access.redhat.com` 的用户名密码，然后通过下面的命令认证：

```bash
$ skopeo login -u <quay.io_user> -p <quay.io_psw> quay.io
$ skopeo login -u <registry.redhat.io_user> -p <registry.redhat.io_psw> registry.redhat.io
$ skopeo login -u <registry.access.redhat.com_user> -p <registry.access.redhat.com_psw> registry.access.redhat.com
```

最后同步镜像的 manifest digest：

```bash
cat redhat-operators-manifests/mapping.txt | while read line; do
  origin=$(echo $line | cut -d= -f1)
  target=$(echo $line | cut -d= -f2)
  if [[ "$origin" =~ "sha256" ]]; then
    tag=$(echo $origin | cut -d: -f2 | cut -c -8)
    skopeo copy --all docker://$origin docker://$target:$tag
  else
    skopeo copy --all docker://$origin docker://$target
  fi
done
```

不得不说，OCP 的安装真是个浩大的工程，这洋洋洒洒的一大篇也只是准备了离线资源，这只是安装的一小步，还有很长的步骤要写，心理素质不过关的同学切勿随意模仿。

## 5. 参考资料

+ [离线部署 Openshift Container Platform 4.3 - 1: 准备离线资源](https://notes.yuanlinios.me/2020-03-15/%E7%A6%BB%E7%BA%BF%E9%83%A8%E7%BD%B2-Openshift-Container-Platform-4-3-1-%E5%87%86%E5%A4%87%E7%A6%BB%E7%BA%BF%E8%B5%84%E6%BA%90/)
+ [Chapter 9. Using Operator Lifecycle Manager on restricted networks](https://access.redhat.com/documentation/en-us/openshift_container_platform/4.4/html/operators/olm-restricted-networks)
