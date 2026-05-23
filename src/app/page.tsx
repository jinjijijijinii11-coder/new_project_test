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

const INIT_YEAR  = 2025
const INIT_MONTH = 9

const ERROR_SOLUTIONS: Record<string, string[]> = {
  rls:     ['Supabase 대시보드 → Table Editor → hospital_master / hospital_metrics → RLS 탭 → 정책 추가 또는 비활성화'],
  table:   ['hospital_master 또는 hospital_metrics 테이블 없음 — SQL Editor에서 schema.sql 실행'],
  column:  ['src/lib/metrics-config.ts → SCHEMA 컬럼명 수정 → 아래 감지된 DB 스키마 패널 참조'],
  auth:    ['.env.local 에 SUPABASE_SERVICE_ROLE_KEY 추가 후 서버 재시작'],
  network: ['인터넷 연결 확인, Supabase 프로젝트 활성화 여부 확인'],
  unknown: ['/test 페이지에서 상세 오류 확인'],
}

export default function DashboardPage() {
  const [year,      setYear]      = useState(INIT_YEAR)
  const [month,     setMonth]     = useState(INIT_MONTH)
  const [groupTab,  setGroupTab]  = useState<GroupTab>('tertiary')
  const [category,  setCategory]  = useState<CategoryKey>('emergency')
  const [showRaw,   setShowRaw]   = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  const configuredMetrics = useMemo(
    () => CATEGORIES.find(c => c.key === category)!.metrics,
    [category],
  )

  const {
    tableRows, chartSeries, isLoading, error, refetch,
    activeMetrics, isAutoDetected, detectedSchema,
  } = useDashboardData(year, month, groupTab, configuredMetrics)

  const errorInfo     = error ? ERROR_TYPE_LABELS[error.type] : null
  const hospitalCount = tableRows.filter(r => !r.isAverage).length

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header year={year} month={month} onYearChange={setYear} onMonthChange={setMonth} />
      <TopNav value={groupTab} onChange={setGroupTab} />

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6 space-y-6">

        {/* ── 오류 패널 ──────────────────────────────────────────── */}
        {error && (
          <div className={`rounded-xl border p-4 text-sm ${errorInfo?.color ?? 'bg-red-50 border-red-200 text-red-700'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span>{errorInfo?.icon}</span>
                <span className="font-bold">{errorInfo?.label ?? 'Supabase 오류'}</span>
                <code className="text-xs opacity-60">[{error.step}{error.code ? ` · ${error.code}` : ''}]</code>
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
              {error.details && <><br /><span className="opacity-60">details: {error.details}</span></>}
              {error.hint    && <><br /><span className="opacity-60">hint: {error.hint}</span></>}
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
              <Link href="/test" className="underline">/test 페이지 →</Link>
            </div>
          </div>
        )}

        {/* ── 자동 감지 경고 배너 ────────────────────────────────── */}
        {!isLoading && !error && isAutoDetected && activeMetrics.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <p className="font-semibold mb-1">
              ⚠️ metrics-config.ts 컬럼명과 DB 불일치 → 수치형 컬럼 자동 감지 사용 중
            </p>
            <p className="mb-1">
              감지된 컬럼:{' '}
              {activeMetrics.map(m => (
                <code key={m.key} className="bg-amber-100 px-1 rounded mx-0.5">{m.key}</code>
              ))}
            </p>
            <p className="opacity-70">
              아래 DB 스키마 패널을 열어 실제 컬럼명을 확인하고{' '}
              <code className="bg-amber-100 px-1 rounded">src/lib/metrics-config.ts</code>를 수정하세요.
            </p>
          </div>
        )}

        {/* ── 카테고리 탭 + 상태 ─────────────────────────────────── */}
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
                    ? `${year}년 ${month}월 · ${hospitalCount}개 병원`
                    : `${year}년 ${month}월 · 데이터 없음`}
            </span>
          </div>
        </div>

        {/* ── 핵심 지표 막대그래프 ───────────────────────────────── */}
        {isLoading ? (
          <div className="card h-64 flex items-center justify-center"><LoadingSpinner /></div>
        ) : (
          <MetricsBarChart metrics={activeMetrics} series={chartSeries} month={month} />
        )}

        {/* ── 병원별 실적 현황 표 ────────────────────────────────── */}
        {isLoading ? (
          <div className="card h-48 flex items-center justify-center"><LoadingSpinner /></div>
        ) : (
          <HospitalTable rows={tableRows} metrics={activeMetrics} year={year} month={month} />
        )}

        {/* ── 데이터 없음 ────────────────────────────────────────── */}
        {!isLoading && !error && tableRows.length === 0 && (
          <div className="card bg-amber-50 border border-amber-200 text-sm">
            <h3 className="font-semibold text-amber-800 mb-2">📋 {year}년 {month}월 데이터가 없습니다</h3>
            <ol className="list-decimal list-inside text-amber-700 space-y-1 text-xs">
              <li>상단에서 실제 데이터가 있는 연도/월을 선택하세요</li>
              <li>아래 DB 스키마 패널에서 실제 컬럼명 확인 후 metrics-config.ts 수정</li>
              <li>HOSPITAL_TYPE_VALUES가 실제 DB 종별 값과 일치하는지 확인</li>
            </ol>
          </div>
        )}

        {/* ── DB 스키마 감지 패널 ─────────────────────────────────── */}
        {!isLoading && detectedSchema && (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden text-xs">
            <button
              onClick={() => setShowDebug(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-slate-500 transition-colors"
            >
              <span className="font-semibold text-slate-700">
                🔍 감지된 DB 스키마 — metrics-config.ts 수정 참고용
              </span>
              <span>{showDebug ? '▲ 접기' : '▼ 펼치기'}</span>
            </button>

            {showDebug && (
              <div className="border-t border-slate-100 p-4 space-y-4">

                {/* hospital_master */}
                <div>
                  <p className="font-bold text-slate-700 mb-2">
                    hospital_master
                    <span className="ml-2 font-normal text-slate-400">
                      ({detectedSchema.master.columns.length}개 컬럼)
                    </span>
                  </p>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {[
                      { label: 'ID 컬럼 (SCHEMA.MASTER.ID)',   value: detectedSchema.master.idCol },
                      { label: '병원명 컬럼 (SCHEMA.MASTER.NAME)', value: detectedSchema.master.nameCol },
                      { label: '종별 컬럼 (SCHEMA.MASTER.TYPE)',  value: detectedSchema.master.typeCol },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-slate-50 rounded-lg p-2">
                        <p className="text-slate-400 text-[10px] mb-0.5">{label}</p>
                        <code className="text-emerald-700 font-bold">{value}</code>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {detectedSchema.master.columns.map(c => (
                      <code key={c} className={`px-1.5 py-0.5 rounded text-[10px] border
                        ${[detectedSchema.master.idCol, detectedSchema.master.nameCol, detectedSchema.master.typeCol].includes(c)
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold'
                          : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                        {c}
                      </code>
                    ))}
                  </div>
                </div>

                {/* 종별 값 */}
                <div>
                  <p className="font-bold text-slate-700 mb-2">종별 구분 값 (HOSPITAL_TYPE_VALUES)</p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {[
                      { label: '상급종합 (TERTIARY)', value: detectedSchema.typeValues.tertiary },
                      { label: '종합병원 (GENERAL)',   value: detectedSchema.typeValues.general },
                    ].map(({ label, value }) => (
                      <div key={label} className={`rounded-lg p-2 ${value ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        <p className="text-slate-400 text-[10px] mb-0.5">{label}</p>
                        <code className={value ? 'text-emerald-700 font-bold' : 'text-red-500'}>
                          {value ?? '미감지 ⚠️'}
                        </code>
                      </div>
                    ))}
                  </div>
                  <p className="text-slate-400 text-[10px]">
                    DB 전체 종별 값: {detectedSchema.typeValues.all.map(v => (
                      <code key={v} className="bg-slate-100 px-1 rounded mx-0.5">{v}</code>
                    ))}
                  </p>
                </div>

                {/* hospital_metrics */}
                <div>
                  <p className="font-bold text-slate-700 mb-2">
                    hospital_metrics
                    <span className="ml-2 font-normal text-slate-400">
                      ({detectedSchema.metrics.columns.length}개 컬럼)
                    </span>
                  </p>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {[
                      { label: '병원 FK (SCHEMA.METRICS.HOSPITAL_ID)', value: detectedSchema.metrics.fkCol },
                      { label: '연도 컬럼 (SCHEMA.METRICS.YEAR)',       value: detectedSchema.metrics.yearCol },
                      { label: '월 컬럼 (SCHEMA.METRICS.MONTH)',        value: detectedSchema.metrics.monthCol },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-slate-50 rounded-lg p-2">
                        <p className="text-slate-400 text-[10px] mb-0.5">{label}</p>
                        <code className="text-emerald-700 font-bold">{value}</code>
                      </div>
                    ))}
                  </div>
                  <p className="text-slate-500 mb-1 text-[10px] font-semibold">
                    수치형 컬럼 ({detectedSchema.metrics.numericCols.length}개) — MetricField.key 후보:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {detectedSchema.metrics.numericCols.map(c => {
                      const isUsed = activeMetrics.some(m => m.key === c)
                      return (
                        <code key={c} className={`px-1.5 py-0.5 rounded text-[10px] border
                          ${isUsed
                            ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold'
                            : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                          {c}
                        </code>
                      )
                    })}
                  </div>
                  {detectedSchema.metrics.numericCols.length === 0 && (
                    <p className="text-slate-400 mt-1">
                      수치형 컬럼 없음 — hospital_metrics 데이터 없거나 FK 조인 실패
                    </p>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        <footer className="text-center text-xs text-slate-400 pb-4">
          병원군별 비교분석 대시보드 · Supabase 실데이터 연동
        </footer>
      </main>
    </div>
  )
}
