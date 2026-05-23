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
export type ErrorType = 'rls' | 'table' | 'column' | 'auth' | 'network' | 'unknown'

export function parseSupabaseError(e: unknown, step: string): SupabaseErrorDetail {
  if (e instanceof Error)
    return { step, message: e.message, raw: e.message, type: classifyError(e.message, undefined) }
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
  return { step, message: msg, raw: msg, type: classifyError(msg, undefined) }
}

function classifyError(message: string, code?: string): ErrorType {
  const m = message.toLowerCase(); const c = (code ?? '').toLowerCase()
  if (c === '42501' || m.includes('row-level security') || m.includes('rls')) return 'rls'
  if (c === '42p01' || (m.includes('does not exist') && m.includes('relation'))) return 'table'
  if (c === '42703' || (m.includes('does not exist') && m.includes('column'))) return 'column'
  if (m.includes('allowlist') || m.includes('invalid api key') || m.includes('jwt')) return 'auth'
  if (m.includes('networkerror') || m.includes('failed to fetch') || m.includes('econnrefused')) return 'network'
  return 'unknown'
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
  name:  string
  color: string
  values: MetricValues
}

/** 자동 감지된 실제 DB 스키마 정보 */
export interface DetectedSchema {
  master: {
    columns:  string[]
    idCol:    string
    nameCol:  string
    typeCol:  string
  }
  metrics: {
    columns:     string[]
    fkCol:       string
    yearCol:     string
    monthCol:    string
    numericCols: string[]
  }
  typeValues: {
    all:      string[]
    tertiary: string | null
    general:  string | null
  }
}

interface DashboardData {
  tableRows:      TableRow[]
  chartSeries:    ChartSeries[]
  isLoading:      boolean
  error:          SupabaseErrorDetail | null
  refetch:        () => void
  activeMetrics:  MetricField[]
  isAutoDetected: boolean
  detectedSchema: DetectedSchema | null
}

// ── 색상 ──────────────────────────────────────────────────────────────
const COLORS = {
  ourHospital: '#3b82f6',
  tertiary:    '#10b981',
  general:     '#f59e0b',
}

// ── 유틸 ──────────────────────────────────────────────────────────────
function prevMonthOf(y: number, m: number) {
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 }
}

