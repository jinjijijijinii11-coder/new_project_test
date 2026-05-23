import { cn } from '@/lib/utils'
import { HOSPITAL_TYPE_COLORS, HospitalType } from '@/types/hospital'

interface BadgeProps {
  type: HospitalType
  size?: 'sm' | 'md'
}

export function HospitalTypeBadge({ type, size = 'md' }: BadgeProps) {
  const color = HOSPITAL_TYPE_COLORS[type]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      )}
      style={{ backgroundColor: `${color}18`, color }}
    >
      {type}
    </span>
  )
}
