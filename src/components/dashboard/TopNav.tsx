import { cn } from '@/lib/utils'
import { GroupTab, GROUP_TAB_LABELS } from '@/lib/metrics-config'

interface Props {
  value:    GroupTab
  onChange: (tab: GroupTab) => void
}

const TABS: GroupTab[] = ['tertiary', 'general', 'all']

export function TopNav({ value, onChange }: Props) {
  return (
    <div className="flex items-center border-b border-slate-200 bg-white px-6">
      {TABS.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={cn(
            'px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors duration-150',
            value === tab
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
          )}
        >
          {GROUP_TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  )
}
