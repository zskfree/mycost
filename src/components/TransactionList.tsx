import type { Transaction } from '../types';

interface TransactionListProps {
  transactions: Transaction[];
  loading: boolean;
  onDelete: (transaction: Transaction) => void;
}

export function TransactionList({ transactions, loading, onDelete }: TransactionListProps) {
  return (
    <section className="panel panel-wide">
      <h2>最近账单</h2>
      <div className="transaction-list">
        {transactions.length === 0 ? <div className="empty-state">暂无账单</div> : null}
        {transactions.map((transaction) => (
          <article className="transaction-item" key={transaction.id}>
            <div className="transaction-main">
              <div>
                <strong>{transaction.description || transaction.category}</strong>
                <p>
                  {transaction.transaction_date} · {transaction.category}
                  {transaction.subcategory ? `/${transaction.subcategory}` : ''}
                  {transaction.payment_method ? ` · ${transaction.payment_method}` : ''}
                </p>
              </div>
              <span className={transaction.type === 'income' ? 'amount income' : 'amount expense'}>
                {transaction.type === 'income' ? '+' : '-'}¥{transaction.amount.toFixed(2)}
              </span>
            </div>
            <div className="transaction-meta">
              <span>{transaction.raw_text}</span>
              <button type="button" onClick={() => onDelete(transaction)} disabled={loading}>
                删除
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
