import { cn } from '@/lib/utils'
import { CategoryKey, CATEGORIES } from '@/lib/metrics-config'

interface Props {
  value:    CategoryKey
  onChange: (cat: CategoryKey) => void
}

export function CategoryTabs({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium text-slate-500">항목 선택</span>
      <div className="flex gap-1.5">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => onChange(cat.key)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-150 border',
              value === cat.key
                ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-primary-300 hover:text-primary-600',
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  )
}
