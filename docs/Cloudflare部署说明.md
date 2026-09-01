# MyCost Cloudflare Workers 部署说明

本文档对应当前 Worker + Static Assets + D1 实现。网页操作优先阅读 [Cloudflare网页端部署说明](./Cloudflare网页端部署说明.md)。

## 1. 架构

```text
React PWA (dist)
       ↓ Static Assets
Cloudflare Worker (worker/index.ts)
       ↓
Hono API (/api/v1/*)
       ↓
Cloudflare D1 + One API
```

Worker 入口：`worker/index.ts`。

API 业务代码：`functions/api/v1/`。目录名保留是为了减少迁移改动，但运行时已不再使用 Pages Functions 适配器。

## 2. 免费计划说明

Workers 提供 Free plan，适合先部署个人记账应用。免费额度包含限制，具体以 Cloudflare Dashboard 和官方定价页为准。

Cloudflare 免费额度不包含 One API 上游模型费用。自建 One API 服务器和模型调用是否收费，需要单独核算。

## 3. 安装和检查

```bash
npm install
npm run check
npm run build
```

预期：

- TypeScript 检查通过。
- `dist/` 生成。
- Worker 和静态资产均可被 Wrangler 识别。

登录 Cloudflare：

```bash
npx wrangler login
npx wrangler whoami
```

## 4. Wrangler 配置

当前 `wrangler.toml`：

```toml
name = "mycost"
main = "worker/index.ts"
compatibility_date = "2026-09-01"

[assets]
directory = "./dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*"]

[[d1_databases]]
binding = "DB"
database_name = "mycost"
database_id = "REPLACE_WITH_D1_DATABASE_ID"
```

关键约束：

- `main` 指向 Worker 入口。
- `ASSETS` 用于提供 React 构建产物。
- `/api/*` 必须优先执行 Worker。
- D1 binding 必须叫 `DB`。

## 5. D1 创建和 schema

创建数据库：

```bash
npx wrangler d1 create mycost
```

把输出的 `database_id` 写入 `wrangler.toml`。

初始化远端：

```bash
npx wrangler d1 execute mycost --remote --file=./db/schema.sql
```

本地数据库：

```bash
npx wrangler d1 execute mycost --local --file=./db/schema.sql
```

检查远端表：

```bash
npx wrangler d1 execute mycost --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

## 6. 本地变量

本地开发可使用 `.dev.vars`，不要提交：

```dotenv
APP_PASSKEY=个人随机令牌
ONE_API_BASE_URL=https://example.com/v1
ONE_API_KEY=one-api-key
MULTIMODAL_MODELS=gemini-3.5-flash-lite,gemini-3.7-flash,gemini-3.6-flash
TRANSCRIBE_MODEL=gemini-3.5-transcribe
```

`.env.example` 继续作为变量清单。真实密钥只能放 `.env`、`.dev.vars` 或 Cloudflare Secrets。

设置生产 Secrets：

```bash
npx wrangler secret put APP_PASSKEY
npx wrangler secret put ONE_API_KEY
```

普通变量可通过 Dashboard 配置，也可以写入 `wrangler.toml` 的 `[vars]`。不要把真实 Secret 写进 `[vars]`。

## 7. 本地完整联调

先构建：

```bash
npm run build
```

启动 Worker：

```bash
npx wrangler dev
```

Wrangler 会同时提供：

- React 静态资产。
- `/api/v1/*` API。
- 本地 D1 binding。

健康检查：

```bash
curl http://localhost:8787/api/v1/health
```

端口以 Wrangler 实际输出为准。

## 8. 部署

```bash
npm run build
npm run deploy
```

`npm run deploy` 执行 `wrangler deploy`。

默认域名通常为：

```text
https://mycost.<your-workers-subdomain>.workers.dev
```

也可以在 Worker Settings 中绑定自定义域名。

## 9. 官方一键部署

README 使用：

```markdown
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/zskfree/mycost)
```

要求：

- 源仓库公开。
- 仓库托管在 GitHub 或 GitLab。
- `wrangler.toml` 包含 Worker 入口和资源 binding。

Cloudflare 会复制仓库、构建 Worker，并尝试创建 D1。部署完成后仍需手工配置 Secrets 并执行 `db/schema.sql`。

## 10. API 验收

健康检查：

```bash
curl https://<your-worker-domain>/api/v1/health
```

未授权检查：

```bash
curl -i https://<your-worker-domain>/api/v1/transactions
```

预期 HTTP `401`。

文本记账：

```bash
curl -X POST https://<your-worker-domain>/api/v1/entry \
  -H "Authorization: Bearer <APP_PASSKEY>" \
  -H "Content-Type: application/json" \
  -d '{"request_id":"test-001","text":"中午吃牛肉面 28 块，微信支付","datetime":"2026-09-01T12:30:00+08:00","weekday":"二","source":"shortcuts"}'
```

查询：

```bash
curl "https://<your-worker-domain>/api/v1/transactions?month=2026-09" \
  -H "Authorization: Bearer <APP_PASSKEY>"
```

导出：

```bash
curl -L "https://<your-worker-domain>/api/v1/export?format=json" \
  -H "Authorization: Bearer <APP_PASSKEY>" \
  -o mycost_export.json
```

幂等测试：连续发送相同 `request_id`。第二次应返回 `duplicated: true`，D1 不新增记录。

## 11. 生产验收清单

- [ ] `npm run check` 通过。
- [ ] `npm run build` 通过。
- [ ] Worker 首页可打开。
- [ ] `/api/v1/health` 正常。
- [ ] D1 binding 名为 `DB`。
- [ ] schema 已执行。
- [ ] `APP_PASSKEY` 和 `ONE_API_KEY` 已设置为 Secret。
- [ ] One API 文本解析成功。
- [ ] PWA 新增、查询、删除、导出成功。
- [ ] 苹果文本快捷指令成功。
- [ ] 音频模型能力已验证。
