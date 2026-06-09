import { useEffect, useState } from 'react'
import api from '../api'
import s from './Income.module.css'

const fmt = n => '€' + Number(n).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function Income() {
  const [incomes, setIncomes] = useState([])
  const [form, setForm] = useState({ amount: '', source: '', note: '', received_at: new Date().toISOString().slice(0, 10) })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const load = () => api.get('/api/incomes?limit=50').then(r => setIncomes(r.data.incomes))
  useEffect(() => { load() }, [])

  const submit = async e => {
    e.preventDefault()
    if (!form.amount || !form.source) { setError('Amount and source required.'); return }
    setSaving(true)
    setError('')
    try {
      await api.post('/api/incomes', {
        amount: parseFloat(form.amount),
        source: form.source,
        note: form.note || null,
        received_at: form.received_at,
      })
      setForm(f => ({ ...f, amount: '', source: '', note: '' }))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      load()
    } catch {
      setError('Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async id => {
    if (!confirm('Remove this income?')) return
    await api.delete(`/api/incomes/${id}`)
    load()
  }

  return (
    <div className={s.wrap}>
      <h1 className={s.title}>Income</h1>
      <p className={s.sub}>Log money received. Used to calculate implied expenses separately from balance changes.</p>

      {/* Add form */}
      <div className={s.section}>Log income</div>
      <div className={s.card}>
        <form onSubmit={submit}>
          <div className={s.grid}>
            <div className={s.field}>
              <label className={s.label}>Source</label>
              <input
                type="text"
                placeholder="e.g. Salary, Freelance…"
                value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
              />
            </div>
            <div className={s.field}>
              <label className={s.label}>Amount (€)</label>
              <input
                type="number"
                placeholder="0"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                style={{ fontFamily: 'var(--mono)' }}
              />
            </div>
            <div className={s.field}>
              <label className={s.label}>Date received</label>
              <input
                type="date"
                value={form.received_at}
                onChange={e => setForm(f => ({ ...f, received_at: e.target.value }))}
              />
            </div>
            <div className={s.field}>
              <label className={s.label}>Note (optional)</label>
              <input
                type="text"
                placeholder="e.g. June salary"
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>
          {error && <p className={s.error}>{error}</p>}
          {saved && <p className={s.success}>✓ Income logged</p>}
          <button type="submit" className={s.btn} disabled={saving}>
            {saving ? 'Saving…' : 'Log income'}
          </button>
        </form>
      </div>

      {/* List */}
      <div className={s.section} style={{ marginTop: '2rem' }}>Recent income</div>
      <div className={s.list}>
        {incomes.length === 0 && <p className={s.empty}>No income logged yet.</p>}
        {incomes.map(i => (
          <div key={i.id} className={s.item}>
            <div className={s.itemLeft}>
              <div className={s.itemSource}>{i.source}</div>
              <div className={s.itemMeta}>{fmtDate(i.received_at)}{i.note ? ` · ${i.note}` : ''}</div>
            </div>
            <div className={s.itemRight}>
              <div className={s.itemAmount}>{fmt(i.amount)}</div>
              <button className={s.del} onClick={() => remove(i.id)} title="Remove">×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
