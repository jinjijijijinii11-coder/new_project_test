'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  SCHEMA,
  HOSPITAL_TYPE_VALUES,
  OUR_HOSPITAL_KEYWORD,
  GroupTab,
  MetricField,
} from '@/lib/metrics-config'

// ── 공용 타입 ─────────────────────────────────────────────────────────
export interface MetricValues {
  [columnKey: string]: number | null
}

export interface TableRow {
  id:            string
  name:          string
  type:          string
  isOurHospital: boolean
  isAverage:     boolean      // "그룹 평균" 합산 행
  current:       MetricValues
  prevMonth:     MetricValues
  prevYear:      MetricValues
}

export interface ChartSeries {
  name:  string              // 우리병원 | 상급종합 평균 | 종합병원 평균
  color: string
  values: MetricValues       // key = MetricField.key, value = 수치
}

interface DashboardData {
  tableRows:    TableRow[]
  chartSeries:  ChartSeries[]
  isLoading:    boolean
  error:        string | null
  refetch:      () => void
}

// ── 색상 정의 ─────────────────────────────────────────────────────────
const COLORS = {
  ourHospital: '#3b82f6',    // 파랑 – 우리병원
  tertiary:    '#10b981',    // 초록 – 상급종합 평균
  general:     '#f59e0b',    // 주황 – 종합병원 평균
}

// ── 헬퍼: 이전 월 계산 ───────────────────────────────────────────────
function prevMonthOf(year: number, month: number) {
  return month === 1
    ? { year: year - 1, month: 12 }
    : { year,           month: month - 1 }
}

