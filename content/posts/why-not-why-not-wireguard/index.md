---
keywords:
- WireGuard
- wg
- ipsec
- openvpn
title: "Why not \"Why not WireGuard?\""
date: 2021-01-05T17:48:33+08:00
lastmod: 2021-01-05T17:48:33+08:00
description: 本文针对 《Why not WireGuard》这篇文章的观点进行逐一反驳，老刺激了。
draft: false
author: 米开朗基杨
hideToc: false
enableToc: true
enableTocContent: false
tocFolding: false
tocLevels: ["h2", "h3", "h4"]
tags:
- WireGuard
categories: Network
img: https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@second/img/20201231104851.jpg
---

前段时间 [ipfire](https://www.ipfire.org) 的 Michael Tremer 写过一篇文章叫[《Why not WireGuard》](/posts/why-not-wireguard/)，随后不久，[Tailscale](https://tailscale.com) 的大佬 [Avery Pennarun](https://twitter.com/apenwarr) 也写了一篇文章来和 Michael Tremer 叫板，文章的标题就很挑衅：[《Why not "Why not WireGuard?"》](https://tailscale.com/blog/why-not-why-not-wireguard/)，整篇文章的风格就是针对 Michael Tremer 的观点逐一反驳，老刺激了。咱也不知道谁对谁错，咱也不敢问，端个小板凳看戏就是了。

以下是这篇文章的译文。

作者开篇就提出 Michael Tremer 的那篇文章包含了一些错误的观念和一些过时的信息，然后就开门见山直接一一反驳。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@second/img/5db8bb9127604b2c30f4db71b729567b.gif)

## 1. WireGuard 能否取代 IPSec？

原作者的观点：

> No. There is no chance the big vendors […] will pick up WireGuard. They do not jump onto trains like this unless there is a big necessity.

译文：

> 不！`Cisco` 和 `Juniper` 等大厂不可能使用 WireGuard，除非迫不得已，他们是不会上 WireGuard 的车的。

Tremer 这里讨论的是商业 VPN 硬件/软件厂商，这些厂商大多使用的是集 VPN 网关和 spoke 架构。他说的没错，大多数 IPsec VPN 厂商确实不太可能升级到 WireGuard，但客户是怎么想的呢？很少有客户想让现有的 VPN 网关直接支持新协议，相反，他们渴望使用更轻巧、限制更少的东西来取代 VPN 网关。

简而言之，WireGuard 以简单的软件解决方案取代了 VPN 硬件，因此它不需要传统硬件供应商的支持。

## 2. WireGuard 实现了 Road Warrior？

原作者的观点：

> Right now, WireGuard has a huge backlog of features that it needs to implement to be suitable for this use-case. It does not, for example, allow using a dynamic IP address on the server side of the tunnel which breaks a whole use-case.

译文：

> WireGuard 目前还有很多功能未实现，例如不能使用动态 IP 来建立连接。要想实现漫游功能，还有很长的路要走。

Tremer 认为 WireGuard 缺少大量功能，但这里只讨论了动态 IP，没关系，我们来看看他关于动态 IP 的讨论是否正确。

对于 WireGuard 而言，只要有一端是静态 IP，另一端不管是不是静态 IP，都能正常工作。而他虽然一开始说 WireGuard 不支持 road warrior，但后面似乎都在讨论连接的两端都有动态 IP 地址所引起的问题，这就属于混淆视听了。诚然，WireGuard 在两端都是动态 IP 的支持方面确实没有做到开箱即用，但可以通过各种脚本和高级工具来支持。

即使两端都是动态 IP 地址，WireGuard 也能正常工作。你可以将 WireGuard 客户端配置为指向服务器的 DNS 名称，并且该 DNS 名称可以使用动态 DNS 定期更新。虽然 WireGuard 只在启动时解析 DNS 名称，后续 DNS 更新之后也不会重新解析，但我们可以通过自动化脚本来定期重启客户端。当然，`Tailscale` 用了别的方法来支持动态 IP 地址，这里不便透露。

## 3. WireGuard 真的好用吗？

原作者的观点：

> Is IPsec really hard to use? No, it clearly is not if the vendor has done their homework right and provides an interface that is easy to use.

译文：

