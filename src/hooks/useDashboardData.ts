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
  overall:     '#8b5cf6',
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

// ── % 지표 판별 ──────────────────────────────────────────────────────
function isPercentMetric(name: string): boolean {
  return /율$|률$/.test(name)
}

// ── DB rows → MetricField[] (display_order 정렬) ──────────────────────
function extractMetrics(rows: Record<string, unknown>[]): MetricField[] {
  const seen = new Map<string, MetricField>()
  for (const row of rows) {
    const metricName   = String(row['metric_name']   ?? '').trim()
    if (!metricName) continue
    const subCat       = String(row['sub_category']  ?? '').trim()
    const labelPath    = String(row['label_path']    ?? '').trim()
    const displayOrder = Number(row['display_order'] ?? 9999)
    const key = subCat ? `${metricName}||${subCat}` : metricName
    if (!seen.has(key)) {
      seen.set(key, {
        key,
        label:        labelPath || (subCat ? `${metricName} (${subCat})` : metricName),
        isPercent:    isPercentMetric(metricName),
        displayOrder,
      })
    }
  }
  return Array.from(seen.values())
    .sort((a, b) => (a.displayOrder ?? 9999) - (b.displayOrder ?? 9999))
}

// ── 병원별 집계 (long-format → wide-format) ───────────────────────────
// 실제 DB 컬럼: hospital_code, hospital_group, hospital_name, is_our_hospital,
//              major_category, metric_name, sub_category, label_path, display_order,
//              current_month_value, mom_change, yoy_change
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

    // sub_category 가 있으면 복합 키 사용 (중복 방지)
    const subCat    = String(row['sub_category'] ?? '').trim()
    const metricKey = subCat ? `${metricName}||${subCat}` : metricName

    if (metricKey in entry.current) continue  // 첫 번째 값 유지

    const cur = toNum(row['current_month_value'])
    const mom = toNum(row['mom_change'])
    const yoy = toNum(row['yoy_change'])

    entry.current[metricKey]   = cur
    entry.prevMonth[metricKey] = (cur !== null && mom !== null) ? cur - mom : null
    entry.prevYear[metricKey]  = (cur !== null && yoy !== null) ? cur - yoy : null
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

      // ── 그룹별 분류 ──────────────────────────────────────────────
      const tertiaryHospitals = allHospitals.filter(h => h.group === GROUP_DB.tertiary)
      const generalHospitals  = allHospitals.filter(h => h.group === GROUP_DB.general)

      // ── DB rows에서 지표 목록 자동 추출 (display_order 정렬) ─────
      const dynamicMetrics = extractMetrics(rows)
      const metrics  = dynamicMetrics.length > 0 ? dynamicMetrics : category.metrics
      const metaKeys = metrics.map(m => m.key)

      // ── 그룹별 평균 계산 ──────────────────────────────────────────
      const computeAvg = (list: HospitalEntry[]) => {
        const cur: MetricValues = {}
        const pm:  MetricValues = {}
        const py:  MetricValues = {}
        for (const key of metaKeys) {
          cur[key] = calcAvg(list.map(h => h.current),   key)
          pm[key]  = calcAvg(list.map(h => h.prevMonth), key)
          py[key]  = calcAvg(list.map(h => h.prevYear),  key)
        }
        return { cur, pm, py }
      }

      const tertiaryAvg = computeAvg(tertiaryHospitals)
      const generalAvg  = computeAvg(generalHospitals)
      const overallAvg  = computeAvg(allHospitals)

      // ── 탭별 표시 병원 결정 ──────────────────────────────────────
      // 규칙: 상급종합병원/종합병원 탭 → 해당 그룹 + 본원(21C) 항상 포함
      //       전체 탭 → 전체 병원
      let displayHospitals: HospitalEntry[]

      if (groupTab === 'all') {
        displayHospitals = allHospitals
      } else {
        const groupValue     = GROUP_DB[groupTab]
        const groupHospitals = allHospitals.filter(h => h.group === groupValue)
        const ourAlreadyIn   = ourHospital && groupHospitals.some(h => h.code === ourHospital.code)
        displayHospitals = ourHospital && !ourAlreadyIn
          ? [...groupHospitals, ourHospital]
          : groupHospitals
      }

      // ── 테이블 행: 본원 → 평균 → 나머지 병원(가나다순) ──────────
      const ourRow    = displayHospitals.find(h => h.isOurHospital)
      const otherRows = displayHospitals
        .filter(h => !h.isOurHospital)
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'))

      console.log(`[대시보드] 표시 병원 ${displayHospitals.length}곳:`, displayHospitals.map(h => h.name))

      // 평균 행 생성 헬퍼
      const makeAvgRow = (
        id: string, name: string, group: string,
        avg: { cur: MetricValues; pm: MetricValues; py: MetricValues },
      ): TableRow => ({
        id, name, group,
        isOurHospital: false,
        isAverage:     true,
        current:       avg.cur,
        prevMonth:     avg.pm,
        prevYear:      avg.py,
      })

      // 탭별 평균 행
      let avgTableRows: TableRow[]
      if (groupTab === 'all') {
        avgTableRows = [
          ...(tertiaryHospitals.length > 0
            ? [makeAvgRow('__avg_tertiary__', '상급종합병원 평균', GROUP_DB.tertiary, tertiaryAvg)]
            : []),
          ...(generalHospitals.length > 0
            ? [makeAvgRow('__avg_general__',  '종합병원 평균',     GROUP_DB.general,  generalAvg)]
            : []),
          makeAvgRow('__avg_all__', '전체 평균', '전체', overallAvg),
        ]
      } else if (groupTab === 'tertiary') {
        avgTableRows = [makeAvgRow('__avg_tertiary__', '상급종합병원 평균', GROUP_DB.tertiary, tertiaryAvg)]
      } else {
        avgTableRows = [makeAvgRow('__avg_general__',  '종합병원 평균',     GROUP_DB.general,  generalAvg)]
      }

      // ── 테이블 행 ────────────────────────────────────────────────
      const tableRowsData: TableRow[] = [
        // 1. 본원
        ...(ourRow ? [{
          id:            ourRow.code,
          name:          ourRow.name,
          group:         ourRow.group,
          isOurHospital: true,
          isAverage:     false,
          current:       ourRow.current,
          prevMonth:     ourRow.prevMonth,
          prevYear:      ourRow.prevYear,
        }] : []),
        // 2. 평균 행 (탭별)
        ...avgTableRows,
        // 3. 나머지 병원 (가나다순)
        ...otherRows.map(h => ({
          id:            h.code,
          name:          h.name,
          group:         h.group,
          isOurHospital: false,
          isAverage:     false,
          current:       h.current,
          prevMonth:     h.prevMonth,
          prevYear:      h.prevYear,
        })),
      ]

      // ── 차트 시리즈 ──────────────────────────────────────────────
      const chartSeriesData: ChartSeries[] = []

      // 본원
      if (ourHospital) {
        const vals: MetricValues = {}
        for (const key of metaKeys) vals[key] = ourHospital.current[key] ?? null
        chartSeriesData.push({
          name:   `본원 (${ourHospital.name})`,
          color:  COLORS.ourHospital,
          values: vals,
        })
      }

      // 탭별 그룹 평균 시리즈
      if (groupTab === 'all') {
        if (tertiaryHospitals.length > 0)
          chartSeriesData.push({ name: '상급종합병원 평균', color: COLORS.tertiary, values: tertiaryAvg.cur })
        if (generalHospitals.length > 0)
          chartSeriesData.push({ name: '종합병원 평균',     color: COLORS.general,  values: generalAvg.cur })
        chartSeriesData.push(  { name: '전체 평균',         color: COLORS.overall,  values: overallAvg.cur })
      } else if (groupTab === 'tertiary') {
        chartSeriesData.push(  { name: '상급종합병원 평균', color: COLORS.tertiary, values: tertiaryAvg.cur })
      } else {
        chartSeriesData.push(  { name: '종합병원 평균',     color: COLORS.general,  values: generalAvg.cur })
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
