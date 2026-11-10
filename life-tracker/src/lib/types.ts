export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface WhoopConnection {
  id: string;
  user_id: string;
  whoop_user_id: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface SleepRecord {
  id: string;
  connection_id: string;
  whoop_sleep_id: number;
  start_time: string;
  end_time: string;
  score: number | null;
  rem_duration_ms: number | null;
  deep_duration_ms: number | null;
  light_duration_ms: number | null;
  awake_duration_ms: number | null;
  respiratory_rate: number | null;
  created_at: string;
}

export interface RecoveryRecord {
  id: string;
  connection_id: string;
  whoop_cycle_id: number;
  date: string;
  recovery_score: number | null;
  hrv_rmssd: number | null;
  resting_hr: number | null;
  spo2: number | null;
  skin_temp_celsius: number | null;
  created_at: string;
}

export interface Workout {
  id: string;
  connection_id: string;
  whoop_workout_id: number;
  sport_name: string | null;
  start_time: string;
  end_time: string;
  strain: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  calories: number | null;
  distance_m: number | null;
  created_at: string;
}

export interface FinanceCategory {
  id: string;
  user_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  is_income: boolean;
  sort_order: number;
  created_at: string;
}

export interface FinanceAccount {
  id: string;
  user_id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'cash' | 'investment';
  currency: string;
  current_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  description: string | null;
  date: string;
  type: 'debit' | 'credit';
  source: 'manual' | 'csv_import';
  import_batch_id: string | null;
  created_at: string;
  category?: FinanceCategory;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  period: 'monthly' | 'weekly';
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export interface JournalPrompt {
  id: string;
  user_id: string | null;
  text: string;
  category: 'gratitude' | 'reflection' | 'goals' | 'wins' | 'freeform';
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  date: string;
  mood_score: number | null;
  energy_score: number | null;
  freeform_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalResponse {
  id: string;
  entry_id: string;
  prompt_id: string;
  response_text: string;
  created_at: string;
}

export interface UserGoal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  domain: 'health' | 'finance' | 'journal' | 'general';
  target_value: number | null;
  target_unit: string | null;
  deadline: string | null;
  status: 'active' | 'completed' | 'paused';
  created_at: string;
  updated_at: string;
}

export interface DailySummary {
  id: string;
  user_id: string;
  date: string;
  summary_text: string;
  recommendations: string[] | null;
  health_snapshot: Record<string, unknown> | null;
  finance_snapshot: Record<string, unknown> | null;
  mood_snapshot: Record<string, unknown> | null;
  generated_at: string;
}
