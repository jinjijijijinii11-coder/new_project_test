'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  SCHEMA,
  HOSPITAL_TYPE_VALUES,
  OUR_HOSPITAL_KEYWORD,
  GroupTab,
  MetricField,
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

export type ErrorType =
  | 'rls'
  | 'table'
  | 'column'
  | 'auth'
  | 'network'
  | 'unknown'

export function parseSupabaseError(e: unknown, step: string): SupabaseErrorDetail {
  if (e instanceof Error) {
    return { step, message: e.message, raw: e.message, type: classifyError(e.message, undefined) }
  }
  if (typeof e === 'object' && e !== null) {
    const sb = e as Record<string, unknown>
    const message = String(sb.message ?? sb.msg ?? '알 수 없는 오류')
    const code    = sb.code    != null ? String(sb.code)    : undefined
    const details = sb.details != null ? String(sb.details) : undefined
    const hint    = sb.hint    != null ? String(sb.hint)    : undefined
    let raw = ''
    try { raw = JSON.stringify(e, null, 2) } catch { raw = String(e) }
    return { step, message, code, details, hint, raw, type: classifyError(message, code) }
  }
  const msg = String(e)
  return { step, message: msg, raw: msg, type: classifyError(msg, undefined) }
}

function classifyError(message: string, code?: string): ErrorType {
  const m = message.toLowerCase()
  const c = (code ?? '').toLowerCase()
  if (c === '42501' || m.includes('row-level security') || m.includes('rls')) return 'rls'
  if (c === '42p01' || (m.includes('does not exist') && m.includes('relation'))) return 'table'
  if (c === '42703' || (m.includes('does not exist') && m.includes('column'))) return 'column'
  if (m.includes('allowlist') || m.includes('invalid api key') || m.includes('jwt') || m.includes('invalid_token')) return 'auth'
  if (m.includes('networkerror') || m.includes('failed to fetch') || m.includes('econnrefused')) return 'network'
  return 'unknown'
}

export const ERROR_TYPE_LABELS: Record<ErrorType, { label: string; color: string; icon: string }> = {
  rls:     { label: 'RLS(행 보안) 차단',   color: 'text-purple-700 bg-purple-50 border-purple-200', icon: '🔒' },
  table:   { label: '테이블 없음',         color: 'text-red-700 bg-red-50 border-red-200',          icon: '🗄️' },
  column:  { label: '컬럼명 불일치',       color: 'text-amber-700 bg-amber-50 border-amber-200',    icon: '📋' },
  auth:    { label: '인증/키 오류',        color: 'text-rose-700 bg-rose-50 border-rose-200',       icon: '🔑' },
  network: { label: '네트워크 오류',       color: 'text-slate-700 bg-slate-50 border-slate-200',    icon: '📡' },
  unknown: { label: '알 수 없는 오류',     color: 'text-gray-700 bg-gray-50 border-gray-200',       icon: '❓' },
}

// ── 공용 타입 ─────────────────────────────────────────────────────────
export interface MetricValues { [k: string]: number | null }

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
  /** 실제로 렌더링에 사용된 지표 목록 (설정값 또는 자동 감지값) */
  activeMetrics:  MetricField[]
  /** 자동 감지로 폴백된 경우 true */
  isAutoDetected: boolean
}

const COLORS = {
  ourHospital: '#3b82f6',
  tertiary:    '#10b981',
  general:     '#f59e0b',
}

