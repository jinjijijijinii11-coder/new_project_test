'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  GroupTab,
  MetricField,
  CategoryConfig,
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
  const m = message.toLowerCase()
  const c = (code ?? '').toLowerCase()
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
  group:         string
  isOurHospital: boolean
  isAverage:     boolean
  current:       MetricValues   // metric_name → current_month_value
  prevMonth:     MetricValues   // metric_name → current - mom_change
  prevYear:      MetricValues   // metric_name → current - yoy_change
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
}

// ── hospital_group DB 값 ──────────────────────────────────────────────
const GROUP_DB: Record<Exclude<GroupTab, 'all'>, string> = {
  tertiary: '상급종합병원',
  general:  '종합병원',
}

// ── /api/db 호출 ──────────────────────────────────────────────────────
interface DbResponse {
  ok:       boolean
  rows?:    Record<string, unknown>[]
  columns?: string[]
  count?:   number
  error?:   { message: string; code?: string; details?: string; hint?: string; raw?: string }
}

async function dbFetch(params: Record<string, string>): Promise<DbResponse> {
  const qs  = new URLSearchParams(params).toString()
  const res = await fetch(`/api/db?${qs}`)
  try { return await res.json() as DbResponse }
  catch { return { ok: false, error: { message: `HTTP ${res.status}`, raw: '' } } }
}

// ── 수치 추출 ──────────────────────────────────────────────────────────
function toNum(v: unknown): number | null {
  if (typeof v === 'number' && !isNaN(v)) return v
  if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? null : n }
  return null
}

