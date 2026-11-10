import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { parseCsv } from '../services/csv.js';
import { supabaseAdmin } from '../services/supabase.js';
import { randomUUID } from 'crypto';

export const financeRouter = Router();

financeRouter.post('/import-csv', requireAuth, async (req, res) => {
  const userId = (req as typeof req & { userId: string }).userId;
  const { csvContent, accountId } = req.body;

  if (!csvContent || !accountId) {
    res.status(400).json({ error: 'Missing csvContent or accountId' });
    return;
  }

  const { data: account } = await supabaseAdmin
    .from('finance_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single();

  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  try {
    const parsed = parseCsv(csvContent);
    const batchId = randomUUID();

    const transactions = parsed.map((t) => ({
      account_id: accountId,
      amount: t.amount,
      description: t.description,
      date: t.date,
      type: t.type,
      source: 'csv_import' as const,
      import_batch_id: batchId,
    }));

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .insert(transactions)
      .select();

    if (error) throw error;

    res.json({ imported: data?.length ?? 0, batch_id: batchId });
  } catch (err) {
    console.error('CSV import error:', err);
    res.status(500).json({ error: 'Failed to import CSV' });
  }
});
