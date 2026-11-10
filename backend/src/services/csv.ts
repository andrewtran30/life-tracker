import Papa from 'papaparse';

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
}

export function parseCsv(csvContent: string): ParsedTransaction[] {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  return result.data.map((row) => {
    const amount = parseFloat(
      row.amount?.replace(/[$,]/g, '') ??
      row.debit?.replace(/[$,]/g, '') ??
      row.credit?.replace(/[$,]/g, '') ??
      '0'
    );

    let type: 'debit' | 'credit' = 'debit';
    if (row.type) {
      type = row.type.toLowerCase().includes('credit') ? 'credit' : 'debit';
    } else if (amount < 0 || row.debit) {
      type = 'debit';
    } else if (row.credit) {
      type = 'credit';
    }

    return {
      date: row.date ?? row.transaction_date ?? row['posting date'] ?? new Date().toISOString().split('T')[0],
      description: row.description ?? row.memo ?? row.name ?? row.payee ?? '',
      amount: Math.abs(amount),
      type,
    };
  }).filter((t) => t.amount > 0);
}
