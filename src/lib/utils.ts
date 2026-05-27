import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 공통 숫자 포맷 함수
 * - 소수점 첫째 자리까지 반올림
 * - 정수는 소수점 표시 안 함 (2106.0 → 2106)
 * - 소수는 1자리 표시 (623.909 → 623.9)
 * - isPercent: true면 % 접미사 추가
 */
export function fmtNum(v: number | null | undefined, isPercent?: boolean): string {
  if (v === null || v === undefined) return '-'
  const rounded = Math.round(v * 10) / 10
  const str = Number.isInteger(rounded)
    ? rounded.toLocaleString('ko-KR')
    : rounded.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return isPercent ? `${str}%` : str
}

export function formatNumber(value: number, unit?: string): string {
  if (value === 0) return '-'
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}억${unit ? ` ${unit}` : ''}`
  }
  if (value >= 10_000) {
    return `${(value / 10_000).toFixed(1)}만${unit ? ` ${unit}` : ''}`
  }
  return `${value.toLocaleString('ko-KR')}${unit ? ` ${unit}` : ''}`
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function getChangeColor(change: number): string {
  if (change > 0) return 'text-emerald-600'
  if (change < 0) return 'text-red-500'
  return 'text-slate-500'
}

export function getChangeBg(change: number): string {
  if (change > 0) return 'bg-emerald-50 text-emerald-700'
  if (change < 0) return 'bg-red-50 text-red-600'
  return 'bg-slate-100 text-slate-600'
}

export function getChangeIcon(change: number): string {
  if (change > 0) return '▲'
  if (change < 0) return '▼'
  return '─'
}

export function formatAxisNumber(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(0)}억`
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}만`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}천`
  return String(value)
}
