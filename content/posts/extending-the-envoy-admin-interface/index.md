---
title: "Envoy 基础教程：扩展 Envoy 的管理界面"
subtitle: "提高 Envoy 管理界面的安全性"
date: 2018-10-25T16:34:20+08:00
draft: false
author: 米开朗基杨
categories: service-mesh
tags: ["envoy", "service mesh"]
img: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/1_NBS4fR_SmLnuGgp45YC6Hg.jpeg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
---

<p id="div-border-left-red">
<strong>原文地址：</strong><a href="https://medium.com/@mitchfriedman5/extending-the-envoy-admin-interface-6ce2ad220842" target="_blank">Extending the Envoy Admin Interface</a>
<br />
<strong>译者：</strong>米开朗基杨
</p>

[Envoy](https://www.envoyproxy.io/) 是一个动态可配置的高性能现代化代理工具，现在几乎所有的 IT 潮男都用它来构建服务网格。Envoy 有许多吸引人的功能，其中包括对网络流量的高级可观察性。Envoy 可以通过好几种方式来暴露数据，其中最主要的是 `stats` 和 `tracing`：stats 由内置的 [statsd ](https://www.envoyproxy.io/docs/envoy/latest/api-v2/config/metrics/v2/stats.proto#config-metrics-v2-statsdsink) 模块提供，方便集成诸如 prometheus 等监控方案。开启了 [tracing](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/tracing) 可以方便集成 Open Tracing 系统，追踪请求。然而 Envoy 管理界面本身却很少被提及到。

最近，我看到某些公司在讨论将由 `Haproxy` 驱动的数据平面替换为 Envoy。如果你以前使用过 Haproxy，应该熟悉 Haproxy 的管理界面 UI（稍微有点过时了），它会暴露出后端服务列表、健康状态、活动状态和每个服务的统计信息。

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/haproxy-admin.png)

