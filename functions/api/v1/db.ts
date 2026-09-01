export type TransactionSource = 'shortcuts' | 'pwa_voice' | 'pwa_text' | 'manual';
export type TransactionType = 'expense' | 'income';
export type ParseStatus = 'parsed' | 'pending' | 'failed';

export interface TransactionRow {
  id: string;
  request_id: string | null;
  type: TransactionType;
  amount_cents: number;
  currency: string;
  category: string;
  subcategory: string | null;
  merchant: string | null;
  payment_method: string | null;
  transaction_date: string;
  description: string | null;
  raw_text: string;
  source: TransactionSource;
  parse_status: ParseStatus;
  model_name: string | null;
  confidence: number | null;
  is_deleted: 0 | 1;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionInput {
  request_id?: string | null;
  type: TransactionType;
  amount_cents: number;
  currency?: string;
  category: string;
  subcategory?: string | null;
  merchant?: string | null;
  payment_method?: string | null;
  transaction_date: string;
  description?: string | null;
  raw_text: string;
  source: TransactionSource;
  parse_status?: ParseStatus;
  model_name?: string | null;
  confidence?: number | null;
}

export interface TransactionUpdate {
  type?: TransactionType;
  amount_cents?: number;
  currency?: string;
  category?: string;
  subcategory?: string | null;
  merchant?: string | null;
  payment_method?: string | null;
  transaction_date?: string;
  description?: string | null;
}

export interface ListTransactionsParams {
  month?: string;
  category?: string;
  limit?: number;
}

const LIST_SELECT = `
  SELECT id, request_id, type, amount_cents, currency, category, subcategory, merchant,
         payment_method, transaction_date, description, raw_text, source, parse_status,
         model_name, confidence, is_deleted, deleted_at, created_at, updated_at
  FROM transactions
`;

export async function listTransactions(db: D1Database, params: ListTransactionsParams = {}): Promise<TransactionRow[]> {
  const where = ['is_deleted = 0'];
  const bindings: Array<string | number> = [];

  if (params.month) {
    where.push('transaction_date >= ? AND transaction_date < ?');
    bindings.push(`${params.month}-01`, nextMonth(params.month));
  }

  if (params.category) {
    where.push('category = ?');
    bindings.push(params.category);
  }

  const limit = Math.min(Math.max(params.limit ?? 100, 1), 500);
  bindings.push(limit);

  const query = `${LIST_SELECT} WHERE ${where.join(' AND ')} ORDER BY transaction_date DESC, created_at DESC LIMIT ?`;
  const result = await db.prepare(query).bind(...bindings).all<TransactionRow>();
  return result.results ?? [];
}

export async function findTransactionByRequestId(db: D1Database, requestId: string): Promise<TransactionRow | null> {
  const row = await db
    .prepare(`${LIST_SELECT} WHERE request_id = ? AND is_deleted = 0 LIMIT 1`)
    .bind(requestId)
    .first<TransactionRow>();
  return row ?? null;
}

export async function findTransactionById(db: D1Database, id: string): Promise<TransactionRow | null> {
  const row = await db
    .prepare(`${LIST_SELECT} WHERE id = ? AND is_deleted = 0 LIMIT 1`)
    .bind(id)
    .first<TransactionRow>();
  return row ?? null;
}

export async function insertTransaction(db: D1Database, input: TransactionInput): Promise<TransactionRow> {
  if (input.request_id) {
    const existing = await findTransactionByRequestId(db, input.request_id);
    if (existing) {
      return existing;
    }
  }

  const now = new Date().toISOString();
  const row: TransactionRow = {
    id: crypto.randomUUID(),
    request_id: input.request_id ?? null,
    type: input.type,
    amount_cents: input.amount_cents,
    currency: input.currency ?? 'CNY',
    category: input.category,
    subcategory: input.subcategory ?? null,
    merchant: input.merchant ?? null,
    payment_method: input.payment_method ?? null,
    transaction_date: input.transaction_date,
    description: input.description ?? null,
    raw_text: input.raw_text,
    source: input.source,
    parse_status: input.parse_status ?? 'parsed',
    model_name: input.model_name ?? null,
    confidence: input.confidence ?? null,
    is_deleted: 0,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  };

  await db
    .prepare(
      `INSERT INTO transactions (
        id, request_id, type, amount_cents, currency, category, subcategory, merchant,
        payment_method, transaction_date, description, raw_text, source, parse_status,
        model_name, confidence, is_deleted, deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.request_id,
      row.type,
      row.amount_cents,
      row.currency,
      row.category,
      row.subcategory,
      row.merchant,
      row.payment_method,
      row.transaction_date,
      row.description,
      row.raw_text,
      row.source,
      row.parse_status,
      row.model_name,
      row.confidence,
      row.is_deleted,
      row.deleted_at,
      row.created_at,
      row.updated_at,
    )
    .run();

  return row;
}

export async function updateTransaction(db: D1Database, id: string, changes: TransactionUpdate): Promise<TransactionRow | null> {
  const allowed = new Set([
    'type',
    'amount_cents',
    'currency',
    'category',
    'subcategory',
    'merchant',
    'payment_method',
    'transaction_date',
    'description',
  ]);
  const entries = Object.entries(changes).filter(([key]) => allowed.has(key));

  if (entries.length > 0) {
    const assignments = entries.map(([key]) => `${key} = ?`);
    const values = entries.map(([, value]) => value as string | number | null);
    assignments.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await db
      .prepare(`UPDATE transactions SET ${assignments.join(', ')} WHERE id = ? AND is_deleted = 0`)
      .bind(...values)
      .run();
  }

  return findTransactionById(db, id);
}

export async function softDeleteTransaction(db: D1Database, id: string): Promise<boolean> {
  const result = await db
    .prepare('UPDATE transactions SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE id = ? AND is_deleted = 0')
    .bind(new Date().toISOString(), new Date().toISOString(), id)
    .run();

  return (result.meta.changes ?? 0) > 0;
}

export function summarizeTransactions(rows: TransactionRow[]) {
  return rows.reduce(
    (summary, row) => {
      if (row.type === 'income') {
        summary.total_income_cents += row.amount_cents;
      } else {
        summary.total_expense_cents += row.amount_cents;
      }
      return summary;
    },
    { total_expense_cents: 0, total_income_cents: 0 },
  );
}

function nextMonth(month: string): string {
  const [yearPart, monthPart] = month.split('-').map(Number);
  const date = new Date(Date.UTC(yearPart, monthPart, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
