import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { generateDailySummary } from '../services/summary.js';
import { supabaseAdmin } from '../services/supabase.js';

export const summaryRouter = Router();

summaryRouter.get('/today', requireAuth, async (req, res) => {
  const userId = (req as typeof req & { userId: string }).userId;
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data: existing } = await supabaseAdmin
      .from('daily_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (existing) {
      res.json(existing);
      return;
    }

    const summary = await generateDailySummary(userId, today);
    res.json(summary);
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

summaryRouter.post('/regenerate', requireAuth, async (req, res) => {
  const userId = (req as typeof req & { userId: string }).userId;
  const today = new Date().toISOString().split('T')[0];

  try {
    await supabaseAdmin
      .from('daily_summaries')
      .delete()
      .eq('user_id', userId)
      .eq('date', today);

    const summary = await generateDailySummary(userId, today);
    res.json(summary);
  } catch (err) {
    console.error('Regenerate error:', err);
    res.status(500).json({ error: 'Failed to regenerate summary' });
  }
});
