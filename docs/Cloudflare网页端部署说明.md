# MyCost Cloudflare Workers 网页端部署说明

本文档用于通过浏览器完成部署。项目已迁移为 Cloudflare Worker + Static Assets + D1，支持官方 `Deploy to Cloudflare` 按钮。

## 1. 免费范围

Cloudflare Workers 提供 Free plan。个人记账通常可以先使用免费计划，但免费计划包含请求数、CPU 时间、D1 读写和存储限制，不代表无限使用。

以下费用不属于 Workers 免费额度：

- 自建 One API 服务器成本。
- One API 上游模型调用费用。
- 超出 Workers 或 D1 免费额度后的费用。

部署后在 Cloudflare Dashboard 的 `Billing` 和 `Usage` 页面检查实际用量。

## 2. 部署前准备

需要：

- Cloudflare 账号。
- GitHub 账号。
- 可访问的 One API 地址。
- One API Key。
- 一段随机、足够长的 `APP_PASSKEY`。

仓库关键文件：

```text
worker/index.ts
wrangler.toml
db/schema.sql
package.json
src/
functions/api/v1/
```

当前 Worker 配置：

```text
Worker entry: worker/index.ts
Build command: npm run build
Deploy command: npm run deploy
Static assets: dist
Assets binding: ASSETS
D1 binding: DB
```

## 3. 方式一：官方一键部署按钮

打开项目 README，点击：

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/zskfree/mycost)

按钮要求源仓库是公开 GitHub 或 GitLab 仓库。流程：

1. 登录 Cloudflare。
2. 授权 Cloudflare 访问 GitHub。
3. 确认复制后的 GitHub 仓库名称。
4. 确认 Worker 名称，建议 `mycost`。
5. 确认 D1 资源名称，建议 `mycost`。
6. 等待 Cloudflare 克隆、构建并部署。
7. 部署完成后进入新 Worker 的详情页。

Cloudflare 会读取 `wrangler.toml`：

- `main = "worker/index.ts"`
- `[assets] directory = "./dist"`
- `[[d1_databases]] binding = "DB"`

一键流程可能自动创建并绑定 D1。部署后仍必须检查 `DB` binding 是否存在，并在 D1 Console 执行 schema。

一键部署不会自动填入个人的 One API Key。部署成功不代表 AI 记账已经可用，必须继续执行第 6、7 节。

## 4. 方式二：Dashboard 导入 GitHub 仓库

不使用一键按钮时：

1. 登录 `https://dash.cloudflare.com/`。
2. 选择账号。
3. 打开 `Workers & Pages`。
4. 点击 `Create application`。
5. 选择 `Import a repository`、`Connect to Git` 或界面中对应的 Git 仓库导入入口。
6. 选择 GitHub。
7. 授权并选择 `zskfree/mycost`。
8. Worker 名称填写 `mycost`。
9. Production branch 选择 `main`。

构建设置：

