'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Header }           from '@/components/layout/Header'
import { TopNav }           from '@/components/dashboard/TopNav'
import { CategoryTabs }     from '@/components/dashboard/CategoryTabs'
import { MetricsBarChart }  from '@/components/dashboard/MetricsBarChart'
import { HospitalTable }    from '@/components/dashboard/HospitalTable'
import { LoadingSpinner }   from '@/components/ui/LoadingSpinner'
import { useDashboardData, ERROR_TYPE_LABELS } from '@/hooks/useDashboardData'
import { useAvailableMonths } from '@/hooks/useAvailableMonths'
import { CATEGORIES, GroupTab, CategoryKey } from '@/lib/metrics-config'

const ERROR_SOLUTIONS: Record<string, string[]> = {
  rls:     ['Supabase 대시보드 → Table Editor → hospital_metrics → RLS 탭 → 정책 추가 또는 비활성화'],
  table:   ['hospital_metrics 테이블 없음 — SQL Editor에서 schema.sql 실행'],
  column:  ['src/lib/metrics-config.ts → dbCategory 또는 metric key 값 수정'],
  auth:    ['.env.local 에 SUPABASE_SERVICE_ROLE_KEY 추가 후 서버 재시작'],
  network: ['인터넷 연결 확인, Supabase 프로젝트 활성화 여부 확인'],
  unknown: ['/test 페이지에서 상세 오류 확인'],
}

