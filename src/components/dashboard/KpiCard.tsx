import { cn, formatNumber, getChangeBg, getChangeIcon } from '@/lib/utils'

interface KpiCardProps {
  title:     string
  value:     number
  unit:      string
  change:    number
  icon:      string
  colorClass?: string
}

export function KpiCard({ title, value, unit, change, icon, colorClass = 'bg-primary-50 text-primary-600' }: KpiCardProps) {
  return (
    <div className="card-hover">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-500 font-medium mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-900">
            {formatNumber(value)}
            <span className="text-base font-medium text-slate-500 ml-1">{unit}</span>
          </p>
        </div>
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center text-xl', colorClass)}>
          {icon}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1">
        <span className={cn('badge text-xs', getChangeBg(change))}>
          {getChangeIcon(change)} {Math.abs(change).toFixed(1)}%
        </span>
        <span className="text-xs text-slate-400">전년 대비</span>
      </div>
    </div>
  )
}
