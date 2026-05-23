'use client'

import { useState, useMemo } from 'react'
import { Header }           from '@/components/layout/Header'
import { TopNav }           from '@/components/dashboard/TopNav'
import { CategoryTabs }     from '@/components/dashboard/CategoryTabs'
import { MetricsBarChart }  from '@/components/dashboard/MetricsBarChart'
import { HospitalTable }    from '@/components/dashboard/HospitalTable'
import { LoadingSpinner }   from '@/components/ui/LoadingSpinner'
import { useDashboardData } from '@/hooks/useDashboardData'
import { CATEGORIES, GroupTab, CategoryKey } from '@/lib/metrics-config'
import { cn } from '@/lib/utils'

// ── 초기값 ────────────────────────────────────────────────────────────
const now = new Date()
const INIT_YEAR  = now.getFullYear()
const INIT_MONTH = now.getMonth() + 1   // getMonth() is 0-indexed

export default function DashboardPage() {
  const [year,     setYear]     = useState(INIT_YEAR)
  const [month,    setMonth]    = useState(INIT_MONTH)
  const [groupTab, setGroupTab] = useState<GroupTab>('tertiary')
  const [category, setCategory] = useState<CategoryKey>('emergency')

  // 선택된 카테고리의 지표 목록
  const currentCategoryConfig = useMemo(
    () => CATEGORIES.find(c => c.key === category)!,
    [category],
  )
  const metrics = currentCategoryConfig.metrics

  // Supabase 실데이터 로드
  const { tableRows, chartSeries, isLoading, error, refetch } =
    useDashboardData(year, month, groupTab, metrics)

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* 헤더 (제목 + 조회월 선택) */}
      <Header
        year={year}
        month={month}
        onYearChange={setYear}
        onMonthChange={setMonth}
      />

      {/* 상단 탭 (병원군 선택) */}
      <TopNav value={groupTab} onChange={setGroupTab} />

      {/* 메인 콘텐츠 */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6 space-y-6">

        {/* 오류 배너 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm flex items-start gap-3">
            <span className="text-red-500 text-lg shrink-0">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold text-red-700 mb-0.5">Supabase 연결 오류</p>
              <p className="text-red-600 text-xs font-mono">{error}</p>
              {error.includes('allowlist') && (
                <p className="mt-1.5 text-red-600 text-xs">
                  👉 Supabase 대시보드 → Settings → API → API Keys →
                  Allowed origins 에{' '}
                  <code className="bg-red-100 px-1 rounded">http://localhost:3000</code>{' '}
                  추가 후{' '}
                  <button onClick={refetch} className="underline font-medium">재시도</button>
                </p>
              )}
            </div>
            <button
              onClick={refetch}
              className="shrink-0 text-xs text-red-600 border border-red-200 rounded-lg px-2.5 py-1 hover:bg-red-100"
            >
              재시도
            </button>
          </div>
        )}

        {/* 항목 선택 + 조회 상태 */}
        <div className="card flex items-center justify-between gap-4 flex-wrap py-4">
          <CategoryTabs value={category} onChange={setCategory} />
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {isLoading && <LoadingSpinner size="sm" />}
            <span>
              {isLoading
                ? '데이터 불러오는 중…'
                : `${year}년 ${month}월 · ${tableRows.length}개 병원`}
            </span>
          </div>
        </div>

        {/* 핵심 지표 막대그래프 */}
        {isLoading ? (
          <div className="card h-64 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <MetricsBarChart
            metrics={metrics}
            series={chartSeries}
            month={month}
          />
        )}

        {/* 병원별 실적 현황 표 */}
        {isLoading ? (
          <div className="card h-48 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <HospitalTable
            rows={tableRows}
            metrics={metrics}
            year={year}
            month={month}
          />
        )}

        {/* 컬럼 설정 안내 (데이터 없을 때) */}
        {!isLoading && !error && tableRows.length === 0 && (
          <div className="card bg-amber-50 border border-amber-200 text-sm">
            <h3 className="font-semibold text-amber-800 mb-2">📋 데이터 없음</h3>
            <p className="text-amber-700 mb-2">병원 데이터가 조회되지 않습니다. 확인 사항:</p>
            <ol className="list-decimal list-inside text-amber-700 space-y-1 text-xs">
              <li>
                <a href="/test" className="underline font-medium">연결 테스트 페이지</a>에서
                Supabase 연결 및 테이블 확인
              </li>
              <li>
                <code className="bg-amber-100 px-1 rounded">src/lib/metrics-config.ts</code> 에서
                SCHEMA.MASTER.NAME, TYPE 컬럼명 확인
              </li>
              <li>
                hospital_master.type 값이{' '}
                <code className="bg-amber-100 px-1 rounded">상급종합</code>,{' '}
                <code className="bg-amber-100 px-1 rounded">종합병원</code>
                과 일치하는지 확인 (HOSPITAL_TYPE_VALUES 수정)
              </li>
            </ol>
          </div>
        )}

        {/* 푸터 */}
        <footer className="text-center text-xs text-slate-400 pb-4">
          병원군별 비교분석 대시보드 · Supabase 실데이터 연동
        </footer>
      </main>
    </div>
  )
}