function avg(rows: MetricValues[], key: string): number | null {
  const vals = rows.map(r => r[key]).filter((v): v is number => typeof v === 'number')
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

function toMetricValues(row: Record<string, unknown> | null): MetricValues {
  if (!row) return {}
  const r: MetricValues = {}
  for (const [k, v] of Object.entries(row)) r[k] = typeof v === 'number' ? v : null
  return r
}

// ── /api/db 호출 헬퍼 ────────────────────────────────────────────────
interface DbResponse {
  ok:      boolean
  rows?:   Record<string, unknown>[]
  columns?: string[]
  count?:  number
  error?:  { message: string; code?: string; details?: string; hint?: string; raw?: string }
}

async function dbFetch(params: Record<string, string | number>): Promise<DbResponse> {
  const qs  = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
  const res = await fetch(`/api/db?${qs}`)
  try { return await res.json() as DbResponse }
  catch { return { ok: false, error: { message: `HTTP ${res.status}` } } }
}

// ── 컬럼명 감지 ───────────────────────────────────────────────────────

/** 후보 목록에서 실제 컬럼 집합에 있는 첫 번째를 반환 */
function pick(cols: Set<string>, candidates: string[]): string | undefined {
  return candidates.find(c => cols.has(c))
}

/**
 * hospital_master 스키마 감지.
 * 우선순위: 설정값 → 알려진 이름 목록 → 값 기반 휴리스틱
 */
function detectMasterSchema(
  rows: Record<string, unknown>[],
): { idCol: string; nameCol: string; typeCol: string } {
  if (!rows.length) return { idCol: SCHEMA.MASTER.ID, nameCol: SCHEMA.MASTER.NAME, typeCol: SCHEMA.MASTER.TYPE }

  const colSet = new Set(Object.keys(rows[0]))

  // ── ID 컬럼 ─────────────────────────────────────────────────────
  const idCol = pick(colSet, [
    SCHEMA.MASTER.ID,
    'id', 'ykiho',
    '기관코드', '병원코드', '요양기관번호', '기관번호', '병원번호', '기관ID', '병원ID',
    'inst_cd', 'hosp_cd', 'org_cd', 'code', 'seq', 'no',
  ])
  // 휴리스틱: 고유값이 rows.length인 컬럼 (= PK 특성)
  ?? [...colSet].find(c => {
    const vals = rows.map(r => String(r[c] ?? ''))
    return new Set(vals).size === rows.length
  })
  ?? [...colSet][0]

  // ── NAME 컬럼 ────────────────────────────────────────────────────
  const nameCol = pick(colSet, [
    SCHEMA.MASTER.NAME,
    'name', 'yadmnm',
    '기관명', '병원명', '요양기관명', '기관명칭', '의료기관명', '시설명', '명칭', '이름',
    'hospital_name', 'hosp_nm', 'inst_nm', 'org_nm', 'nm',
  ])
  // 휴리스틱: id가 아니면서, 2자 이상 한글/영문 문자열 값을 가진 컬럼
  ?? [...colSet].find(c => {
    if (c === idCol) return false
    const sample = rows.slice(0, 5).map(r => String(r[c] ?? ''))
    const avg    = sample.reduce((a, v) => a + v.length, 0) / sample.length
    return avg >= 2 && sample.some(v => /[가-힣a-zA-Z]/.test(v))
  })
  ?? [...colSet][1]

  // ── TYPE 컬럼 ────────────────────────────────────────────────────
  const typeCol = pick(colSet, [
    SCHEMA.MASTER.TYPE,
    'type', 'clCd', 'clcd', 'cl_cd',
    '종별코드', '종별', '종류', '구분', '병원종별', '의료기관종별',
    '병원구분', '기관구분', '분류', '유형', '기관유형',
    'hospital_type', 'hosp_type', 'category', 'cls', 'class', 'type_cd', 'typecd',
  ])
  // 휴리스틱: id/name이 아니면서, 고유값이 2~30개인 컬럼 (카테고리형)
  ?? [...colSet].find(c => {
    if (c === idCol || c === nameCol) return false
    const uniq = new Set(rows.map(r => String(r[c] ?? '')))
    return uniq.size >= 2 && uniq.size <= 30
  })
  ?? [...colSet][2]

  return { idCol, nameCol, typeCol }
}

/**
 * hospital_metrics 스키마 감지.
 */
function detectMetricsSchema(
  rows: Record<string, unknown>[],
  masterIdCol: string,
): { fkCol: string; yearCol: string; monthCol: string; numericCols: string[] } {
  const colSet = rows.length ? new Set(Object.keys(rows[0])) : new Set<string>()

  const fkCol = pick(colSet, [
    SCHEMA.METRICS.HOSPITAL_ID,
    'hospital_id', 'ykiho',
    '기관코드', '병원코드', '요양기관번호', '기관번호', '병원번호', '기관ID', '병원ID',
    masterIdCol,                     // master의 PK와 같은 이름이면 사용
    'hosp_cd', 'inst_cd', 'org_cd',
  ])
  ?? [...colSet].find(c => c.endsWith('_id') && c !== 'id')
  ?? [...colSet].find(c => /병원|기관|hosp|inst/.test(c))
  ?? SCHEMA.METRICS.HOSPITAL_ID

  const yearCol = pick(colSet, [
    SCHEMA.METRICS.YEAR,
    'year', '연도', '년도', '기준연도', 'yr', 'YEAR',
  ]) ?? 'year'

  const monthCol = pick(colSet, [
    SCHEMA.METRICS.MONTH,
    'month', '월', '기준월', 'mon', 'mm', 'MONTH',
  ]) ?? 'month'

  // 수치형 지표 컬럼: 메타 컬럼 제외
  const metaCols = new Set([fkCol, yearCol, monthCol, 'id', 'created_at', 'updated_at', 'deleted_at'])
  const numericCols = rows.length
    ? Object.keys(rows[0]).filter(c => {
        if (metaCols.has(c)) return false
        const cl = c.toLowerCase()
        if (cl.endsWith('_id') || cl.includes('date') || cl.includes('time')) return false
        // 숫자이거나 null
        return rows.slice(0, 3).some(r => typeof r[c] === 'number' || r[c] === null)
      })
    : []

  return { fkCol, yearCol, monthCol, numericCols }
}

/**
 * 종별 값 매칭 (퍼지: '상급종합' ↔ '상급종합병원', '01' 등)
 */
function matchTypeVal(uniqueVals: string[], keywords: string[]): string | null {
  for (const kw of keywords) {
    const found = uniqueVals.find(v => v === kw)
      ?? uniqueVals.find(v => v.startsWith(kw) || kw.startsWith(v))
      ?? uniqueVals.find(v => v.includes(kw) || kw.includes(v))
    if (found) return found
  }
  return null
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
  const [detectedSchema, setDetectedSchema] = useState<DetectedSchema | null>(null)

  const pm = prevMonthOf(year, month)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PHASE 1: 스키마 Probe — limit=1로 컬럼 구조만 파악
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const [masterProbe, metricsProbe] = await Promise.all([
        dbFetch({ table: 'hospital_master',  limit: 1 }),
        dbFetch({ table: 'hospital_metrics', limit: 1 }),
      ])

      if (!masterProbe.ok || masterProbe.error) {
        const err = masterProbe.error!
        setError({ step: 'hospital_master probe', message: err.message, code: err.code,
          details: err.details, hint: err.hint,
          raw: err.raw ?? JSON.stringify(err), type: classifyError(err.message, err.code) })
        return
      }

      const probeRows    = masterProbe.rows ?? []
      const masterSchema = detectMasterSchema(probeRows)
      const metricsRows  = metricsProbe.rows ?? []
      const metricsSchema = detectMetricsSchema(metricsRows, masterSchema.idCol)

      console.log('[스키마 감지] master  :', masterSchema)
      console.log('[스키마 감지] metrics :', metricsSchema)
      console.log('[스키마 감지] master 컬럼 :', masterProbe.columns)
      console.log('[스키마 감지] metrics 컬럼:', metricsProbe.columns)

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PHASE 2: hospital_master 전체 조회
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const masterRes = await dbFetch({ table: 'hospital_master', limit: 2000 })
      if (!masterRes.ok || masterRes.error) {
        const err = masterRes.error!
        setError({ step: 'hospital_master 조회', message: err.message, code: err.code,
          details: err.details, hint: err.hint,
          raw: err.raw ?? JSON.stringify(err), type: classifyError(err.message, err.code) })
        return
      }

      const allHospitals = masterRes.rows ?? []
      if (!allHospitals.length) {
        setTableRows([]); setChartSeries([]); setActiveMetrics(metrics)
        return
      }

      const { idCol, nameCol, typeCol } = masterSchema

      // 종별 값 자동 매칭
      const uniqueTypes = [...new Set(allHospitals.map(h => String(h[typeCol] ?? '')))]
      const tertiaryVal = matchTypeVal(uniqueTypes, ['상급종합병원', '상급종합', '01', '1'])
      const generalVal  = matchTypeVal(uniqueTypes, ['종합병원', '11', '2'])

      console.log('[종별 값 목록]', uniqueTypes)
      console.log('[종별 매칭]', { tertiaryVal, generalVal })

      // 스키마 정보 UI에 노출
      const schema: DetectedSchema = {
        master:  { columns: masterProbe.columns ?? [], ...masterSchema },
        metrics: { columns: metricsProbe.columns ?? [], ...metricsSchema },
        typeValues: { all: uniqueTypes, tertiary: tertiaryVal, general: generalVal },
      }
      setDetectedSchema(schema)

      const ourHospital = allHospitals.find(
        h => String(h[nameCol] ?? '').includes(OUR_HOSPITAL_KEYWORD)
      )
      const tertiaryHospitals = tertiaryVal
        ? allHospitals.filter(h => String(h[typeCol] ?? '') === tertiaryVal) : []
      const generalHospitals  = generalVal
        ? allHospitals.filter(h => String(h[typeCol] ?? '') === generalVal)  : []

      // displayHospitals 결정 (타입 매칭 실패 시 전체 표시)
      let displayHospitals: typeof allHospitals
      if (groupTab === 'tertiary') {
        displayHospitals = tertiaryHospitals.length ? tertiaryHospitals : allHospitals
        if (ourHospital && !displayHospitals.find(h => h[idCol] === ourHospital[idCol]))
          displayHospitals = [ourHospital, ...displayHospitals]
      } else if (groupTab === 'general') {
        displayHospitals = generalHospitals.length ? generalHospitals : allHospitals
        if (ourHospital && !displayHospitals.find(h => h[idCol] === ourHospital[idCol]))
          displayHospitals = [ourHospital, ...displayHospitals]
      } else {
        displayHospitals = allHospitals
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PHASE 3: hospital_metrics 3시점 조회
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const allIds = allHospitals.map(h => String(h[idCol]))
      const idList = allIds.join(',')
      const { fkCol, yearCol, monthCol } = metricsSchema

      const [curRes, pmRes, pyRes] = await Promise.all([
        dbFetch({ table: 'hospital_metrics', year,          month,    limit: 5000,
                  yearCol, monthCol, ids: idList, idCol: fkCol }),
        dbFetch({ table: 'hospital_metrics', year: pm.year, month: pm.month, limit: 5000,
                  yearCol, monthCol, ids: idList, idCol: fkCol }),
        dbFetch({ table: 'hospital_metrics', year: year - 1, month,  limit: 5000,
                  yearCol, monthCol, ids: idList, idCol: fkCol }),
      ])

      if (!curRes.ok || curRes.error) {
        const err = curRes.error!
        setError({ step: `hospital_metrics (${year}년 ${month}월)`, message: err.message, code: err.code,
          details: err.details, hint: err.hint,
          raw: err.raw ?? JSON.stringify(err), type: classifyError(err.message, err.code) })
        return
      }

      const curRows = (curRes.rows ?? []) as Record<string, unknown>[]
      const pmRows  = (pmRes.rows  ?? []) as Record<string, unknown>[]
      const pyRows  = (pyRes.rows  ?? []) as Record<string, unknown>[]

      console.log('[hospital_metrics] 현재월:', curRows.length, '건, 전월:', pmRows.length, '건, 전년:', pyRows.length, '건')
      if (curRows[0]) console.log('[hospital_metrics] 첫행 컬럼:', Object.keys(curRows[0]))

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PHASE 4: 활성 지표 결정
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const allMetricRows = [...curRows, ...pmRows, ...pyRows]
      const metricKeys    = metrics.map(m => m.key)

      // 설정값과 실제 컬럼 교집합
      const matched = metricKeys.filter(k =>
        allMetricRows.some(r => r[k] !== undefined)
      )

      let finalMetrics: MetricField[]
      let autoDetected = false

      if (matched.length > 0) {
        // 설정값 일부라도 매칭
        finalMetrics = metrics.filter(m => matched.includes(m.key))
        console.log('[지표 매칭] 설정값 사용:', matched)
      } else if (metricsSchema.numericCols.length > 0) {
        // 완전 불일치 → 수치형 컬럼 자동 감지
        finalMetrics = metricsSchema.numericCols.map(c => ({
          key:   c,
          label: c.replace(/_/g, ' '),
          unit:  '',
        }))
        autoDetected = true
        console.log('[지표 자동 감지]:', metricsSchema.numericCols)
      } else {
        finalMetrics = metrics
      }

      setActiveMetrics(finalMetrics)
      setIsAutoDetected(autoDetected)

      const finalKeys = finalMetrics.map(m => m.key)

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PHASE 5: 데이터 맵 구성 + 테이블 행 + 차트 시리즈
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const toMap = (rows: Record<string, unknown>[]) =>
        Object.fromEntries(rows.map(r => [String(r[fkCol]), toMetricValues(r)]))

      const curMap = toMap(curRows)
      const pmMap  = toMap(pmRows)
      const pyMap  = toMap(pyRows)

      // 테이블 행
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
        const ta = buildAvg(tertiaryHospitals.length ? tertiaryHospitals : allHospitals)
        const ga = buildAvg(generalHospitals.length  ? generalHospitals  : [])

        rows = [
          ...(ourHospital ? [{
            id: String(ourHospital[idCol]), name: String(ourHospital[nameCol] ?? ''),
            type: String(ourHospital[typeCol] ?? ''), isOurHospital: true, isAverage: false,
            current:   curMap[String(ourHospital[idCol])] ?? {},
            prevMonth: pmMap[String(ourHospital[idCol])]  ?? {},
            prevYear:  pyMap[String(ourHospital[idCol])]  ?? {},
          }] : []),
          { id: '__t__', name: '상급종합병원 평균', type: tertiaryVal ?? '상급종합',
            isOurHospital: false, isAverage: true, current: ta.cv, prevMonth: ta.pv, prevYear: ta.yv },
          ...(generalHospitals.length ? [{
            id: '__g__', name: '종합병원 평균', type: generalVal ?? '종합병원',
            isOurHospital: false, isAverage: true, current: ga.cv, prevMonth: ga.pv, prevYear: ga.yv,
          }] : []),
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
          if (b.isOurHospital) return  1
          return a.name.localeCompare(b.name, 'ko')
        })
      }
      setTableRows(rows)

      // 차트 시리즈
      const buildVals = (hospitals: typeof allHospitals): MetricValues => {
        const out: MetricValues = {}
        for (const k of finalKeys)
          out[k] = avg(hospitals.map(h => curMap[String(h[idCol])] ?? {}), k)
        return out
      }

      const series: ChartSeries[] = []
      if (ourHospital)
        series.push({ name: `우리병원 (${String(ourHospital[nameCol] ?? '21C')})`,
          color: COLORS.ourHospital, values: curMap[String(ourHospital[idCol])] ?? {} })
      if (groupTab === 'tertiary' || groupTab === 'all')
        series.push({ name: '상급종합 평균', color: COLORS.tertiary,
          values: buildVals(tertiaryHospitals.length ? tertiaryHospitals : allHospitals) })
      if (groupTab === 'general' || groupTab === 'all')
        series.push({ name: '종합병원 평균', color: COLORS.general,
          values: buildVals(generalHospitals) })

      setChartSeries(series)

    } catch (e) {
      const err = parseSupabaseError(e, '알 수 없는 위치')
      console.error('[useDashboardData]', err.raw)
      setError(err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, groupTab, metrics.map(m => m.key).join(','), pm.year, pm.month])

  useEffect(() => { fetchData() }, [fetchData])

  return { tableRows, chartSeries, isLoading, error, refetch: fetchData,
           activeMetrics, isAutoDetected, detectedSchema }
}
