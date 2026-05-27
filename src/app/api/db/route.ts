/**
 * 서버사이드 DB 프록시 API
 *
 * GET /api/db?table=hospital_metrics&sourceMonth=2025-09&majorCategory=응급실&hospitalGroup=상급종합병원
 * GET /api/db?table=hospital_master&limit=5
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, hasServiceKey } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const table         = searchParams.get('table')
  const limit         = Number(searchParams.get('limit') ?? 5000)

  // ── hospital_metrics 전용 필터 ────────────────────────────────
  const sourceMonth   = searchParams.get('sourceMonth')   // 'YYYY-MM' 형식
  const majorCategory = searchParams.get('majorCategory') // major_category 값
  const hospitalGroup = searchParams.get('hospitalGroup') // hospital_group 값

  // ── 레거시 파라미터 (hospital_master 직접 조회 등) ─────────────
  const year     = searchParams.get('year')
  const month    = searchParams.get('month')
  const yearCol  = searchParams.get('yearCol')  ?? 'year'
  const monthCol = searchParams.get('monthCol') ?? 'month'
  const idList   = searchParams.get('ids')
  const idCol    = searchParams.get('idCol')

  if (!table) {
    return NextResponse.json({ error: 'table 파라미터 필요' }, { status: 400 })
  }

  // ── distinct 단일 컬럼 조회 ──────────────────────────────────────────
  const distinct = searchParams.get('distinct')  // e.g. 'source_month'
  if (distinct) {
    const supabase = createServerClient()
    try {
      const { data, error } = await supabase
        .from(table)
        .select(distinct)
        .limit(10000)
      if (error) {
        const raw = JSON.stringify(error, null, 2)
        return NextResponse.json({ ok: false, error: { message: error.message, raw } }, { status: 500 })
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const values = [...new Set((data ?? []).map(r => (r as any)[distinct] as string))]
        .filter(v => v != null && v !== '')
        .sort()
      return NextResponse.json({ ok: true, values })
    } catch (e) {
      return NextResponse.json({ ok: false, error: { message: String(e), raw: String(e) } }, { status: 500 })
    }
  }

  const supabase = createServerClient()

  try {
    let query = supabase.from(table).select('*', { count: 'exact' })

    // ── source_month 필터 (문자열 'YYYY-MM') ──────────────────────
    if (sourceMonth) query = query.eq('source_month', sourceMonth)

    // ── major_category 필터 ───────────────────────────────────────
    if (majorCategory) query = query.eq('major_category', majorCategory)

    // ── hospital_group 필터 ───────────────────────────────────────
    if (hospitalGroup) query = query.eq('hospital_group', hospitalGroup)

    // ── 레거시: 연도/월 정수 필터 ─────────────────────────────────
    if (year && !sourceMonth)  query = query.eq(yearCol,  Number(year))
    if (month && !sourceMonth) query = query.eq(monthCol, Number(month))

    // ── ID 목록 필터 ───────────────────────────────────────────────
    if (idList && idCol) {
      const ids = idList.split(',').filter(Boolean)
      if (ids.length > 0) query = query.in(idCol, ids)
    }

    query = query.limit(limit)

    const { data, error, count } = await query

    if (error) {
      let raw = ''
      try { raw = JSON.stringify(error, null, 2) } catch { raw = String(error) }
      console.error('[/api/db ' + table + ']', raw)
      return NextResponse.json(
        { ok: false, error: { message: error.message, code: (error as any).code, details: (error as any).details, hint: (error as any).hint, raw } },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok:              true,
      table,
      count,
      rows:            data,
      columns:         data?.[0] ? Object.keys(data[0]) : [],
      has_service_key: hasServiceKey,
    })
  } catch (e: unknown) {
    let raw = ''
    try { raw = JSON.stringify(e, null, 2) } catch { raw = String(e) }
    console.error('[/api/db ' + table + ' exception]', raw)
    return NextResponse.json({ ok: false, error: { message: String(e), raw } }, { status: 500 })
  }
}