// ── 헬퍼: 숫자 평균 ──────────────────────────────────────────────────
function avg(rows: MetricValues[], key: string): number | null {
  const vals = rows
    .map(r => r[key])
    .filter((v): v is number => typeof v === 'number')
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

// ── 헬퍼: MetricValues 로 변환 ────────────────────────────────────────
function toMetricValues(row: Record<string, unknown> | null): MetricValues {
  if (!row) return {}
  const result: MetricValues = {}
  for (const [k, v] of Object.entries(row)) {
    result[k] = typeof v === 'number' ? v : null
  }
  return result
}

// ── 메인 훅 ──────────────────────────────────────────────────────────
export function useDashboardData(
  year:     number,
  month:    number,
  groupTab: GroupTab,
  metrics:  MetricField[],   // 현재 선택된 카테고리의 지표 목록
): DashboardData {
  const [tableRows,   setTableRows]   = useState<TableRow[]>([])
  const [chartSeries, setChartSeries] = useState<ChartSeries[]>([])
  const [isLoading,   setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  const pm = prevMonthOf(year, month)
  const metricKeys = metrics.map(m => m.key)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )

      // ── 1. 병원 마스터 조회 ─────────────────────────────────────
      const { data: allHospitals, error: masterErr } = await supabase
        .from('hospital_master')
        .select('*')

      if (masterErr) throw masterErr
      if (!allHospitals?.length) {
        setTableRows([])
        setChartSeries([])
        return
      }

      const N  = SCHEMA.MASTER.NAME
      const T  = SCHEMA.MASTER.TYPE
      const ID = SCHEMA.MASTER.ID
      const MID = SCHEMA.METRICS.HOSPITAL_ID

      const ourHospital = allHospitals.find(h =>
        String(h[N] ?? '').includes(OUR_HOSPITAL_KEYWORD)
      )

      // 탭에 따른 표시 대상 필터
      const tertiaryHospitals = allHospitals.filter(
        h => String(h[T] ?? '') === HOSPITAL_TYPE_VALUES.TERTIARY
      )
      const generalHospitals  = allHospitals.filter(
        h => String(h[T] ?? '') === HOSPITAL_TYPE_VALUES.GENERAL
      )

      let displayHospitals: typeof allHospitals
      if (groupTab === 'tertiary') {
        displayHospitals = [...tertiaryHospitals]
        // 우리병원이 상급종합이 아니어도 추가
        if (ourHospital && !displayHospitals.find(h => h[ID] === ourHospital[ID])) {
          displayHospitals.push(ourHospital)
        }
      } else if (groupTab === 'general') {
        displayHospitals = [...generalHospitals]
        if (ourHospital && !displayHospitals.find(h => h[ID] === ourHospital[ID])) {
          displayHospitals.push(ourHospital)
        }
      } else {
        // 전체: 우리병원 + 두 그룹 평균은 계산으로 생성하므로 전체 필요
        displayHospitals = allHospitals
      }

      const allIds = allHospitals.map(h => h[ID])

      // ── 2. 지표 3개 시점 조회 ───────────────────────────────────
      const [curRes, pmRes, pyRes] = await Promise.all([
        supabase
          .from('hospital_metrics')
          .select('*')
          .in(MID, allIds)
          .eq(SCHEMA.METRICS.YEAR, year)
          .eq(SCHEMA.METRICS.MONTH, month),
        supabase
          .from('hospital_metrics')
          .select('*')
          .in(MID, allIds)
          .eq(SCHEMA.METRICS.YEAR, pm.year)
          .eq(SCHEMA.METRICS.MONTH, pm.month),
        supabase
          .from('hospital_metrics')
          .select('*')
          .in(MID, allIds)
          .eq(SCHEMA.METRICS.YEAR, year - 1)
          .eq(SCHEMA.METRICS.MONTH, month),
      ])

      if (curRes.error) throw curRes.error

      // ── 3. ID → MetricValues 맵 빌드 ───────────────────────────
      const toMap = (rows: Record<string, unknown>[]) =>
        Object.fromEntries(rows.map(r => [String(r[MID]), toMetricValues(r)]))

      const curMap = toMap((curRes.data  ?? []) as Record<string, unknown>[])
      const pmMap  = toMap((pmRes.data   ?? []) as Record<string, unknown>[])
      const pyMap  = toMap((pyRes.data   ?? []) as Record<string, unknown>[])

      // ── 4. 테이블 행 생성 ───────────────────────────────────────
      let rows: TableRow[]

      if (groupTab === 'all') {
        // 전체 탭: 우리병원 + 상급종합 평균 + 종합병원 평균
        const buildAvg = (hospitals: typeof allHospitals, keys: string[]) => {
          const curVals: MetricValues = {}
          const pmVals:  MetricValues = {}
          const pyVals:  MetricValues = {}
          for (const k of keys) {
            curVals[k] = avg(hospitals.map(h => curMap[String(h[ID])] ?? {}), k)
            pmVals[k]  = avg(hospitals.map(h => pmMap[String(h[ID])]  ?? {}), k)
            pyVals[k]  = avg(hospitals.map(h => pyMap[String(h[ID])]  ?? {}), k)
          }
          return { curVals, pmVals, pyVals }
        }

        const tAvg = buildAvg(tertiaryHospitals, metricKeys)
        const gAvg = buildAvg(generalHospitals,  metricKeys)

        rows = [
          // 우리병원
          ...(ourHospital ? [{
            id:            String(ourHospital[ID]),
            name:          String(ourHospital[N] ?? ''),
            type:          String(ourHospital[T] ?? ''),
            isOurHospital: true,
            isAverage:     false,
            current:       curMap[String(ourHospital[ID])] ?? {},
            prevMonth:     pmMap[String(ourHospital[ID])]  ?? {},
            prevYear:      pyMap[String(ourHospital[ID])]  ?? {},
          }] : []),
          // 상급종합 평균
          {
            id:            '__tertiary_avg__',
            name:          '상급종합병원 평균',
            type:          HOSPITAL_TYPE_VALUES.TERTIARY,
            isOurHospital: false,
            isAverage:     true,
            current:       tAvg.curVals,
            prevMonth:     tAvg.pmVals,
            prevYear:      tAvg.pyVals,
          },
          // 종합병원 평균
          {
            id:            '__general_avg__',
            name:          '종합병원 평균',
            type:          HOSPITAL_TYPE_VALUES.GENERAL,
            isOurHospital: false,
            isAverage:     true,
            current:       gAvg.curVals,
            prevMonth:     gAvg.pmVals,
            prevYear:      gAvg.pyVals,
          },
        ]
      } else {
        rows = displayHospitals.map(h => {
          const hid = String(h[ID])
          const isOurs = String(h[N] ?? '').includes(OUR_HOSPITAL_KEYWORD)
          return {
            id:            hid,
            name:          String(h[N] ?? ''),
            type:          String(h[T] ?? ''),
            isOurHospital: isOurs,
            isAverage:     false,
            current:       curMap[hid] ?? {},
            prevMonth:     pmMap[hid]  ?? {},
            prevYear:      pyMap[hid]  ?? {},
          }
        })
        // 우리병원 최상단 정렬
        rows.sort((a, b) => {
          if (a.isOurHospital) return -1
          if (b.isOurHospital) return 1
          return a.name.localeCompare(b.name, 'ko')
        })
      }

      setTableRows(rows)

      // ── 5. 차트 시리즈 생성 ────────────────────────────────────
      const buildSeriesValues = (
        hospitals: typeof allHospitals,
      ): MetricValues => {
        const out: MetricValues = {}
        for (const k of metricKeys) {
          out[k] = avg(hospitals.map(h => curMap[String(h[ID])] ?? {}), k)
        }
        return out
      }

      const series: ChartSeries[] = []

      // 우리병원 시리즈
      if (ourHospital) {
        series.push({
          name:   `우리병원 (${String(ourHospital[N] ?? '21C')})`,
          color:  COLORS.ourHospital,
          values: curMap[String(ourHospital[ID])] ?? {},
        })
      }

      // 그룹 평균 시리즈
      if (groupTab === 'tertiary' || groupTab === 'all') {
        series.push({
          name:   '상급종합 평균',
          color:  COLORS.tertiary,
          values: buildSeriesValues(tertiaryHospitals),
        })
      }
      if (groupTab === 'general' || groupTab === 'all') {
        series.push({
          name:   '종합병원 평균',
          color:  COLORS.general,
          values: buildSeriesValues(generalHospitals),
        })
      }

      setChartSeries(series)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [year, month, groupTab, metricKeys.join(','), pm.year, pm.month])

  useEffect(() => { fetchData() }, [fetchData])

  return { tableRows, chartSeries, isLoading, error, refetch: fetchData }
}