// ── 평균 계산 ──────────────────────────────────────────────────────────
function calcAvg(rows: MetricValues[], key: string): number | null {
  const vals = rows.map(r => r[key]).filter((v): v is number => typeof v === 'number')
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

// ── 병원별 집계 (long-format → wide-format) ───────────────────────────
// 실제 DB 컬럼: hospital_code, hospital_group, hospital_name, is_our_hospital,
//              major_category, metric_name, current_month_value, mom_change, yoy_change
interface HospitalEntry {
  code:          string
  name:          string
  group:         string
  isOurHospital: boolean
  current:   MetricValues
  prevMonth: MetricValues
  prevYear:  MetricValues
}

function buildHospitalMap(rows: Record<string, unknown>[]): Map<string, HospitalEntry> {
  const map = new Map<string, HospitalEntry>()

  for (const row of rows) {
    const code = String(row['hospital_code'] ?? '').trim()
    if (!code) continue

    if (!map.has(code)) {
      map.set(code, {
        code,
        name:          String(row['hospital_name'] ?? ''),
        group:         String(row['hospital_group'] ?? ''),
        isOurHospital: !!row['is_our_hospital'] || code === OUR_HOSPITAL_CODE,
        current:   {},
        prevMonth: {},
        prevYear:  {},
      })
    }

    const entry      = map.get(code)!
    const metricName = String(row['metric_name'] ?? '').trim()
    if (!metricName) continue

    if (metricName in entry.current) continue  // 첫 번째 값 유지

    const cur = toNum(row['current_month_value'])
    const mom = toNum(row['mom_change'])
    const yoy = toNum(row['yoy_change'])

    entry.current[metricName]   = cur
    entry.prevMonth[metricName] = (cur !== null && mom !== null) ? cur - mom : null
    entry.prevYear[metricName]  = (cur !== null && yoy !== null) ? cur - yoy : null
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
  const [tableRows,     setTableRows]     = useState<TableRow[]>([])
  const [chartSeries,   setChartSeries]   = useState<ChartSeries[]>([])
  const [isLoading,     setLoading]       = useState(true)
  const [error,         setError]         = useState<SupabaseErrorDetail | null>(null)
  const [activeMetrics, setActiveMetrics] = useState<MetricField[]>(category.metrics)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const sourceMonth = `${year}-${String(month).padStart(2, '0')}`

      // ── 전체 조회 (hospital_group 필터 없이) ─────────────────────
      // 클라이언트에서 그룹 + 본원 합산 필터링
      const params: Record<string, string> = {
        table:         'hospital_metrics',
        sourceMonth,
        majorCategory: category.dbCategory,
        limit:         '5000',
      }

      console.log('[대시보드] 조회 파라미터:', params)
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
      console.log(`[대시보드] 전체 조회 결과: ${rows.length}행`)
      if (rows.length > 0) console.log('[대시보드] 샘플:', JSON.stringify(rows[0]))

      if (!rows.length) {
        setTableRows([])
        setChartSeries([])
        setActiveMetrics(category.metrics)
        setLoading(false)
        return
      }

      // ── 병원별 집계 ──────────────────────────────────────────────
      const hospitalMap = buildHospitalMap(rows)
      const allHospitals = Array.from(hospitalMap.values())
      const ourHospital  = allHospitals.find(h => h.isOurHospital)

      // ── 탭별 표시 병원 결정 ──────────────────────────────────────
      // 규칙: 상급종합병원/종합병원 탭 → 해당 그룹 + 본원(21C) 항상 포함
      //       전체 탭 → 전체 병원
      let displayHospitals: HospitalEntry[]

      if (groupTab === 'all') {
        displayHospitals = allHospitals
      } else {
        const groupValue    = GROUP_DB[groupTab]
        const groupHospitals = allHospitals.filter(h => h.group === groupValue)
        const ourAlreadyIn  = ourHospital && groupHospitals.some(h => h.code === ourHospital.code)

        displayHospitals = ourHospital && !ourAlreadyIn
          ? [...groupHospitals, ourHospital]
          : groupHospitals
      }

      // 본원 최상단, 이후 가나다순
      displayHospitals.sort((a, b) => {
        if (a.isOurHospital && !b.isOurHospital) return -1
        if (!a.isOurHospital && b.isOurHospital) return 1
        return a.name.localeCompare(b.name, 'ko')
      })

      console.log(`[대시보드] 표시 병원 ${displayHospitals.length}곳:`, displayHospitals.map(h => h.name))

      const metrics  = category.metrics
      const metaKeys = metrics.map(m => m.key)

      // ── 그룹 평균 (displayHospitals 기준) ────────────────────────
      const avgCurrent:   MetricValues = {}
      const avgPrevMonth: MetricValues = {}
      const avgPrevYear:  MetricValues = {}

      for (const key of metaKeys) {
        avgCurrent[key]   = calcAvg(displayHospitals.map(h => h.current),   key)
        avgPrevMonth[key] = calcAvg(displayHospitals.map(h => h.prevMonth), key)
        avgPrevYear[key]  = calcAvg(displayHospitals.map(h => h.prevYear),  key)
      }

      const avgLabel =
        groupTab === 'tertiary' ? '상급종합병원 평균'
        : groupTab === 'general' ? '종합병원 평균'
        : '전체 평균'

      // ── 테이블 행 ────────────────────────────────────────────────
      const tableRowsData: TableRow[] = [
        ...displayHospitals.map(h => ({
          id:            h.code,
          name:          h.name,
          group:         h.group,
          isOurHospital: h.isOurHospital,
          isAverage:     false,
          current:       h.current,
          prevMonth:     h.prevMonth,
          prevYear:      h.prevYear,
        })),
        {
          id:            '__avg__',
          name:          avgLabel,
          group:         groupTab === 'all' ? '전체' : GROUP_DB[groupTab],
          isOurHospital: false,
          isAverage:     true,
          current:       avgCurrent,
          prevMonth:     avgPrevMonth,
          prevYear:      avgPrevYear,
        },
      ]

      // ── 차트 시리즈 ──────────────────────────────────────────────
      const chartSeriesData: ChartSeries[] = []

      if (ourHospital) {
        const vals: MetricValues = {}
        for (const key of metaKeys) vals[key] = ourHospital.current[key] ?? null
        chartSeriesData.push({
          name:   `본원 (${ourHospital.name})`,
          color:  COLORS.ourHospital,
          values: vals,
        })
      }

      const avgVals: MetricValues = {}
      for (const key of metaKeys) avgVals[key] = avgCurrent[key] ?? null
      chartSeriesData.push({
        name:   avgLabel,
        color:  groupTab === 'general' ? COLORS.general : COLORS.tertiary,
        values: avgVals,
      })

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
