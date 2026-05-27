'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  GroupTab,
  MetricField,
  CategoryConfig,
  HOSPITAL_GROUP_VALUES,
  OUR_HOSPITAL_CODE,
} from '@/lib/metrics-config'

// ── 에러 타입 ─────────────────────────────────────────────────────────
export interface SupabaseErrorDetail {
  step:     string
  message:  string
  code?:    string
  details?: string | null
  hint?:    string | null
  raw:      string
  type:     ErrorType
}
export type ErrorType = 'rls' | 'table' | 'column' | 'auth' | 'network' | 'unknown'

function classifyError(message: string, code?: string): ErrorType {
  const m = message.toLowerCase(); const c = (code ?? '').toLowerCase()
  if (c === '42501' || m.includes('row-level security') || m.includes('rls')) return 'rls'
  if (c === '42p01' || (m.includes('does not exist') && m.includes('relation'))) return 'table'
  if (c === '42703' || (m.includes('does not exist') && m.includes('column'))) return 'column'
  if (m.includes('allowlist') || m.includes('invalid api key') || m.includes('jwt')) return 'auth'
  if (m.includes('networkerror') || m.includes('failed to fetch') || m.includes('econnrefused')) return 'network'
  return 'unknown'
}

export function parseSupabaseError(e: unknown, step: string): SupabaseErrorDetail {
  if (e instanceof Error)
    return { step, message: e.message, raw: e.message, type: classifyError(e.message) }
  if (typeof e === 'object' && e !== null) {
    const sb      = e as Record<string, unknown>
    const message = String(sb.message ?? sb.msg ?? '알 수 없는 오류')
    const code    = sb.code    != null ? String(sb.code)    : undefined
    const details = sb.details != null ? String(sb.details) : undefined
    const hint    = sb.hint    != null ? String(sb.hint)    : undefined
    let raw = ''; try { raw = JSON.stringify(e, null, 2) } catch { raw = String(e) }
    return { step, message, code, details, hint, raw, type: classifyError(message, code) }
  }
  const msg = String(e)
  return { step, message: msg, raw: msg, type: classifyError(msg) }
}

export const ERROR_TYPE_LABELS: Record<ErrorType, { label: string; color: string; icon: string }> = {
  rls:     { label: 'RLS(행 보안) 차단', color: 'text-purple-700 bg-purple-50 border-purple-200', icon: '🔒' },
  table:   { label: '테이블 없음',       color: 'text-red-700 bg-red-50 border-red-200',          icon: '🗄️' },
  column:  { label: '컬럼명 불일치',     color: 'text-amber-700 bg-amber-50 border-amber-200',    icon: '📋' },
  auth:    { label: '인증/키 오류',      color: 'text-rose-700 bg-rose-50 border-rose-200',       icon: '🔑' },
  network: { label: '네트워크 오류',     color: 'text-slate-700 bg-slate-50 border-slate-200',    icon: '📡' },
  unknown: { label: '알 수 없는 오류',   color: 'text-gray-700 bg-gray-50 border-gray-200',       icon: '❓' },
}

// ── 공용 타입 ─────────────────────────────────────────────────────────
export type MetricValues = Record<string, number | null>

export interface TableRow {
  id:            string
  name:          string
  type:          string
  isOurHospital: boolean
  isAverage:     boolean
  current:       MetricValues
  prevMonth:     MetricValues
  prevYear:      MetricValues
}

export interface ChartSeries {
  name:   string
  color:  string
  values: MetricValues
}

interface DashboardData {
  tableRows:      TableRow[]
  chartSeries:    ChartSeries[]
  isLoading:      boolean
  error:          SupabaseErrorDetail | null
  refetch:        () => void
  activeMetrics:  MetricField[]
  isAutoDetected: false
  detectedSchema: null
}

// ── 색상 ──────────────────────────────────────────────────────────────
const COLORS = {
  ourHospital: '#3b82f6',
  tertiary:    '#10b981',
  general:     '#f59e0b',
  average:     '#6366f1',
}

// ── /api/db 호출 헬퍼 ─────────────────────────────────────────────────
interface DbResponse {
  ok:       boolean
  rows?:    Record<string, unknown>[]
  columns?: string[]
  count?:   number
  error?:   { message: string; code?: string; details?: string; hint?: string; raw?: string }
}

