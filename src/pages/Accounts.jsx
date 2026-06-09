import { useEffect, useState } from 'react'
import api from '../api'
import s from './Accounts.module.css'

const TYPES = ['debit', 'credit', 'debt', 'investment', 'cash']
const TYPE_LABELS = { debit: 'Debit', credit: 'Credit', debt: 'Debt', investment: 'Invest', cash: 'Cash' }
const TYPE_COLORS = { debit: '#22c55e', credit: '#ef4444', debt: '#f59e0b', investment: '#3b82f6', cash: '#9090A8' }

export default function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState({ name: '', type: 'debit' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const load = () => api.get('/api/accounts').then(r => setAccounts(r.data.accounts))
  useEffect(() => { load() }, [])

  const add = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name required.'); return }
    setSaving(true)
    setError('')
    try {
      await api.post('/api/accounts', { name: form.name.trim(), type: form.type, sort_order: accounts.length })
      setForm(f => ({ ...f, name: '' }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      load()
    } catch {
      setError('Failed to add account.')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (a) => {
    await api.patch(`/api/accounts/${a.id}`, { is_active: !a.is_active })
    load()
  }

  const active = accounts.filter(a => a.is_active)
  const archived = accounts.filter(a => !a.is_active)

  return (
    <div className={s.wrap}>
      <h1 className={s.title}>Accounts</h1>
      <p className={s.sub}>Manage your tracked accounts. Archived accounts are excluded from snapshots and dashboard.</p>

      {/* Active accounts */}
      <div className={s.section}>Active accounts</div>
      <div className={s.card}>
        {active.length === 0 && <p className={s.empty}>No accounts yet.</p>}
        {active.map(a => (
          <div key={a.id} className={s.row}>
            <div className={s.rowLeft}>
              <span className={s.dot} style={{ background: TYPE_COLORS[a.type] }} />
              <span className={s.tag} style={{ color: TYPE_COLORS[a.type], background: TYPE_COLORS[a.type] + '18' }}>
                {TYPE_LABELS[a.type]}
              </span>
              <span className={s.name}>{a.name}</span>
            </div>
            <button className={s.archiveBtn} onClick={() => toggle(a)}>Archive</button>
          </div>
        ))}
      </div>

      {/* Add form */}
      <div className={s.section} style={{ marginTop: '2rem' }}>Add account</div>
      <div className={s.card}>
        <form onSubmit={add}>
          <div className={s.grid}>
            <div className={s.field}>
              <label className={s.label}>Account name</label>
              <input
                type="text"
                placeholder="e.g. Millennium checking"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className={s.field}>
              <label className={s.label}>Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
          </div>
          {error && <p className={s.error}>{error}</p>}
          {saved && <p className={s.success}>✓ Account added</p>}
          <button type="submit" className={s.btn} disabled={saving}>
            {saving ? 'Adding…' : 'Add account'}
          </button>
        </form>
      </div>

      {/* Archived */}
      {archived.length > 0 && (
        <>
          <div className={s.section} style={{ marginTop: '2rem' }}>Archived</div>
          <div className={s.card}>
            {archived.map(a => (
              <div key={a.id} className={`${s.row} ${s.rowArchived}`}>
                <div className={s.rowLeft}>
                  <span className={s.dot} style={{ background: TYPE_COLORS[a.type], opacity: 0.4 }} />
                  <span className={s.name} style={{ color: 'var(--text3)' }}>{a.name}</span>
                </div>
                <button className={s.restoreBtn} onClick={() => toggle(a)}>Restore</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
