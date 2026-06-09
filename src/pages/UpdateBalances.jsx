import { useEffect, useState } from 'react'
import api from '../api'
import s from './UpdateBalances.module.css'

const TYPE_LABELS = { debit: 'Debit', credit: 'Credit', debt: 'Debt', investment: 'Invest', cash: 'Cash' }
const TYPE_COLORS = { debit: '#22c55e', credit: '#ef4444', debt: '#f59e0b', investment: '#3b82f6', cash: '#9090A8' }

export default function UpdateBalances() {
  const [accounts, setAccounts] = useState([])
  const [latest, setLatest] = useState({}) // accountId -> balance
  const [values, setValues] = useState({}) // accountId -> string input
  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/api/accounts'),
      api.get('/api/snapshots/latest'),
    ]).then(([aRes, sRes]) => {
      const accs = aRes.data.accounts.filter(a => a.is_active)
      setAccounts(accs)

      const latestMap = {}
      const valMap = {}
      for (const snap of sRes.data.snapshots) {
        latestMap[snap.account_id] = snap.balance
        valMap[snap.account_id] = String(parseFloat(snap.balance))
      }
      // accounts with no snapshot yet default to empty
      for (const a of accs) {
        if (!valMap[a.id]) valMap[a.id] = ''
      }
      setLatest(latestMap)
      setValues(valMap)
    })
  }, [])

  const save = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const entries = accounts
        .filter(a => values[a.id] !== '')
        .map(a => ({ account_id: a.id, balance: parseFloat(values[a.id]) }))

      if (entries.length === 0) {
        setError('Enter at least one balance.')
        return
      }

      await api.post('/api/snapshots', { recorded_at: recordedAt, entries })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError('Failed to save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>Update balances</h1>
          <p className={s.sub}>Enter current balances for all accounts. Previous value shown below each input.</p>
        </div>
        <div className={s.dateWrap}>
          <label className={s.dateLabel}>Snapshot date</label>
          <input type="date" value={recordedAt} onChange={e => setRecordedAt(e.target.value)} style={{ width: 160 }} />
        </div>
      </div>

      <div className={s.card}>
        {accounts.map(a => (
          <div key={a.id} className={s.row}>
            <div className={s.rowLeft}>
              <span className={s.tag} style={{ color: TYPE_COLORS[a.type], background: TYPE_COLORS[a.type] + '18' }}>
                {TYPE_LABELS[a.type]}
              </span>
              <span className={s.name}>{a.name}</span>
            </div>
            <div className={s.rowRight}>
              <div className={s.inputWrap}>
                <span className={s.euro}>€</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={values[a.id] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [a.id]: e.target.value }))}
                  className={s.balanceInput}
                  placeholder="0"
                />
              </div>
              <div className={s.prev}>
                {latest[a.id] != null
                  ? `prev: €${Number(latest[a.id]).toLocaleString('de-DE')}`
                  : 'no previous data'}
              </div>
            </div>
          </div>
        ))}

        {accounts.length === 0 && (
          <p style={{ color: 'var(--text3)', padding: '1rem 0' }}>No accounts yet. Add some in Accounts.</p>
        )}
      </div>

      {error && <p className={s.error}>{error}</p>}
      {saved && <p className={s.success}>✓ Saved successfully</p>}

      <button className={s.btn} onClick={save} disabled={saving || accounts.length === 0}>
        {saving ? 'Saving…' : 'Save snapshot'}
      </button>
    </div>
  )
}
