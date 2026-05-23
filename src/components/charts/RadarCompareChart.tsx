'use client'

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { GroupSummary, HOSPITAL_TYPE_COLORS } from '@/types/hospital'

interface Props {
  data: GroupSummary[]
}

// 정규화: 각 지표의 최대값을 100으로 환산
function normalize(values: number[]): number[] {
  const max = Math.max(...values)
  if (max === 0) return values.map(() => 0)
  return values.map(v => Math.round((v / max) * 100))
}

export function RadarCompareChart({ data }: Props) {
  const outpatients  = normalize(data.map(d => d.avg_outpatient))
  const revenues     = normalize(data.map(d => d.avg_revenue))
  const beds         = normalize(data.map(d => d.avg_beds))
  const occupancies  = normalize(data.map(d => d.avg_bed_occupancy))
  const inpatients   = normalize(data.map(d => d.avg_inpatient))

  const radarData = [
    { subject: '외래환자',   ...Object.fromEntries(data.map((d, i) => [d.type, outpatients[i]])) },
    { subject: '매출',       ...Object.fromEntries(data.map((d, i) => [d.type, revenues[i]])) },
    { subject: '병상',       ...Object.fromEntries(data.map((d, i) => [d.type, beds[i]])) },
    { subject: '병상가동률', ...Object.fromEntries(data.map((d, i) => [d.type, occupancies[i]])) },
    { subject: '입원환자',   ...Object.fromEntries(data.map((d, i) => [d.type, inpatients[i]])) },
  ]

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={radarData}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#64748b' }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#cbd5e1' }} />
        <Tooltip
          formatter={(v: number) => [`${v}점`, '']}
          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        {data.map(d => (
          <Radar
            key={d.type}
            name={d.type}
            dataKey={d.type}
            stroke={HOSPITAL_TYPE_COLORS[d.type]}
            fill={HOSPITAL_TYPE_COLORS[d.type]}
            fillOpacity={0.12}
            strokeWidth={2}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  )
}
