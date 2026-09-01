import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardStats } from './components/DashboardStats';
import { ExportModal } from './components/ExportModal';
import { QuickInputBar } from './components/QuickInputBar';
import { TransactionList } from './components/TransactionList';
import { createAudioEntry, createEntry, deleteTransaction, listTransactions } from './services/api';
import { startAudioRecording, type AudioRecordingSession } from './services/audioRecorder';
import type { EntryResponse, Transaction, TransactionsResponse } from './types';

const TOKEN_STORAGE_KEY = 'mycost.appPasskey';

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) ?? '');
  const [month, setMonth] = useState(() => currentMonth());
  const [text, setText] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef<AudioRecordingSession | null>(null);
  const [data, setData] = useState<TransactionsResponse>({
    transactions: [],
    total_expense: 0,
    total_income: 0,
    total_expense_cents: 0,
    total_income_cents: 0,
  });

  const refresh = useCallback(
    async (targetMonth = month) => {
      if (!token.trim()) return;
      setError('');
      try {
        setData(await listTransactions(token.trim(), targetMonth));
      } catch (refreshError) {
        setError(refreshError instanceof Error ? refreshError.message : '读取账单失败');
      }
    },
    [month, token],
  );

  useEffect(() => {
    if (token.trim()) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
      void refresh(month);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }, [month, refresh, token]);

  async function handleSubmit() {
    const content = text.trim();
    if (!token.trim()) {
      setError('先填写 APP_PASSKEY');
      return;
    }
    if (!content) {
      setError('请输入记账内容');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');
    try {
      const response = await createEntry(token.trim(), content);
      setText('');
      await showEntryResult(response);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '记账失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleStartRecording() {
    if (!token.trim()) {
      setError('先填写 APP_PASSKEY');
      return;
    }

    setError('');
    setNotice('');
    try {
      recordingRef.current = await startAudioRecording();
      setRecording(true);
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : '录音启动失败');
    }
  }

  async function handleStopRecording() {
    const session = recordingRef.current;
    if (!session) return;

    setLoading(true);
    setRecording(false);
    setError('');
    try {
      const audio = await session.stop();
      recordingRef.current = null;
      const response = await createAudioEntry(token.trim(), audio, text);
      setText('');
      await showEntryResult(response);
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : '语音记账失败');
    } finally {
      setLoading(false);
    }
  }

  async function showEntryResult(response: EntryResponse) {
    const targetMonth = response.transactions?.[0]?.transaction_date.slice(0, 7) || month;
    const suffix = targetMonth !== month ? `，已切换到 ${targetMonth}` : '';
    setNotice(`${response.duplicated ? `${response.message}（未新增）` : response.message}${suffix}`);
    if (targetMonth !== month) {
      setMonth(targetMonth);
    }
    await refresh(targetMonth);
  }

  async function handleDelete(transaction: Transaction) {
    if (!confirm(`删除 ${transaction.category} ¥${transaction.amount.toFixed(2)}？`)) return;
    setLoading(true);
    setError('');
    try {
      await deleteTransaction(token.trim(), transaction.id);
      await refresh(month);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">MyCost</p>
          <h1>语音输入记账</h1>
          <p className="subtle">Shortcuts · PWA · D1</p>
        </div>
        <div className="status-pill">{token ? 'Token 已设置' : '待设置 Token'}</div>
      </header>

      <main className="app-grid">
        <QuickInputBar
          token={token}
          text={text}
          loading={loading}
          notice={notice}
          error={error}
          onTokenChange={setToken}
          onTextChange={setText}
          recording={recording}
          onSubmit={handleSubmit}
          onRefresh={() => void refresh(month)}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
        />
        <DashboardStats response={data} month={month} onMonthChange={setMonth} />
        <TransactionList transactions={data.transactions} loading={loading} onDelete={handleDelete} />
        <ExportModal token={token.trim()} />
      </main>
    </div>
  );
}

function currentMonth(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