export default function DashboardPage() {
  // 초기값은 현재 날짜 — DB 로드 완료 후 최신 source_month 로 덮어씀
  const [year,     setYear]     = useState(() => new Date().getFullYear())
  const [month,    setMonth]    = useState(() => new Date().getMonth() + 1)
  const [groupTab, setGroupTab] = useState<GroupTab>('tertiary')
  const [category, setCategory] = useState<CategoryKey>('emergency')
  const [showRaw,  setShowRaw]  = useState(false)

  // ── 사용 가능한 조회월 (DB 기반) ────────────────────────────────────
  const { months: availableMonths, isLoading: isLoadingMonths } = useAvailableMonths()

  // 가장 최신 source_month 로 초기 설정 (한 번만)
  const initialized = useRef(false)
  useEffect(() => {
    if (initialized.current || availableMonths.length === 0) return
    initialized.current = true
    const latest = availableMonths[availableMonths.length - 1]  // 'YYYY-MM'
    const [y, m] = latest.split('-').map(Number)
    setYear(y)
    setMonth(m)
  }, [availableMonths])

  // 연도별 목록 (내림차순)
  const availableYears = useMemo(
    () => [...new Set(availableMonths.map(s => Number(s.split('-')[0])))].sort((a, b) => b - a),
    [availableMonths],
  )

  // 선택된 연도에서 사용 가능한 월 목록 (오름차순)
  const availableMonthsForYear = useMemo(
    () => availableMonths
      .filter(s => s.startsWith(String(year) + '-'))
      .map(s => Number(s.split('-')[1])),
    [availableMonths, year],
  )

  // 연도 변경 시 → 해당 연도에 없는 월이면 최신 월로 조정
  const handleYearChange = useCallback((y: number) => {
    setYear(y)
    const monthsForYear = availableMonths
      .filter(s => s.startsWith(String(y) + '-'))
      .map(s => Number(s.split('-')[1]))
    if (monthsForYear.length > 0 && !monthsForYear.includes(month)) {
      setMonth(monthsForYear[monthsForYear.length - 1])
    }
  }, [availableMonths, month])

  // ── 대시보드 데이터 ──────────────────────────────────────────────────
  const selectedCategory = useMemo(
    () => CATEGORIES.find(c => c.key === category)!,
    [category],
  )

  const {
    tableRows, chartSeries, isLoading, error, refetch,
    activeMetrics,
  } = useDashboardData(year, month, groupTab, selectedCategory)

  const errorInfo     = error ? ERROR_TYPE_LABELS[error.type] : null
  const hospitalCount = tableRows.filter(r => !r.isAverage).length

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header
        year={year}
        month={month}
        availableYears={availableYears}
        availableMonthsForYear={availableMonthsForYear}
        isLoadingMonths={isLoadingMonths}
        onYearChange={handleYearChange}
        onMonthChange={setMonth}
      />
      <TopNav value={groupTab} onChange={setGroupTab} />

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6 space-y-6">

        {error && (
          <div className={"rounded-xl border p-4 text-sm " + (errorInfo?.color ?? 'bg-red-50 border-red-200 text-red-700')}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span>{errorInfo?.icon}</span>
                <span className="font-bold">{errorInfo?.label ?? 'Supabase 오류'}</span>
                <code className="text-xs opacity-60">[{error.step}{error.code ? ' · ' + error.code : ''}]</code>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowRaw(v => !v)} className="text-xs underline opacity-60">
                  {showRaw ? '접기' : 'JSON 보기'}
                </button>
                <button onClick={refetch} className="text-xs border rounded-lg px-2 py-1 border-current">
                  🔄 재시도
                </button>
              </div>
            </div>
            <p className="font-mono text-xs mb-2 bg-black/5 rounded px-2 py-1 break-all">
              {error.message}
              {error.details && <span><br /><span className="opacity-60">details: {error.details}</span></span>}
              {error.hint    && <span><br /><span className="opacity-60">hint: {error.hint}</span></span>}
            </p>
            <ol className="list-decimal list-inside text-xs opacity-80 space-y-0.5 mb-1">
              {(ERROR_SOLUTIONS[error.type] ?? []).map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            {showRaw && (
              <pre className="mt-2 text-[10px] font-mono bg-black/10 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-40">
                {error.raw}
              </pre>
            )}
            <div className="mt-2 pt-2 border-t border-current/20 text-xs opacity-60">
              <Link href="/test" className="underline">/test 페이지 토</Link>
            </div>
          </div>
        )}

        <div className="card flex items-center justify-between gap-4 flex-wrap py-4">
          <CategoryTabs value={category} onChange={setCategory} />
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {isLoading && <LoadingSpinner size="sm" />}
            <span>
              {isLoading
                ? '데이터 불러오는 중…'
                : error
                  ? '오류로 인해 데이터 없음'
                  : hospitalCount > 0
                    ? year + '년 ' + month + '월 · ' + hospitalCount + '개 병원'
                    : year + '년 ' + month + '월 · 데이터 없음'}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="card h-64 flex items-center justify-center"><LoadingSpinner /></div>
        ) : (
          <MetricsBarChart metrics={activeMetrics} series={chartSeries} month={month} />
        )}

        {isLoading ? (
          <div className="card h-48 flex items-center justify-center"><LoadingSpinner /></div>
        ) : (
          <HospitalTable rows={tableRows} metrics={activeMetrics} year={year} month={month} />
        )}

        {!isLoading && !error && tableRows.length === 0 && (
          <div className="card bg-amber-50 border border-amber-200 text-sm">
            <h3 className="font-semibold text-amber-800 mb-2">📋 {year}년 {month}월 데이터가 없습니다</h3>
            <ol className="list-decimal list-inside text-amber-700 space-y-1 text-xs">
              <li>상단에서 실제 데이터가 있는 연도/월을 선택하세요</li>
              <li>source_month 컬럼 값이 {year}-{String(month).padStart(2,'0')} 형식인지 확인</li>
              <li>major_category 값이 &quot;{selectedCategory.dbCategory}&quot;와 일치하는지 확인</li>
            </ol>
          </div>
        )}

        <footer className="text-center text-xs text-slate-400 pb-4">
          병원군별 비교분석 대시보드 · Supabase 실데이터 연동
        </footer>
      </main>
    </div>
  )
}
