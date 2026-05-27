/**
 * GET /api/months
 * hospital_metrics.source_month 의 distinct 값을 오름차순으로 반환합니다.
 *
 * 구현 방식:
 *   hospital_metrics 는 행이 많아 단순 limit 조회로는 중복 제거가 불가능합니다.
 *   대신 "cursor > 이전값 ORDER BY ASC LIMIT 1" 패턴을 반복하여
 *   각 반복마다 인덱스 스캔 한 행씩 다음 distinct 값을 가져옵니다.
 */
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createServerClient()
  const months: string[] = []
  let cursor = ''

  // 최대 120회 반복 (10년치 월별 = 120개)
  for (let i = 0; i < 120; i++) {
    const query = supabase
      .from('hospital_metrics')
      .select('source_month')
      .not('source_month', 'is', null)
      .gt('source_month', cursor)
      .order('source_month', { ascending: true })
      .limit(1)

    const { data, error } = await query
    if (error || !data?.length) break

    const m = String(data[0].source_month ?? '').trim()
    if (!m || m === cursor) break

    months.push(m)
    cursor = m
  }

  if (months.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'source_month 데이터가 없습니다.' },
      { status: 404 },
    )
  }

  return NextResponse.json({ ok: true, months })
}
