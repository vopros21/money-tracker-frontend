import { useEffect, useState, Fragment } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
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

// Recharts domain accepts [min, max] as functions receiving the actual
// dataMin/dataMax for the rendered key, recomputed on every render (period
// change, new data, etc). We pad by a % of the observed range rather than
// a fixed € amount so this scales correctly whether the series sits around
// €500 (investments) or €200k (debt). Falls back to a small fixed range
// when the series is flat (dataMin === dataMax) so the line doesn't
// collapse onto the horizontal centre of the chart.
function paddedDomain(padRatio = 0.08, flatFallback = 10) {
  return ([dataMin, dataMax]) => {
    const range = (dataMax - dataMin) || Math.abs(dataMax) * 0.1 || flatFallback
    return [
      Math.floor(dataMin - range * padRatio),
      Math.ceil(dataMax + range * padRatio),
    ]
  }
}
function ChartCard({ title, delta, children }) {
  return (
    <div className={s.chartCard}>
      <div className={s.chartTitle}>
        {title}
        {delta}
      </div>
      {children}
    </div>
  )
}

function DeltaBadge({ value, goodWhenNegative = false, suffix = 'this week' }) {
  if (value === undefined || value === null || value === 0) return null
  const isGood = goodWhenNegative ? value < 0 : value > 0
  return (
    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: isGood ? '#22c55e' : '#ef4444' }}>
      {fmtDelta(value)} {suffix}
    </span>
  )
}
const tooltipStyle = {
  contentStyle: { background: '#1E1E26', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#9090A8' },
  itemStyle: { color: '#E8E8F0' },
}

// SVG icons for known restricted account types, matched by name substring
const RESTRICTED_ICONS = [
  {
    match: ['meal', 'food', 'lunch', 'refeição'],
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55 }}>
        {/* Fork and knife */}
        <line x1="8" y1="2" x2="8" y2="22" />
        <path d="M5 2v6a3 3 0 0 0 6 0V2" />
        <line x1="16" y1="2" x2="16" y2="22" />
      </svg>
    ),
  },
  {
    match: ['medic', 'health', 'medicine', 'pharma', 'benefit', 'saúde'],
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55 }}>
        {/* Cross / plus */}
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
]

function getRestrictedIcon(name) {
  if (!name) return null
  const lower = name.toLowerCase()
  for (const entry of RESTRICTED_ICONS) {
    if (entry.match.some(kw => lower.includes(kw))) return entry.icon
  }
  return null
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
      // Raw income entries (not the weekly-bucketed /summary endpoint) —
      // we need each entry's actual received_at so it can be matched to
      // the snapshot interval it really falls in, see cashflowData below.
      api.get(`/api/incomes?from=${from}&to=${to}`),
    ]).then(([sRes, iRes]) => {
      setSnapshots(sRes.data.snapshots)
      // NOTE: confirm this matches the actual response shape of
      // GET /api/incomes — adjust the key below if it differs
      // (e.g. r.data.data instead of r.data.incomes).
      setIncomes(iRes.data.incomes ?? iRes.data.data ?? [])
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

  // Income vs implied expenses, per snapshot interval.
  // "Week" in the underlying formula really just means "since the last
  // snapshot" — snapshots aren't taken on a fixed weekly cadence, so income
  // is summed by matching each entry's received_at to the actual date range
  // between two consecutive snapshots, rather than to a calendar week bucket.
  // The first chart point is skipped (no prior snapshot to diff against, so
  // expenses can't be computed for it).
  const cashflowData = (() => {
    return chartData.map((d, i) => {
      if (i === 0) return null
      const prevDate = chartData[i - 1].date
      const inc = incomes
        .filter(inc => {
          const rd = inc.received_at?.slice(0, 10) ?? inc.received_at
          return rd > prevDate && rd <= d.date
        })
        .reduce((sum, inc) => sum + parseFloat(inc.amount), 0)
      const expenses = Math.max(0, chartData[i - 1].liquid + inc - d.liquid)
      return { date: d.date, income: inc, expenses }
    }).filter(Boolean)
  })()

  // Investments will sit under €1k for a while, so don't force €k formatting
  // (that's what was rounding everything down to "€0k"). Switch formats once
  // the balance is actually large enough for €k to be legible.
  const investMax = Math.max(0, ...chartData.map(d => Math.abs(d.invest)))
  const investTickFmt = v => (investMax >= 1000 ? '€' + (v / 1000).toFixed(1) + 'k' : '€' + v.toFixed(0))

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
                <div className={s.heroLabel} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {getRestrictedIcon(r.name)}
                  {r.name}
                </div>
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

            <ChartCard title="Investments" delta={<DeltaBadge value={summary?.investments_delta} />}>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#55556A' }} axisLine={false} tickLine={false} />
                  <YAxis domain={paddedDomain(0.15, 5)} tick={{ fontSize: 11, fill: '#55556A' }} axisLine={false} tickLine={false} tickFormatter={investTickFmt} width={48} />
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

          <ChartCard title="Debt level" delta={<DeltaBadge value={summary?.debt_delta} goodWhenNegative />}>
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#55556A' }} axisLine={false} tickLine={false} />
                <YAxis domain={paddedDomain(0.02, 1000)} tick={{ fontSize: 11, fill: '#55556A' }} axisLine={false} tickLine={false} tickFormatter={v => '€' + (v / 1000).toFixed(1) + 'k'} width={52} />
                <Tooltip formatter={v => fmt(v)} labelFormatter={shortDate} {...tooltipStyle} />
                {chartData.length > 0 && (
                  <ReferenceLine
                    y={chartData[0].debt}
                    stroke="#55556A"
                    strokeDasharray="3 3"
                    ifOverflow="extendDomain"
                  />
                )}
                <Line type="monotone" dataKey="debt" stroke="#ef4444" strokeWidth={2} dot={false} name="Debt" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}
    </div>
  )
}
