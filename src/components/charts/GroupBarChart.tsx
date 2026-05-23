'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  LabelList,
} from 'recharts'
import { GroupSummary, HOSPITAL_TYPE_COLORS, MetricKey } from '@/types/hospital'
import { formatAxisNumber, formatNumber } from '@/lib/utils'

interface Props {
  data:   GroupSummary[]
  metric: MetricKey
  unit:   string
}

const metricToField: Record<MetricKey, keyof GroupSummary> = {
  outpatient_count:   'avg_outpatient',
  inpatient_count:    'avg_inpatient',
  surgery_count:      'avg_outpatient',   // 예시: surgery 별도 필드 추가 시 교체
  revenue:            'avg_revenue',
  avg_stay_days:      'avg_stay_days',
  bed_occupancy_rate: 'avg_bed_occupancy',
}

const CustomTooltip = ({ active, payload, unit }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as GroupSummary
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700 mb-2">{d.type}</p>
      <p className="text-slate-600">
        평균 <span className="font-bold text-slate-900">{formatNumber(Number(payload[0].value))}</span> {unit}
      </p>
      <p className="text-xs text-slate-400 mt-1">병원 수: {d.hospital_count.toLocaleString()}개</p>
    </div>
  )
}

export function GroupBarChart({ data, metric, unit }: Props) {
  const field = metricToField[metric]
  const chartData = data.map(d => ({ ...d, value: d[field] }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="type"
          tick={{ fontSize: 12, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis
          tickFormatter={formatAxisNumber}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
          width={50}
        />
        <Tooltip content={<CustomTooltip unit={unit} />} cursor={{ fill: '#f8fafc' }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
          {chartData.map(entry => (
            <Cell key={entry.type} fill={HOSPITAL_TYPE_COLORS[entry.type]} />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            formatter={(v: number) => formatAxisNumber(v)}
            style={{ fontSize: 10, fill: '#94a3b8' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
