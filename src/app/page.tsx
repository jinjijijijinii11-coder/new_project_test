'use client'

import { useState } from 'react'
import { Header }            from '@/components/layout/Header'
import { FilterBar }         from '@/components/dashboard/FilterBar'
import { KpiCard }           from '@/components/dashboard/KpiCard'
import { GroupSummaryTable } from '@/components/dashboard/GroupSummaryTable'
import { MonthlyTrendChart } from '@/components/charts/MonthlyTrendChart'
import { GroupBarChart }     from '@/components/charts/GroupBarChart'
import { RadarCompareChart } from '@/components/charts/RadarCompareChart'
import { RegionPieChart }    from '@/components/charts/RegionPieChart'
import { LoadingSpinner, CardSkeleton } from '@/components/ui/LoadingSpinner'
import { useHospitalData }   from '@/hooks/useHospitalData'
import { DashboardFilters, METRIC_LABELS } from '@/types/hospital'

const DEFAULT_FILTERS: DashboardFilters = {
  year:          2024,
  selectedTypes: [],
  selectedRegions: [],
  metric:        'outpatient_count',
}

export default function DashboardPage() {
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS)

  const {
    kpi,
    groupSummary,
    monthlyTrend,
    regionDistribution,
    isLoading,
    error,
    refetch,
  } = useHospitalData(filters.year, filters.metric, filters.selectedTypes)

  const metricInfo = METRIC_LABELS[filters.metric]

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6 space-y-6">

        {/* ── 오류 알림 ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
            <button onClick={refetch} className="ml-auto underline text-red-600 hover:text-red-800">
              재시도
            </button>
          </div>
        )}

        {/* ── 필터 바 ── */}
        <FilterBar filters={filters} onChange={setFilters} />

        {/* ── KPI 카드 ── */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="전체 의료기관"
              value={kpi.totalHospitals.value}
              unit={kpi.totalHospitals.unit}
              change={kpi.totalHospitals.change}
              icon="🏥"
              colorClass="bg-blue-50 text-blue-600"
            />
            <KpiCard
              title="총 병상 수"
              value={kpi.totalBeds.value}
              unit={kpi.totalBeds.unit}
              change={kpi.totalBeds.change}
              icon="🛏️"
              colorClass="bg-emerald-50 text-emerald-600"
            />
            <KpiCard
              title="평균 병상 가동률"
              value={kpi.avgOccupancy.value}
              unit={kpi.avgOccupancy.unit}
              change={kpi.avgOccupancy.change}
              icon="📊"
              colorClass="bg-amber-50 text-amber-600"
            />
            <KpiCard
              title="월평균 외래 환자"
              value={kpi.totalOutpatient.value}
              unit={kpi.totalOutpatient.unit}
              change={kpi.totalOutpatient.change}
              icon="👥"
              colorClass="bg-purple-50 text-purple-600"
            />
          </div>
        )}

        {/* ── 메인 차트 영역 ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* 월별 추이 (2/3 너비) */}
          <div className="xl:col-span-2 card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">월별 {metricInfo.label} 추이</h2>
                <p className="text-xs text-slate-400 mt-0.5">{filters.year}년 · 병원군별 비교</p>
              </div>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                단위: {metricInfo.unit}
              </span>
            </div>
            {isLoading
              ? <div className="h-[320px] flex items-center justify-center"><LoadingSpinner /></div>
              : <MonthlyTrendChart data={monthlyTrend} selectedTypes={filters.selectedTypes} unit={metricInfo.unit} />
            }
          </div>

          {/* 지역 분포 (1/3 너비) */}
          <div className="card">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-800">지역별 분포</h2>
              <p className="text-xs text-slate-400 mt-0.5">전체 의료기관 기준</p>
            </div>
            {isLoading
              ? <div className="h-[300px] flex items-center justify-center"><LoadingSpinner /></div>
              : <RegionPieChart data={regionDistribution} />
            }
          </div>
        </div>

        {/* ── 하단 차트 영역 ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* 병원군별 비교 바 차트 */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">병원군별 {metricInfo.label} 비교</h2>
                <p className="text-xs text-slate-400 mt-0.5">평균값 기준</p>
              </div>
            </div>
            {isLoading
              ? <div className="h-[280px] flex items-center justify-center"><LoadingSpinner /></div>
              : <GroupBarChart data={groupSummary} metric={filters.metric} unit={metricInfo.unit} />
            }
          </div>

          {/* 레이더 차트 */}
          <div className="card">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-800">다차원 역량 비교</h2>
              <p className="text-xs text-slate-400 mt-0.5">주요 지표 정규화 (최대값 = 100점)</p>
            </div>
            {isLoading
              ? <div className="h-[300px] flex items-center justify-center"><LoadingSpinner /></div>
              : <RadarCompareChart data={groupSummary} />
            }
          </div>
        </div>

        {/* ── 상세 테이블 ── */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">병원군별 상세 현황</h2>
              <p className="text-xs text-slate-400 mt-0.5">{filters.year}년 기준 · 평균값</p>
            </div>
            <span className="text-xs text-slate-400">
              {groupSummary.length}개 병원군
            </span>
          </div>
          {isLoading
            ? <div className="h-[200px] flex items-center justify-center"><LoadingSpinner /></div>
            : <GroupSummaryTable data={groupSummary} />
          }
        </div>

        {/* ── 푸터 ── */}
        <footer className="text-center text-xs text-slate-400 pb-4">
          <p>병원군 비교분석 대시보드 · 데모 모드(목업 데이터)</p>
          <p className="mt-1">
            실제 데이터 연동은{' '}
            <code className="bg-slate-100 px-1 rounded">.env.local</code>에
            Supabase 정보를 입력하세요
          </p>
        </footer>
      </main>
    </div>
  )
}