> `IPsec` 真的很难用吗？恐怕不是这样，如果厂商做了正确的功课，并提供了易于使用的界面（比如，[IPFire](https://www.ipfire.org)），就不会难用。

Tremer 认为 IPsec 不算很难用，只需要提供自己的公网地址、peer 的公网地址、子网和预先共享的秘钥，之后 VPN 就可以兼容所有厂商的产品。这。。。

首先，配置 IPSec 只知道这些信息是不够的，还需要指定加密算法。当然 IPSec 是有默认加密算法的，但几乎没人会用默认的，因为默认的既不安全也不能跨平台，所以需要设定一个靠谱的加密算法，那么问题来了，加密算法会直接影响到 IPSec 厂商之间的兼容性，大多数人都不是密码学专家，怎么会知道该用哪种算法？

其次，他认为需要为隧道两端指定公网地址。这个操作就很迷了，你之前不是说 WireGuard 的缺点就包括“两端需要指定静态 IP”吗？？还说 `WireGuard` 不支持动态 IP，现在又说 IPSec 也需要这么做，你确定你是在夸 IPSec？

事实上，不管是 WireGuard 还是 IPSec，只要有一端是静态 IP 就可以正常工作，所以最多只需要配置一个公网地址。

最后，他建议在隧道两端使用预先共享的秘钥（`PSK`）。`PSK` 是最弱鸡的一种认证方式（密码就是 PSK 的一种形式），只要从一个节点上窃取到 PSK，窃取者就可以冒充任何一端并伪造两端的流量。

比起 PSK，公钥认证会更安全，IPsec 和 WireGuard 都允许使用公钥认证，不同点在于：**IPSec 是可选的，而 WireGuard 是强制的**。IPSec 所谓的“灵活性”会带来很多安全隐患，他自己也说了：

> 与 `OpenBSD` 系统之间建立隧道，过程可能会比较痛苦。

他似乎认为在 `OpenBSD` 上配置 IPSec 很复杂。虽然我们的团队并不熟悉 `OpenBSD` 上的 IPsec，但我们知道在 OpenBSD 上配置 `WireGuard` 就和其他平台一样简单，没有任何区别。

## 4. 协议复杂度真的很重要吗？

原作者的观点：

> The end-user does not have to worry about the complexity of the protocol. If that was an issue we would have definitely gone rid of SIP and H.323, FTP and other protocols that don’t cope well with NAT and are decades old.

译文：

> 作为终端用户，其实无需考虑协议的复杂度。如果复杂度真的影响很大，我们肯定早就摆脱 `SIP`、 `H.323` 和 `FTP` 等不能很好地应对 NAT 的协议了。

搞的那么复杂真的好吗？下面来看[由 `N Ferguson` 和 `B. Schneier` 于 2003 年发表的论文](https://www.schneier.com/academic/archives/2003/12/a_cryptographic_eval.html)中的一段话：

> IPSec 太复杂了，很不安全。这个设计的初衷显然是想通过不同的选项来支持各种不同的情况，但最终导致整个 VPN 系统远远超出了用当前的方法论可以分析或正确实现的复杂程度，它就是个黑盒子。因此，任何 IPSec 系统都无法保证其高度安全性。

这篇论文已经发表了 16 年了，而 IPSec 的复杂度只增不减，变得越来越无法分析，大家已经渐渐从 `IPSec` 转向 `TLS`。都 2021 年了，IPSec 的过于复杂使其濒临淘汰，现在大家都有了更好的选择，没错我说的就是 WireGuard。

Tremer 又说了：

> User-authentication using username/password or a SIM card with EAP. […] WireGuard does not have that.

译文：

> WireGuard 不能使用用户名/密码或带有 `EAP` 的 `SIM` 卡进行用户认证。

这句话我部分认同，因为它只对核心的 WireGuard 适用。核心的 WireGuard 只是一个数据平面，可以在其上层建立不同的秘钥交换机制，Tailscale 就提供了[这样的秘钥交换机制（适用 Oauth2、OIDC 或 SAML 进行用户认证）](https://tailscale.com/blog/how-tailscale-works)。

与 IPsec 非常复杂的密钥协商协议相比，只对核心 WireGuard 的安全性进行分析和审计，然后再对上面单独的密钥交换机制进行审计，这样要容易得多。

## 5. 如何更新加密方式

接下来，Tremer 批评了 WireGuard 的加密方式：它只允许使用单一的加密方式。

> If you were to change the cipher you are using from one day to the next one, you would need to upgrade your WireGuard software on all those laptops, phones, etc. at the same time.

译文：

> 假设现在你改了加密算法，那么就需要同时更新所有客户端的加密算法才能正常工作。

这种说法本身就是错误的。WireGuard 的迭代升级过程中肯定会支持第二种加密方式，只是时间问题。只要觉得现有的加密方式可能有安全隐患了，新的加密方式立马安排上。

当然，为了解决需要同时更新所有客户端这个问题，需要对 WireGuard 进行改进，使其同时支持两种加密算法，只需要支持两种就行。这样就可以实现在更新过程中，使用旧秘钥的客户端仍然有效，直到所有客户端更新完毕后，才会弃用旧秘钥。

我知道，大多数 VPN 都提供了数千种不同的算法组合来供用户选择，但大多数加密算法都不安全或解析速度很慢，将来 WireGuard 只需要同时支持两种加密算法足矣。

## 6. 加密算法

原作者的观点：

> I would conclude that practically the same cryptography is available for all VPNs here. Therefore WireGuard is not more or less secure than the others when it comes to encryption or data integrity.

译文：

> 我的结论是：**实际上所有的 VPN 都可以使用相同的加密技术，WireGuard 在加密或数据完整性方面并没有比其他的 VPN 更安全或更不安全。**

从表面上看，这种说法是正确的。你可以为 IPSec 选择不同的加密算法进行组合，使其和 WireGuard 的唯一加密方式大致相同。

然而事实上并不是这样，首先你必须知道如何选择恰当的加密算法进行组合，这是密码学高手才能干的事情好吗，大部分用户谁能干这事？其次，就算你能找到合适的加密算法，它能和所有的 VPN 硬件或软件兼容吗？

更讽刺的是，虽然 IPSec 标准允许使用几乎所有的加密算法，但它并没有强制要求任何一种加密算法。也就是说，你会遇到这样一种情况：隧道两端完全符合 IPSec 标准，但却无法通信，八成就是加密算法不一致了，你要做的就是不断调试以匹配对方的加密算法。。。

而 WireGuard 目前只有一种加密算法，别无选择，不会出现上述情况。即使将来支持两种加密算法，遇到上述情况也很容易解决，因为只有两种可能啊，那还不简单？

## 7. WireGuard 真的很快吗？

在本节中，Tremer 提出了几个立不住脚的观点，大概意思就是由于 CPU 的发展，`AES` 加密可能会比 `ChaCha20` 更快。这个说法我不赞同也不反对，因为在没有基于特定平台和特定语言进行测试的情况下，目前还不确定这种说法是否正确。

不过那不重要，对于 IPsec 和 WireGuard 而言，在几乎所有的场景下，不管你是使用 `AES` 还是 `ChaCha20`，加密解密速度都不是瓶颈。

当然，如果你的网络带宽远超过 10 Gbit/秒，加密解密就会遇到瓶颈，不过这种情况极为罕见。

还有一点，IPSec 等传统 VPN 是有 VPN 网关的，而 VPN 网关的硬件性能比较弱，如果同时有很多个 IPSec 用户交换数据，就会出现阻塞。当然这不是 IPSec 的问题，略过。

除此之外，移动设备的 CPU 比桌面服务器的 CPU 性能差，加密解密速度也慢一些，但移动设备的网络更慢，假设移动设备的加密解密占用了 1% 的时间，则网络传输就会占用 99% 的时间。所以对于移动设备而言，加密解密速度可以忽略不计，主要的瓶颈在网络。

另外一点需要注意的是[**点对多点架构**和**中心辐射型架构**的区别](https://tailscale.com/blog/how-tailscale-works/)。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@second/img/hub-and-spoke-single.svg)

一般来说，中心辐射型网络有一个 VPN 网关，这个网关通常都有一个静态 IP 地址，其他所有的客户端都需要连接这个 VPN 网关，再由网关将流量转发到其他的客户端。

这种架构有很多问题。首先，用户可能离 VPN 网关很近，也可能很远，如果离得很远，延迟就会很高；其次，它想访问的另外一个客户端可能离 VPN 网关也会很远，这样又增加了一倍延迟。想象一下你的 VPN 网关在旧金山，你的家和公司都在纽约，你在纽约的家中通过旧金山的 VPN 网关来访问纽约的公司内网服务，岂不是很蛋疼。。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@second/img/hub-and-spoke-multiple.svg)

WireGuard 就比较先进了，它支持**点对多点**架构，同一个客户端可以同时连接多个 `peer`，而不是只连接一个 `peer`，再通过该 peer 将流量转发到其他客户端。

![](https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting@second/img/hub-and-spoke-direct.svg)

## 8. 与 Linux 内核的集成问题

这个论点已经过时了，自从他的文章写完后，WireGuard 模块就被集成到最新的 Linux 内核中了。。。

## 9. 理想与现实

原作者的观点：

> Unfortunately every time, when a customer asks me to help them setting up a VPN, the credentials that they are getting are using old ciphers. 3DES in combination with MD5 is a common candidate as well as AES-256 with SHA1. Although the latter is better, it is still not what I would like to use today.

译文：

> 现实情况是，每次当客户要求我帮他们搭建 VPN 时，给到他们手里的证书都是使用旧的加密方式，通常是 `3DES` 和 `MD5` 结合，或者 `AES-256` 和 `SHA1` 结合。至于秘钥交换，我们一直在使用 `RSA`，虽然速度很慢，但足够安全。

很明显，Tremer 这里说的只是他自己的客户，全世界的客户多了去了，难道都是他的客户？他的这些客户需要让客户端软件与传统的 IPSec VPN 服务器进行通信，而这些服务器可能是在几年前配置的，只支持过时的、有安全隐患的加密算法，客户别无选择，只能选择旧的加密算法。

从长远来看，VPN 网关不是必要的，首先应该抛弃的就是强制性的 VPN 网关。WireGuard 是开源的，可以运行在虚拟机中（这就避免了硬件锁定和厂商锁定），目前只支持一种众所周知非常快速安全的单一加密算法，而且可以在其上层建立任何秘钥交换机制。毫无疑问，WireGuard 就是 VPN 的未来。