async function dbFetch(params: Record<string, string | number>): Promise<DbResponse> {
  const qs  = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString()
  const res = await fetch(`/api/db?${qs}`)
  try { return await res.json() as DbResponse }
  catch { return { ok: false, error: { message: `HTTP ${res.status}` } } }
}

// ── 평균 계산 ──────────────────────────────────────────────────────────
function calcAvg(rows: MetricValues[], key: string): number | null {
  const vals = rows
    .map(r => r[key])
    .filter((v): v is number => typeof v === 'number' && !isNaN(v))
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

// ── 병원별 메트릭 행 파싱 ─────────────────────────────────────────────
// DB의 long-format 행들을 병원 코드별로 집계
interface HospitalEntry {
  code:          string
  name:          string
  group:         string
  isOurHospital: boolean
  current:       MetricValues
  prevMonth:     MetricValues
  prevYear:      MetricValues
}

function buildHospitalMap(rows: Record<string, unknown>[]): Map<string, HospitalEntry> {
  const map = new Map<string, HospitalEntry>()

  for (const row of rows) {
    const code = String(row['hospital_code'] ?? '')
    if (!code) continue

    if (!map.has(code)) {
      map.set(code, {
        code,
        name:          String(row['hospital_name'] ?? ''),
        group:         String(row['hospital_group'] ?? ''),
        isOurHospital: row['is_our_hospital'] === true || code === OUR_HOSPITAL_CODE,
        current:   {},
        prevMonth: {},
        prevYear:  {},
      })
    }

    const entry      = map.get(code)!
    const metricName = String(row['metric_name'] ?? '')
    if (!metricName) continue

    // sub_category가 있으면 '일반' 우선; 이미 값이 있으면 '일반'만 덮어쓰기
    const subCat    = row['sub_category'] as string | null
    const existsKey = metricName in entry.current
    if (existsKey && subCat && subCat !== '일반') continue

    const cur   = row['current_month_value']   as number | null ?? null
    const prev  = row['previous_month_value']  as number | null ?? null
    const prevY = row['previous_year_value']   as number | null ?? null
    const mom   = row['mom_change']            as number | null ?? null
    const yoy   = row['yoy_change']            as number | null ?? null

    entry.current[metricName]   = cur
    // previous_month_value 없으면 mom_change로 역산
    entry.prevMonth[metricName] = prev !== null ? prev
      : (cur !== null && mom !== null ? cur - mom : null)
    // previous_year_value 없으면 yoy_change로 역산
    entry.prevYear[metricName]  = prevY !== null ? prevY
      : (cur !== null && yoy !== null ? cur - yoy : null)
  }

  return map
}

// ── 메인 훅 ──────────────────────────────────────────────────────────
export function useDashboardData(
  year:     number,
  month:    number,
  groupTab: GroupTab,
  category: CategoryConfig,
): DashboardData {
  const [tableRows,    setTableRows]    = useState<TableRow[]>([])
  const [chartSeries,  setChartSeries]  = useState<ChartSeries[]>([])
  const [isLoading,    setLoading]      = useState(true)
  const [error,        setError]        = useState<SupabaseErrorDetail | null>(null)
  const [activeMetrics, setActiveMetrics] = useState<MetricField[]>(category.metrics)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // source_month 형식: 'YYYY-MM'
      const sourceMonth = `${year}-${String(month).padStart(2, '0')}`

      // hospital_group 필터 결정
      const hospitalGroup =
        groupTab === 'all' ? undefined : HOSPITAL_GROUP_VALUES[groupTab]

      // ── hospital_metrics 조회 ────────────────────────────────────
      const params: Record<string, string> = {
        table:         'hospital_metrics',
        sourceMonth,
        majorCategory: category.dbCategory,
        limit:         '5000',
      }
      if (hospitalGroup) params.hospitalGroup = hospitalGroup

      const res = await dbFetch(params)

      if (!res.ok || res.error) {
        const err = res.error!
        setError({
          step:    `hospital_metrics (${sourceMonth} / ${category.dbCategory})`,
          message: err.message,
          code:    err.code,
          details: err.details,
          hint:    err.hint,
          raw:     err.raw ?? JSON.stringify(err),
          type:    classifyError(err.message, err.code),
        })
        setLoading(false)
        return
      }

      const rows = (res.rows ?? []) as Record<string, unknown>[]
      console.log(`[useDashboardData] ${sourceMonth} / ${category.dbCategory}: ${rows.length}행`)
      if (rows[0]) console.log('[useDashboardData] 컬럼:', Object.keys(rows[0]))

      if (!rows.length) {
        setTableRows([])
        setChartSeries([])
        setActiveMetrics(category.metrics)
        setLoading(false)
        return
      }

      // ── 병원별 집계 ──────────────────────────────────────────────
      const hospitalMap = buildHospitalMap(rows)
      const hospitals   = Array.from(hospitalMap.values())

      // 우리병원 최상단 → 이후 가나다순
      hospitals.sort((a, b) => {
        if (a.isOurHospital && !b.isOurHospital) return -1
        if (!a.isOurHospital && b.isOurHospital) return 1
        return a.name.localeCompare(b.name, 'ko')
      })

      const metrics  = category.metrics
      const metaKeys = metrics.map(m => m.key)

      // ── 그룹 평균 ────────────────────────────────────────────────
      const nonAvgHospitals = hospitals // 평균 제외 (이미 is_our_hospital 아닌 그룹)
      const avgCurrent:   MetricValues = {}
      const avgPrevMonth: MetricValues = {}
      const avgPrevYear:  MetricValues = {}

      for (const key of metaKeys) {
        avgCurrent[key]   = calcAvg(nonAvgHospitals.map(h => h.current),   key)
        avgPrevMonth[key] = calcAvg(nonAvgHospitals.map(h => h.prevMonth), key)
        avgPrevYear[key]  = calcAvg(nonAvgHospitals.map(h => h.prevYear),  key)
      }

      const avgLabel =
        groupTab === 'tertiary' ? '상급종합병원 평균'
        : groupTab === 'general' ? '종합병원 평균'
        : '전체 평균'

      // ── 테이블 행 구성 ───────────────────────────────────────────
      const tableRowsData: TableRow[] = [
        ...hospitals.map(h => ({
          id:            h.code,
          name:          h.name,
          type:          h.group,
          isOurHospital: h.isOurHospital,
          isAverage:     false,
          current:       h.current,
          prevMonth:     h.prevMonth,
          prevYear:      h.prevYear,
        })),
        {
          id:            '__avg__',
          name:          avgLabel,
          type:          hospitalGroup ?? '전체',
          isOurHospital: false,
          isAverage:     true,
          current:       avgCurrent,
          prevMonth:     avgPrevMonth,
          prevYear:      avgPrevYear,
        },
      ]

      // ── 차트 시리즈 ──────────────────────────────────────────────
      const ourHospital = hospitals.find(h => h.isOurHospital)

      const chartSeriesData: ChartSeries[] = []

      if (ourHospital) {
        const vals: MetricValues = {}
        for (const key of metaKeys) vals[key] = ourHospital.current[key] ?? null
        chartSeriesData.push({
          name:   `우리병원 (${ourHospital.name})`,
          color:  COLORS.ourHospital,
          values: vals,
        })
      }

      {
        const vals: MetricValues = {}
        for (const key of metaKeys) vals[key] = avgCurrent[key] ?? null
        chartSeriesData.push({
          name:   avgLabel,
          color:  groupTab === 'general' ? COLORS.general : COLORS.tertiary,
          values: vals,
        })
      }

      setTableRows(tableRowsData)
      setChartSeries(chartSeriesData)
      setActiveMetrics(metrics)

    } catch (e) {
      const err = parseSupabaseError(e, '데이터 조회 오류')
      console.error('[useDashboardData]', err.raw)
      setError(err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, groupTab, category.key])

  useEffect(() => { fetchData() }, [fetchData])

  return {
    tableRows,
    chartSeries,
    isLoading,
    error,
    refetch:        fetchData,
    activeMetrics,
    isAutoDetected: false,
    detectedSchema: null,
  }
}
