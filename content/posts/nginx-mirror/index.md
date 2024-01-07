---
keywords:
- nginx
- mirror
- load balance
title: "Nginx 流量镜像使用技巧"
subtitle: "Nginx mirror 模块使用过程中的趟坑经历"
description: 本文展示了如何通过 Nginx mirror 模块简单地复制所有的流量，以及如何通过 split_client 模块来复制部分流量，同时还解释了当镜像后端响应缓慢时为什么原始请求会被阻塞，并给出了解决方案。
date: 2019-01-28T16:39:48+08:00
draft: false
author: 米开朗基杨
toc: true
categories: 
- load-balancing
tags:
- Nginx
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/dynamic-pages-seo-friendly.png"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

> 原文链接：[nginx mirroring tips and tricks](https://alex.dzyoba.com/blog/nginx-mirror/)

最近我在研究 Nginx 1.13.4 最新的 [mirror 模块](http://nginx.org/en/docs/http/ngx_http_mirror_module.htm)，利用 mirror 模块，你可以将线上实时流量拷贝至其他环境同时不影响源站请求的响应，因为 Nginx 会丢弃 mirror 的响应。mirror 模块可用于以下几个场景：

+ 通过预生产环境测试来观察新系统对生产环境流量的处理能力。
+ 复制请求日志以进行安全分析。
+ 复制请求用于数据科学研究。
+ 等等

我已经用它来测试新系统对生产环境流量的处理能力，但遇到了一些小问题，经过一番努力我总结出了一些小窍门，现在分享给你们。

## 基础配置

----

先来创建一个基本的配置，架构如下图所示，由一个用来实际处理流量的后端和一个前端代理组成：

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/SePJFH.jpg)

Nginx 配置文件如下：

```nginx
upstream backend {
    server backend.local:10000;
}

server {
    server_name proxy.local;
    listen 8000;

    location / {
        proxy_pass http://backend;
    }
}
```

配置文件由两部分组成：后端服务与代理。代理监听在 `8000` 端口，它会将流量转发到后端服务的 `10000` 端口。看起来没什么稀奇的，先做个压力测试看看性能吧。这里我选择用 [hey](https://github.com/rakyll/hey) 来测试压力，因为它很简单，可以施加稳定的负载，其他工具的负载施加很不稳定（例如，wrk, apache benchmark, siege）。

```bash
$ hey -z 10s -q 1000 -n 100000 -c 1 -t 1 http://proxy.local:8000

Summary:
  Total:	10.0016 secs
  Slowest:	0.0225 secs
  Fastest:	0.0003 secs
  Average:	0.0005 secs
  Requests/sec:	995.8393

  Total data:	6095520 bytes
  Size/request:	612 bytes

Response time histogram:
  0.000 [1]    |
  0.003 [9954] |■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
  0.005 [4]    |
  0.007 [0]    |
  0.009 [0]    |
  0.011 [0]    |
  0.014 [0]    |
  0.016 [0]    |
  0.018 [0]    |
  0.020 [0]    |
  0.022 [1]    |


Latency distribution:
  10% in 0.0003 secs
  25% in 0.0004 secs
  50% in 0.0005 secs
  75% in 0.0006 secs
  90% in 0.0007 secs
  95% in 0.0007 secs
  99% in 0.0009 secs

Details (average, fastest, slowest):
  DNS+dialup:	0.0000 secs, 0.0003 secs, 0.0225 secs
  DNS-lookup:	0.0000 secs, 0.0000 secs, 0.0008 secs
  req write:	0.0000 secs, 0.0000 secs, 0.0003 secs
  resp wait:	0.0004 secs, 0.0002 secs, 0.0198 secs
  resp read:	0.0001 secs, 0.0000 secs, 0.0012 secs

Status code distribution:
  [200]	9960 responses
```

大多数请求都在 1 毫秒内处理完成，也没有错误响应，很好，但这只是我们的底线。

## 基础流量镜像配置

----

现在我们向后端添加一个测试服务，并将发往源后端的流量复制一份到测试后端。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting6@main/uPic/VqOLrh.jpg)

流量镜像的配置文件如下：

```nginx
upstream backend {
    server backend.local:10000;
}

upstream test_backend {
    server test.local:20000;
}

server {
    server_name proxy.local;
    listen 8000;

    location / {
        mirror /mirror;
        proxy_pass http://backend;
    }

    location = /mirror {
        internal;
        proxy_pass http://test_backend$request_uri;
    }

}
```

+ `mirror` 指令制定镜像 uri 为 `/mirror`
+ `location = /mirror` 中的 `internal` 指定此 location 只能被“内部的”请求调用，外部的调用请求会返回 ”Not found” (404)

在 mirror 配置中可以做很多事情，但这里我们只是单纯地转发所有的流量。

再次进行压力测试，观察流量镜像是如何影响性能的：

```bash
$ hey -z 10s -q 1000 -n 100000 -c 1 -t 1 http://proxy.local:8000

Summary:
  Total:	10.0010 secs
  Slowest:	0.0042 secs
  Fastest:	0.0003 secs
  Average:	0.0005 secs
  Requests/sec:	997.3967

  Total data:	6104700 bytes
  Size/request:	612 bytes

Response time histogram:
  0.000 [1]     |
  0.001 [9132]  |■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
  0.001 [792]   |■■■
  0.001 [43]    |
  0.002 [3]     |
  0.002 [0] 	|
  0.003 [2] 	|
  0.003 [0] 	|
  0.003 [0] 	|
  0.004 [1] 	|
  0.004 [1] 	|


Latency distribution:
  10% in 0.0003 secs
  25% in 0.0004 secs
  50% in 0.0005 secs
  75% in 0.0006 secs
  90% in 0.0007 secs
  95% in 0.0008 secs
  99% in 0.0010 secs

Details (average, fastest, slowest):
  DNS+dialup:	0.0000 secs, 0.0003 secs, 0.0042 secs
  DNS-lookup:	0.0000 secs, 0.0000 secs, 0.0009 secs
  req write:	0.0000 secs, 0.0000 secs, 0.0002 secs
  resp wait:	0.0004 secs, 0.0002 secs, 0.0041 secs
  resp read:	0.0001 secs, 0.0000 secs, 0.0021 secs

Status code distribution:
  [200]	9975 responses
```

和第一次的测试结果一样：大多数请求都在 1 毫秒内处理完成，也没有错误响应。可以得出结论：镜像流量不会影响源站请求的响应。

## 将流量复制到故障后端

----

到目前为止，测试结果都很符合预期。考虑另外一种场景，如果镜像后端出现了故障，时不时会返回错误响应，这时会不会对原始请求产生影响呢？

为了模拟这种场景，我用 golang 写了一个[小工具](https://github.com/dzeban/mirror-backend)来随机注入故障，你可以通过以下命令来启动：

```bash
$ mirror-backend -errors

2019/01/13 14:43:12 Listening on port 20000, delay is 0, error injecting is true
```

然后进行负载测试：

```bash
$ hey -z 10s -q 1000 -n 100000 -c 1 -t 1 http://proxy.local:8000

Summary:
  Total:	10.0008 secs
  Slowest:	0.0027 secs
  Fastest:	0.0003 secs
  Average:	0.0005 secs
  Requests/sec:	998.7205

  Total data:	6112656 bytes
  Size/request:	612 bytes

Response time histogram:
  0.000 [1]    |
  0.001 [7388] |■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
  0.001 [2232] |■■■■■■■■■■■■
  0.001 [324]  |■■
  0.001 [27]   |
  0.002 [6]    |
  0.002 [2]    |
  0.002 [3]    |
  0.002 [2]    |
  0.002 [0]    |
  0.003 [3]    |


Latency distribution:
  10% in 0.0003 secs
  25% in 0.0003 secs
  50% in 0.0004 secs
  75% in 0.0006 secs
  90% in 0.0007 secs
  95% in 0.0008 secs
  99% in 0.0009 secs

Details (average, fastest, slowest):
  DNS+dialup:	0.0000 secs, 0.0003 secs, 0.0027 secs
  DNS-lookup:	0.0000 secs, 0.0000 secs, 0.0008 secs
  req write:	0.0000 secs, 0.0000 secs, 0.0001 secs
  resp wait:	0.0004 secs, 0.0002 secs, 0.0026 secs
  resp read:	0.0001 secs, 0.0000 secs, 0.0006 secs

Status code distribution:
  [200]	9988 responses
```

仍然和之前的测试结果一样！这说明了故障后端的错误并不会影响源后端的响应。Nginx 忽略了镜像请求的响应，所以测试结果会和之前一样。

## 将流量复制到响应缓慢的后端

----

继续设想下一种场景：镜像后端不会返回错误响应，仅仅只是响应很缓慢，这时候会对原始请求有影响吗？

通过以下命令来让镜像后端对每个请求延迟 1 秒再响应：

```bash
$ mirror-backend -delay 1

2019/01/13 14:50:39 Listening on port 20000, delay is 1, error injecting is false
```

然后进行负载测试：

```bash
$ hey -z 10s -q 1000 -n 100000 -c 1 -t 1 http://proxy.local:8000

Summary:
  Total:	10.0290 secs
  Slowest:	0.0023 secs
  Fastest:	0.0018 secs
  Average:	0.0021 secs
  Requests/sec:	1.9942

  Total data:	6120 bytes
  Size/request:	612 bytes

Response time histogram:
  0.002 [1]	|■■■■■■■■■■
  0.002 [0]	|
  0.002 [1]	|■■■■■■■■■■
  0.002 [0]	|
  0.002 [0]	|
  0.002 [0]	|
  0.002 [1]	|■■■■■■■■■■
  0.002 [1]	|■■■■■■■■■■
  0.002 [0]	|
  0.002 [4]	|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
  0.002 [2]	|■■■■■■■■■■■■■■■■■■■■


Latency distribution:
  10% in 0.0018 secs
  25% in 0.0021 secs
  50% in 0.0022 secs
  75% in 0.0023 secs
  90% in 0.0023 secs
  0% in 0.0000 secs
  0% in 0.0000 secs

Details (average, fastest, slowest):
  DNS+dialup:	0.0007 secs, 0.0018 secs, 0.0023 secs
  DNS-lookup:	0.0003 secs, 0.0002 secs, 0.0006 secs
  req write:	0.0001 secs, 0.0001 secs, 0.0002 secs
  resp wait:	0.0011 secs, 0.0007 secs, 0.0013 secs
  resp read:	0.0002 secs, 0.0001 secs, 0.0002 secs

Status code distribution:
  [200]	10 responses

Error distribution:
  [10]	Get http://proxy.local:8000: net/http: request canceled (Client.Timeout exceeded while awaiting headers)
```

发生了什么？`rps`（requests per second） 变成了 `1.9`？之前的 `1000` rps 到哪去了？为什么会有错误响应？

为了解释这个现象，有必要来探究一下 Nginx 是怎样实现流量镜像的。

### Nginx 如何实现流量镜像

当请求到达 Nginx 时，如果 Nginx 开启了流量镜像功能，它就会将请求复制一份，并根据 mirror location 中的配置来处理这份复制的请求。本文我们只是将复制的请求转发到镜像后端。

下面到了关键部分，复制的镜像请求和原始请求是相关联的，按照我的理解，只要镜像请求没有处理完成，原始请求就会被阻塞。

这就是为什么上一个测试的结果接近于 `2` rps，`hey` 先发送了 `10` 个请求，没有响应；再发送 `10` 个请求，但这 10 个请求被阻塞了，因为之前的镜像请求发生了延迟，导致最后 10 个请求超时并返回错误响应。

如果我们将测试工具可接受的延迟时间增加到 `10` 秒，就不会出现错误了：

```bash
$ hey -z 10s -q 1000 -n 100000 -c 1 -t 10 http://proxy.local:8000

Summary:
  Total:	10.0197 secs
  Slowest:	1.0018 secs
  Fastest:	0.0020 secs
  Average:	0.9105 secs
  Requests/sec:	1.0978

  Total data:	6732 bytes
  Size/request:	612 bytes

Response time histogram:
  0.002 [1]    |■■■■
  0.102 [0]    |
  0.202 [0]    |
  0.302 [0]    |
  0.402 [0]    |
  0.502 [0]    |
  0.602 [0]    |
  0.702 [0]    |
  0.802 [0]    |
  0.902 [0]    |
  1.002 [10]   |■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■


Latency distribution:
  10% in 1.0011 secs
  25% in 1.0012 secs
  50% in 1.0016 secs
  75% in 1.0016 secs
  90% in 1.0018 secs
  0% in 0.0000 secs
  0% in 0.0000 secs

Details (average, fastest, slowest):
  DNS+dialup:	0.0001 secs, 0.0020 secs, 1.0018 secs
  DNS-lookup:	0.0000 secs, 0.0000 secs, 0.0005 secs
  req write:	0.0001 secs, 0.0000 secs, 0.0002 secs
  resp wait:	0.9101 secs, 0.0008 secs, 1.0015 secs
  resp read:	0.0002 secs, 0.0001 secs, 0.0003 secs

Status code distribution:
  [200]	11 responses
```

现在我们搞清楚了原因 : **如果镜像请求响应很缓慢，原始请求就会被阻塞。**

我不知道如何修复这个 bug，但我想到了一个方法可以缓解这个 bug 带来的影响：只复制流量的一部分。具体的实现方法见下文。

## 只复制流量的一部分

----

如果你不确定镜像后端是否能够正确处理原始请求，你可以只复制一部分流量到镜像后端，例如 10%。

`mirror` 指令没有更多的配置项，它只会将所有的请求复制一份，并根据 mirror location 中的配置来处理请求，所以在 mirror 指令中做文章是行不通的，我们只能修改 mirror location 中的配置。修改后的配置文件如下：

```nginx
 1	upstream backend {
 2	    server backend.local:10000;
 3	}
 4	
 5	upstream test_backend {
 6	    server test.local:20000;
 7	}
 8	
 9	split_clients $remote_addr $mirror_backend {
10	    50% test_backend;
11	    *   "";
12	}
13	
14	server {
15	    server_name proxy.local;
16	    listen 8000;
17	
18	    access_log /var/log/nginx/proxy.log;
19	    error_log /var/log/nginx/proxy.error.log info;
20	
21	    location / {
22	        mirror /mirror;
23	        proxy_pass http://backend;
24	    }
25	
26	    location = /mirror {
27	        internal;
28	        if ($mirror_backend = "") {
29	            return 400;
30	        }
31	
32	        proxy_pass http://$mirror_backend$request_uri;
33	    }
34	
35	}
```

在 mirror location 中，请求会被转发到 `$mirror_backend` 变量（32 行）定义的后端。`$mirror_backend` 变量由 `split_clients` 配置块定义，`split_clients` 会将左边的变量 `$remote_addr`（requests remote address）经过 MurmurHash2 算法进行哈希，得出的值如果在前 `50%`（从 0 到 2147483500），那么 `$mirror_backend` 的值为 `test_backend`；如果不在前 50%，那么 `$mirror_backend` 的值为空字符 `""`。

这样我们就实现了只复制部分流量到镜像后端，如果 `$mirror_backend` 变量的值为空字符串，就不复制流量；其他情况就会将流量到镜像后端。因为镜像请求的错误响应并不会影响原始请求，所以丢弃镜像请求并返回错误响应是很安全的。

这个方法的优点在于你可以根据任何变量或变量组合来拆分镜像流量。如果你想真正区分用户，那么 remote address 可能不适合作为拆分镜像流量的依据，因为用户可能会更换 IP。这时你最好使用用户粘性密钥来拆分镜像流量，例如 `API key`。

比如，如果你想根据请求中的 `apikey` 来拆分镜像流量，只需要将 `split_client` 配置块中的 `$remote_addr` 改为 `$arg_apikey`：

```nginx
split_clients $arg_apikey $mirror_backend {
    50% test_backend;
    *   "";
}
```

现在如果你查询从 `1` 到 `20` 这几个 apikey，只有一半（11）的请求会被复制到镜像后端：

```bash
$ for i in {1..20};do curl -i "proxy.local:8000/?apikey=${i}" ;done
```

查看镜像后端的日志：

```bash
...
2019/01/13 22:34:34 addr=127.0.0.1:47224 host=test_backend uri="/?apikey=1"
2019/01/13 22:34:34 addr=127.0.0.1:47230 host=test_backend uri="/?apikey=2"
2019/01/13 22:34:34 addr=127.0.0.1:47240 host=test_backend uri="/?apikey=4"
2019/01/13 22:34:34 addr=127.0.0.1:47246 host=test_backend uri="/?apikey=5"
2019/01/13 22:34:34 addr=127.0.0.1:47252 host=test_backend uri="/?apikey=6"
2019/01/13 22:34:34 addr=127.0.0.1:47262 host=test_backend uri="/?apikey=8"
2019/01/13 22:34:34 addr=127.0.0.1:47272 host=test_backend uri="/?apikey=10"
2019/01/13 22:34:34 addr=127.0.0.1:47278 host=test_backend uri="/?apikey=11"
2019/01/13 22:34:34 addr=127.0.0.1:47288 host=test_backend uri="/?apikey=13"
2019/01/13 22:34:34 addr=127.0.0.1:47298 host=test_backend uri="/?apikey=15"
2019/01/13 22:34:34 addr=127.0.0.1:47308 host=test_backend uri="/?apikey=17"
...
```

这个方法的奇妙之处在于 `split_client` 对流量的拆分结果是保持恒定的，`apikey=1` 的请求会一直被复制到镜像后端。

## 总结

----

这就是我使用 Nginx 的 mirror 模块过程中的一些趟坑经历，本文向你们展示了如何简单地复制所有的流量，以及如何通过 `split_client` 模块来复制部分流量，同时我还解释了当镜像后端响应缓慢时为什么原始请求会被阻塞，并给出了解决方案。