每当添加新的后端服务或修改 [ACL](https://www.haproxy.com/documentation/aloha/10-0/traffic-management/lb-layer7/acls/) 时，如果出现了故障，我就会用此管理界面 UI 来调试网络。例如，在任何给定时间，很容易确定集群中的单个故障后端，以及哪些后端服务运行状况不佳。

Envoy 管理界面也提供了很多功能，其中 ` /clusters` 和 `/config_dump` 端点提供了大量有用的信息（例如，` /clusters` 端点中的所有动态配置的 Cluster 和 Endpoint，以及 `/config_dump` 端点中的所有其他当前状态的配置，稍后我会详细介绍）。

不幸的是，在我看来，由于某些原因，Envoy 的管理界面做得并不是很友好，但我们可以做一些改进来使管理 Envoy 更容易，对用户更加友好。

首先，它并不像 `Haproxy` 的管理界面那样直观，特别是当你想在某些事件中快速找到一些有用信息时（比如回答我上面提到的各种问题）。

其次，通过此 UI 可以执行某些潜在的危险操作（例如，停止正在运行的 Envoy 进程）。对于管理员或者某些团队而言，这可能不是什么大问题，但对服务使用者而言，需要以更安全的只读模式来使用此 UI（该模式仅公开一部分功能），而 Envoy 目前是不支持的。理想情况是：我想让服务所有者能够看到 `/clusters` 和 `/config_dump ` 的输出，但没有任何潜在的危险行为。这个问题已经作为一个 [open issue](https://github.com/envoyproxy/envoy/issues/2763) 在 Github 中进行讨论，同时 [官方文档](https://www.envoyproxy.io/docs/envoy/latest/operations/admin) 中也提到了这一点。我们将遵循 [Matt Klein](https://twitter.com/mattklein123) 在此 [comment](https://github.com/envoyproxy/data-plane-api/pull/523#issuecomment-371550679) 中提出的有关使用真正的 Listener 来增强管理界面的建议。

最后，我们希望将 `Listener` 的配置嵌入到 Envoy 的配置文件中，以便工程师可以通过一致的工作流程来处理与 Envoy 相关的配置。

还好我们是软件工程师，这些都不是问题！我们拥有所需的所有原始数据，可以自己构建一个简单的 UI！

你需要做的第一件事就是开启 Envoy 的管理界面。你只需要将这部分配置放在 Envoy 配置文件中以设置管理员访问日志路径和运行管理服务的端口：

```yaml
admin:
  access_log_path: /var/log/envoy/envoy_admin_access.log
  address:
    socket_address: { address: 0.0.0.0, port_value: 5000 }
```

启动 Envoy 进程后，你就可以在浏览器中通过 URL `<public_ip>:5000` 访问 Envoy 的管理界面了。

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/envoy-admin.png)

现在有一个小问题——你会注意到，如果你尝试构建一个从远程 Envoy 实例（`<public_ip>:5000`）中提取数据的网站，你将看到浏览器（不禁用任何安全设置）不会允许我们获取数据，因为远程 Envoy 实例的端点不包含正确的 `CORS`（跨域资源共享） 响应头（如文档中所述，以防止 `CSRF` 攻击）。

正如 Matt Klein 在上面的 Github [comment](https://github.com/envoyproxy/data-plane-api/pull/523#issuecomment-371550679) 中所建议的一样，我们可以设置一个包含正确 `CORS` 响应头的代理，并让我们的网站从该代理获取数据。

这个很简单，只需要使用单个 `VirtualHost` 配置一个 `Listener` 和 `Cluster`，该 `VirtualHost` 代理本地 `5000` 端口或运行管理服务的任何其他端口。我们只需要确保该代理包含正确的 CORS 响应头——对于我上面提到的情况，只需要配置响应头 `Access-Control-Allow-Origin`。

由于我们一直在使用 [java 控制平面库](https://github.com/envoyproxy/java-control-plane) 编写一个控制平面，我们决定动态生成这些对象以防以后想要更改或更新它们，但通过静态配置文件也很容易配置。请参考以下需要包含在引导程序文件中以实现此代理的静态资源配置示例：

```yaml
static_resources:
  clusters:
  - name: local_admin_cluster
    connect_timeout: 30s
    type: STATIC
    lb_policy: ROUND_ROBIN
    hosts: [{ socket_address: { address: 0.0.0.0, port_value: 5000 }}]

  listeners:
  - name: local_admin_listener
    address:
      socket_address: { address: 0.0.0.0, port_value: 5001 }
    filter_chains:
    - filters:
      - name: envoy.http_connection_manager
        config:
          stat_prefix: ingress_http
          codec_type: AUTO
          route_config:
            name: local_admin_route
            virtual_hosts:
            - name: local_service
              domains: ["*"]
              response_headers_to_add:
              - header:
                  key: "Access-Control-Allow-Origin"
                  value: "*"

              routes:
              - match: { path: "/clusters" }
                route: { cluster: local_admin }
              - match: { path: "/config_dump" }
                route: { cluster: local_admin }
          http_filters:
          - name: envoy.router
```

如你所见，我已经确保路由仅匹配 `/clusters` 和 `/config_dump`，这样就不会造成潜在的危险。此外，由于我们已经将其作为我们的控制平面驱动的动态配置文件实现，因此我们可以根据是开发环境还是生产环境来更改这些路径的匹配方式（比如在开发环境中可以公开管理界面的所有端点，但在生产环境中不能这么做）。

{{< notice note >}}
注意，因为我们使用的是 <code>Listener</code>，所以我们应该使用 <code>HTTPs</code>，我会将其作为读者的练习。
{{< /notice >}}

前面我没有提到如何使用 `/config_dump` 端点导的数据（Haproxy 的 UI 可以通过 `/clusters` 端点的信息来构建等效的数据），因为我不太清楚我想要构建什么。由于 Envoy 的配置实在是太复杂了（即使不使用动态控制平面，只使用静态配置文件），以至于其他使用者很难确定每个 Envoy 实例的配置。`/config_dump` 的输出可能非常冗长，特别是如果有非常多复杂的 Cluster、Listener 和 Route。我认为这将是一个很好的用例，可以用来演示一些展示当前流量分割、流量镜像、Cluster 子集和权重的可视化。

此外，当我们在控制平面中开发更多功能时，为手动测试提供一些视觉反馈并向团队的其他人展示新功能将会起到很棒的效果。

我认为我们真的只是在获得对网络的深入见解时找到了冰山一角，我很高兴看到我们通过扩展 Envoy 管理界面等强大工具使我们的网络更加健壮和易懂。

如果您对此有任何想法，请随时通过 `Twitter` 或通过电子邮件与我联系：

+ Twitter: [@mitchfriedman5](https://twitter.com/mitchfriedman5)

+ Email: `mitchfriedman5@gmail.com`

----

![](https://hugo-picture.oss-cn-beijing.aliyuncs.com/images/wechat.gif)
<center>扫一扫关注微信公众号</center>

