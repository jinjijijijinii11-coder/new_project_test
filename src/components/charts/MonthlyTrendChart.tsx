'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { MonthlyTrend, HospitalType, HOSPITAL_TYPE_COLORS, HOSPITAL_TYPES } from '@/types/hospital'
import { formatAxisNumber } from '@/lib/utils'

interface Props {
  data:           MonthlyTrend[]
  selectedTypes:  HospitalType[]
  unit:           string
}

const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-600 w-20">{entry.name}</span>
          <span className="font-medium text-slate-900">
            {entry.value?.toLocaleString('ko-KR')} {unit}
          </span>
        </div>
      ))}
    </div>
  )
}

export function MonthlyTrendChart({ data, selectedTypes, unit }: Props) {
  const types = selectedTypes.length > 0
    ? selectedTypes
    : HOSPITAL_TYPES.filter(t => t !== '의원')  // 의원은 스케일 차이가 커서 기본 제외

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
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
        <Tooltip content={<CustomTooltip unit={unit} />} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          iconType="circle"
          iconSize={8}
        />
        {types.map(type => (
          <Line
            key={type}
            type="monotone"
            dataKey={type}
            stroke={HOSPITAL_TYPE_COLORS[type]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
