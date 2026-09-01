import type { TransactionsResponse } from '../types';

interface DashboardStatsProps {
  response: TransactionsResponse;
  month: string;
}

export function DashboardStats({ response, month }: DashboardStatsProps) {
  const balance = response.total_income - response.total_expense;

  return (
    <section className="panel">
      <h2>{month} 汇总</h2>
      <div className="stat-grid">
        <div className="stat-item">
          <span>支出</span>
          <strong>¥{response.total_expense.toFixed(2)}</strong>
        </div>
        <div className="stat-item">
          <span>收入</span>
          <strong>¥{response.total_income.toFixed(2)}</strong>
        </div>
        <div className="stat-item">
          <span>结余</span>
          <strong className={balance >= 0 ? 'positive' : 'negative'}>¥{balance.toFixed(2)}</strong>
        </div>
      </div>
    </section>
  );
}
