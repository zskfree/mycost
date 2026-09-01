import type { TransactionInput, TransactionSource, TransactionType } from './db';

export interface AIEnv {
  ONE_API_BASE_URL?: string;
  ONE_API_KEY?: string;
  MULTIMODAL_MODELS?: string;
  TRANSCRIBE_MODEL?: string;
}

export interface ParsedTransaction {
  type: TransactionType;
  amount: number;
  currency?: string;
  category: string;
  subcategory?: string | null;
  merchant?: string | null;
  payment_method?: string | null;
  transaction_date: string;
  description?: string | null;
  confidence?: number | null;
}

export interface ParseResult {
  transcript: string;
  model_name: string;
  transactions: ParsedTransaction[];
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export function buildSystemPrompt(clientDateTime: string, weekday: string): string {
  return `你是一个专业严谨的记账助手。请从用户输入中提取财务交易信息，严格输出纯 JSON，不要输出 Markdown。

输出格式：
{
  "transactions": [
    {
      "type": "expense" | "income",
      "amount": number,
      "currency": "CNY",
      "category": string,
      "subcategory": string | null,
      "merchant": string | null,
      "payment_method": string | null,
      "transaction_date": "YYYY-MM-DD",
      "description": string | null,
      "confidence": number
    }
  ]
}

要求：
- 金额单位输出为元，服务端会转换为整数分。
- 多笔账单必须拆成多条 transactions。
- 支出 type 为 expense，收入 type 为 income。
- 不确定分类时使用“其它”。
- 不确定支付方式、商户、二级分类时输出 null。
- confidence 范围 0 到 1。

【当前基准时间】
- 客户端当前时间：${clientDateTime || '未提供'}${weekday ? ` (星期${weekday})` : ''}
- 根据此基准时间计算“昨天”、“前天”、“上周日”等相对日期。

【分类标准库】
餐饮(早餐/午餐/晚餐/咖啡饮料/零食水果), 交通(打车/地铁公交/加油/停车), 购物(超市买菜/日用品/服饰数码), 娱乐, 居家, 医疗, 人情, 收入(工资/理财/兼职), 其它。`;
}

export async function parseEntryWithOneApi(args: {
  env: AIEnv;
  text?: string;
  audio?: File;
  clientDateTime: string;
  weekday: string;
}): Promise<ParseResult> {
  const baseUrl = normalizeBaseUrl(args.env.ONE_API_BASE_URL);
  const apiKey = args.env.ONE_API_KEY?.trim();
  const models = parseModelList(args.env.MULTIMODAL_MODELS);

  if (!baseUrl || !apiKey || models.length === 0) {
    throw new Error('One API env missing: ONE_API_BASE_URL, ONE_API_KEY, MULTIMODAL_MODELS');
  }

  const systemPrompt = buildSystemPrompt(args.clientDateTime, args.weekday);
  const userText = args.text?.trim();
  const audioPayload = args.audio ? await fileToDataUrl(args.audio) : null;
  const lastErrors: string[] = [];

  for (const model of models) {
    try {
      const content = audioPayload
        ? [
            { type: 'text', text: userText || '请解析这段记账语音。' },
            { type: 'input_audio', input_audio: { data: audioPayload.base64, format: audioPayload.format } },
          ]
        : userText || '';

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content },
          ],
        }),
      });

      if (!response.ok) {
        lastErrors.push(`${model}: HTTP ${response.status}`);
        continue;
      }

      const data = (await response.json()) as ChatCompletionResponse;
      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) {
        lastErrors.push(`${model}: empty content`);
        continue;
      }

      const parsed = cleanAndParseJSON<{ transactions?: ParsedTransaction[] }>(rawContent);
      const transactions = normalizeParsedTransactions(parsed.transactions ?? [], args.clientDateTime);
      if (transactions.length === 0) {
        lastErrors.push(`${model}: no transactions`);
        continue;
      }

      return {
        transcript: userText || args.audio?.name || 'audio',
        model_name: model,
        transactions,
      };
    } catch (error) {
      lastErrors.push(`${model}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`One API parse failed: ${lastErrors.join('; ')}`);
}

export function parsedToTransactionInput(args: {
  parsed: ParsedTransaction;
  rawText: string;
  source: TransactionSource;
  requestId: string | null;
  modelName: string | null;
}): TransactionInput {
  return {
    request_id: args.requestId,
    type: args.parsed.type,
    amount_cents: toAmountCents(args.parsed.amount),
    currency: args.parsed.currency ?? 'CNY',
    category: args.parsed.category,
    subcategory: args.parsed.subcategory ?? null,
    merchant: args.parsed.merchant ?? null,
    payment_method: args.parsed.payment_method ?? null,
    transaction_date: args.parsed.transaction_date,
    description: args.parsed.description ?? null,
    raw_text: args.rawText,
    source: args.source,
    parse_status: 'parsed',
    model_name: args.modelName,
    confidence: args.parsed.confidence ?? null,
  };
}

export function cleanAndParseJSON<T>(rawContent: string): T {
  let cleaned = rawContent.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  return JSON.parse(cleaned) as T;
}

export function toAmountCents(amount: number): number {
  return Math.round(amount * 100);
}

function normalizeBaseUrl(value?: string): string | null {
  const trimmed = value?.trim().replace(/\/$/, '');
  return trimmed || null;
}

function parseModelList(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeParsedTransactions(rows: ParsedTransaction[], clientDateTime: string): ParsedTransaction[] {
  const fallbackDate = (clientDateTime || new Date().toISOString()).slice(0, 10);
  return rows
    .filter((row) => Number.isFinite(row.amount) && row.amount > 0)
    .map((row) => ({
      type: row.type === 'income' ? 'income' : 'expense',
      amount: row.amount,
      currency: row.currency || 'CNY',
      category: row.category || (row.type === 'income' ? '收入' : '其它'),
      subcategory: row.subcategory ?? null,
      merchant: row.merchant ?? null,
      payment_method: row.payment_method ?? null,
      transaction_date: /^\d{4}-\d{2}-\d{2}$/.test(row.transaction_date) ? row.transaction_date : fallbackDate,
      description: row.description ?? null,
      confidence: typeof row.confidence === 'number' ? row.confidence : null,
    }));
}

async function fileToDataUrl(file: File): Promise<{ base64: string; format: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return {
    base64: btoa(binary),
    format: inferAudioFormat(file.type, file.name),
  };
}

function inferAudioFormat(contentType: string, fileName: string): string {
  if (contentType.includes('wav') || fileName.endsWith('.wav')) return 'wav';
  if (contentType.includes('mpeg') || fileName.endsWith('.mp3')) return 'mp3';
  if (contentType.includes('mp4') || contentType.includes('m4a') || fileName.endsWith('.m4a')) return 'm4a';
  return 'wav';
}
