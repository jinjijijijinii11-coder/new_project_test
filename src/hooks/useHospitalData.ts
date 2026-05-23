'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  GroupSummary,
  MonthlyTrend,
  RegionDistribution,
  MetricKey,
  HospitalType,
} from '@/types/hospital'
import {
  MOCK_GROUP_SUMMARY,
  MOCK_MONTHLY_OUTPATIENT,
  MOCK_MONTHLY_REVENUE,
  MOCK_MONTHLY_BED_OCCUPANCY,
  MOCK_KPI,
  MOCK_REGION_DISTRIBUTION,
} from '@/lib/mock-data'

// ⚠️ 이 훅은 더 이상 사용되지 않습니다.
// 메인 대시보드는 src/hooks/useDashboardData.ts 를 사용합니다.
// This file is kept for reference only.
const USE_REAL_DATA = false

interface KpiData {
  totalHospitals:  { value: number; change: number; unit: string }
  totalBeds:       { value: number; change: number; unit: string }
  avgOccupancy:    { value: number; change: number; unit: string }
  totalOutpatient: { value: number; change: number; unit: string }
}

interface HospitalDataState {
  kpi:               KpiData
  groupSummary:      GroupSummary[]
  monthlyTrend:      MonthlyTrend[]
  regionDistribution: RegionDistribution[]
  isLoading:         boolean
  error:             string | null
  refetch:           () => void
}

export function useHospitalData(
  year: number,
  metric: MetricKey,
  selectedTypes: HospitalType[],
): HospitalDataState {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [kpi, setKpi]             = useState<KpiData>(MOCK_KPI)
  const [groupSummary, setGroupSummary] = useState<GroupSummary[]>([])
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([])
  const [regionDistribution, setRegionDistribution] = useState<RegionDistribution[]>([])

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (USE_REAL_DATA) {
        // TODO: Supabase 쿼리로 교체
        // const { data, error } = await supabase
        //   .from('hospital_stats')
        //   .select('*, hospitals(*)')
        //   .eq('year', year)
        // if (error) throw error
        throw new Error('Supabase 연결을 설정해주세요.')
      }

      // 목업 데이터 사용 (300ms 딜레이로 실제 API 흉내)
      await new Promise(r => setTimeout(r, 300))

      const trendMap: Record<MetricKey, MonthlyTrend[]> = {
        outpatient_count:   MOCK_MONTHLY_OUTPATIENT,
        inpatient_count:    MOCK_MONTHLY_OUTPATIENT.map(d => ({
          ...d, ...Object.fromEntries(
            ['상급종합','종합병원','병원','의원','요양병원'].map(t => [t, Math.round(Number(d[t] ?? 0) * 0.047)])
          )
        })),
        surgery_count:      MOCK_MONTHLY_OUTPATIENT.map(d => ({
          ...d, ...Object.fromEntries(
            ['상급종합','종합병원','병원','의원','요양병원'].map(t => [t, Math.round(Number(d[t] ?? 0) * 0.018)])
          )
        })),
        revenue:            MOCK_MONTHLY_REVENUE,
        avg_stay_days:      MOCK_MONTHLY_BED_OCCUPANCY.map(d => ({
          ...d,
          '상급종합': 8.4, '종합병원': 7.1, '병원': 12.6, '의원': 0, '요양병원': 104.2,
        })),
        bed_occupancy_rate: MOCK_MONTHLY_BED_OCCUPANCY,
      }

      setKpi(MOCK_KPI)
      setGroupSummary(
        MOCK_GROUP_SUMMARY.filter(g =>
          selectedTypes.length === 0 || selectedTypes.includes(g.type)
        )
      )
      setMonthlyTrend(trendMap[metric] ?? MOCK_MONTHLY_OUTPATIENT)
      setRegionDistribution(MOCK_REGION_DISTRIBUTION)
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터를 불러오는 데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [year, metric, selectedTypes])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { kpi, groupSummary, monthlyTrend, regionDistribution, isLoading, error, refetch: fetchData }
}
