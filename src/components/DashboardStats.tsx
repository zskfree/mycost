import type { TransactionsResponse } from '../types';

interface DashboardStatsProps {
  response: TransactionsResponse;
  month: string;
  onMonthChange: (month: string) => void;
}

export function DashboardStats({ response, month, onMonthChange }: DashboardStatsProps) {
  const balance = response.total_income - response.total_expense;

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{month} 汇总</h2>
        <input
          className="month-field"
          type="month"
          value={month}
          onChange={(event) => onMonthChange(event.target.value)}
          aria-label="选择账单月份"
        />
      </div>
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
