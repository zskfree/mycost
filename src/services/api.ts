import type { EntryResponse, TransactionsResponse } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export async function apiFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as T;
}

export function listTransactions(token: string, month: string): Promise<TransactionsResponse> {
  return apiFetch<TransactionsResponse>(`/transactions?month=${encodeURIComponent(month)}&limit=100`, token);
}

export function createEntry(token: string, text: string): Promise<EntryResponse> {
  return apiFetch<EntryResponse>('/entry', token, {
    method: 'POST',
    body: JSON.stringify({
      request_id: createRequestId(),
      text,
      datetime: new Date().toISOString(),
      weekday: String(new Date().getDay()),
      source: 'pwa_text',
    }),
  });
}

export function createAudioEntry(token: string, audio: File, text = ''): Promise<EntryResponse> {
  const body = new FormData();
  body.set('request_id', createRequestId());
  body.set('datetime', new Date().toISOString());
  body.set('weekday', String(new Date().getDay()));
  body.set('source', 'pwa_voice');
  if (text.trim()) {
    body.set('text', text.trim());
  }
  body.set('audio', audio);

  return apiFetch<EntryResponse>('/entry', token, {
    method: 'POST',
    body,
  });
}

export function deleteTransaction(token: string, id: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/transactions/${id}`, token, { method: 'DELETE' });
}

export async function downloadExport(token: string, format: 'csv' | 'json'): Promise<void> {
  const response = await fetch(`${BASE_URL}/export?format=${format}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = getFilename(response.headers.get('Content-Disposition')) ?? `mycost_export.${format}`;
  link.click();
  URL.revokeObjectURL(url);
}

export function createRequestId(): string {
  return crypto.randomUUID();
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message || `API request failed: ${response.status}`;
  } catch {
    return `API request failed: ${response.status}`;
  }
}

function getFilename(disposition: string | null): string | null {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
}
