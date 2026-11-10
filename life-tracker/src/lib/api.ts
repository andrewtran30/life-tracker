import { supabase } from './supabase';

const API_BASE = '/api';

async function authFetch(path: string, options: RequestInit = {}) {
  const { data: { session }, error } = await supabase.auth.getSession();
  console.log('authFetch session:', !!session, 'error:', error, 'path:', path);
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }

  return res.json();
}

export const api = {
  whoop: {
    getAuthUrl: () => authFetch('/whoop/auth-url'),
    exchangeCode: (code: string) => authFetch('/whoop/callback', { method: 'POST', body: JSON.stringify({ code }) }),
    sync: () => authFetch('/whoop/sync', { method: 'POST' }),
    status: () => authFetch('/whoop/status'),
  },
  summary: {
    getToday: () => authFetch('/summary/today'),
    regenerate: () => authFetch('/summary/regenerate', { method: 'POST' }),
  },
  finance: {
    importCsv: (csvContent: string, accountId: string) =>
      authFetch('/finance/import-csv', { method: 'POST', body: JSON.stringify({ csvContent, accountId }) }),
  },
};
