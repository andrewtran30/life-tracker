import { useState, useEffect, useCallback } from 'react'
import { Wallet, Plus, Upload, X, TrendingDown, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import type { FinanceAccount, Transaction, FinanceCategory } from '../lib/types'

export function FinancePage() {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showAddTx, setShowAddTx] = useState(false)
  const [showCsvImport, setShowCsvImport] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [accts, cats] = await Promise.all([
      supabase.from('finance_accounts').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('finance_categories').select('*').or(`user_id.is.null,user_id.eq.${user.id}`).order('sort_order'),
    ])
    setAccounts(accts.data ?? [])
    setCategories(cats.data ?? [])
    if (accts.data?.length) {
      const ids = accts.data.map(a => a.id)
      const { data: txs } = await supabase.from('transactions').select('*, category:finance_categories(*)').in('account_id', ids).order('date', { ascending: false }).limit(50)
      setTransactions(txs ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (loading) return <p style={{ color: 'var(--fg-muted)', padding: 40, textAlign: 'center' }}>Loading finances...</p>

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.current_balance), 0)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthSpend = transactions.filter(t => t.type === 'debit' && t.date.startsWith(thisMonth)).reduce((sum, t) => sum + Number(t.amount), 0)
  const monthIncome = transactions.filter(t => t.type === 'credit' && t.date.startsWith(thisMonth)).reduce((sum, t) => sum + Number(t.amount), 0)

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: 2 }}>Finance</h1>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.9rem' }}>Track spending, income, and budgets</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowCsvImport(true)}><Upload size={13} /> Import CSV</button>
          <button className="btn btn-primary" onClick={() => setShowAddTx(true)}><Plus size={13} /> Add Transaction</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Wallet size={14} color="var(--accent)" />
            <span className="stat-label">Total Balance</span>
          </div>
          <span className="stat-value" style={{ fontSize: '1.5rem' }}>${totalBalance.toFixed(2)}</span>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <TrendingDown size={14} color="var(--danger)" />
            <span className="stat-label">Spent This Month</span>
          </div>
          <span className="stat-value" style={{ fontSize: '1.5rem' }}>${monthSpend.toFixed(2)}</span>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <TrendingUp size={14} color="var(--success)" />
            <span className="stat-label">Income This Month</span>
          </div>
          <span className="stat-value" style={{ fontSize: '1.5rem' }}>${monthIncome.toFixed(2)}</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: '0.95rem' }}>Accounts</h3>
          <button className="btn btn-ghost" onClick={() => setShowAddAccount(true)} style={{ fontSize: '0.8rem' }}><Plus size={13} /> Add Account</button>
        </div>
        {accounts.length === 0 ? (
          <p style={{ color: 'var(--fg-muted)', textAlign: 'center', padding: 16, fontSize: '0.9rem' }}>No accounts yet. Add one to start tracking.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {accounts.map(a => (
              <div key={a.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-xs)',
              }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{a.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', textTransform: 'capitalize' }}>{a.type}</div>
                </div>
                <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${Number(a.current_balance).toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ fontSize: '0.95rem', marginBottom: 14 }}>Recent Transactions</h3>
        {transactions.length === 0 ? (
          <p style={{ color: 'var(--fg-muted)', textAlign: 'center', padding: 16, fontSize: '0.9rem' }}>No transactions yet. Add one manually or import a CSV.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {transactions.map(t => (
              <div key={t.id} style={{
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 12,
                padding: '10px 14px', borderRadius: 'var(--radius-xs)',
                alignItems: 'center', fontSize: '0.85rem',
                borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{t.description || 'Untitled'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', display: 'flex', gap: 8 }}>
                    <span>{t.date}</span>
                    {t.category && <span>{t.category.icon} {t.category.name}</span>}
                  </div>
                </div>
                <span style={{
                  fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                  color: t.type === 'credit' ? 'var(--success)' : 'var(--fg)',
                }}>
                  {t.type === 'credit' ? '+' : '-'}${Number(t.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddAccount && <Modal title="Add Account" onClose={() => setShowAddAccount(false)}>
        <AddAccountForm onSave={async (name, type, balance) => {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return
          await supabase.from('finance_accounts').insert({ user_id: user.id, name, type, current_balance: balance })
          setShowAddAccount(false); loadData()
        }} />
      </Modal>}

      {showAddTx && <Modal title="Add Transaction" onClose={() => setShowAddTx(false)}>
        <AddTransactionForm accounts={accounts} categories={categories} onSave={async (tx) => {
          await supabase.from('transactions').insert(tx)
          setShowAddTx(false); loadData()
        }} />
      </Modal>}

      {showCsvImport && <Modal title="Import CSV" onClose={() => setShowCsvImport(false)}>
        <CsvImportForm accounts={accounts} onImport={async (csvContent, accountId) => {
          await api.finance.importCsv(csvContent, accountId)
          setShowCsvImport(false); loadData()
        }} />
      </Modal>}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card" style={{ width: 440, maxHeight: '90vh', overflow: 'auto', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ fontSize: '1rem' }}>{title}</h3>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function AddAccountForm({ onSave }: { onSave: (name: string, type: string, balance: number) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('checking')
  const [balance, setBalance] = useState('')
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(name, type, parseFloat(balance) || 0) }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div><label className="label">Account Name</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chase Checking" required /></div>
      <div><label className="label">Type</label>
        <select className="input" value={type} onChange={e => setType(e.target.value)}>
          <option value="checking">Checking</option><option value="savings">Savings</option>
          <option value="credit">Credit Card</option><option value="cash">Cash</option><option value="investment">Investment</option>
        </select></div>
      <div><label className="label">Current Balance</label><input className="input" type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0.00" /></div>
      <button className="btn btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center' }}>Add Account</button>
    </form>
  )
}

function AddTransactionForm({ accounts, categories, onSave }: {
  accounts: FinanceAccount[]; categories: FinanceCategory[];
  onSave: (tx: { account_id: string; category_id: string | null; amount: number; description: string; date: string; type: string }) => void
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [type, setType] = useState('debit')
  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ account_id: accountId, category_id: categoryId || null, amount: parseFloat(amount), description, date, type }) }}
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div><label className="label">Account</label>
        <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)} required>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><label className="label">Type</label>
          <select className="input" value={type} onChange={e => setType(e.target.value)}>
            <option value="debit">Expense</option><option value="credit">Income</option>
          </select></div>
        <div><label className="label">Amount</label><input className="input" type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required /></div>
      </div>
      <div><label className="label">Description</label><input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="What was it for?" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><label className="label">Date</label><input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><label className="label">Category</label>
          <select className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">Uncategorized</option>
            {categories.filter(c => type === 'credit' ? c.is_income : !c.is_income).map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select></div>
      </div>
      <button className="btn btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center' }}>Add Transaction</button>
    </form>
  )
}

function CsvImportForm({ accounts, onImport }: { accounts: FinanceAccount[]; onImport: (csv: string, accountId: string) => void }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [csvContent, setCsvContent] = useState('')
  const [fileName, setFileName] = useState('')
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setCsvContent(reader.result as string)
    reader.readAsText(file)
  }
  return (
    <form onSubmit={e => { e.preventDefault(); onImport(csvContent, accountId) }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div><label className="label">Account</label>
        <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)} required>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select></div>
      <div>
        <label className="label">CSV File</label>
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: 20, border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-sm)',
          cursor: 'pointer', color: 'var(--fg-muted)', fontSize: '0.85rem', background: 'var(--bg-subtle)',
        }}>
          <Upload size={14} />{fileName || 'Click to select a CSV file'}
          <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
        </label>
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>CSV should have columns: date, description, amount. Most bank exports work.</p>
      <button className="btn btn-primary" type="submit" disabled={!csvContent} style={{ width: '100%', justifyContent: 'center' }}>Import Transactions</button>
    </form>
  )
}
