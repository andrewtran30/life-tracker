import { supabaseAdmin } from './supabase.js';

interface SummaryData {
  sleep?: { score: number; duration_hours: number };
  recovery?: { score: number; hrv: number; resting_hr: number };
  spending_yesterday?: number;
  mood?: number;
  energy?: number;
  goals?: Array<{ title: string; domain: string }>;
}

const TEMPLATE_SUMMARY = `Good morning! Here's your daily snapshot:

{sleep_section}
{recovery_section}
{finance_section}
{mood_section}

**Recommendations:**
{recommendations}`;

function buildTemplateSummary(data: SummaryData): { summary: string; recommendations: string[] } {
  const sections: string[] = [];
  const recommendations: string[] = [];

  if (data.sleep) {
    sections.push(`**Sleep:** Score ${data.sleep.score}/100 (${data.sleep.duration_hours.toFixed(1)}h)`);
    if (data.sleep.score < 70) recommendations.push('Your sleep score was below average. Consider an earlier bedtime tonight.');
    if (data.sleep.duration_hours < 7) recommendations.push('You slept under 7 hours. Aim for 7-9 hours for optimal recovery.');
  } else {
    sections.push('**Sleep:** No data available');
  }

  if (data.recovery) {
    sections.push(`**Recovery:** ${data.recovery.score}% | HRV: ${data.recovery.hrv.toFixed(0)}ms | Resting HR: ${data.recovery.resting_hr.toFixed(0)}bpm`);
    if (data.recovery.score < 34) recommendations.push('Recovery is in the red zone. Consider a rest day or light activity only.');
    else if (data.recovery.score < 67) recommendations.push('Recovery is moderate. A medium-intensity workout would be appropriate.');
    else recommendations.push('Recovery is green. You\'re primed for a high-intensity session if you want one.');
  } else {
    sections.push('**Recovery:** No data available');
  }

  if (data.spending_yesterday !== undefined) {
    sections.push(`**Yesterday's spending:** $${data.spending_yesterday.toFixed(2)}`);
    if (data.spending_yesterday > 100) recommendations.push('Spending was above $100 yesterday. Review your transactions to stay on budget.');
  } else {
    sections.push('**Spending:** No transactions logged yet');
  }

  if (data.mood) {
    sections.push(`**Mood:** ${data.mood}/10 | **Energy:** ${data.energy ?? '—'}/10`);
    if (data.mood <= 4) recommendations.push('Your mood was low. Consider journaling about what\'s weighing on you.');
  } else {
    sections.push('**Mood:** Not logged yet');
  }

  if (recommendations.length === 0) {
    recommendations.push('Keep up the great work! You\'re on track with your routine.');
  }

  const summary = TEMPLATE_SUMMARY
    .replace('{sleep_section}', sections[0])
    .replace('{recovery_section}', sections[1])
    .replace('{finance_section}', sections[2])
    .replace('{mood_section}', sections[3])
    .replace('{recommendations}', recommendations.map(r => `- ${r}`).join('\n'));

  return { summary, recommendations };
}

async function generateAISummary(data: SummaryData, goals: Array<{ title: string; domain: string }>): Promise<{ summary: string; recommendations: string[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      summary: '⚠️ AI summary unavailable: Missing Anthropic API key. Using template summary instead.\n\n' + buildTemplateSummary(data).summary,
      recommendations: buildTemplateSummary(data).recommendations,
    };
  }

  const prompt = `You are a personal health and life coach. Based on the user's data from today, provide a brief, encouraging morning summary with actionable recommendations to help them reach their goals.

User's data:
${JSON.stringify(data, null, 2)}

User's active goals:
${goals.map(g => `- [${g.domain}] ${g.title}`).join('\n') || 'No goals set yet.'}

Keep it concise (3-4 sentences for summary, 2-3 bullet recommendations). Be specific to their numbers, not generic.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const template = buildTemplateSummary(data);
    return {
      summary: '⚠️ AI summary generation failed. Using template summary.\n\n' + template.summary,
      recommendations: template.recommendations,
    };
  }

  const result = await res.json() as { content: Array<{ text: string }> };
  const text = result.content[0].text;
  return { summary: text, recommendations: [] };
}

export async function generateDailySummary(userId: string, date: string) {
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const [sleepRes, recoveryRes, transactionsRes, journalRes, goalsRes] = await Promise.all([
    supabaseAdmin.from('sleep_records')
      .select('score, start_time, end_time')
      .eq('connection_id', (await supabaseAdmin.from('whoop_connections').select('id').eq('user_id', userId).single()).data?.id ?? '')
      .gte('end_time', `${yesterdayStr}T00:00:00`)
      .lt('end_time', `${date}T00:00:00`)
      .order('end_time', { ascending: false })
      .limit(1),
    supabaseAdmin.from('recovery_records')
      .select('recovery_score, hrv_rmssd, resting_hr')
      .eq('connection_id', (await supabaseAdmin.from('whoop_connections').select('id').eq('user_id', userId).single()).data?.id ?? '')
      .eq('date', yesterdayStr)
      .limit(1),
    supabaseAdmin.from('transactions')
      .select('amount, type, account_id, finance_accounts!inner(user_id)')
      .eq('finance_accounts.user_id', userId)
      .eq('date', yesterdayStr),
    supabaseAdmin.from('journal_entries')
      .select('mood_score, energy_score')
      .eq('user_id', userId)
      .eq('date', yesterdayStr)
      .limit(1),
    supabaseAdmin.from('user_goals')
      .select('title, domain')
      .eq('user_id', userId)
      .eq('status', 'active'),
  ]);

  const sleepRecord = sleepRes.data?.[0];
  const recoveryRecord = recoveryRes.data?.[0];
  const journalEntry = journalRes.data?.[0];

  const spending = (transactionsRes.data ?? [])
    .filter((t: { type: string }) => t.type === 'debit')
    .reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0);

  const summaryData: SummaryData = {
    sleep: sleepRecord ? {
      score: sleepRecord.score,
      duration_hours: (new Date(sleepRecord.end_time).getTime() - new Date(sleepRecord.start_time).getTime()) / 3600000,
    } : undefined,
    recovery: recoveryRecord ? {
      score: recoveryRecord.recovery_score,
      hrv: recoveryRecord.hrv_rmssd,
      resting_hr: recoveryRecord.resting_hr,
    } : undefined,
    spending_yesterday: spending,
    mood: journalEntry?.mood_score ?? undefined,
    energy: journalEntry?.energy_score ?? undefined,
    goals: goalsRes.data ?? [],
  };

  const { summary, recommendations } = await generateAISummary(summaryData, goalsRes.data ?? []);

  const { data, error } = await supabaseAdmin.from('daily_summaries').upsert({
    user_id: userId,
    date,
    summary_text: summary,
    recommendations,
    health_snapshot: { sleep: summaryData.sleep, recovery: summaryData.recovery },
    finance_snapshot: { spending_yesterday: summaryData.spending_yesterday },
    mood_snapshot: { mood: summaryData.mood, energy: summaryData.energy },
    generated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,date' }).select().single();

  if (error) throw error;
  return data;
}
