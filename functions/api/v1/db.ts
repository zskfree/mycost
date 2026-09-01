export type TransactionSource = 'shortcuts' | 'pwa_voice' | 'pwa_text' | 'manual';

export interface TransactionRow {
  id: string;
  request_id: string | null;
  type: 'expense' | 'income';
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
  parse_status: 'parsed' | 'pending' | 'failed';
  model_name: string | null;
  confidence: number | null;
  is_deleted: 0 | 1;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListTransactionsParams {
  month?: string;
  category?: string;
  limit?: number;
}

export async function listTransactions(_db: D1Database, _params: ListTransactionsParams = {}): Promise<TransactionRow[]> {
  return [];
}

export async function upsertTransaction(_db: D1Database, row: TransactionRow): Promise<TransactionRow> {
  return row;
}

export async function softDeleteTransaction(_db: D1Database, _id: string): Promise<void> {
  void _id;
}
