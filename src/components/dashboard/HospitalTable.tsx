'use client'

import { cn } from '@/lib/utils'
import { MetricField } from '@/lib/metrics-config'
import { TableRow } from '@/hooks/useDashboardData'

interface Props {
  rows:    TableRow[]
  metrics: MetricField[]
  year:    number
  month:   number
}

// ── 수치 포맷 ─────────────────────────────────────────────────────────
function fmtValue(v: number | null | undefined, isPercent?: boolean): string {
  if (v === null || v === undefined) return '-'
  if (isPercent) return `${v.toFixed(1)}%`
  return v.toLocaleString('ko-KR')
}

// ── 증감 포맷 ─────────────────────────────────────────────────────────
function Delta({
  current,
  prev,
  isPercent,
  unit,
}: {
  current:   number | null | undefined
  prev:      number | null | undefined
  isPercent?: boolean
  unit?:     string
}) {
  if (current == null || prev == null) {
    return <span className="text-slate-300 text-xs">-</span>
  }
  const diff = current - prev
  const pct  = prev !== 0 ? ((diff / prev) * 100).toFixed(1) : null

  const isPos = diff > 0
  const isZero = diff === 0

  const colorCls = isZero
    ? 'text-slate-400'
    : isPos
    ? 'text-emerald-600'
    : 'text-red-500'

  const arrow = isZero ? '' : isPos ? '▲' : '▼'
  const diffStr = isPercent
    ? `${Math.abs(diff).toFixed(1)}%p`
    : Math.abs(diff).toLocaleString('ko-KR')

  return (
    <span className={cn('text-xs font-medium', colorCls)}>
      {arrow} {diffStr}
      {pct && <span className="text-[10px] ml-0.5 opacity-75">({pct}%)</span>}
    </span>
  )
}

// ── 셀 배경 ──────────────────────────────────────────────────────────
function rowBg(row: TableRow) {
  if (row.isOurHospital) return 'bg-blue-50'
  if (row.isAverage)     return 'bg-amber-50/60'
  return ''
}

// ── 메인 테이블 ──────────────────────────────────────────────────────
export function HospitalTable({ rows, metrics, year, month }: Props) {
  const pm = month === 1 ? 12 : month - 1
  const pmYear = month === 1 ? year - 1 : year

  if (!rows.length) {
    return (
      <div className="card flex items-center justify-center h-32">
        <p className="text-sm text-slate-400">조회된 병원 데이터가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="card p-0 overflow-hidden">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800">병원별 실적 현황</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {year}년 {month}월 기준 · 전월({pmYear}년 {pm}월) · 전년동월({year - 1}년 {month}월) 비교
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300" />
            <span className="text-slate-500">우리병원</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-50 border border-amber-200" />
            <span className="text-slate-500">그룹 평균</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          {/* 헤더: 2-row (지표명 + 현재/전월/전년) */}
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th
                rowSpan={2}
                className="text-left px-4 py-2 font-semibold text-slate-600 whitespace-nowrap sticky left-0 bg-slate-50 z-10 border-r border-slate-200 min-w-[140px]"
              >
                병원명
              </th>
              {metrics.map(m => (
                <th
                  key={m.key}
                  colSpan={3}
                  className="text-center px-2 py-2 font-semibold text-slate-600 whitespace-nowrap border-l border-slate-200"
                >
                  {m.label}
                  {m.unit && <span className="text-slate-400 font-normal ml-1">({m.unit})</span>}
                </th>
              ))}
            </tr>
            <tr className="border-b border-slate-200 bg-slate-50">
              {metrics.map(m => (
                <>
                  <th key={`${m.key}-cur`} className="text-center px-2 py-1.5 font-medium text-slate-500 whitespace-nowrap border-l border-slate-100">
                    {month}월
                  </th>
                  <th key={`${m.key}-pm`} className="text-center px-2 py-1.5 font-medium text-slate-400 whitespace-nowrap">
                    전월대비
                  </th>
                  <th key={`${m.key}-py`} className="text-center px-2 py-1.5 font-medium text-slate-400 whitespace-nowrap">
                    전년대비
                  </th>
                </>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-slate-100 hover:brightness-95 transition-all',
                  rowBg(row),
                )}
              >
                {/* 병원명 (sticky) */}
                <td
                  className={cn(
                    'px-4 py-2.5 font-medium sticky left-0 z-10 border-r border-slate-200',
                    rowBg(row) || 'bg-white',
                  )}
                >
                  <div className="flex items-center gap-2">
                    {row.isOurHospital && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-600 text-white shrink-0">
                        우리
                      </span>
                    )}
                    {row.isAverage && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-white shrink-0">
                        평균
                      </span>
                    )}
                    <span className={cn(
                      'whitespace-nowrap',
                      row.isOurHospital ? 'text-primary-700 font-bold' : 'text-slate-700',
                    )}>
                      {row.name}
                    </span>
                  </div>
                </td>

                {/* 지표별 데이터 */}
                {metrics.map(m => (
                  <>
                    {/* 현재월 */}
                    <td key={`${row.id}-${m.key}-cur`} className="text-right px-3 py-2.5 font-semibold text-slate-800 border-l border-slate-100 whitespace-nowrap">
                      {fmtValue(row.current[m.key] as number | null, m.isPercent)}
                      {row.current[m.key] != null && m.unit && !m.isPercent
                        ? <span className="text-slate-400 font-normal ml-0.5">{m.unit}</span>
                        : null}
                    </td>
                    {/* 전월 대비 */}
                    <td key={`${row.id}-${m.key}-pm`} className="text-center px-2 py-2.5 whitespace-nowrap">
                      <Delta
                        current={row.current[m.key] as number | null}
                        prev={row.prevMonth[m.key] as number | null}
                        isPercent={m.isPercent}
                        unit={m.unit}
                      />
                    </td>
                    {/* 전년 대비 */}
                    <td key={`${row.id}-${m.key}-py`} className="text-center px-2 py-2.5 whitespace-nowrap border-r border-slate-100">
                      <Delta
                        current={row.current[m.key] as number | null}
                        prev={row.prevYear[m.key] as number | null}
                        isPercent={m.isPercent}
                        unit={m.unit}
                      />
                    </td>
                  </>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 컬럼 미설정 안내 */}
      {rows.length > 0 &&
        metrics.every(m => rows[0]?.current[m.key] == null) && (
          <div className="px-6 py-3 bg-amber-50 border-t border-amber-200 text-xs text-amber-700">
            ⚠️ 데이터가 없습니다. hospital_metrics 테이블에서
            <code className="bg-amber-100 px-1 rounded mx-1">source_month</code>
            /
            <code className="bg-amber-100 px-1 rounded mx-1">major_category</code>
            /
            <code className="bg-amber-100 px-1 rounded mx-1">hospital_group</code>
            필터 값을 확인하세요.
            <a href="/test" className="ml-2 underline font-medium">연결 확인 →</a>
          </div>
        )}
    </div>
  )
}
