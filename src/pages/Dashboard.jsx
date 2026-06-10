import { useEffect, useState, Fragment } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import api from '../api'
import s from './Dashboard.module.css'

const PERIODS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
]

const fmt = n => '€' + Number(n ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtDelta = n => (n >= 0 ? '+' : '') + fmt(n)

function ChartCard({ title, children }) {
  return (
    <div className={s.chartCard}>
      <div className={s.chartTitle}>{title}</div>
      {children}
    </div>
  )
}

const tooltipStyle = {
  contentStyle: { background: '#1E1E26', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#9090A8' },
  itemStyle: { color: '#E8E8F0' },
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [snapshots, setSnapshots] = useState([])
  const [incomes, setIncomes] = useState([])
  const [period, setPeriod] = useState(PERIODS[0])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/dashboard/summary').then(r => setSummary(r.data))
  }, [])

  useEffect(() => {
    const to = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - period.days * 86400000).toISOString().slice(0, 10)
    setLoading(true)
    Promise.all([
      api.get(`/api/snapshots/history?from=${from}&to=${to}`),
      api.get(`/api/incomes/summary?from=${from}&to=${to}`),
    ]).then(([sRes, iRes]) => {
      setSnapshots(sRes.data.snapshots)
      setIncomes(iRes.data.summary)
    }).finally(() => setLoading(false))
  }, [period])

  // Build chart data: group snapshots by date
  const chartData = (() => {
    const byDate = {}
    for (const s of snapshots) {
      const d = s.recorded_at?.slice(0, 10) ?? s.recorded_at
      if (!byDate[d]) byDate[d] = { date: d, netWorth: 0, liquid: 0, invest: 0, debt: 0 }
      const b = parseFloat(s.balance)
      if (s.type === 'credit' || s.type === 'debt') {
        byDate[d].netWorth -= b
        byDate[d].debt += b
      } else {
        byDate[d].netWorth += b
      }
      if (s.type === 'debit' || s.type === 'cash') byDate[d].liquid += b
      if (s.type === 'investment') byDate[d].invest += b
    }
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  })()

  // Income vs implied expenses by week
  const cashflowData = (() => {
    const incomeByWeek = {}
    for (const i of incomes) {
      incomeByWeek[i.week_start] = parseFloat(i.total)
    }
    return chartData.map((d, i) => {
      const prev = chartData[i - 1]
      const inc = incomeByWeek[d.date] ?? 0
      const expenses = Math.max(0, (prev?.liquid ?? d.liquid) + inc - d.liquid)
      return { date: d.date, income: inc, expenses: i === 0 ? 0 : expenses }
    }).filter((_, i) => i > 0)
  })()

  const shortDate = d => {
    if (!d) return ''
    const dt = new Date(d)
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  return (
    <div>
      {/* Hero — main numbers */}
      <div className={s.hero}>
        <div className={s.heroItem}>
          <div className={s.heroLabel}>Net worth</div>
          <div className={`${s.heroNumber} ${(summary?.net_worth ?? 0) >= 0 ? s.green : s.red}`}>
            {fmt(summary?.net_worth)}
          </div>
          {summary?.net_worth_delta !== undefined && (
            <div className={`${s.delta} ${summary.net_worth_delta >= 0 ? s.green : s.red}`}>
              {fmtDelta(summary.net_worth_delta)} from last week
            </div>
          )}
        </div>
        <div className={s.heroDivider} />
        <div className={s.heroItem}>
          <div className={s.heroLabel}>Liquid balance</div>
          <div className={s.heroNumber}>{fmt(summary?.liquid)}</div>
          {summary?.liquid_delta !== undefined && (
            <div className={`${s.delta} ${summary.liquid_delta >= 0 ? s.green : s.red}`}>
              {fmtDelta(summary.liquid_delta)} from last week
            </div>
          )}
        </div>
        <div className={s.heroDivider} />
        <div className={s.heroItem}>
          <div className={s.heroLabel}>Implied expenses</div>
          <div className={`${s.heroNumber} ${s.red}`}>{fmt(summary?.implied_expenses)}</div>
          <div className={s.delta} style={{ color: 'var(--text3)' }}>
            {summary?.last_update ? `week ending ${shortDate(summary.last_update)}` : '—'}
          </div>
        </div>
      </div>

      {/* Restricted accounts — one card each, only shown if any exist */}
      {summary?.restricted?.length > 0 && (
        <div className={s.hero}>
          {summary.restricted.map((r, i) => (
            <Fragment key={r.name}>
              {i > 0 && <div className={s.heroDivider} />}
              <div className={s.heroItem}>
                <div className={s.heroLabel}>{r.name}</div>
                <div className={s.heroNumber}>{fmt(r.balance)}</div>
                <div className={s.delta} style={{ color: 'var(--text3)' }}>restricted</div>
              </div>
            </Fragment>
          ))}
        </div>
      )}

      {/* Period tabs */}
      <div className={s.tabs}>
        {PERIODS.map(p => (
          <button
            key={p.label}
            className={`${s.tab} ${period.label === p.label ? s.tabActive : ''}`}
            onClick={() => setPeriod(p)}
          >{p.label}</button>
        ))}
      </div>

      {loading ? (
        <div className={s.loading}>Loading charts…</div>
      ) : (
        <>
          <div className={s.grid2}>
            <ChartCard title="Net worth">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#55556A' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#55556A' }} axisLine={false} tickLine={false} tickFormatter={v => '€' + (v / 1000).toFixed(0) + 'k'} width={48} />
                  <Tooltip formatter={v => fmt(v)} labelFormatter={shortDate} {...tooltipStyle} />
                  <Line type="monotone" dataKey="netWorth" stroke="#22c55e" strokeWidth={2} dot={false} name="Net worth" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Liquid balance">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#55556A' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#55556A' }} axisLine={false} tickLine={false} tickFormatter={v => '€' + (v / 1000).toFixed(0) + 'k'} width={48} />
                  <Tooltip formatter={v => fmt(v)} labelFormatter={shortDate} {...tooltipStyle} />
                  <Line type="monotone" dataKey="liquid" stroke="#94a3b8" strokeWidth={2} dot={false} name="Liquid" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Investments">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#55556A' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#55556A' }} axisLine={false} tickLine={false} tickFormatter={v => '€' + (v / 1000).toFixed(0) + 'k'} width={48} />
                  <Tooltip formatter={v => fmt(v)} labelFormatter={shortDate} {...tooltipStyle} />
                  <Line type="monotone" dataKey="invest" stroke="#3b82f6" strokeWidth={2} dot={false} name="Investments" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Income vs implied expenses">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={cashflowData} barGap={2}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#55556A' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#55556A' }} axisLine={false} tickLine={false} tickFormatter={v => '€' + v} width={52} />
                  <Tooltip formatter={v => fmt(v)} labelFormatter={shortDate} {...tooltipStyle} />
                  <Bar dataKey="income" fill="rgba(34,197,94,0.75)" radius={[3, 3, 0, 0]} name="Income" />
                  <Bar dataKey="expenses" fill="rgba(239,68,68,0.7)" radius={[3, 3, 0, 0]} name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard title="Debt level">
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#55556A' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#55556A' }} axisLine={false} tickLine={false} tickFormatter={v => '€' + (v / 1000).toFixed(0) + 'k'} width={48} />
                <Tooltip formatter={v => fmt(v)} labelFormatter={shortDate} {...tooltipStyle} />
                <Line type="monotone" dataKey="debt" stroke="#ef4444" strokeWidth={2} dot={false} name="Debt" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}
    </div>
  )
}
