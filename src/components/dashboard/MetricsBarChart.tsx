'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { MetricField } from '@/lib/metrics-config'
import { ChartSeries } from '@/hooks/useDashboardData'
import { formatAxisNumber, fmtNum } from '@/lib/utils'

interface Props {
  metrics: MetricField[]
  series:  ChartSeries[]   // 본원, 상급종합 평균, 종합병원 평균
  month:   number
}

// label_path 축약 ('A > B > C' → 'B / C')
function compactLabel(label: string): string {
  const parts = label.split(' > ')
  return parts.length > 1 ? parts.slice(1).join(' / ') : parts[0]
}

// ── 개별 지표 미니 차트 ───────────────────────────────────────────────
function MiniBarChart({
  metric,
  series,
}: {
  metric: MetricField
  series: ChartSeries[]
}) {
  // recharts 데이터: [{ name: '본원', value: 120 }, ...]
  const data = series.map(s => ({
    name:  s.name,
    value: s.values[metric.key] ?? null,
    color: s.color,
  }))

  const hasData = data.some(d => d.value !== null)

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
        <p className="font-semibold text-slate-700 mb-1">{compactLabel(metric.label)}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-500">{p.name}</span>
            <span className="font-medium text-slate-800 ml-1">
              {p.value !== null
                ? `${fmtNum(p.value, metric.isPercent)}${metric.unit && !metric.isPercent ? ' ' + metric.unit : ''}`
                : '-'}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-2">
      <p className="text-xs font-semibold text-slate-600">{compactLabel(metric.label)}</p>
      {!hasData ? (
        <div className="h-28 flex items-center justify-center">
          <span className="text-xs text-slate-400">데이터 없음</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={v =>
                metric.isPercent ? `${v}%` : formatAxisNumber(v)
              }
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      {/* 범례 */}
      <div className="flex flex-wrap gap-2 mt-1">
        {data.map(d => (
          <div key={d.name} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-xs text-slate-500 truncate max-w-[100px]">{d.name}</span>
            <span className="text-xs font-semibold text-slate-800">
              {d.value !== null
                ? `${fmtNum(d.value, metric.isPercent)}${metric.unit && !metric.isPercent ? metric.unit : ''}`
                : '-'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 메인 섹션 컴포넌트 ───────────────────────────────────────────────
export function MetricsBarChart({ metrics, series, month }: Props) {
  if (!series.length) {
    return (
      <div className="card flex items-center justify-center h-40">
        <p className="text-sm text-slate-400">데이터가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-slate-800">지표별 비교 차트</h2>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
          {month}월 기준 · 그룹 비교
        </span>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-3 mb-4">
        {series.map(s => (
          <div key={s.name} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-xs font-medium text-slate-600">{s.name}</span>
          </div>
        ))}
      </div>

      {/* 지표별 미니 차트 그리드 */}
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${Math.min(metrics.length, 3)}, 1fr)`,
        }}
      >
        {metrics.map(metric => (
          <MiniBarChart key={metric.key} metric={metric} series={series} />
        ))}
      </div>
    </div>
  )
}
