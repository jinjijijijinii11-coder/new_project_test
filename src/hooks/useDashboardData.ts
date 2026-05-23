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

// ── 에러 타입 ─────────────────────────────────────────────────────────
export interface SupabaseErrorDetail {
  step:     string           // 어느 쿼리에서 발생했는지
  message:  string
  code?:    string
  details?: string | null
  hint?:    string | null
  raw:      string           // JSON.stringify 전체
  type:     ErrorType
}

export type ErrorType =
  | 'rls'          // Row Level Security 차단
  | 'table'        // 테이블 없음
  | 'column'       // 컬럼명 오류
  | 'auth'         // 키/인증 오류 (allowlist, invalid key)
  | 'network'      // 네트워크 오류
  | 'unknown'

/** Supabase PostgrestError / plain object → 구조화된 에러로 변환 */
export function parseSupabaseError(e: unknown, step: string): SupabaseErrorDetail {
  // 1) JavaScript Error 인스턴스
  if (e instanceof Error) {
    return {
      step, message: e.message, raw: e.message,
      type: classifyError(e.message, undefined),
    }
  }

  // 2) Supabase PostgrestError (plain object with .message)
  if (typeof e === 'object' && e !== null) {
    const sb = e as Record<string, unknown>
    const message = String(sb.message ?? sb.msg ?? '알 수 없는 오류')
    const code    = sb.code    != null ? String(sb.code)    : undefined
    const details = sb.details != null ? String(sb.details) : undefined
    const hint    = sb.hint    != null ? String(sb.hint)    : undefined

    // JSON.stringify 로 전체 직렬화
    let raw = ''
    try { raw = JSON.stringify(e, null, 2) } catch { raw = String(e) }

    return { step, message, code, details, hint, raw, type: classifyError(message, code) }
  }

  // 3) 문자열 / 기타
  const msg = String(e)
  return { step, message: msg, raw: msg, type: classifyError(msg, undefined) }
}

