import { supabase } from './supabase';
import type { WhoopDailyScore, WhoopWorkoutActivity, Workout, ShoeMileageSummary } from './types';

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
    shoes: (): Promise<ShoeMileageSummary> => authFetch('/whoop/shoes'),
    dailyScores: (): Promise<{ days: WhoopDailyScore[] }> => authFetch('/whoop/daily-scores'),
    workoutDetails: (id: string): Promise<{ workout: Workout; activity: WhoopWorkoutActivity; source: 'archive' | 'whoop'; archived_at?: string }> => authFetch(`/whoop/workouts/${encodeURIComponent(id)}`),
    saveRunDetails: (id: string, details: { running_shoes: string | null; running_miles: number | null }): Promise<{ workout: Workout }> =>
      authFetch(`/whoop/workouts/${encodeURIComponent(id)}/run-details`, { method: 'PATCH', body: JSON.stringify(details) }),
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
