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
      const { data: txs } = await supabase
        .from('transactions')
        .select('*, category:finance_categories(*)')
        .in('account_id', ids)
        .order('date', { ascending: false })
        .limit(50)
      setTransactions(txs ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (loading) return <div style={{ color: 'var(--fg-muted)', padding: 40, textAlign: 'center' }}>Loading finances...</div>

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.current_balance), 0)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthSpend = transactions
    .filter(t => t.type === 'debit' && t.date.startsWith(thisMonth))
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const monthIncome = transactions
    .filter(t => t.type === 'credit' && t.date.startsWith(thisMonth))
    .reduce((sum, t) => sum + Number(t.amount), 0)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Finance</h1>
          <p style={{ color: 'var(--fg-muted)' }}>Track spending, income, and budgets</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowCsvImport(true)}><Upload size={14} /> Import CSV</button>
          <button className="btn btn-primary" onClick={() => setShowAddTx(true)}><Plus size={14} /> Add Transaction</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Wallet size={16} color="var(--finance)" />
            <span className="stat-label">Total Balance</span>
          </div>
          <span className="stat-value" style={{ color: 'var(--finance)' }}>${totalBalance.toFixed(2)}</span>
        </div>
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <TrendingDown size={16} color="var(--danger)" />
            <span className="stat-label">Spent This Month</span>
          </div>
          <span className="stat-value" style={{ color: 'var(--danger)' }}>${monthSpend.toFixed(2)}</span>
        </div>
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <TrendingUp size={16} color="var(--success)" />
            <span className="stat-label">Income This Month</span>
          </div>
          <span className="stat-value" style={{ color: 'var(--success)' }}>${monthIncome.toFixed(2)}</span>
        </div>
      </div>

      {/* Accounts */}
      <div className="glass-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: '1rem' }}>Accounts</h3>
          <button className="btn btn-ghost" onClick={() => setShowAddAccount(true)} style={{ fontSize: '0.8rem' }}>
            <Plus size={14} /> Add Account
          </button>
        </div>
        {accounts.length === 0 ? (
          <p style={{ color: 'var(--fg-muted)', textAlign: 'center', padding: 20 }}>
            No accounts yet. Add one to start tracking finances.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {accounts.map(a => (
              <div key={a.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-xs)',
              }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{a.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', textTransform: 'capitalize' }}>{a.type}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  ${Number(a.current_balance).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transactions */}
      <div className="glass-card">
        <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>Recent Transactions</h3>
        {transactions.length === 0 ? (
          <p style={{ color: 'var(--fg-muted)', textAlign: 'center', padding: 20 }}>
            No transactions yet. Add one manually or import a CSV.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {transactions.map(t => (
              <div key={t.id} style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12,
                padding: '10px 16px', borderRadius: 'var(--radius-xs)',
                alignItems: 'center', fontSize: '0.85rem',
                background: 'var(--bg-surface)',
              }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{t.description || 'Untitled'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', display: 'flex', gap: 8 }}>
                    <span>{t.date}</span>
                    {t.category && <span style={{ color: t.category.color ?? 'var(--fg-muted)' }}>{t.category.icon} {t.category.name}</span>}
                  </div>
                </div>
                <span style={{
                  fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                  color: t.type === 'credit' ? 'var(--success)' : 'var(--fg-primary)',
                }}>
                  {t.type === 'credit' ? '+' : '-'}${Number(t.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Account Modal */}
      {showAddAccount && (
        <Modal title="Add Account" onClose={() => setShowAddAccount(false)}>
          <AddAccountForm categories={categories} onSave={async (name, type, balance) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            await supabase.from('finance_accounts').insert({ user_id: user.id, name, type, current_balance: balance })
            setShowAddAccount(false)
            loadData()
          }} />
        </Modal>
      )}

      {/* Add Transaction Modal */}
      {showAddTx && (
        <Modal title="Add Transaction" onClose={() => setShowAddTx(false)}>
          <AddTransactionForm accounts={accounts} categories={categories} onSave={async (tx) => {
            await supabase.from('transactions').insert(tx)
            setShowAddTx(false)
            loadData()
          }} />
        </Modal>
      )}

      {/* CSV Import Modal */}
      {showCsvImport && (
        <Modal title="Import CSV" onClose={() => setShowCsvImport(false)}>
          <CsvImportForm accounts={accounts} onImport={async (csvContent, accountId) => {
            await api.finance.importCsv(csvContent, accountId)
            setShowCsvImport(false)
            loadData()
          }} />
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="glass-card" style={{ width: 480, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3>{title}</h3>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 6 }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function AddAccountForm({ onSave }: { categories: FinanceCategory[]; onSave: (name: string, type: string, balance: number) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('checking')
  const [balance, setBalance] = useState('')

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(name, type, parseFloat(balance) || 0) }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div><label className="label">Account Name</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chase Checking" required /></div>
      <div>
        <label className="label">Type</label>
        <select className="input" value={type} onChange={e => setType(e.target.value)}>
          <option value="checking">Checking</option>
          <option value="savings">Savings</option>
          <option value="credit">Credit Card</option>
          <option value="cash">Cash</option>
          <option value="investment">Investment</option>
        </select>
      </div>
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
    <form onSubmit={e => {
      e.preventDefault()
      onSave({ account_id: accountId, category_id: categoryId || null, amount: parseFloat(amount), description, date, type })
    }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label className="label">Account</label>
        <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)} required>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="label">Type</label>
          <select className="input" value={type} onChange={e => setType(e.target.value)}>
            <option value="debit">Expense</option>
            <option value="credit">Income</option>
          </select>
        </div>
        <div>
          <label className="label">Amount</label>
          <input className="input" type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
        </div>
      </div>
      <div><label className="label">Description</label><input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="What was it for?" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label className="label">Date</label><input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">Uncategorized</option>
            {categories.filter(c => type === 'credit' ? c.is_income : !c.is_income).map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>
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
    <form onSubmit={e => { e.preventDefault(); onImport(csvContent, accountId) }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label className="label">Account</label>
        <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)} required>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">CSV File</label>
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '24px', border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)',
          cursor: 'pointer', color: 'var(--fg-muted)', fontSize: '0.85rem',
        }}>
          <Upload size={16} />
          {fileName || 'Click to select a CSV file'}
          <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
        </label>
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
        CSV should include columns: date, description, amount. Most bank export formats are supported.
      </p>
      <button className="btn btn-primary" type="submit" disabled={!csvContent} style={{ width: '100%', justifyContent: 'center' }}>
        Import Transactions
      </button>
    </form>
  )
}
