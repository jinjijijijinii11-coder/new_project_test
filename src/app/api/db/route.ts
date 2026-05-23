/**
 * 서버사이드 DB 프록시 API
 *
 * GET /api/db?table=hospital_master&limit=5
 * GET /api/db?table=hospital_metrics&year=2025&month=9&yearCol=연도&monthCol=월&ids=1,2&idCol=병원코드
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, hasServiceKey } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const table    = searchParams.get('table')
  const year     = searchParams.get('year')
  const month    = searchParams.get('month')
  // yearCol / monthCol: 실제 DB 컬럼명 (기본값 'year' / 'month')
  const yearCol  = searchParams.get('yearCol')  ?? 'year'
  const monthCol = searchParams.get('monthCol') ?? 'month'
  const limit    = Number(searchParams.get('limit') ?? 500)
  const idList   = searchParams.get('ids')    // 쉼표 구분 ID 목록
  const idCol    = searchParams.get('idCol')  // FK 컬럼명

  if (!table) {
    return NextResponse.json({ error: 'table 파라미터 필요' }, { status: 400 })
  }

  const supabase = createServerClient()

  try {
    let query = supabase.from(table).select('*', { count: 'exact' })

    // 연도/월 필터 — 실제 컬럼명 사용
    if (year)  query = query.eq(yearCol,  Number(year))
    if (month) query = query.eq(monthCol, Number(month))

    // ID 목록 필터
    if (idList && idCol) {
      const ids = idList.split(',').filter(Boolean)
      if (ids.length > 0) query = query.in(idCol, ids)
    }

    query = query.limit(limit)

    const { data, error, count } = await query

    if (error) {
      let raw = ''
      try { raw = JSON.stringify(error, null, 2) } catch { raw = String(error) }
      console.error(`[/api/db ${table}]`, raw)
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
    console.error(`[/api/db ${table} exception]`, raw)
    return NextResponse.json({ ok: false, error: { message: String(e), raw } }, { status: 500 })
  }
}
