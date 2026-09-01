# MyCost

个人高频语音记账应用：iOS 快捷指令负责快速输入，Cloudflare Worker 提供 API 和静态 PWA，Cloudflare D1 保存唯一账本，One API 负责文本/音频解析。

## 一键部署

> 仓库需要是公开 GitHub 仓库。一键部署会把项目复制到你的 GitHub 账号，并在 Cloudflare 上创建 Worker。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/zskfree/mycost)

点击按钮后按 Cloudflare 页面提示完成：

1. 登录 Cloudflare。
2. 选择要创建的 GitHub 仓库名称。
3. 确认 Worker 名称和 D1 资源名称。
4. 等待构建和部署。
5. 部署完成后进入 Worker 设置，配置 D1 和 Secrets。

一键部署不能自动知道个人的 `APP_PASSKEY`、`ONE_API_KEY` 和 One API 地址。首次部署完成后，必须按 [Cloudflare网页端部署说明](docs/Cloudflare网页端部署说明.md) 配置环境变量并初始化 D1 schema。

## 当前状态

已实现：

- React PWA 首页和本地 Token 保存
- 文本记账
- 浏览器录音上传
- One API 文本/音频解析和模型降级
- D1 交易新增、查询、汇总、更新、软删除
- `request_id` 幂等去重
- CSV / JSON 导出
- Worker Bearer Token 鉴权
- Worker 静态资产托管

## 目录

```text
mycost/
├── db/schema.sql                         # D1 数据库结构
├── docs/Cloudflare部署说明.md             # Worker 命令行和运行说明
├── docs/Cloudflare网页端部署说明.md        # Worker 控制台网页操作
├── docs/苹果快捷指令设置说明.md             # iOS 快捷指令完整设置
├── docs/语音输入记账App_架构规范_v0.1.md    # 项目总规范
├── functions/api/v1/                     # 可复用 API 和 D1 业务代码
├── public/                               # PWA 静态资源
├── scripts/probe_one_api.py              # One API 探针
├── src/                                  # React PWA
├── worker/index.ts                       # Cloudflare Worker 入口
└── wrangler.toml                         # Worker、Assets、D1 配置
```

## 本地检查

```bash
npm install
npm run check
npm run build
npm run dev
```

本地 PWA 地址：`http://127.0.0.1:5173/`

`npm run dev` 只启动 Vite 前端，不提供 Worker、D1 和真实 API。完整联调使用：

```bash
npm run build
npx wrangler dev
```

## 网页端部署

详细步骤：

- [Cloudflare网页端部署说明](docs/Cloudflare网页端部署说明.md)
- [Cloudflare部署说明](docs/Cloudflare部署说明.md)
- [苹果快捷指令设置说明](docs/苹果快捷指令设置说明.md)
- [项目总规范](docs/语音输入记账App_架构规范_v0.1.md)

Worker 配置：

```text
Build command: npm run build
Deploy command: npm run deploy
Static assets directory: dist
D1 binding variable name: DB
Assets binding name: ASSETS
```

## API 快速测试

把 `<your-worker-domain>` 和 `<APP_PASSKEY>` 替换成实际值。Worker 默认域名通常是：

```text
https://mycost.<your-subdomain>.workers.dev
```

```bash
curl https://<your-worker-domain>/api/v1/health

curl -X POST https://<your-worker-domain>/api/v1/entry \
  -H "Authorization: Bearer <APP_PASSKEY>" \
  -H "Content-Type: application/json" \
  -d '{"request_id":"test-001","text":"中午吃牛肉面 28 块，微信支付","datetime":"2026-09-01T12:30:00+08:00","weekday":"二","source":"shortcuts"}'
```

预期：

- 健康检查返回 HTTP `200` 和 `status: "ok"`。
- 记账接口返回 HTTP `200` 和 `status: "SUCCESS"`。
- 重复 `request_id` 不会新增第二笔。

## 免费额度说明

Cloudflare Workers 有 Free plan，但不是无限资源：请求数、CPU 时间、D1 读写和存储都有各自限制。个人低频或中等频率记账通常适合先使用 Free plan，但需要在 Dashboard 的 `Billing` / `Usage` 页面观察用量。

One API、上游 Gemini 或其他模型服务的费用不包含在 Cloudflare 免费额度内。模型服务是否收费，以 One API 上游实际账单为准。

## 安全规则

- 不要提交 `.env`。
- 不要把 `ONE_API_KEY` 写入前端代码或苹果快捷指令。
- `APP_PASSKEY` 只作为个人 API 访问令牌使用。
- 生产密钥放在 Worker Secrets 中。
- `database_id` 可以写入本地 Wrangler 配置，但不要把 Cloudflare API Token 写入仓库。
