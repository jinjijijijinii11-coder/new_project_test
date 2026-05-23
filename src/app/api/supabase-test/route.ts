import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // 요청 Origin 감지 (없으면 localhost 기본값)
  const origin = req.headers.get('origin') ?? 'http://localhost:3000'

  // 서버사이드에서 Origin 헤더 포함 → Supabase host allowlist 통과 시도
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Origin: origin },
    },
  })

  const results: Record<string, unknown> = {}

  // ── hospital_master ──────────────────────────────────────────────
  const t1 = Date.now()
  const { data: md, error: me, count: mc } = await client
    .from('hospital_master')
    .select('*', { count: 'exact' })
    .limit(5)

  results.hospital_master = {
    ok:          !me,
    latency_ms:  Date.now() - t1,
    total_count: mc,
    sample_rows: md,
    columns:     md?.[0] ? Object.keys(md[0]) : [],
    error:       me?.message ?? null,
  }

  // ── hospital_metrics ────────────────────────────────────────────
  const t2 = Date.now()
  const { data: sd, error: se, count: sc } = await client
    .from('hospital_metrics')
    .select('*', { count: 'exact' })
    .limit(5)

  results.hospital_metrics = {
    ok:          !se,
    latency_ms:  Date.now() - t2,
    total_count: sc,
    sample_rows: sd,
    columns:     sd?.[0] ? Object.keys(sd[0]) : [],
    error:       se?.message ?? null,
  }

  // ── 환경변수 확인 ────────────────────────────────────────────────
  results.env = {
    url:        supabaseUrl,
    key_prefix: supabaseAnonKey.slice(0, 22) + '…',
    origin_used: origin,
  }

  const allOk =
    (results.hospital_master as any).ok &&
    (results.hospital_metrics as any).ok

  return NextResponse.json(results, { status: allOk ? 200 : 500 })
}