| 字段 | 值 |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npm run deploy` 或 `npx wrangler deploy` |
| Root directory | `/` |

`npm run deploy` 对应 `package.json` 中的 `wrangler deploy`。构建步骤必须先生成 `dist/`，否则静态 PWA 无法上传。

点击 `Save and Deploy`。默认域名通常是：

```text
https://mycost.<你的-workers-subdomain>.workers.dev
```

## 5. 检查静态资产和 Worker 路由

部署完成后，先检查两个地址：

```text
https://<your-worker-domain>/
https://<your-worker-domain>/api/v1/health
```

预期：

- `/` 显示 MyCost PWA。
- `/api/v1/health` 返回 JSON，`status` 为 `ok`。

工作方式：

- `/api/*` 优先进入 Worker/Hono。
- CSS、JS、manifest 等由 Worker Static Assets 提供。
- 其他前端路径回退到 `index.html`。

如果首页正常但 API 404，检查：

- `wrangler.toml` 的 `run_worker_first = ["/api/*"]`。
- Worker 入口是否是 `worker/index.ts`。
- 当前部署是否来自最新 commit。

## 6. 创建和初始化 D1

### 6.1 检查自动创建结果

一键部署后：

1. 打开 Worker `mycost`。
2. 进入 `Settings`。
3. 打开 `Bindings`。
4. 检查是否存在 D1 binding：

```text
Variable name: DB
Database: mycost 或自动创建的数据库
```

如果 `DB` 已存在，直接进入 6.3 初始化 schema。

### 6.2 手工创建和绑定

没有自动创建时：

1. 打开 Dashboard 左侧 `Storage & databases`。
2. 进入 `D1 SQL database`。
3. 点击 `Create`。
4. 名称填写 `mycost`。
5. 创建完成后回到 Worker `mycost`。
6. 打开 `Settings` > `Bindings`。
7. 点击 `Add binding`。
8. 类型选择 `D1 database`。
9. Variable name 填 `DB`。
10. Database 选择 `mycost`。
11. 保存并重新部署 Worker。

变量名必须是大写 `DB`。代码使用 `env.DB`，其他名称不能工作。

### 6.3 网页 Console 初始化 schema

1. 打开 D1 数据库。
2. 进入 `Console` 或 `Query`。
3. 打开仓库文件 [db/schema.sql](../db/schema.sql)。
4. 复制全部 SQL 到 Console。
5. 点击 `Run`。

如果 Console 不接受一次运行多条语句，按顺序分段执行：

1. `transactions` 表。
2. 三个 `transactions` 索引。
3. `categories` 表。
4. `settings` 表。

检查：

```sql
SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;
```

预期：

```text
categories
settings
transactions
```

再检查交易字段：

```sql
PRAGMA table_info(transactions);
```

必须包含 `request_id`、`amount_cents`、`parse_status`、`model_name`、`confidence`、`is_deleted`、`deleted_at`。

## 7. 配置 Worker Variables 和 Secrets

进入：

`Workers & Pages` > `mycost` > `Settings` > `Variables and Secrets`

添加：

| 名称 | 类型 | 值 |
|---|---|---|
| `APP_PASSKEY` | Secret | 自己生成的随机令牌 |
| `ONE_API_KEY` | Secret | One API Key |
| `ONE_API_BASE_URL` | Text | 例如 `https://example.com/v1` |
| `MULTIMODAL_MODELS` | Text | 逗号分隔模型列表 |
| `TRANSCRIBE_MODEL` | Text | 可选 STT 模型名 |

示例模型列表：

```text
gemini-3.5-flash-lite,gemini-3.7-flash,gemini-3.6-flash
```

安全规则：

- `ONE_API_KEY` 不能放入前端或快捷指令。
- `APP_PASSKEY` 用于 PWA 和快捷指令访问 Worker API。
- 不要把 Cloudflare API Token 写进 Worker 变量。
- 同域前端默认使用 `/api/v1`，通常不需要配置 `VITE_API_BASE_URL`。

保存变量后重新部署当前 Worker，确保新部署能读取变量。

## 8. 验证 One API

当前 Worker 请求：

```text
POST {ONE_API_BASE_URL}/chat/completions
Authorization: Bearer {ONE_API_KEY}
```

One API 需要满足：

- 模型名称与 `MULTIMODAL_MODELS` 一致。
- 文本模型支持 OpenAI 兼容 `/chat/completions`。
- 返回内容是 JSON object，包含 `transactions` 数组。
- 音频模型支持消息中的 `input_audio`。

建议先测试文本，再测试音频。文本成功、音频失败通常说明模型不支持 `input_audio`，不代表 Worker 或 D1 配置错误。

## 9. 网页端功能验收

### 9.1 健康检查

浏览器打开：

```text
https://<your-worker-domain>/api/v1/health
```

预期 HTTP `200`：

```json
{"status":"ok","timestamp":"..."}
```

### 9.2 鉴权检查

浏览器直接打开：

```text
https://<your-worker-domain>/api/v1/transactions
```

预期返回 `401 Unauthorized`。这说明 API 路由和鉴权均已工作。

### 9.3 PWA 文本记账

1. 打开 Worker 首页。
2. 在 `APP_PASSKEY` 输入框填写 Worker Secret 中相同的值。
3. 输入：`中午吃牛肉面 28 块，微信支付`。
4. 点击 `提交`。

预期：

- 页面显示 `已记入`。
- 最近账单出现一笔记录。
- 本月支出增加 `¥28.00`。
- D1 中 `amount_cents` 为 `2800`。

### 9.4 幂等测试

浏览器 PWA 每次会生成新 UUID。精确测试幂等时，使用 Cloudflare Dashboard 的 API 测试工具或终端，连续发送相同 `request_id`。

预期第二次返回：

```json
{"duplicated":true}
```

D1 不能新增第二笔。

### 9.5 删除和导出

- 删除后交易从列表消失，D1 中变为 `is_deleted = 1`。
- CSV 能用 Excel/Numbers 打开。
- JSON 包含完整交易字段。

## 10. 配置苹果快捷指令

网页端文本记账通过后，再按：

[苹果快捷指令设置说明](./苹果快捷指令设置说明.md)

把文档中的 URL 替换为：

```text
https://<your-worker-domain>/api/v1/entry
```

测试顺序：

1. PWA 文本记账。
2. 苹果文本快捷指令。
3. 多笔拆分和相对日期。
4. 音频兜底快捷指令。
5. 重复请求和断网提示。

## 11. 日志排障

进入：

`Workers & Pages` > `mycost` > `Logs` 或 `Observability`

常见错误：

| 错误 | 原因 |
|---|---|
| `APP_PASSKEY missing` | Worker 没配置 Secret，或修改后未重新部署 |
| `Unauthorized` | 客户端 Token 与 Worker Secret 不一致 |
| `One API env missing` | `ONE_API_BASE_URL`、`ONE_API_KEY`、模型列表不完整 |
| `D1_ERROR` | D1 没绑定、binding 不是 `DB`、schema 没初始化 |
| `One API parse failed` | 模型名错误、网关不可用、响应 JSON 不合规范 |
| 首页 404 | `dist` 未构建或 `[assets]` 配置未生效 |
| API 返回首页 HTML | `/api/*` 没有设置 `run_worker_first` |

## 12. 部署完成清单

- [ ] Worker 已创建，默认域名可访问。
- [ ] 首页显示 MyCost PWA。
- [ ] `/api/v1/health` 返回 `status: ok`。
- [ ] D1 database 已创建。
- [ ] D1 binding 名为 `DB`。
- [ ] `db/schema.sql` 已执行。
- [ ] `APP_PASSKEY` 已配置为 Secret。
- [ ] `ONE_API_KEY` 已配置为 Secret。
- [ ] `ONE_API_BASE_URL` 已配置。
- [ ] `MULTIMODAL_MODELS` 已配置。
- [ ] PWA 文本记账成功。
- [ ] 刷新后交易仍存在。
- [ ] 删除、CSV、JSON 正常。
- [ ] 苹果文本快捷指令成功。
- [ ] 重复 `request_id` 不重复入库。
- [ ] 音频链路已测试或明确上游模型不支持。
