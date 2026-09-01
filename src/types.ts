export interface Transaction {
  id: string;
  request_id: string | null;
  type: 'expense' | 'income';
  amount: number;
  amount_cents: number;
  currency: string;
  category: string;
  subcategory: string | null;
  merchant: string | null;
  payment_method: string | null;
  transaction_date: string;
  description: string | null;
  raw_text: string;
  source: 'shortcuts' | 'pwa_voice' | 'pwa_text' | 'manual';
  parse_status: 'parsed' | 'pending' | 'failed';
  model_name: string | null;
  confidence: number | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  total_expense: number;
  total_income: number;
  total_expense_cents: number;
  total_income_cents: number;
}

export interface EntryResponse {
  status: 'SUCCESS' | 'ERROR';
  duplicated?: boolean;
  message: string;
  transcript?: string;
  transactions?: Transaction[];
  execution_time_ms?: number;
}
