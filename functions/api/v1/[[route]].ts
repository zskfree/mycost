import { Hono } from 'hono';
import { parseEntryWithOneApi, parsedToTransactionInput, toAmountCents } from './ai';
import {
  findTransactionByRequestId,
  insertTransaction,
  listTransactions,
  softDeleteTransaction,
  summarizeTransactions,
  updateTransaction,
  type TransactionRow,
  type TransactionSource,
  type TransactionUpdate,
} from './db';
import { requireBearerToken, type AppBindings } from './middleware';

const app = new Hono<AppBindings>();
const API_PREFIX = '/api/v1';

interface EntryPayload {
  request_id?: string;
  text?: string;
  datetime?: string;
  weekday?: string;
  source?: TransactionSource;
}

interface UpdatePayload extends Omit<TransactionUpdate, 'amount_cents'> {
  amount?: number;
  amount_cents?: number;
}

app.get(`${API_PREFIX}/health`, (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use(`${API_PREFIX}/*`, requireBearerToken);

app.post(`${API_PREFIX}/entry`, async (c) => {
  const startedAt = Date.now();

  try {
    const payload = await parseEntryRequest(c.req.raw);
    const requestId = payload.request_id?.trim() || crypto.randomUUID();
    const source = normalizeSource(payload.source);
    const clientDateTime = payload.datetime || new Date().toISOString();
    const weekday = payload.weekday || '';

    const existing = await findTransactionByRequestId(c.env.DB, requestId);
    if (existing) {
      return c.json({
        status: 'SUCCESS',
        duplicated: true,
        message: formatEntryMessage([existing]),
        transcript: existing.raw_text,
        transactions: [toApiTransaction(existing)],
        execution_time_ms: Date.now() - startedAt,
      });
    }

    const parseResult = await parseEntryWithOneApi({
      env: c.env,
      text: payload.text,
      audio: payload.audio,
      clientDateTime,
      weekday,
    });

    const inserted: TransactionRow[] = [];
    for (let index = 0; index < parseResult.transactions.length; index += 1) {
      const parsed = parseResult.transactions[index];
      inserted.push(
        await insertTransaction(
          c.env.DB,
          parsedToTransactionInput({
            parsed,
            rawText: payload.text || parseResult.transcript,
            source,
            requestId: index === 0 ? requestId : `${requestId}:${index + 1}`,
            modelName: parseResult.model_name,
          }),
        ),
      );
    }

    return c.json({
      status: 'SUCCESS',
      duplicated: false,
      message: formatEntryMessage(inserted),
      transcript: parseResult.transcript,
      transactions: inserted.map(toApiTransaction),
      execution_time_ms: Date.now() - startedAt,
    });
  } catch (error) {
    return c.json(
      {
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Entry failed',
        execution_time_ms: Date.now() - startedAt,
      },
      400,
    );
  }
});

app.get(`${API_PREFIX}/transactions`, async (c) => {
  const rows = await listTransactions(c.env.DB, {
    month: c.req.query('month'),
    category: c.req.query('category'),
    limit: parsePositiveInt(c.req.query('limit')),
  });
  const summary = summarizeTransactions(rows);

  return c.json({
    transactions: rows.map(toApiTransaction),
    total_expense: centsToYuan(summary.total_expense_cents),
    total_income: centsToYuan(summary.total_income_cents),
    total_expense_cents: summary.total_expense_cents,
    total_income_cents: summary.total_income_cents,
  });
});

app.put(`${API_PREFIX}/transactions/:id`, async (c) => {
  try {
    const payload = (await c.req.json()) as UpdatePayload;
    const changes: TransactionUpdate = {
      ...payload,
      amount_cents: typeof payload.amount_cents === 'number' ? payload.amount_cents : undefined,
    };

    if (typeof payload.amount === 'number') {
      changes.amount_cents = toAmountCents(payload.amount);
    }

    delete (changes as Record<string, unknown>).amount;
    const updated = await updateTransaction(c.env.DB, c.req.param('id'), changes);
    if (!updated) {
      return c.json({ status: 'ERROR', message: 'Transaction not found' }, 404);
    }

    return c.json({ status: 'SUCCESS', transaction: toApiTransaction(updated) });
  } catch (error) {
    return c.json({ status: 'ERROR', message: error instanceof Error ? error.message : 'Update failed' }, 400);
  }
});

app.delete(`${API_PREFIX}/transactions/:id`, async (c) => {
  const deleted = await softDeleteTransaction(c.env.DB, c.req.param('id'));
  if (!deleted) {
    return c.json({ status: 'ERROR', message: 'Transaction not found' }, 404);
  }
  return c.json({ status: 'SUCCESS' });
});

app.get(`${API_PREFIX}/export`, async (c) => {
  const format = c.req.query('format') === 'json' ? 'json' : 'csv';
  const rows = await listTransactions(c.env.DB, { limit: 500 });
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');

  if (format === 'json') {
    return new Response(JSON.stringify({ exported_at: new Date().toISOString(), transactions: rows.map(toApiTransaction) }, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="mycost_export_${date}.json"`,
      },
    });
  }

  return new Response(toCSV(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="mycost_export_${date}.csv"`,
    },
  });
});

export { app };

async function parseEntryRequest(request: Request): Promise<EntryPayload & { audio?: File }> {
  const contentType = request.headers.get('Content-Type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const audio = form.get('audio');
    const payload = {
      request_id: stringValue(form.get('request_id')),
      text: stringValue(form.get('text')),
      datetime: stringValue(form.get('datetime')),
      weekday: stringValue(form.get('weekday')),
      source: stringValue(form.get('source')) as TransactionSource | undefined,
      audio: isFileLike(audio) ? audio : undefined,
    };
    if (!payload.text && !payload.audio) {
      throw new Error('text or audio is required for entry request');
    }
    return payload;
  }

  const body = (await request.json()) as EntryPayload;
  if (!body.text?.trim()) {
    throw new Error('text is required for JSON entry request');
  }
  return body;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isFileLike(value: unknown): value is File {
  return typeof value === 'object' && value !== null && 'arrayBuffer' in value && 'name' in value;
}

function normalizeSource(source?: TransactionSource): TransactionSource {
  if (source === 'shortcuts' || source === 'pwa_voice' || source === 'pwa_text' || source === 'manual') {
    return source;
  }
  return 'shortcuts';
}

function parsePositiveInt(value?: string): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function toApiTransaction(row: TransactionRow) {
  return {
    ...row,
    amount: centsToYuan(row.amount_cents),
  };
}

function centsToYuan(cents: number): number {
  return Math.round(cents) / 100;
}

function formatEntryMessage(rows: TransactionRow[]): string {
  if (rows.length === 0) return '未识别到账单';
  if (rows.length === 1) {
    const row = rows[0];
    const subcategory = row.subcategory ? `/${row.subcategory}` : '';
    return `已记入「${row.category}${subcategory}」¥${centsToYuan(row.amount_cents).toFixed(2)}`;
  }

  const total = rows.reduce((sum, row) => sum + row.amount_cents, 0);
  return `已记入 ${rows.length} 笔共 ¥${centsToYuan(total).toFixed(2)}`;
}

function toCSV(rows: TransactionRow[]): string {
  const header = ['日期', '类型', '金额', '币种', '一级分类', '二级分类', '商户', '支付方式', '备注', '原始识别文本'];
  const body = rows.map((row) =>
    [
      row.transaction_date,
      row.type === 'income' ? '收入' : '支出',
      centsToYuan(row.amount_cents).toFixed(2),
      row.currency,
      row.category,
      row.subcategory ?? '',
      row.merchant ?? '',
      row.payment_method ?? '',
      row.description ?? '',
      row.raw_text,
    ]
      .map(csvCell)
      .join(','),
  );

  return ['\uFEFF' + header.map(csvCell).join(','), ...body].join('\n');
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
