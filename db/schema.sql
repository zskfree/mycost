-- MyCost D1 schema scaffold

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    request_id TEXT UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CNY',
    category TEXT NOT NULL,
    subcategory TEXT,
    merchant TEXT,
    payment_method TEXT,
    transaction_date TEXT NOT NULL,
    description TEXT,
    raw_text TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'shortcuts',
    parse_status TEXT NOT NULL DEFAULT 'parsed',
    model_name TEXT,
    confidence REAL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_deleted ON transactions(is_deleted);
CREATE INDEX IF NOT EXISTS idx_transactions_request_id ON transactions(request_id);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    icon TEXT,
    subcategories TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
