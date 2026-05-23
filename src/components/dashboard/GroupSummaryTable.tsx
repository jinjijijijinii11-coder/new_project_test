'use client'

import { GroupSummary } from '@/types/hospital'
import { HospitalTypeBadge } from '@/components/ui/Badge'
import { formatNumber, formatPercent } from '@/lib/utils'

interface Props {
  data: GroupSummary[]
}

const cols = [
  { key: 'hospital_count',    label: '병원 수',      format: (v: number) => `${v.toLocaleString()}개` },
  { key: 'avg_beds',          label: '평균 병상',    format: (v: number) => v > 0 ? `${v.toLocaleString()}병상` : '-' },
  { key: 'avg_outpatient',    label: '평균 외래',    format: (v: number) => `${formatNumber(v)}명` },
  { key: 'avg_inpatient',     label: '평균 입원',    format: (v: number) => v > 0 ? `${v.toLocaleString()}명` : '-' },
  { key: 'avg_revenue',       label: '평균 매출',    format: (v: number) => formatNumber(v, '만원') },
  { key: 'avg_bed_occupancy', label: '병상 가동률',  format: (v: number) => v > 0 ? formatPercent(v) : '-' },
  { key: 'avg_stay_days',     label: '평균 재원일',  format: (v: number) => v > 0 ? `${v}일` : '-' },
] as const

export function GroupSummaryTable({ data }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left py-3 px-3 font-semibold text-slate-500 w-28">병원군</th>
            {cols.map(c => (
              <th key={c.key} className="text-right py-3 px-3 font-semibold text-slate-500">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row.type}
              className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
            >
              <td className="py-3.5 px-3">
                <HospitalTypeBadge type={row.type} size="sm" />
              </td>
              {cols.map(c => (
                <td key={c.key} className="text-right py-3.5 px-3 font-medium text-slate-700">
                  {c.format(row[c.key] as number)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
