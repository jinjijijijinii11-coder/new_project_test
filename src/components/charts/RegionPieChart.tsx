'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { RegionDistribution } from '@/types/hospital'

const COLORS = [
  '#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444',
  '#06b6d4','#84cc16','#f97316','#ec4899','#6366f1',
  '#14b8a6','#a855f7','#eab308','#64748b','#0ea5e9',
  '#22c55e','#fb923c',
]

interface Props {
  data: RegionDistribution[]
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as RegionDistribution
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700">{d.region}</p>
      <p className="text-slate-600">{d.count.toLocaleString()}개소</p>
      <p className="text-primary-600 font-medium">{d.percentage}%</p>
    </div>
  )
}

export function RegionPieChart({ data }: Props) {
  // 상위 8개만 표시, 나머지는 기타로 묶음
  const top8 = data.slice(0, 8)
  const others = data.slice(8)
  const othersSum = others.reduce((acc, d) => acc + d.count, 0)
  const othersPercentage = others.reduce((acc, d) => acc + d.percentage, 0)
  const chartData = [
    ...top8,
    ...(others.length > 0 ? [{ region: '기타', count: othersSum, percentage: Number(othersPercentage.toFixed(1)) }] : []),
  ]

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="count"
          nameKey="region"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={110}
          paddingAngle={2}
        >
          {chartData.map((entry, i) => (
            <Cell key={entry.region} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value) => <span className="text-slate-600">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
