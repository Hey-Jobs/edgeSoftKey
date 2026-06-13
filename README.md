[![English](https://img.shields.io/badge/English-Click-yellow)](README-en.md)
[![中文文档](https://img.shields.io/badge/中文文档-点击查看-orange)](README.md)

# EdgeSoftKey

EdgeSoftKey 是一套基于 Vike + Cloudflare Workers 的全栈卡密商城系统，专为软件授权与激活服务打造。同一套代码同时包含前端页面、SSR 渲染、后端 API 和卡密验证接口，运行于 Cloudflare 全球边缘网络。

## 新增功能（v1.5.0）

- **卡密类型商品系统**：支持配置不同商品的有效时长（月卡/季卡/年卡/自定义）
- **卡密验证接口**：RESTful 风格接口，支持硬件绑定、到期时间计算、硬件变更检测
- **卡密解绑接口**：支持硬件解绑并延长有效期一天，完整的操作日志审计
- **卡密批量生成**：支持手动批量生成与订单自动发货生成两种模式
- **Python SDK**：硬件信息采集、SHA256 加密、卡密验证、自动验证与硬件变更检测
- **Node.js SDK**：功能与 Python SDK 一致，原生实现无需第三方依赖
- **管理后台增强**：卡密类型商品配置、卡密使用状态查询、生成记录管理

## 功能特性

- 🚀 **真正的零成本** — 无需购买服务器和域名，基于 Cloudflare 全球边缘网络运行。一键部署，即刻上线。
- 🌍 **零成本运维** — 基于 Workers + D1，免费额度满足日常运营，无需担心额外账单。
- 🛍️ **商品管理** — 支持分类、商品上下架、库存模式（有限/无限）、最小/最大购买数量。
- 🔑 **卡密管理系统** — 批量导入卡密、支付后自动发货、卡密类型配置（月卡/季卡/年卡/自定义）、库存实时预警。
- 🔐 **卡密验证系统** — 硬件绑定、到期时间管理、硬件变更检测、解绑续期功能。
- 📦 **订单管理** — 订单列表、手动补发、自动关闭过期订单、详细的支付日志。
- 💳 **多支付网关** — 内置 BEpusdt (USDT)、Epay (聚合支付)、支付宝、Stripe，支持插件式扩展。
- 📧 **邮件通知** — 支持 SMTP / API / Cloudflare Email 三种通道，内置详细的邮件发送日志。
- ⚙️ **站点设置** — 灵活配置站点名称、Logo、公告及客服联系方式。
- 🔒 **管理后台** — 安全可靠的管理员账号体系，支持双重认证 (2FA)。
- 🌐 **多语言 SDK** — 提供 Python 和 Node.js 版本的软件激活 SDK。

> [!TIP]
> **关于 0 成本运行：** 在配合支付渠道（USDT、自建等）、个人邮箱 SMTP 以及免费图床的理想状态下，本项目可实现 **100% 零成本** 运营。

## 快速开始

本项目支持三种部署方式，按推荐程度排序：

| 方式 | 适合场景 | 便捷程度 |
|---|---|---|
| **一键部署**（推荐） | 首次部署，无需本地环境 | ⭐⭐⭐ 最简单，点击按钮全自动完成 |
| **Git 自动部署** | 持续迭代，代码推送自动更新 | ⭐⭐ 配置一次后全自动 |
| **手动部署** | 二开需求，细节掌控 | ⭐ 需要本地环境和命令行操作 |

### 一键部署到 Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Hey-Jobs/edgeSoftKey)

> **点击按钮后，会打开 Cloudflare Workers 部署向导，操作提示：**
> 1. 登录并授权 Git 账户 (GitHub、GitLab)，它会自动在你的 Git 账号创建一个新仓库。
> 2. 为了增强安全性，请在向导中修改默认的密钥 (`AUTH_SECRET`)。
> 3. 如果你不绑定已有的 D1 数据库，它会自动完成新建数据库并初始化数据（管理员账号等）的操作，无需手动干预。
> 4. 部署成功之后在页面的日志里面可以找到 "Deployed edgeSoftKey triggers (0.38 sec) https://edgekey.你的账号.workers.dev" 这样的日志。
> 5. `https://edgekey.你的账号.workers.dev/admin` 为管理后台登录地址，默认管理员账号: admin，密码: admin123456，**切记登录后立即修改密码！**

### 文档资源

- [一键部署教程](./docs/fast_deploy/start.md)
- [CDN 加速配置](./docs/cdn/start.md)
- [本地开发规范](./docs/development-guide.md)
- 支付：[BEpusdt](./docs/pay/bepusdt/start.md)、[易支付](./docs/pay/epay/start.md)、[支付宝](./docs/pay/alipay/start.md)、[Stripe](./docs/pay/stripe/start.md)
- [更新日志](./CHANGELOG.md)

## 技术栈

| 层级 | 技术 |
|------|------|
| **运行时** | Cloudflare Workers |
| **框架** | Vike + Vue 3 + Tailwind CSS + daisyUI |
| **后端** | Hono |
| **数据库 ORM** | Prisma + Cloudflare D1 (SQLite) |
| **认证** | Auth.js (Admin 账号密码 + 2FA) |
| **RPC** | Telefunc |
| **SDK** | Python / Node.js (硬件信息采集 + 卡密验证) |

## SDK 使用

### Python SDK

```bash
pip install edgekey-auth
```

```python
from edgekey_auth import EdgeKeyClient

client = EdgeKeyClient(api_base_url="https://your-domain.com")

# 自动验证（推荐在软件启动时调用）
result = client.auto_verify("YOUR_CARD_KEY")
if result.success:
    print(f"验证成功，有效期至: {result.expire_at}")
else:
    print(f"验证失败: {result.message}")

# 解绑（当硬件更换时）
unbind_result = client.unbind("YOUR_CARD_KEY")
```

### Node.js SDK

```bash
npm install edgekey-auth
```

```javascript
const { EdgeKeyClient } = require('edgekey-auth');

const client = new EdgeKeyClient({ apiUrl: 'https://your-domain.com' });

// 自动验证
const result = await client.autoVerify('YOUR_CARD_KEY');
if (result.success) {
    console.log(`验证成功，有效期至: ${result.expireAt}`);
} else {
    console.log(`验证失败: ${result.message}`);
}
```

## 鸣谢

感谢 [Linux.do](https://linux.do/)、[NodeSeek](https://www.nodeseek.com/) 社区支持。

感谢下列开源项目：
- [Ebpusdt](https://github.com/v03413/BEpusdt) — 加密货币交易支持
- [worker-mailer](https://github.com/zou-yu/worker-mailer) — Workers 环境 SMTP 邮件支持

## 🏝️ 社区交流

- Telegram 群组：https://t.me/edgeKeyChannel
- Telegram 频道：https://t.me/edgeKeyGroup