function classifyError(message: string, code?: string): ErrorType {
  const m = message.toLowerCase()
  const c = (code ?? '').toLowerCase()

  if (c === '42501' || m.includes('row-level security') || m.includes('rls'))
    return 'rls'
  if (c === '42p01' || (m.includes('does not exist') && m.includes('relation')))
    return 'table'
  if (c === '42703' || (m.includes('does not exist') && m.includes('column')))
    return 'column'
  if (
    m.includes('allowlist') || m.includes('invalid api key') ||
    m.includes('jwt') || m.includes('invalid_token') || m.includes('api key')
  )
    return 'auth'
  if (m.includes('networkerror') || m.includes('failed to fetch') || m.includes('econnrefused'))
    return 'network'
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
  tableRows:    TableRow[]
  chartSeries:  ChartSeries[]
  isLoading:    boolean
  error:        SupabaseErrorDetail | null
  refetch:      () => void
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

// ── 메인 훅 ──────────────────────────────────────────────────────────
export function useDashboardData(
  year:     number,
  month:    number,
  groupTab: GroupTab,
  metrics:  MetricField[],
): DashboardData {
  const [tableRows,   setTableRows]   = useState<TableRow[]>([])
  const [chartSeries, setChartSeries] = useState<ChartSeries[]>([])
  const [isLoading,   setLoading]     = useState(true)
  const [error,       setError]       = useState<SupabaseErrorDetail | null>(null)

  const pm         = prevMonthOf(year, month)
  const metricKeys = metrics.map(m => m.key)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )

      const N   = SCHEMA.MASTER.NAME
      const T   = SCHEMA.MASTER.TYPE
      const ID  = SCHEMA.MASTER.ID
      const MID = SCHEMA.METRICS.HOSPITAL_ID

      // ── STEP 1: hospital_master ─────────────────────────────────
      const { data: allHospitals, error: masterErr } = await supabase
        .from('hospital_master')
        .select('*')

      if (masterErr) {
        const err = parseSupabaseError(masterErr, 'hospital_master 조회')
        console.error('[hospital_master 오류]', err.raw)
        setError(err)
        return
      }

      if (!allHospitals?.length) {
        console.warn('[hospital_master] 데이터 0건')
        setTableRows([])
        setChartSeries([])
        return
      }

      console.log('[hospital_master]', allHospitals.length, '건', '첫번째 행:', JSON.stringify(allHospitals[0]))

      const ourHospital       = allHospitals.find(h => String(h[N] ?? '').includes(OUR_HOSPITAL_KEYWORD))
      const tertiaryHospitals = allHospitals.filter(h => String(h[T] ?? '') === HOSPITAL_TYPE_VALUES.TERTIARY)
      const generalHospitals  = allHospitals.filter(h => String(h[T] ?? '') === HOSPITAL_TYPE_VALUES.GENERAL)

      let displayHospitals: typeof allHospitals
      if (groupTab === 'tertiary') {
        displayHospitals = [...tertiaryHospitals]
        if (ourHospital && !displayHospitals.find(h => h[ID] === ourHospital[ID]))
          displayHospitals.push(ourHospital)
      } else if (groupTab === 'general') {
        displayHospitals = [...generalHospitals]
        if (ourHospital && !displayHospitals.find(h => h[ID] === ourHospital[ID]))
          displayHospitals.push(ourHospital)
      } else {
        displayHospitals = allHospitals
      }

      const allIds = allHospitals.map(h => h[ID])

      // ── STEP 2: hospital_metrics 3시점 ──────────────────────────
      const [curRes, pmRes, pyRes] = await Promise.all([
        supabase.from('hospital_metrics').select('*')
          .in(MID, allIds).eq(SCHEMA.METRICS.YEAR, year).eq(SCHEMA.METRICS.MONTH, month),
        supabase.from('hospital_metrics').select('*')
          .in(MID, allIds).eq(SCHEMA.METRICS.YEAR, pm.year).eq(SCHEMA.METRICS.MONTH, pm.month),
        supabase.from('hospital_metrics').select('*')
          .in(MID, allIds).eq(SCHEMA.METRICS.YEAR, year - 1).eq(SCHEMA.METRICS.MONTH, month),
      ])

      if (curRes.error) {
        const err = parseSupabaseError(curRes.error, `hospital_metrics 조회 (${year}년 ${month}월)`)
        console.error('[hospital_metrics 오류]', err.raw)
        setError(err)
        return
      }

      console.log('[hospital_metrics]', curRes.data?.length ?? 0, '건', '첫번째 행:', JSON.stringify(curRes.data?.[0]))

      const toMap = (rows: Record<string, unknown>[]) =>
        Object.fromEntries(rows.map(r => [String(r[MID]), toMetricValues(r)]))

      const curMap = toMap((curRes.data  ?? []) as Record<string, unknown>[])
      const pmMap  = toMap((pmRes.data   ?? []) as Record<string, unknown>[])
      const pyMap  = toMap((pyRes.data   ?? []) as Record<string, unknown>[])

      // ── STEP 3: 테이블 행 구성 ─────────────────────────────────
      let rows: TableRow[]

      if (groupTab === 'all') {
        const buildAvg = (hospitals: typeof allHospitals) => {
          const cv: MetricValues = {}; const pv: MetricValues = {}; const yv: MetricValues = {}
          for (const k of metricKeys) {
            cv[k] = avg(hospitals.map(h => curMap[String(h[ID])] ?? {}), k)
            pv[k] = avg(hospitals.map(h => pmMap[String(h[ID])]  ?? {}), k)
            yv[k] = avg(hospitals.map(h => pyMap[String(h[ID])]  ?? {}), k)
          }
          return { cv, pv, yv }
        }
        const ta = buildAvg(tertiaryHospitals)
        const ga = buildAvg(generalHospitals)

        rows = [
          ...(ourHospital ? [{
            id: String(ourHospital[ID]), name: String(ourHospital[N] ?? ''),
            type: String(ourHospital[T] ?? ''), isOurHospital: true, isAverage: false,
            current: curMap[String(ourHospital[ID])] ?? {},
            prevMonth: pmMap[String(ourHospital[ID])] ?? {},
            prevYear:  pyMap[String(ourHospital[ID])] ?? {},
          }] : []),
          { id: '__t__', name: '상급종합병원 평균', type: HOSPITAL_TYPE_VALUES.TERTIARY,
            isOurHospital: false, isAverage: true, current: ta.cv, prevMonth: ta.pv, prevYear: ta.yv },
          { id: '__g__', name: '종합병원 평균', type: HOSPITAL_TYPE_VALUES.GENERAL,
            isOurHospital: false, isAverage: true, current: ga.cv, prevMonth: ga.pv, prevYear: ga.yv },
        ]
      } else {
        rows = displayHospitals.map(h => {
          const hid   = String(h[ID])
          const isOurs = String(h[N] ?? '').includes(OUR_HOSPITAL_KEYWORD)
          return {
            id: hid, name: String(h[N] ?? ''), type: String(h[T] ?? ''),
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

      // ── STEP 4: 차트 시리즈 ────────────────────────────────────
      const buildSeriesValues = (hospitals: typeof allHospitals): MetricValues => {
        const out: MetricValues = {}
        for (const k of metricKeys)
          out[k] = avg(hospitals.map(h => curMap[String(h[ID])] ?? {}), k)
        return out
      }

      const series: ChartSeries[] = []
      if (ourHospital) {
        series.push({
          name: `우리병원 (${String(ourHospital[N] ?? '21C')})`,
          color: COLORS.ourHospital,
          values: curMap[String(ourHospital[ID])] ?? {},
        })
      }
      if (groupTab === 'tertiary' || groupTab === 'all')
        series.push({ name: '상급종합 평균', color: COLORS.tertiary, values: buildSeriesValues(tertiaryHospitals) })
      if (groupTab === 'general' || groupTab === 'all')
        series.push({ name: '종합병원 평균', color: COLORS.general,  values: buildSeriesValues(generalHospitals) })

      setChartSeries(series)
    } catch (e) {
      // 예상치 못한 예외 – 무조건 JSON 직렬화
      const err = parseSupabaseError(e, '알 수 없는 위치')
      console.error('[useDashboardData catch]', err.raw)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [year, month, groupTab, metricKeys.join(','), pm.year, pm.month])

  useEffect(() => { fetchData() }, [fetchData])
  return { tableRows, chartSeries, isLoading, error, refetch: fetchData }
}
