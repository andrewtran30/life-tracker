import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getAuthUrl, exchangeCode, fetchProfile, fetchSleep, fetchRecovery, fetchWorkouts, refreshToken } from '../services/whoop.js';
import { supabaseAdmin } from '../services/supabase.js';

export const whoopRouter = Router();

whoopRouter.get('/auth-url', requireAuth, (_req, res) => {
  res.json({ url: getAuthUrl() });
});

whoopRouter.post('/callback', requireAuth, async (req, res) => {
  const userId = (req as typeof req & { userId: string }).userId;
  const { code } = req.body;
  if (!code) {
    res.status(400).json({ error: 'Missing authorization code' });
    return;
  }

  try {
    const tokens = await exchangeCode(code);
    const profile = await fetchProfile(tokens.access_token);

    await supabaseAdmin.from('whoop_connections').upsert({
      user_id: userId,
      access_token_encrypted: tokens.access_token,
      refresh_token_encrypted: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      whoop_user_id: String(profile.user_id),
    }, { onConflict: 'user_id' });

    res.json({ success: true, whoop_user_id: profile.user_id });
  } catch (err) {
    console.error('WHOOP callback error:', err);
    res.status(500).json({ error: 'Failed to connect WHOOP account' });
  }
});

whoopRouter.post('/sync', requireAuth, async (req, res) => {
  const userId = (req as typeof req & { userId: string }).userId;

  try {
    const { data: connection } = await supabaseAdmin
      .from('whoop_connections')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!connection) {
      res.status(404).json({ error: 'No WHOOP connection found' });
      return;
    }

    let accessToken = connection.access_token_encrypted;
    if (new Date(connection.token_expires_at) <= new Date()) {
      const newTokens = await refreshToken(connection.refresh_token_encrypted);
      accessToken = newTokens.access_token;
      await supabaseAdmin.from('whoop_connections').update({
        access_token_encrypted: newTokens.access_token,
        refresh_token_encrypted: newTokens.refresh_token,
        token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
      }).eq('id', connection.id);
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().split('T')[0];

    const [sleepData, recoveryData, workoutData] = await Promise.all([
      fetchSleep(accessToken, startDate),
      fetchRecovery(accessToken, startDate),
      fetchWorkouts(accessToken, startDate),
    ]);

    const sleepUpserts = (sleepData.records ?? []).map((s: Record<string, unknown>) => ({
      connection_id: connection.id,
      whoop_sleep_id: s.id,
      start_time: s.start,
      end_time: s.end,
      score: (s.score as Record<string, unknown>)?.sleep_performance_percentage,
      rem_duration_ms: (s.score as Record<string, unknown>)?.stage_summary ? (((s.score as Record<string, unknown>).stage_summary as Record<string, unknown>).total_rem_sleep_time_milli) : null,
      deep_duration_ms: (s.score as Record<string, unknown>)?.stage_summary ? (((s.score as Record<string, unknown>).stage_summary as Record<string, unknown>).total_slow_wave_sleep_time_milli) : null,
      light_duration_ms: (s.score as Record<string, unknown>)?.stage_summary ? (((s.score as Record<string, unknown>).stage_summary as Record<string, unknown>).total_light_sleep_time_milli) : null,
      awake_duration_ms: (s.score as Record<string, unknown>)?.stage_summary ? (((s.score as Record<string, unknown>).stage_summary as Record<string, unknown>).total_awake_time_milli) : null,
      respiratory_rate: (s.score as Record<string, unknown>)?.respiratory_rate,
    }));

    const recoveryUpserts = (recoveryData.records ?? []).map((r: Record<string, unknown>) => ({
      connection_id: connection.id,
      whoop_cycle_id: r.cycle_id,
      date: (r.created_at as string)?.split('T')[0],
      recovery_score: (r.score as Record<string, unknown>)?.recovery_score,
      hrv_rmssd: (r.score as Record<string, unknown>)?.hrv_rmssd_milli,
      resting_hr: (r.score as Record<string, unknown>)?.resting_heart_rate,
      spo2: (r.score as Record<string, unknown>)?.spo2_percentage,
      skin_temp_celsius: (r.score as Record<string, unknown>)?.skin_temp_celsius,
    }));

    const workoutUpserts = (workoutData.records ?? []).map((w: Record<string, unknown>) => ({
      connection_id: connection.id,
      whoop_workout_id: w.id,
      sport_name: (w.sport_id !== undefined) ? String(w.sport_id) : null,
      start_time: w.start,
      end_time: w.end,
      strain: (w.score as Record<string, unknown>)?.strain,
      avg_hr: (w.score as Record<string, unknown>)?.average_heart_rate,
      max_hr: (w.score as Record<string, unknown>)?.max_heart_rate,
      calories: (w.score as Record<string, unknown>)?.kilojoule ? Number((w.score as Record<string, unknown>).kilojoule) / 4.184 : null,
      distance_m: (w.score as Record<string, unknown>)?.distance_meter,
    }));

    await Promise.all([
      sleepUpserts.length > 0 && supabaseAdmin.from('sleep_records').upsert(sleepUpserts, { onConflict: 'whoop_sleep_id' }),
      recoveryUpserts.length > 0 && supabaseAdmin.from('recovery_records').upsert(recoveryUpserts, { onConflict: 'whoop_cycle_id' }),
      workoutUpserts.length > 0 && supabaseAdmin.from('workouts').upsert(workoutUpserts, { onConflict: 'whoop_workout_id' }),
      supabaseAdmin.from('whoop_connections').update({ last_synced_at: new Date().toISOString() }).eq('id', connection.id),
    ]);

    res.json({
      synced: {
        sleep: sleepUpserts.length,
        recovery: recoveryUpserts.length,
        workouts: workoutUpserts.length,
      },
    });
  } catch (err) {
    console.error('WHOOP sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

whoopRouter.get('/status', requireAuth, async (req, res) => {
  const userId = (req as typeof req & { userId: string }).userId;
  const { data } = await supabaseAdmin
    .from('whoop_connections')
    .select('whoop_user_id, last_synced_at')
    .eq('user_id', userId)
    .single();

  res.json({ connected: !!data, ...(data ?? {}) });
});
