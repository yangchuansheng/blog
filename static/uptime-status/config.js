// 配置
window.Config = {

  // 站点名
  SiteName: 'Uptime Status',

  // 站点链接
  SiteUrl: '/',

  // UptimeRobot Api 域名
  // 只需填写域名部分，默认为官网域名
  // 因官网 API 时不时的会 CROS 报错，可填自定义反代域名
  // 详见 https://github.com/yb/uptime-status/ 说明
  ApiDomain: 'uptime.cloud-native.workers.dev',

  // UptimeRobot Api Keys
  // 支持 Monitor-Specific 和 Read-Only 两只 Api Key
  ApiKeys: [
    'm784912564-3f91fd2546ffb05b9633455b',
    'm784912585-9953ea9a58a461f319e46e5d',
    'm784912646-bdf65b9b6bfeadb6dcc60b9c',
  ],

  // 是否显示监测站点的链接
  ShowLink: true,

  // 日志天数
  // 虽然免费版说仅保存60天日志，但测试好像API可以获取90天的
  // 不过时间不要设置太长，容易卡，接口请求也容易失败
  CountDays: 60,

  // 导航栏菜单
  Navi: [
    {
      text: '豪华版监控',
      url: 'https://yangchuansheng.github.io/upptime/'
    },
    {
      text: 'Envoy 中文指南',
      url: 'https://github.com/yangchuansheng/envoy-handbook'
    },
    {
      text: 'Prometheus 中文文档',
      url: 'https://github.com/yangchuansheng/prometheus-handbook'
    }
  ]
};
