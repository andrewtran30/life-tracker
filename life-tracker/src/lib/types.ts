export interface SleepRecord {
  id: string;
  connection_id: string;
  whoop_sleep_id: string;
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

export interface WhoopDailyScore {
  cycle_id: number;
  start_time: string;
  end_time: string | null;
  timezone_offset: string;
  sleep_end_time: string | null;
  sleep_score: number | null;
  recovery_score: number | null;
  strain: number | null;
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
  whoop_workout_id: string;
  sport_name: string | null;
  start_time: string;
  end_time: string;
  strain: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  calories: number | null;
  distance_m: number | null;
  running_shoes: string | null;
  running_miles: number | null;
  running_pace: string | null;
  running_splits: string | null;
  running_feeling: string | null;
  created_at: string;
}

export interface ShoeMileage {
  name: string;
  total_miles: number;
  running_miles: number;
  walking_miles: number;
  hiking_miles: number;
  activities: number;
  missing_distance: number;
  last_used: string | null;
}

export interface ShoeMileageSummary {
  shoes: ShoeMileage[];
  unassigned_activities: number;
}

export interface WhoopWorkoutActivity {
  id: string;
  start: string;
  end: string;
  sport_name: string;
  timezone_offset: string;
  score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
  score?: {
    strain?: number | null;
    average_heart_rate?: number | null;
    max_heart_rate?: number | null;
    kilojoule?: number | null;
    percent_recorded?: number | null;
    distance_meter?: number | null;
    altitude_gain_meter?: number | null;
    altitude_change_meter?: number | null;
    zone_durations?: Record<string, number | null>;
  } | null;
}