function prevMonthOf(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

function avg(rows: MetricValues[], key: string): number | null {
  const vals = rows.map(r => r[key]).filter((v): v is number => typeof v === 'number')
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

function toMetricValues(row: Record<string, unknown> | null): MetricValues {
  if (!row) return {}
  const r: MetricValues = {}
  for (const [k, v] of Object.entries(row)) {
    r[k] = typeof v === 'number' ? v : null
  }
  return r
}

// ── 컬럼명 자동 감지 ─────────────────────────────────────────────────

/**
 * hospital_master 첫 번째 행에서 ID / NAME / TYPE 컬럼을 감지.
 * 설정값(SCHEMA.MASTER)이 실제 컬럼에 존재하면 그것을 우선 사용.
 */
function detectMasterCols(row: Record<string, unknown>) {
  const cols = Object.keys(row)
  const has  = (c: string) => cols.includes(c)

  // ID: 설정 → 'id' → '_id'로 끝나는 것 → 첫 번째 컬럼
  const idCol = has(SCHEMA.MASTER.ID)
    ? SCHEMA.MASTER.ID
    : (has('id') ? 'id'
    : cols.find(c => c.endsWith('_id') || c === 'code' || c === 'serial' || c === 'no')
    ?? cols[0])

  // NAME: 설정 → 이름 계열 후보 → 긴 문자열 값을 가진 컬럼
  const nameCandidates = [
    SCHEMA.MASTER.NAME,
    'name', 'hospital_name', '병원명', '기관명', '명칭', '이름',
    'hosp_nm', 'inst_nm', 'nm',
  ]
  const nameCol = nameCandidates.find(c => has(c))
    ?? cols.find(c =>
      c !== idCol &&
      typeof row[c] === 'string' &&
      String(row[c]).length > 2
    )
    ?? cols[1]

  // TYPE: 설정 → 종별 계열 후보 → 나머지 문자열 컬럼
  const typeCandidates = [
    SCHEMA.MASTER.TYPE,
    'type', 'hospital_type', '종별', '종별코드', '종류', '구분',
    'category', 'cls', 'class', 'hosp_type',
  ]
  const typeCol = typeCandidates.find(c => has(c))
    ?? cols.find(c =>
      c !== idCol &&
      c !== nameCol &&
      typeof row[c] === 'string'
    )
    ?? cols[2]

  return { idCol, nameCol, typeCol }
}

/**
 * hospital_metrics 첫 번째 행에서 병원 FK 컬럼을 감지.
 */
function detectFkCol(row: Record<string, unknown>): string {
  const cols = Object.keys(row)
  if (cols.includes(SCHEMA.METRICS.HOSPITAL_ID)) return SCHEMA.METRICS.HOSPITAL_ID
  return cols.find(c => c === 'hospital_id')
    ?? cols.find(c => c.endsWith('_id') && c !== 'id')
    ?? cols.find(c => c.includes('hospital') || c.includes('hosp') || c.includes('master'))
    ?? 'hospital_id'
}

/**
 * hospital_metrics 에서 수치형 지표 컬럼 목록 자동 감지.
 * year/month/id/FK 같은 메타 컬럼은 제외.
 */
function discoverNumericCols(row: Record<string, unknown>, exclude: string[]): string[] {
  const excSet = new Set(exclude.map(c => c.toLowerCase()))
  return Object.keys(row).filter(c => {
    if (excSet.has(c.toLowerCase())) return false
    const cl = c.toLowerCase()
    // 메타 컬럼 패턴 제외
    if (['id', 'year', 'month', 'created_at', 'updated_at', 'deleted_at'].includes(cl)) return false
    if (cl.endsWith('_id') || cl.includes('date') || cl.includes('time')) return false
    // 값이 숫자이거나 null (다른 행에서 숫자일 수 있음)
    return typeof row[c] === 'number' || row[c] === null
  })
}

/**
 * 실제 DB 종별 값과 설정값을 매칭.
 * 예) '상급종합병원' ↔ '상급종합', '종합병원' ↔ '종합병원'
 */
function matchTypeValue(
  rows: Record<string, unknown>[],
  typeCol: string,
  keyword: string,
): string | undefined {
  const uniqueVals = [...new Set(rows.map(r => String(r[typeCol] ?? '')))]
  return uniqueVals.find(v => v === keyword)        // 완전 일치
    ?? uniqueVals.find(v => v.startsWith(keyword))  // 접두사 일치
    ?? uniqueVals.find(v => keyword.startsWith(v))  // 반대 방향
    ?? uniqueVals.find(v => v.includes(keyword) || keyword.includes(v)) // 포함
}

// ── /api/db 프록시 호출 헬퍼 ─────────────────────────────────────────
interface DbResponse {
  ok:     boolean
  rows?:  Record<string, unknown>[]
  count?: number
  error?: { message: string; code?: string; details?: string; hint?: string; raw?: string }
}

async function fetchTable(params: Record<string, string | number>): Promise<DbResponse> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString()
  const res = await fetch(`/api/db?${qs}`)
  try {
    return await res.json() as DbResponse
  } catch {
    return { ok: false, error: { message: `HTTP ${res.status} ${res.statusText}` } }
  }
}

// ── 메인 훅 ──────────────────────────────────────────────────────────
export function useDashboardData(
  year:     number,
  month:    number,
  groupTab: GroupTab,
  metrics:  MetricField[],
): DashboardData {
  const [tableRows,      setTableRows]      = useState<TableRow[]>([])
  const [chartSeries,    setChartSeries]    = useState<ChartSeries[]>([])
  const [isLoading,      setLoading]        = useState(true)
  const [error,          setError]          = useState<SupabaseErrorDetail | null>(null)
  const [activeMetrics,  setActiveMetrics]  = useState<MetricField[]>(metrics)
  const [isAutoDetected, setIsAutoDetected] = useState(false)

  const pm         = prevMonthOf(year, month)
  const metricKeys = metrics.map(m => m.key)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // ── STEP 1: hospital_master 조회 ────────────────────────────
      const masterRes = await fetchTable({ table: 'hospital_master', limit: 2000 })

      if (!masterRes.ok || masterRes.error) {
        const err = masterRes.error ?? { message: '알 수 없는 오류' }
        setError({
          step: 'hospital_master 조회', message: err.message, code: err.code,
          details: err.details, hint: err.hint,
          raw: err.raw ?? JSON.stringify(err, null, 2),
          type: classifyError(err.message, err.code),
        })
        return
      }

      const allHospitals = masterRes.rows ?? []
      if (!allHospitals.length) {
        console.warn('[hospital_master] 데이터 0건')
        setTableRows([])
        setChartSeries([])
        setActiveMetrics(metrics)
        return
      }

      // ── 컬럼명 자동 감지 ──────────────────────────────────────
      const { idCol, nameCol, typeCol } = detectMasterCols(allHospitals[0])
      console.log('[schema 감지] master:', { idCol, nameCol, typeCol })

      // 종별 값 자동 매칭 (DB에 '상급종합병원'이 저장돼 있어도 처리)
      const tertiaryVal = matchTypeValue(allHospitals, typeCol, HOSPITAL_TYPE_VALUES.TERTIARY)
      const generalVal  = matchTypeValue(allHospitals, typeCol, HOSPITAL_TYPE_VALUES.GENERAL)
      console.log('[종별 매칭]', { tertiaryVal, generalVal })

      const ourHospital       = allHospitals.find(h => String(h[nameCol] ?? '').includes(OUR_HOSPITAL_KEYWORD))
      const tertiaryHospitals = tertiaryVal ? allHospitals.filter(h => String(h[typeCol] ?? '') === tertiaryVal) : []
      const generalHospitals  = generalVal  ? allHospitals.filter(h => String(h[typeCol] ?? '') === generalVal)  : []

      let displayHospitals: typeof allHospitals
      if (groupTab === 'tertiary') {
        displayHospitals = [...tertiaryHospitals]
        if (ourHospital && !displayHospitals.find(h => h[idCol] === ourHospital[idCol]))
          displayHospitals.push(ourHospital)
      } else if (groupTab === 'general') {
        displayHospitals = [...generalHospitals]
        if (ourHospital && !displayHospitals.find(h => h[idCol] === ourHospital[idCol]))
          displayHospitals.push(ourHospital)
      } else {
        displayHospitals = allHospitals
      }

      const allIds = allHospitals.map(h => String(h[idCol]))

      // ── STEP 2: hospital_metrics 3시점 조회 ────────────────────
      const idList = allIds.join(',')
      const [curRes, pmRes, pyRes] = await Promise.all([
        fetchTable({ table: 'hospital_metrics', year,          month,    limit: 5000, ids: idList, idCol: SCHEMA.METRICS.HOSPITAL_ID }),
        fetchTable({ table: 'hospital_metrics', year: pm.year, month: pm.month, limit: 5000, ids: idList, idCol: SCHEMA.METRICS.HOSPITAL_ID }),
        fetchTable({ table: 'hospital_metrics', year: year - 1, month,  limit: 5000, ids: idList, idCol: SCHEMA.METRICS.HOSPITAL_ID }),
      ])

      if (!curRes.ok || curRes.error) {
        const err = curRes.error ?? { message: '알 수 없는 오류' }
        setError({
          step: `hospital_metrics 조회 (${year}년 ${month}월)`, message: err.message, code: err.code,
          details: err.details, hint: err.hint,
          raw: err.raw ?? JSON.stringify(err, null, 2),
          type: classifyError(err.message, err.code),
        })
        return
      }

      const curRows = (curRes.rows ?? []) as Record<string, unknown>[]
      const pmRows  = (pmRes.rows  ?? []) as Record<string, unknown>[]
      const pyRows  = (pyRes.rows  ?? []) as Record<string, unknown>[]

      // ── FK 컬럼 감지 및 활성 지표 결정 ─────────────────────────
      const firstMetric = curRows[0] ?? pmRows[0] ?? pyRows[0]
      let fkCol: string = SCHEMA.METRICS.HOSPITAL_ID
      let finalMetrics = metrics
      let autoDetected = false

      if (firstMetric) {
        fkCol = detectFkCol(firstMetric)
        console.log('[schema 감지] metrics FK:', fkCol)

        // 설정된 metric keys 중 실제 컬럼에 존재하는 것만 사용
        const existingKeys = metricKeys.filter(k =>
          curRows.some(r => r[k] !== undefined) ||
          pmRows.some(r => r[k] !== undefined)
        )

        if (existingKeys.length > 0) {
          // 일부라도 매칭되면 매칭된 것만 사용
          finalMetrics = metrics.filter(m => existingKeys.includes(m.key))
          console.log('[지표 매칭] 설정값 사용:', existingKeys)
        } else {
          // 하나도 매칭되지 않으면 수치형 컬럼 전체 자동 감지
          const exclude = [fkCol, 'year', 'month', 'id', 'created_at', 'updated_at']
          const numericCols = discoverNumericCols(firstMetric, exclude)
          finalMetrics = numericCols.map(c => ({
            key:   c,
            label: c.replace(/_/g, ' '),
            unit:  '',
          }))
          autoDetected = true
          console.log('[지표 자동 감지]:', numericCols)
        }
      } else {
        // 지표 데이터 자체가 없음 (해당 연월 데이터 없음)
        console.warn(`[hospital_metrics] ${year}년 ${month}월 데이터 없음`)
        finalMetrics = metrics
      }

      setActiveMetrics(finalMetrics)
      setIsAutoDetected(autoDetected)

      const finalKeys = finalMetrics.map(m => m.key)

      // ── STEP 3: Map 구성 ────────────────────────────────────────
      const toMap = (rows: Record<string, unknown>[]) =>
        Object.fromEntries(rows.map(r => [String(r[fkCol]), toMetricValues(r)]))

      const curMap = toMap(curRows)
      const pmMap  = toMap(pmRows)
      const pyMap  = toMap(pyRows)

      // ── STEP 4: 테이블 행 구성 ─────────────────────────────────
      let rows: TableRow[]

      if (groupTab === 'all') {
        const buildAvg = (hospitals: typeof allHospitals) => {
          const cv: MetricValues = {}; const pv: MetricValues = {}; const yv: MetricValues = {}
          for (const k of finalKeys) {
            cv[k] = avg(hospitals.map(h => curMap[String(h[idCol])] ?? {}), k)
            pv[k] = avg(hospitals.map(h => pmMap[String(h[idCol])]  ?? {}), k)
            yv[k] = avg(hospitals.map(h => pyMap[String(h[idCol])]  ?? {}), k)
          }
          return { cv, pv, yv }
        }
        const ta = buildAvg(tertiaryHospitals)
        const ga = buildAvg(generalHospitals)

        rows = [
          ...(ourHospital ? [{
            id: String(ourHospital[idCol]), name: String(ourHospital[nameCol] ?? ''),
            type: String(ourHospital[typeCol] ?? ''), isOurHospital: true, isAverage: false,
            current:   curMap[String(ourHospital[idCol])] ?? {},
            prevMonth: pmMap[String(ourHospital[idCol])]  ?? {},
            prevYear:  pyMap[String(ourHospital[idCol])]  ?? {},
          }] : []),
          { id: '__t__', name: '상급종합병원 평균', type: tertiaryVal ?? HOSPITAL_TYPE_VALUES.TERTIARY,
            isOurHospital: false, isAverage: true, current: ta.cv, prevMonth: ta.pv, prevYear: ta.yv },
          { id: '__g__', name: '종합병원 평균', type: generalVal ?? HOSPITAL_TYPE_VALUES.GENERAL,
            isOurHospital: false, isAverage: true, current: ga.cv, prevMonth: ga.pv, prevYear: ga.yv },
        ]
      } else {
        rows = displayHospitals.map(h => {
          const hid    = String(h[idCol])
          const isOurs = String(h[nameCol] ?? '').includes(OUR_HOSPITAL_KEYWORD)
          return {
            id: hid, name: String(h[nameCol] ?? ''), type: String(h[typeCol] ?? ''),
            isOurHospital: isOurs, isAverage: false,
            current:   curMap[hid] ?? {},
            prevMonth: pmMap[hid]  ?? {},
            prevYear:  pyMap[hid]  ?? {},
          }
        })
        rows.sort((a, b) => {
          if (a.isOurHospital) return -1
          if (b.isOurHospital) return 1
          return a.name.localeCompare(b.name, 'ko')
        })
      }

      setTableRows(rows)

      // ── STEP 5: 차트 시리즈 ────────────────────────────────────
      const buildSeriesValues = (hospitals: typeof allHospitals): MetricValues => {
        const out: MetricValues = {}
        for (const k of finalKeys)
          out[k] = avg(hospitals.map(h => curMap[String(h[idCol])] ?? {}), k)
        return out
      }

      const series: ChartSeries[] = []
      if (ourHospital) {
        series.push({
          name:   `우리병원 (${String(ourHospital[nameCol] ?? '21C')})`,
          color:  COLORS.ourHospital,
          values: curMap[String(ourHospital[idCol])] ?? {},
        })
      }
      if (groupTab === 'tertiary' || groupTab === 'all')
        series.push({ name: '상급종합 평균', color: COLORS.tertiary, values: buildSeriesValues(tertiaryHospitals) })
      if (groupTab === 'general' || groupTab === 'all')
        series.push({ name: '종합병원 평균', color: COLORS.general,  values: buildSeriesValues(generalHospitals) })

      setChartSeries(series)

    } catch (e) {
      const err = parseSupabaseError(e, '알 수 없는 위치')
      console.error('[useDashboardData catch]', err.raw)
      setError(err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, groupTab, metricKeys.join(','), pm.year, pm.month])

  useEffect(() => { fetchData() }, [fetchData])

  return { tableRows, chartSeries, isLoading, error, refetch: fetchData, activeMetrics, isAutoDetected }
}
