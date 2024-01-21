---
keywords:
- kubelet
- kubelet exec
title: "Kubectl exec 的工作原理解读"
date: 2020-05-21T10:02:29+08:00
lastmod: 2020-05-21T10:02:29+08:00
description: 本文将通过参考 kubectl、API Server、Kubelet 和容器运行时接口（CRI）Docker API 中的相关代码来了解 kubectl exec 命令是如何工作的。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocLevels: ["h2", "h3", "h4"]
tags:
- Kubelet
- Kubernetes
categories: 
- cloud-native
img: https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20200521183444.png
---

> 原文链接：[How It Works — kubectl exec](https://itnext.io/how-it-works-kubectl-exec-e31325daa910)

对于经常和 `Kubernetes` 打交道的 YAML 工程师来说，最常用的命令就是 `kubectl exec` 了，通过它可以直接在容器内执行命令来调试应用程序。如果你不满足于只是用用而已，想了解 `kubectl exec` 的工作原理，那么本文值得你仔细读一读。本文将通过参考 `kubectl`、`API Server`、`Kubelet` 和容器运行时接口（CRI）Docker API 中的相关代码来了解该命令是如何工作的。

kubectl exec 的工作原理用一张图就可以表示：

![kubectl exec](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20200521110255.png)

先来看一个例子：

```bash
🐳 → kubectl version --short 
Client Version: v1.15.0 
Server Version: v1.15.3

🐳 → kubectl run nginx --image=nginx --port=80 --generator=run-pod/v1
pod/nginx created

🐳 → kubectl get po     
NAME    READY   STATUS    RESTARTS   AGE 
nginx   1/1     Running   0          6s  

🐳 → kubectl exec nginx -- date
Sat Jan 25 18:47:52 UTC 2020

🐳 → kubectl exec -it nginx -- /bin/bash 
root@nginx:/#
```

第一个 kubectl exec 在容器内执行了 `date` 命令，第二个 kubectl exec 使用 `-i` 和 `-t` 参数进入了容器的交互式 shell。

重复第二个 kubectl exec 命令，打印更详细的日志：

```bash
🐳 → kubectl -v=7 exec -it nginx -- /bin/bash                                                         
I0125 10:51:55.434043   28053 loader.go:359] Config loaded from file:  /home/isim/.kube/kind-config-linkerd
I0125 10:51:55.438595   28053 round_trippers.go:416] GET https://127.0.0.1:38545/api/v1/namespaces/default/pods/nginx
I0125 10:51:55.438607   28053 round_trippers.go:423] Request Headers:
I0125 10:51:55.438611   28053 round_trippers.go:426]     Accept: application/json, */*
I0125 10:51:55.438615   28053 round_trippers.go:426]     User-Agent: kubectl/v1.15.0 (linux/amd64) kubernetes/e8462b5
I0125 10:51:55.445942   28053 round_trippers.go:441] Response Status: 200 OK in 7 milliseconds
I0125 10:51:55.451050   28053 round_trippers.go:416] POST https://127.0.0.1:38545/api/v1/namespaces/default/pods/nginx/exec?command=%2Fbin%2Fbash&container=nginx&stdin=true&stdout=true&tty=true
I0125 10:51:55.451063   28053 round_trippers.go:423] Request Headers:
I0125 10:51:55.451067   28053 round_trippers.go:426]     X-Stream-Protocol-Version: v4.channel.k8s.io
I0125 10:51:55.451090   28053 round_trippers.go:426]     X-Stream-Protocol-Version: v3.channel.k8s.io
I0125 10:51:55.451096   28053 round_trippers.go:426]     X-Stream-Protocol-Version: v2.channel.k8s.io
I0125 10:51:55.451100   28053 round_trippers.go:426]     X-Stream-Protocol-Version: channel.k8s.ioI0125 10:51:55.451121   28053 round_trippers.go:426]     User-Agent: kubectl/v1.15.0 (linux/amd64) kubernetes/e8462b5
I0125 10:51:55.465690   28053 round_trippers.go:441] Response Status: 101 Switching Protocols in 14 milliseconds
root@nginx:/#
```

这里有两个重要的 HTTP 请求：

+ `GET` 请求用来[获取 Pod 信息](https://github.com/kubernetes/kubectl/blob/4f155a6381d3caaf46f37df8e575abdad9b24b3f/pkg/cmd/exec/exec.go#L287-L306)。
+ POST 请求调用 Pod 的子资源 `exec` 在容器内执行命令。

{{< alert >}}
子资源（subresource）隶属于某个 K8S 资源，表示为父资源下方的子路径，例如 `/logs`、`/status`、`/scale`、`/exec` 等。其中每个子资源支持的操作根据对象的不同而改变。
{{< /alert >}}

最后 API Server 返回了 `101 Ugrade` 响应，向客户端表示已切换到 `SPDY` 协议。

{{< alert >}}
SPDY 允许在单个 TCP 连接上复用独立的 stdin/stdout/stderr/spdy-error 流。
{{< /alert >}}

## 1. API Server 源码分析

----

请求首先会到底 API Server，先来看看 API Server 是如何注册 `rest.ExecRest` 处理器来处理子资源请求 `/exec` 的。这个处理器用来确定 `exec` 要进入的节点。

API Server [启动过程中](https://github.com/kubernetes/kubernetes/blob/324b5921c1ae9b76acc074e0dfb116c0266ca1e5/cmd/kube-apiserver/app/server.go#L214-L222)做的第一件事就是指挥内嵌的 `GenericAPIServer` 加载早期的遗留 API（legacy API）：

```go
if c.ExtraConfig.APIResourceConfigSource.VersionEnabled(apiv1.SchemeGroupVersion) {
	// ...
	if err := m.InstallLegacyAPI(&c, c.GenericConfig.RESTOptionsGetter, legacyRESTStorageProvider); err != nil {
		return nil, err
	}
}
```

在 API 加载过程中，会将类型 `LegacyRESTStorage` [实例化](https://github.com/kubernetes/kubernetes/blob/324b5921c1ae9b76acc074e0dfb116c0266ca1e5/pkg/master/master.go#L450-L453)，创建一个 `storage.PodStorage` 实例：

```go
podStorage, err := podstore.NewStorage(
	restOptionsGetter,
	nodeStorage.KubeletConnectionInfo,
	c.ProxyTransport,
	podDisruptionClient,
)
if err != nil {
	return LegacyRESTStorage{}, genericapiserver.APIGroupInfo{}, err
}
```

随后 `storeage.PodStorage` 实例会被添加到 map `restStorageMap` 中。注意，该 map 将路径 `pods/exec` 映射到了 `podStorage` 的 `rest.ExecRest` 处理器。

```go
restStorageMap := map[string]rest.Storage{
	"pods":             podStorage.Pod,
	"pods/attach":      podStorage.Attach,
	"pods/status":      podStorage.Status,
	"pods/log":         podStorage.Log,
	"pods/exec":        podStorage.Exec,
	"pods/portforward": podStorage.PortForward,
	"pods/proxy":       podStorage.Proxy,
	"pods/binding":     podStorage.Binding,
	"bindings":         podStorage.LegacyBinding,
```



{{< alert >}}
`podstorage` 为 pod 和子资源提供了 `CURD` 逻辑和策略的抽象。更多详细信息请查看内嵌的 [genericregistry.Store](https://github.com/kubernetes/apiserver/blob/d65a85b44b2088665850402025c97aa9f6f32ba4/pkg/registry/generic/registry/store.go#L72-L77)
{{< /alert >}}

map `restStorageMap` 会成为实例 `apiGroupInfo` 的一部分，添加到 `GenericAPIServer` 中：

```go
if err := s.installAPIResources(apiPrefix, apiGroupInfo, openAPIModels); err != nil {
	return err
}

// Install the version handler.
// Add a handler at /<apiPrefix> to enumerate the supported api versions.
s.Handler.GoRestfulContainer.Add(discovery.NewLegacyRootAPIHandler(s.discoveryAddresses, s.Serializer, apiPrefix).WebService())
```

其中 [GoRestfulContainer.ServeMux](https://github.com/kubernetes/apiserver/blob/8ebac2550a3117540987649ada8d78cd13366f6b/pkg/server/handler.go#L79-L87) 会将传入的请求 URL 映射到不同的处理器。

接下来重点观察处理器 `therest.ExecRest` 的工作原理，它的 `Connect()` 方法会调用函数 [pod.ExecLocation()](https://github.com/kubernetes/kubernetes/blob/1934ad6a9cde42e6d92054f9cff1e4d101005ffc/pkg/registry/core/pod/strategy.go#L463-L473) 来确定 pod 中容器的 `exec` 子资源的 `URL`：

```go
// Connect returns a handler for the pod exec proxy
func (r *ExecREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	execOpts, ok := opts.(*api.PodExecOptions)
	if !ok {
		return nil, fmt.Errorf("invalid options object: %#v", opts)
	}
	location, transport, err := pod.ExecLocation(r.Store, r.KubeletConn, ctx, name, execOpts)
	if err != nil {
		return nil, err
	}
	return newThrottledUpgradeAwareProxyHandler(location, transport, false, true, true, responder), nil
}
```

函数 `pod.ExecLocation()` 返回的 [URL](https://github.com/kubernetes/kubernetes/blob/1934ad6a9cde42e6d92054f9cff1e4d101005ffc/pkg/registry/core/pod/strategy.go#L524-L529) 被 API Server 用来决定连接到哪个节点。

下面接着分析节点上的 `Kubelet` 源码。

## 2. Kubelet 源码分析

----

到了 `Kubelet` 这边，我们需要关心两点：

+ Kubelet 是如何注册 `exec` 处理器的？
+ Kubelet 与 `Docker API` 如何交互？

[Kubelet 的初始化过程](https://github.com/kubernetes/kubernetes/blob/9162c5d7f4a91213f258243119d484fbc3fc1c93/cmd/kubelet/app/server.go#L477-L809)非常复杂，主要涉及到两个函数：

+ [PreInitRuntimeService()](https://github.com/kubernetes/kubernetes/blob/9162c5d7f4a91213f258243119d484fbc3fc1c93/cmd/kubelet/app/server.go#L760-L769) : 使用 `dockershim` 包来初始化 `CRI`。
+ [RunKubelet()](https://github.com/kubernetes/kubernetes/blob/9162c5d7f4a91213f258243119d484fbc3fc1c93/cmd/kubelet/app/server.go#L771-L773) : 注册处理器，启动 Kubelet 服务。

### 注册处理器

当 Kubelet 启动时，它的 [RunKubelet()](https://github.com/kubernetes/kubernetes/blob/9162c5d7f4a91213f258243119d484fbc3fc1c93/cmd/kubelet/app/server.go#L1043-L1048) 函数会调用私有函数 [`startKubelet()`](https://github.com/kubernetes/kubernetes/blob/9162c5d7f4a91213f258243119d484fbc3fc1c93/cmd/kubelet/app/server.go#L1125) 来[启动 `kubelet.Kubelet` 实例](https://github.com/kubernetes/kubernetes/blob/9162c5d7f4a91213f258243119d484fbc3fc1c93/cmd/kubelet/app/server.go#L1131-L1135)的 `ListenAndServe()` 方法，然后该方法会[调用函数 `ListenAndServeKubeletServer()` ](https://github.com/kubernetes/kubernetes/blob/1590c7b31cb40259397ccef602b6d6dc2a9f9d72/pkg/kubelet/kubelet.go#L2226-L2229)，使用构造函数 `NewServer()` 来安装 『debugging』处理器：

```go
// NewServer initializes and configures a kubelet.Server object to handle HTTP requests.
func NewServer(
	// ...
	criHandler http.Handler) Server {
	// ...
	if enableDebuggingHandlers {
		server.InstallDebuggingHandlers(criHandler)
		if enableContentionProfiling {
			goruntime.SetBlockProfileRate(1)
		}
	} else {
		server.InstallDebuggingDisabledHandlers()
	}
	return server
}
```

`InstallDebuggingHandlers()` 函数使用 `getExec()` 处理器来注册 HTTP 请求模式：

```go
// InstallDebuggingHandlers registers the HTTP request patterns that serve logs or run commands/containers
func (s *Server) InstallDebuggingHandlers(criHandler http.Handler) {
  // ...
  ws = new(restful.WebService)
	ws.
		Path("/exec")
	ws.Route(ws.GET("/{podNamespace}/{podID}/{containerName}").
		To(s.getExec).
		Operation("getExec"))
	ws.Route(ws.POST("/{podNamespace}/{podID}/{containerName}").
		To(s.getExec).
		Operation("getExec"))
	ws.Route(ws.GET("/{podNamespace}/{podID}/{uid}/{containerName}").
		To(s.getExec).
		Operation("getExec"))
	ws.Route(ws.POST("/{podNamespace}/{podID}/{uid}/{containerName}").
		To(s.getExec).
		Operation("getExec"))
	s.restfulCont.Add(ws)
```

其中 `getExec()` 处理器又会调用 `s.host` 实例中的 `GetExec()` 方法：

```go
// getExec handles requests to run a command inside a container.
func (s *Server) getExec(request *restful.Request, response *restful.Response) {
  	// ...
	podFullName := kubecontainer.GetPodFullName(pod)
	url, err := s.host.GetExec(podFullName, params.podUID, params.containerName, params.cmd, *streamOpts)
	if err != nil {
		streaming.WriteError(err, response.ResponseWriter)
		return
	}
	// ...
}
```

`s.host` 被实例化为 `kubelet.Kubelet` 类型的一个实例，它嵌套引用了 [`StreamingRuntime` 接口](https://github.com/kubernetes/kubernetes/blob/1590c7b31cb40259397ccef602b6d6dc2a9f9d72/pkg/kubelet/container/runtime.go#L120-L127)，该接口又被[实例化](https://github.com/kubernetes/kubernetes/blob/1590c7b31cb40259397ccef602b6d6dc2a9f9d72/pkg/kubelet/kubelet.go#L683-L710)为 `kubeGenericRuntimeManager` 的实例，即**运行时管理器**。该运行时管理器是 Kubelet 与 `Docker API` 交互的关键组件，`GetExec()` 方法就是由它实现的：

```go
// GetExec gets the endpoint the runtime will serve the exec request from.
func (m *kubeGenericRuntimeManager) GetExec(id kubecontainer.ContainerID, cmd []string, stdin, stdout, stderr, tty bool) (*url.URL, error) {
	// ...
	resp, err := m.runtimeService.Exec(req)
	if err != nil {
		return nil, err
	}

	return url.Parse(resp.Url)
}
```

`GetExec()` 又会调用 `runtimeService.Exec()` 方法，进一步挖掘你会发现 `runtimeService` 是 CRI 包中定义的[接口](https://github.com/kubernetes/kubernetes/blob/4e45328e651abaf0ca72dfd37d132f96599c7161/pkg/kubelet/kuberuntime/kuberuntime_manager.go#L116)。`kuberuntime.kubeGenericRuntimeManager` 的 `runtimeService` 被实例化为 `kuberuntime.instrumentedRuntimeService` 类型，由它来实现 `runtimeService.Exec()` 方法：

```go
func (in instrumentedRuntimeService) Exec(req *runtimeapi.ExecRequest) (*runtimeapi.ExecResponse, error) {
	const operation = "exec"
	defer recordOperation(operation, time.Now())

	resp, err := in.service.Exec(req)
	recordError(operation, err)
	return resp, err
}
```

instrumentedRuntimeService 实例的嵌套服务对象被[实例化](https://github.com/kubernetes/kubernetes/blob/962a61f51fc2cd7c9a6784ed59b37a09f5c3d801/pkg/kubelet/kubelet.go#L392-L394)为 `theremote.RemoteRuntimeService` 类型的实例。该类型实现了 `Exec()` 方法：

```go
// Exec prepares a streaming endpoint to execute a command in the container, and returns the address.
func (r *RemoteRuntimeService) Exec(req *runtimeapi.ExecRequest) (*runtimeapi.ExecResponse, error) {
	ctx, cancel := getContextWithTimeout(r.timeout)
	defer cancel()

	resp, err := r.runtimeClient.Exec(ctx, req)
	if err != nil {
		klog.Errorf("Exec %s '%s' from runtime service failed: %v", req.ContainerId, strings.Join(req.Cmd, " "), err)
		return nil, err
	}

	if resp.Url == "" {
		errorMessage := "URL is not set"
		klog.Errorf("Exec failed: %s", errorMessage)
		return nil, errors.New(errorMessage)
	}

	return resp, nil
}
```

`Exec()` 方法会向 `/runtime.v1alpha2.RuntimeService/Exec` 发起一个 [`gRPC` 调用](https://github.com/kubernetes/cri-api/blob/master/pkg/apis/runtime/v1alpha2/api.pb.go#L7446-L7453)来让运行时端准备一个流式通信的端点，该端点用于在容器中执行命令（关于如何将 `Docker shim` 设置为 gRPC 服务端的更多信息请参考下一小节）。

gRPC 服务端通过调用 `RuntimeServiceServer.Exec()` 方法来[处理请求](https://github.com/kubernetes/cri-api/blob/de6519080ceb33d843ca275a9d8a8cd016558ad8/pkg/apis/runtime/v1alpha2/api.pb.go#L7927-L7943)，该方法由 `dockershim.dockerService` 结构体实现：

```go
// Exec prepares a streaming endpoint to execute a command in the container, and returns the address.
func (ds *dockerService) Exec(_ context.Context, req *runtimeapi.ExecRequest) (*runtimeapi.ExecResponse, error) {
	if ds.streamingServer == nil {
		return nil, streaming.NewErrorStreamingDisabled("exec")
	}
	_, err := checkContainerStatus(ds.client, req.ContainerId)
	if err != nil {
		return nil, err
	}
	return ds.streamingServer.GetExec(req)
}
```

第 10 行的 `ThestreamingServer` 是一个 [streaming.Server](https://github.com/kubernetes/kubernetes/blob/d24fe8a801748953a5c34fd34faa8005c6ad1770/pkg/kubelet/server/streaming/server.go#L42-L60) 接口，它在构造函数 `dockershim.NewDockerService()` 中被实例化：

```go
// create streaming server if configured.
if streamingConfig != nil {
	var err error
	ds.streamingServer, err = streaming.NewServer(*streamingConfig, ds.streamingRuntime)
	if err != nil {
		return nil, err
	}
}
```

来看一下 `GetExec()` 方法的实现方式：

```go
func (s *server) GetExec(req *runtimeapi.ExecRequest) (*runtimeapi.ExecResponse, error) {
	if err := validateExecRequest(req); err != nil {
		return nil, err
	}
	token, err := s.cache.Insert(req)
	if err != nil {
		return nil, err
	}
	return &runtimeapi.ExecResponse{
		Url: s.buildURL("exec", token),
	}, nil
}
```

可以看到这里只是向客户端返回一个简单的 token 组合成的 URL， 之所以生成一个 token 是因为用户的命令中可能包含各种各样的字符，各种长度的字符，需要格式化为一个简单的 token。 该 token 会缓存在本地，后面真正的 exec 请求会携带这个 token，通过该 token 找到之前的具体请求。其中 `restful.WebService` 实例会将 pod `exec` 请求路由到这个端点：

```go
// InstallDebuggingHandlers registers the HTTP request patterns that serve logs or run commands/containers
func (s *Server) InstallDebuggingHandlers(criHandler http.Handler) {
  // ...
  ws = new(restful.WebService)
	ws.
		Path("/exec")
	ws.Route(ws.GET("/{podNamespace}/{podID}/{containerName}").
		To(s.getExec).
		Operation("getExec"))
	ws.Route(ws.POST("/{podNamespace}/{podID}/{containerName}").
		To(s.getExec).
		Operation("getExec"))
	ws.Route(ws.GET("/{podNamespace}/{podID}/{uid}/{containerName}").
		To(s.getExec).
		Operation("getExec"))
	ws.Route(ws.POST("/{podNamespace}/{podID}/{uid}/{containerName}").
		To(s.getExec).
		Operation("getExec"))
	s.restfulCont.Add(ws)
```

### 创建 Docker shim

`PreInitRuntimeService()` 函数[作为 gRPC 服务端](https://github.com/kubernetes/kubernetes/blob/ae95a4bfcac12bf6b19e2d5acf6404359b1a8c3b/pkg/kubelet/dockershim/remote/docker_server.go#L64-L70)，负责[创建并启动](https://github.com/kubernetes/kubernetes/blob/63df40077862c378dd0e7d22a1dc5d2557000694/pkg/kubelet/kubelet.go#L355-L361) Docker shim。在将`dockershim.dockerService` 类型实例化时，让其嵌套的 `streamingRuntime` 实例引用 `dockershim.NativeExecHandler` 的实例（该实例实现了 [dockershim.ExecHandler](https://github.com/kubernetes/kubernetes/blob/63df40077862c378dd0e7d22a1dc5d2557000694/pkg/kubelet/dockershim/exec.go#L33-L36) 接口）。

```go
ds := &dockerService{
	// ...
	streamingRuntime: &streamingRuntime{
		client:      client,
		execHandler: &NativeExecHandler{},
	},
	// ...
}
```

使用 Docker 的 `exec` API 在容器中执行命令的核心实现就是 `NativeExecHandler.ExecInContainer()` 方法：

```go
func (*NativeExecHandler) ExecInContainer(client libdocker.Interface, container *dockertypes.ContainerJSON, cmd []string, stdin io.Reader, stdout, stderr io.WriteCloser, tty bool, resize <-chan remotecommand.TerminalSize, timeout time.Duration) error {
	// ...
	startOpts := dockertypes.ExecStartCheck{Detach: false, Tty: tty}
	streamOpts := libdocker.StreamOptions{
		InputStream:  stdin,
		OutputStream: stdout,
		ErrorStream:  stderr,
		RawTerminal:  tty,
		ExecStarted:  execStarted,
	}
	err = client.StartExec(execObj.ID, startOpts, streamOpts)
	if err != nil {
		return err
	}
	// ...
```

这里就是最终 `Kubelet` 调用 Docker `exec` API 的地方。

最后需要搞清楚的是 `streamingServer` 处理器如何处理 `exec` 请求。首先需要找到它的 `exec` 处理器，我们直接从构造函数 `streaming.NewServer()` 开始往下找，因为这是将 `/exec/{token}` 路径绑定到 `serveExec` 处理器的地方：

```go
ws := &restful.WebService{}
endpoints := []struct {
	path    string
	handler restful.RouteFunction
}{
	{"/exec/{token}", s.serveExec},
	{"/attach/{token}", s.serveAttach},
	{"/portforward/{token}", s.servePortForward},
}
```

所有发送到 `dockershim.dockerService` 实例的请求最终都会在 `streamingServer` 处理器上完成，因为 [dockerService.ServeHTTP()](https://github.com/kubernetes/kubernetes/blob/579e0c74c150085b3fac01f6a33b66db96922f93/pkg/kubelet/dockershim/docker_service.go#L456-L462) 方法会调用 `streamingServer` 实例的 `ServeHTTP()` 方法。

`serveExec` 处理器会[调用 remoteCommand.ServeExec() 函数](https://github.com/kubernetes/kubernetes/blob/d24fe8a801748953a5c34fd34faa8005c6ad1770/pkg/kubelet/server/streaming/server.go#L285-L297)，这个函数又是干嘛的呢？它会调用前面提到的 `Executor.ExecInContainer()` 方法，而 `ExecInContainer()` 方法是知道如何与 Docker `exec` API 通信的：

```go
// ServeExec handles requests to execute a command in a container. After
// creating/receiving the required streams, it delegates the actual execution
// to the executor.
func ServeExec(w http.ResponseWriter, req *http.Request, executor Executor, podName string, uid types.UID, container string, cmd []string, streamOpts *Options, idleTimeout, streamCreationTimeout time.Duration, supportedProtocols []string) {
	// ...
	err := executor.ExecInContainer(podName, uid, container, cmd, ctx.stdinStream, ctx.stdoutStream, ctx.stderrStream, ctx.tty, ctx.resizeChan, 0)
	if err != nil {
	// ...
	} else {
	// ...	
	}
}
```

## 3. 总结

----

本文通过解读 `kubectl`、`API Server` 和 `CRI` 的源码，帮助大家理解 `kubectl exec` 命令的工作原理，当然，这里并没有涉及到 Docker `exec` API 的细节，也没有涉及到 `docker exec` 的工作原理。

首先，kubectl 向 API Server 发出了 `GET` 和 `POST` 请求，API Server 返回了 `101 Ugrade` 响应，向客户端表示已切换到 `SPDY` 协议。

随后 API Server 使用 `storage.PodStorage` 和 `rest.ExecRest` 来提供处理器的映射和执行逻辑，其中 `rest.ExecRest` 处理器决定 `exec` 要进入的节点。

最后 Kubelet 向 `Docker shim` 请求一个流式端点 URL，并将 `exec` 请求转发到 Docker `exec` API。kubelet 再将这个 URL 以 `Redirect` 的方式返回给 API Server，请求就会重定向到到对应 Streaming Server 上发起的 `exec` 请求，并维护长链。

虽然本文只关注了 kubectl exec 命令，但其他的子命令（例如 `attach`、`port-forward`、`log` 等等）也遵循了类似的实现模式：

![kubectl](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@master/img/20200521180219.png)