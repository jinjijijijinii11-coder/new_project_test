'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Header }           from '@/components/layout/Header'
import { TopNav }           from '@/components/dashboard/TopNav'
import { CategoryTabs }     from '@/components/dashboard/CategoryTabs'
import { MetricsBarChart }  from '@/components/dashboard/MetricsBarChart'
import { HospitalTable }    from '@/components/dashboard/HospitalTable'
import { LoadingSpinner }   from '@/components/ui/LoadingSpinner'
import { useDashboardData, ERROR_TYPE_LABELS } from '@/hooks/useDashboardData'
import { CATEGORIES, GroupTab, CategoryKey } from '@/lib/metrics-config'

const now        = new Date()
const INIT_YEAR  = now.getFullYear()
const INIT_MONTH = now.getMonth() + 1

// ── 오류 유형별 해결책 안내 ──────────────────────────────────────────
const ERROR_SOLUTIONS: Record<string, string[]> = {
  rls: [
    'Supabase 대시보드 → Table Editor → hospital_master / hospital_metrics',
    'RLS(Row Level Security) 탭 → 정책 추가 또는 RLS 비활성화',
    '또는: SQL Editor에서 → ALTER TABLE hospital_master ENABLE ROW LEVEL SECURITY; 후 정책 생성',
  ],
  table: [
    'hospital_master 또는 hospital_metrics 테이블이 존재하지 않습니다',
    'Supabase 대시보드 → SQL Editor → supabase/schema.sql 실행',
  ],
  column: [
    'src/lib/metrics-config.ts → SCHEMA 섹션에서 컬럼명 수정',
    '/test 페이지에서 실제 컬럼명 확인 후 key 값과 맞추세요',
  ],
  auth: [
    '.env.local 파일의 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 확인',
    'Supabase 대시보드 → Settings → API → API Keys → Allowed origins 에 http://localhost:3000 추가',
  ],
  network: [
    '인터넷 연결을 확인하세요',
    'Supabase 프로젝트가 일시정지 상태일 수 있습니다 (무료 플랜 비활성화)',
  ],
  unknown: [
    '/test 페이지에서 상세 오류를 확인하세요',
  ],
}

export default function DashboardPage() {
  const [year,     setYear]     = useState(INIT_YEAR)
  const [month,    setMonth]    = useState(INIT_MONTH)
  const [groupTab, setGroupTab] = useState<GroupTab>('tertiary')
  const [category, setCategory] = useState<CategoryKey>('emergency')
  const [showRaw,  setShowRaw]  = useState(false)

  const currentCategoryConfig = useMemo(
    () => CATEGORIES.find(c => c.key === category)!,
    [category],
  )
  const metrics = currentCategoryConfig.metrics

  const { tableRows, chartSeries, isLoading, error, refetch } =
    useDashboardData(year, month, groupTab, metrics)

  const errorInfo = error ? ERROR_TYPE_LABELS[error.type] : null

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header year={year} month={month} onYearChange={setYear} onMonthChange={setMonth} />
      <TopNav value={groupTab} onChange={setGroupTab} />

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6 space-y-6">

        {/* ── 구조화된 오류 패널 ─────────────────────────────────── */}
        {error && (
          <div className={`rounded-xl border p-4 text-sm ${errorInfo?.color ?? 'bg-red-50 border-red-200 text-red-700'}`}>
            {/* 제목 행 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">{errorInfo?.icon}</span>
                <span className="font-bold">{errorInfo?.label ?? 'Supabase 오류'}</span>
                <span className="text-xs opacity-70 font-mono">
                  [{error.step}
                  {error.code ? ` · 코드: ${error.code}` : ''}]
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowRaw(v => !v)}
                  className="text-xs underline opacity-60 hover:opacity-100"
                >
                  {showRaw ? '상세 접기' : '전체 JSON 보기'}
                </button>
                <button
                  onClick={refetch}
                  className="text-xs border rounded-lg px-2.5 py-1 hover:opacity-80 border-current"
                >
                  🔄 재시도
                </button>
              </div>
            </div>

            {/* 오류 메시지 */}
            <p className="font-mono text-xs mb-3 break-all bg-black/5 rounded px-2 py-1.5">
              {error.message}
              {error.details && <><br /><span className="opacity-70">details: {error.details}</span></>}
              {error.hint    && <><br /><span className="opacity-70">hint: {error.hint}</span></>}
            </p>

            {/* 해결 방법 */}
            <div className="mb-2">
              <p className="text-xs font-semibold opacity-80 mb-1">💡 해결 방법</p>
              <ol className="list-decimal list-inside text-xs space-y-0.5 opacity-80">
                {(ERROR_SOLUTIONS[error.type] ?? []).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>

            {/* 전체 JSON (토글) */}
            {showRaw && (
              <pre className="mt-2 text-[10px] font-mono bg-black/10 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-48">
                {error.raw}
              </pre>
            )}

            <div className="mt-2 pt-2 border-t border-current/20 text-xs opacity-60">
              더 자세한 디버깅:{' '}
              <Link href="/test" className="underline font-medium">
                /test 페이지에서 실제 테이블/컬럼 확인 →
              </Link>
            </div>
          </div>
        )}

        {/* ── 항목 선택 ──────────────────────────────────────────── */}
        <div className="card flex items-center justify-between gap-4 flex-wrap py-4">
          <CategoryTabs value={category} onChange={setCategory} />
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {isLoading && <LoadingSpinner size="sm" />}
            <span>
              {isLoading
                ? '데이터 불러오는 중…'
                : error
                ? '오류로 인해 데이터 없음'
                : `${year}년 ${month}월 · ${tableRows.length}개 병원`}
            </span>
          </div>
        </div>

        {/* ── 핵심 지표 막대그래프 ───────────────────────────────── */}
        {isLoading ? (
          <div className="card h-64 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <MetricsBarChart metrics={metrics} series={chartSeries} month={month} />
        )}

        {/* ── 병원별 실적 현황 표 ────────────────────────────────── */}
        {isLoading ? (
          <div className="card h-48 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <HospitalTable rows={tableRows} metrics={metrics} year={year} month={month} />
        )}

        {/* ── 데이터 없음 안내 ───────────────────────────────────── */}
        {!isLoading && !error && tableRows.length === 0 && (
          <div className="card bg-amber-50 border border-amber-200 text-sm">
            <h3 className="font-semibold text-amber-800 mb-2">📋 데이터 없음</h3>
            <ol className="list-decimal list-inside text-amber-700 space-y-1.5 text-xs">
              <li>
                <Link href="/test" className="underline font-medium">연결 테스트 페이지</Link>에서
                테이블 데이터 및 컬럼명 확인
              </li>
              <li>
                <code className="bg-amber-100 px-1 rounded">src/lib/metrics-config.ts</code> →
                SCHEMA.MASTER.NAME / TYPE 컬럼명이 DB와 일치하는지 확인
              </li>
              <li>
                HOSPITAL_TYPE_VALUES 값이 실제 DB의{' '}
                <code className="bg-amber-100 px-1 rounded">type</code>{' '}
                컬럼 값과 일치하는지 확인 (예: '상급종합' vs '상급종합병원')
              </li>
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
