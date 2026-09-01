import { useState } from 'react';
import { downloadExport } from '../services/api';

interface ExportModalProps {
  token: string;
}

export function ExportModal({ token }: ExportModalProps) {
  const [message, setMessage] = useState('');

  async function handleExport(format: 'csv' | 'json') {
    if (!token) {
      setMessage('先填写 APP_PASSKEY');
      return;
    }

    setMessage('');
    try {
      await downloadExport(token, format);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导出失败');
    }
  }

  return (
    <section className="panel">
      <h2>导出</h2>
      <div className="action-row">
        <button type="button" onClick={() => void handleExport('csv')}>
          CSV
        </button>
        <button type="button" onClick={() => void handleExport('json')}>
          JSON
        </button>
      </div>
      {message ? <p className="notice error">{message}</p> : null}
    </section>
  );
}
