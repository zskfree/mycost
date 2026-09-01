import { DashboardStats } from './components/DashboardStats';
import { ExportModal } from './components/ExportModal';
import { QuickInputBar } from './components/QuickInputBar';
import { TransactionList } from './components/TransactionList';

export function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">MyCost</p>
          <h1>语音输入记账</h1>
          <p className="subtle">Shortcuts · PWA · D1</p>
        </div>
        <div className="status-pill">Scaffold</div>
      </header>

      <main className="app-grid">
        <QuickInputBar />
        <DashboardStats />
        <TransactionList />
        <ExportModal />
      </main>
    </div>
  );
}
