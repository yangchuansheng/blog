---
title: "在服务网格内部调用外部 TCP 服务"
subtitle: "TCP 流量的出口规则"
date: 2018-11-23T14:18:48+08:00
draft: false
author: 米开朗基杨
toc: true
categories: 
- service-mesh
tags:
- Istio
- Kubernetes
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/EKPE9QoWkAEtYWt.jpeg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

> 本篇博客于 2018 年 7 月 23 日更新。新版本使用了 Istio 1.0，并使用了新的 [v1alpha3 流量管理 API](https://preliminary.istio.io/zh/blog/2018/v1alpha3-routing/)。如果您使用的 Istio 是旧版本，请参考 [这篇文档](https://archive.istio.io/v0.7/blog/2018/egress-tcp.html)。

在上一篇文章[在服务网格内部调用外部 Web 服务](/posts/egress-https/)中，我描述了如何让 Istio 服务网格中的微服务通过 HTTPS 协议和外部的 Web 服务进行通信。本文我将着重介绍如何让 Istio 服务网格中的微服务通过 `TCP` 协议和外部服务进行通信。讲解的过程中会用到 [Bookinfo 示例应用程序](https://preliminary.istio.io/docs/examples/bookinfo/)中将书籍评级数据保存在 MySQL 数据库中的那个版本。数据库部署在集群外，`ratings` 服务调用该数据库，还要定义一个 `ServiceEntry` 以允许网格内的应用程序访问外部的数据库。

## Bookinfo 示例应用程序与外部评级数据库

首先，在 Kubernetes 集群之外设置了一个 MySQL 数据库实例来保存 Bookinfo 评级数据，然后修改 [Bookinfo 示例应用程序](https://preliminary.istio.io/docs/examples/bookinfo/)以使用这个数据库。

### 为评级数据设置数据库

首先你需要创建一个 MySQL 数据库实例，你可以使用任何 MySQL 实例，我自己用的是 [Compose for MySQL](https://www.ibm.com/cloud/compose/mysql)，我使用 `mysqlsh`（[MySQL Shell](https://dev.mysql.com/doc/mysql-shell/en/)）作为 MySQL 客户端来提供评级数据。

<span id=blue>1.</span> 设置 `MYSQL_DB_HOST` 和 `MYSQL_DB_PORT` 环境变量。

```bash
$ export MYSQL_DB_HOST=<your MySQL database host>
$ export MYSQL_DB_PORT=<your MySQL database port>
```

如果你使用的是本地数据库，`host` 和 `port` 使用的是默认值，分别是 `localhost` 和 `3306`。

<span id=blue>2.</span> 运行以下命令初始化数据库，请在出现提示时输入密码。这个命令通过 `admin` 数据库用户凭证来执行，该用户是通过 [Compose for Mysql](https://www.ibm.com/cloud/compose/mysql) 创建数据库时默认创建的。

```bash
$ curl -s https://raw.githubusercontent.com/istio/istio/master/samples/bookinfo/src/mysql/mysqldb-init.sql | mysqlsh --sql --ssl-mode=REQUIRED -u admin -p --host $MYSQL_DB_HOST --port $MYSQL_DB_PORT
```

**或者**

如果你使用的是本地数据库实例，且客户端使用的是 `mysql`，可以运行以下命令来初始化：

```bash
$ curl -s https://raw.githubusercontent.com/istio/istio/master/samples/bookinfo/src/mysql/mysqldb-init.sql | mysql -u root -p --host $MYSQL_DB_HOST --port $MYSQL_DB_PORT
```

<span id=blue>3.</span> 创建一个名为 `bookinfo` 的用户，并在 `test.ratings` 表上授予它 SELECT 权限：

```bash
$ mysqlsh --sql --ssl-mode=REQUIRED -u admin -p --host $MYSQL_DB_HOST --port $MYSQL_DB_PORT -e "CREATE USER 'bookinfo' IDENTIFIED BY '<password you choose>'; GRANT SELECT ON test.ratings to 'bookinfo';"
```

**或者**

如果你使用的是本地数据库实例，且客户端使用的是 `mysql`，可以运行以下命令：

```bash
$ mysql -u root -p --host $MYSQL_DB_HOST --port $MYSQL_DB_PORT -e "CREATE USER 'bookinfo' IDENTIFIED BY '<password you choose>'; GRANT SELECT ON test.ratings to 'bookinfo';"
```

这里一般遵循[最小权限原则](https://www.wikiwand.com/zh/%E6%9C%80%E5%B0%8F%E6%9D%83%E9%99%90%E5%8E%9F%E5%88%99)，这意味着在 Bookinfo 应用程序中不会直接使用 `admin` 用户。相反，应该为 Bookinfo 应用程序创建一个最小权限的特殊用户 `bookinfo`，该用户只对单个表具有 SELECT 特权。

运行创建用户的命令后，你可能希望通过检查最后一个命令的编号和运行命令 `history -d <创建用户的命令编号>` 来清理 bash 历史记录，我相信你不会想把新用户的密码存储在 bash 历史记录中的。如果你使用的命令行工具是 `mysql`，记得要删除 `~/.mysql_history` 文件中的最后一条命令。可以在 [MySQL 官方文档](https://dev.mysql.com/doc/refman/5.5/en/create-user.html)中阅读有关新创建用户的密码保护的更多信息。

<span id=blue>4.</span> 查看创建的评级数据是否跟预期的一致：

```bash
$ mysqlsh --sql --ssl-mode=REQUIRED -u bookinfo -p --host $MYSQL_DB_HOST --port $MYSQL_DB_PORT -e "select * from test.ratings;"

Enter password:
+----------+--------+
| ReviewID | Rating |
+----------+--------+
|        1 |      5 |
|        2 |      4 |
+----------+--------+
```

**或者**

如果你使用的是本地数据库实例，且客户端使用的是 `mysql`，可以运行以下命令：

```bash
$ mysql -u bookinfo -p --host $MYSQL_DB_HOST --port $MYSQL_DB_PORT -e "select * from test.ratings;"

Enter password:
+----------+--------+
| ReviewID | Rating |
+----------+--------+
|        1 |      5 |
|        2 |      4 |
+----------+--------+
```

<span id=blue>5.</span> 暂时将评级设置为 `1`，以便在 Bookinfo ratings 服务调用数据库时提供直观的线索。

```bash
$ mysqlsh --sql --ssl-mode=REQUIRED -u admin -p --host $MYSQL_DB_HOST --port $MYSQL_DB_PORT -e "update test.ratings set rating=1; select * from test.ratings;"

Enter password:

Rows matched: 2  Changed: 2  Warnings: 0
+----------+--------+
| ReviewID | Rating |
+----------+--------+
|        1 |      1 |
|        2 |      1 |
+----------+--------+
```

**或者**

如果你使用的是本地数据库实例，且客户端使用的是 `mysql`，可以运行以下命令：

```bash
$ mysql -u root -p --host $MYSQL_DB_HOST --port $MYSQL_DB_PORT -e "update test.ratings set rating=1; select * from test.ratings;"

Enter password:
+----------+--------+
| ReviewID | Rating |
+----------+--------+
|        1 |      1 |
|        2 |      1 |
+----------+--------+
```

最后一个命令使用了 `admin` 用户（本地数据库实例使用的是 `root` 用户），因为 `bookinfo` 用户对 `test.ratings` 这个表没有 UPDATE 权限。

现在就可以部署一个使用外部数据库的 Bookinfo 应用程序了。

### Bookinfo 应用程序的初始设置

为了演示使用外部数据库的场景，首先需要一个安装了 [Istio](https://preliminary.istio.io/zh/docs/setup/kubernetes/quick-start/#%E5%AE%89%E8%A3%85%E6%AD%A5%E9%AA%A4) 的 Kubernetes 集群，然后部署 [Istio Bookinfo 示例应用程序](https://preliminary.istio.io/zh/docs/examples/bookinfo/)，并且创建了默认的 `DestinationRule`。

该应用程序使用 `ratings` 微服务来获取书籍评级，评级在 1 到 5 之间，评级显示为每个 review 的星号。有好几个版本的 `ratings` 微服务，有些版本使用 [MongoDB](https://www.mongodb.com/) 作为数据库，还有些版本使用 [MySQL](https://www.mysql.com/) 作为数据库。

本文的示例命令适用于 Istio 1.0+，无论你有没有启用[双向 TLS 认证](https://preliminary.istio.io/zh/docs/concepts/security/#%E5%8F%8C%E5%90%91-tls-%E8%AE%A4%E8%AF%81)。

以下是原始版本的 Bookinfo 示例应用程序中应用程序端到端架构的副本。

![](https://images.icloudnative.io/uPic/withistio.svg "原 Bookinfo 应用程序")

### 使用外部数据库存储 Bookinfo 应用程序的评级数据

<span id=blue>1.</span> 修改使用 MySQL 数据库的 ratings 服务版本的 deployment 配置文件中的环境变量，将其修改成你自己的数据库实例信息。该 yaml 文件位于 Istio 发行存档的 [samples/bookinfo/platform/kube/bookinfo-ratings-v2-mysql.yaml](https://github.com/istio/istio/blob/master/samples/bookinfo/platform/kube/bookinfo-ratings-v2-mysql.yaml)中。修改以下几行：

```yaml
- name: MYSQL_DB_HOST
  value: mysqldb
- name: MYSQL_DB_PORT
  value: "3306"
- name: MYSQL_DB_USER
  value: root
- name: MYSQL_DB_PASSWORD
  value: password
```

将数据库的 IP、端口、用户名和密码替换成实际的值。请注意，在 Kubernetes 中使用容器环境变量中密码的正确方法是[使用 secret](https://kubernetes.io/docs/concepts/configuration/secret/#using-secrets-as-environment-variables)，本文只是为了便于演示在 deployment spec 中直接配置明文密码。**切记！不要在真实环境中这样做！**我想你们应该也知道，`"password"` 这个值也不应该用作密码。

<span id=blue>2.</span> 使用修改后的 deployment yaml 文件来创建使用外部数据库的 ratings 服务：`v2-mysql`。

```bash
$ kubectl apply -f samples/bookinfo/platform/kube/bookinfo-ratings-v2-mysql.yaml

deployment "ratings-v2-mysql" created
```

<span id=blue>3.</span> 将发往 reviews 服务的所有流量都路由到 `v3` 版本，这样做是为了确保 reviews 服务始终调用 ratings 服务。此外，将发往 ratings 服务的所有流量都路由到使用外部数据库的 `ratings v2-mysql`。

通过添加两个 `VirtualService`，可以为上述两种服务指定路由。这些 `VirtualService` 在 Istio 发行档案的 [samples/bookinfo/networking/virtual-service-ratings-mysql.yaml](https://raw.githubusercontent.com/istio/istio/master/samples/bookinfo/networking/virtual-service-ratings-mysql.yaml) 中指定。**注意 :** 确保你在添加了默认的 `DestinationRule` 之后再执行下面的命令。

```bash
$ kubectl apply -f samples/bookinfo/networking/virtual-service-ratings-mysql.yaml
```

更新后的架构如下所示。请注意，网格内的蓝色箭头表示创建 `VirtualService` 之后的流量转发路径。根据创建的 `VirtualService`，流量将被转发到 reviews `v3` 和 ratings `v2-mysql`。

![](https://images.icloudnative.io/uPic/bookinfo-ratings-v2-mysql-external.svg)

<center><p id=small>使用外部 MySQL 数据库的 ratings v2-mysql 版本的 Bookinfo 应用程序</p></center>

请注意，MySQL 数据库位于 Istio 服务网格之外，或者更准确地说是在 Kubernetes 集群之外，服务网格的边界由虚线标记。

### 访问 Web 页面

在[确定 ingress IP 和端口](https://preliminary.istio.io/zh/docs/examples/bookinfo/#%E7%A1%AE%E5%AE%9A-ingress-%E7%9A%84-ip-%E5%92%8C%E7%AB%AF%E5%8F%A3)之后， 就可以访问应用程序的 Web 页面了。


哎呀糟糕，出现问题了 :disappointed_relieved: 无论你怎么刷新浏览器，每个 review 下方都不会显示评级星标，而是显示 `“Ratings service is currently unavailable”`。

![](https://images.icloudnative.io/uPic/9FLVz8.jpg)

<center><p id=small>Ratings 服务的错误信息</p></center>

与[在服务网格内部调用外部 Web 服务](/posts/egress-https/)这篇文章中遇到的情况一样，你会体验到优雅的服务降级，非常好。虽然 ratings 服务中有错误，但是应用程序并没有因此而崩溃，Web 页面虽然不能显示评级星标，但可以正确显示书籍信息、details 信息和 reviews 信息。

默认情况下， Istio sidecar 代理（Envoy proxies） 会阻止到集群外服务的所有流量（TCP 和 HTTP），要为 TCP 启用此类流量，我们必须先定义 TCP 协议的 `mesh-external ServiceEntry`。

### 外部 MySQL 实例的 Mesh-external ServiceEntry

下面就该 mesh-external ServiceEntry 上场了。

<span id=blue>1.</span> 获取 MySQL 数据库的 IP 地址。你可以通过 [hosts](https://linux.die.net/man/1/host) 命令来获取：

```bash
$ export MYSQL_DB_IP=$(host $MYSQL_DB_HOST | grep " has address " | cut -d" " -f4)
```

如果你使用的是本地数据库实例，设置 `MYSQL_DB_IP` 环境变量为你的本机 IP，并且要保证这个环境变量能被集群访问到。

<span id=blue>2.</span> 定义一个 TCP mesh-external `ServiceEntry`：

```yaml
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1alpha3
kind: ServiceEntry
metadata:
  name: mysql-external
spec:
  hosts:
  - $MYSQL_DB_HOST
  addresses:
  - $MYSQL_DB_IP/32
  ports:
  - name: tcp
    number: $MYSQL_DB_PORT
    protocol: tcp
  location: MESH_EXTERNAL
EOF
```

<span id=blue>3.</span> 查看创建好的 `ServiceEntry`：

```yaml
$ kubectl get serviceentry mysql-external -o yaml

apiVersion: networking.istio.io/v1alpha3
kind: ServiceEntry
metadata:
...
```

{{< alert >}}
对于 TCP ServiceEntry，你需要指定 <code>port</code> 列表的 <code>protocol</code> 字段值为 <code>tcp</code>，还要在 <code>addresses</code> 列表里面指定外部服务的 IP 地址，该 IP 地址以网络号为 <code>32</code> 位的无类型域间选路（<a href="https://tools.ietf.org/html/rfc2317" target="_blank">CIDR</a>）形式表示。 
{{< /alert >}}

下面我将详细讨论 TCP ServiceEntry。现在先来验证添加 `ServiceEntry` 之后是否解决了上面遇到的问题，再次访问 Web 页面，看看评级星标是不是回来了。

果然有效！现在 Web 页面的报错已经消失了，正确显示了评级：

![](https://images.icloudnative.io/uPic/tL3SzD.jpg)

<center><p id=small>Book Ratings 显示正常</p></center>

和预期的一样，你会看到两个 review 下面显示的都是一星评级。因为之前我们在数据库中将评级改为了一颗星，所以现在可以肯定 ratings 服务调用到了外部数据库。

与 HTTP/HTTPS 协议的 ServiceEntry 一样，你也可以使用 `kubectl` 动态删除和创建 TCP ServiceEntry。

## 控制出口 TCP 流量的动机

有时候，Istio 网格内的应用程序需要访问外部服务，如遗留系统。并且很多情况下，网格内的微服务都不会通过 HTTP 或 HTTPS 协议来访问外部服务，而是通过 `TCP` 协议或 TCP 协议的变种（如 [MongoDB wire 协议](https://docs.mongodb.com/manual/reference/mongodb-wire-protocol/) 和 [MySQL客户端/服务器协议](https://dev.mysql.com/doc/internals/en/client-server-protocol.html)）来和外部数据库通信。

接下来我会重点介绍 TCP 流量的 `ServiceEntry`。

## TCP 流量的 ServiceEntry

用于启用到特定端口的 TCP 流量的 `ServiceEntry` 必须将端口的协议指定为 `TCP`。此外，对于 [MongoDB Wire 协议](https://docs.mongodb.com/manual/reference/mongodb-wire-protocol/)，可以将协议指定为 `MONGO`，而不是 `TCP`。

对于 ServiceEntry 中的 `addresses` 列表，必须以网络号为 32 位的无类型域间选路（[CIDR](https://tools.ietf.org/html/rfc2317)）形式表示。**注意：在 TCP ServiceEntry 中，`hosts` 字段会被忽略掉。**

想要通过其主机名（hostname）启用到外部服务的 TCP 流量，必须指定主机名的所有 IP，每个 IP 必须以 CIDR 的形式表示。

有时候我们无法获取外部服务的所有 IP，这时候要想往集群外发送 TCP 流量，只能在 `addresses` 列表中指定那些已知的被应用程序使用的 IP。

有些情况下，外部服务的 IP 并不总是静态 IP，例如在 [CDN](https://www.wikiwand.com/zh/%E5%85%A7%E5%AE%B9%E5%82%B3%E9%81%9E%E7%B6%B2%E8%B7%AF) 的场景中。大多数情况下 IP 地址都是静态的，但有时 IP 地址会被更改，例如由于基础设施的变化。这时候如果你知道 IP 地址变化的范围，就可以通过 CIDR 的形式指定范围。如果你实在无法确定 IP 地址变化的范围，就不能使用 TCP ServiceEntry，必须绕过 sidecar 代理[直接调用外部服务](https://preliminary.istio.io/zh/docs/tasks/traffic-management/egress/#%E7%9B%B4%E6%8E%A5%E8%B0%83%E7%94%A8%E5%A4%96%E9%83%A8%E6%9C%8D%E5%8A%A1)。

## 与网格扩展的关系

请注意，本文中描述的场景与[集成虚拟机](https://preliminary.istio.io/zh/docs/examples/integrating-vms/)示例中描述的网格扩展场景不同。 在集成虚拟机的场景中，MySQL 实例在与 Istio 服务网格集成的外部（集群外）机器（裸机或VM）上运行 ，MySQL 服务成为网格的一等公民，具有 Istio 的所有高级功能。除此之外，也不需要创建 ServiceEntry 来访问 MySQL 服务，可以直接通过本地集群域名（例如 `mysqldb.vm.svc.cluster.local`）来寻址，并且可以通过[双向 TLS 身份验证](https://preliminary.istio.io/docs/concepts/security/#mutual-tls-authentication)来保护与其之间的通信。但是该服务必须要在 Istio 中注册，要启用此类集成，必须在计算机上安装 Istio 组件（Envoy proxy，node-agent，istio-agent），并且必须可以从中访问 Istio 控制平面（Pilot，Mixer，Citadel）。详细信息请参考 [Istio Mesh Expansion](https://preliminary.istio.io/docs/setup/kubernetes/mesh-expansion/)。

但在本文的示例中，MySQL 实例可以在任何机器上运行，也可以由云提供商提供，无需与 Istio 集成，也无需从 MySQL 实例所在的机器上访问 Istio 控制平面。在 MySQL 作为服务的情况下，客户端可能无法访问 MySQL 所运行的机器，并且无法在该机器上安装所需组件。本文示例中的 MySQL 实例可以通过其全局域名进行寻址，这对希望使用域名来寻址的消费者客户端来说是有益的。当在消费者应用程序的部署配置中无法更改预期的域名时，这项功能显得尤为重要。

## 清理

<span id=blue>1.</span> 删除 `test` 数据库和 `bookinfo` 用户：

```bash
$ mysqlsh --sql --ssl-mode=REQUIRED -u admin -p --host $MYSQL_DB_HOST --port $MYSQL_DB_PORT -e "drop database test; drop user bookinfo;"
```

**或者**

如果你使用的是本地数据库实例，且客户端使用的是 `mysql`，可以运行以下命令：

```bash
$ mysql -u root -p --host $MYSQL_DB_HOST --port $MYSQL_DB_PORT -e "drop database test; drop user bookinfo;"
```

<span id=blue>2.</span> 删除 VirtualService

```bash
$ kubectl delete -f samples/bookinfo/networking/virtual-service-ratings-mysql.yaml

Deleted config: virtual-service/default/reviews
Deleted config: virtual-service/default/ratings
```

<span id=blue>3.</span> 删除 ratings v2-mysql：

```bash
$ kubectl delete -f samples/bookinfo/platform/kube/bookinfo-ratings-v2-mysql.yaml

deployment "ratings-v2-mysql" deleted
```

<span id=blue>4.</span> 删除 ServiceEntry

```bash
$ kubectl delete serviceentry mysql-external -n default

Deleted config: serviceentry mysql-external
```

## 总结

本文演示了 Istio 服务网格中的微服务如何通过 `TCP` 协议调用外部服务。默认情况下， Istio sidecar 代理（Envoy proxies） 会阻止到集群外服务的所有流量（TCP 和 HTTP），要为 TCP 启用此类流量，我们必须先定义 TCP 协议的 mesh-external `ServiceEntry`。
