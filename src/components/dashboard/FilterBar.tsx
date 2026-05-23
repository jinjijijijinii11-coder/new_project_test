'use client'

import { cn } from '@/lib/utils'
import {
  DashboardFilters,
  HospitalType,
  HOSPITAL_TYPES,
  HOSPITAL_TYPE_COLORS,
  MetricKey,
  METRIC_LABELS,
} from '@/types/hospital'

interface Props {
  filters:   DashboardFilters
  onChange:  (filters: DashboardFilters) => void
}

export function FilterBar({ filters, onChange }: Props) {
  const toggleType = (type: HospitalType) => {
    const next = filters.selectedTypes.includes(type)
      ? filters.selectedTypes.filter(t => t !== type)
      : [...filters.selectedTypes, type]
    onChange({ ...filters, selectedTypes: next })
  }

  return (
    <div className="card flex flex-wrap items-center gap-4">
      {/* 연도 선택 */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-500">연도</span>
        <select
          value={filters.year}
          onChange={e => onChange({ ...filters, year: Number(e.target.value) })}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white
                     focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          {[2024, 2023, 2022, 2021].map(y => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
      </div>

      {/* 지표 선택 */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-500">지표</span>
        <select
          value={filters.metric}
          onChange={e => onChange({ ...filters, metric: e.target.value as MetricKey })}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white
                     focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          {Object.entries(METRIC_LABELS).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* 병원군 필터 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-slate-500">병원군</span>
        {HOSPITAL_TYPES.map(type => {
          const active = filters.selectedTypes.includes(type)
          const color  = HOSPITAL_TYPE_COLORS[type]
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150',
                active
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
              )}
              style={active ? { backgroundColor: color, borderColor: color } : {}}
            >
              {type}
            </button>
          )
        })}
        {filters.selectedTypes.length > 0 && (
          <button
            onClick={() => onChange({ ...filters, selectedTypes: [] })}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            전체 보기
          </button>
        )}
      </div>
    </div>
  )
}
