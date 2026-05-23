import { createClient } from '@supabase/supabase-js'

// =====================================================================
// Supabase 클라이언트 – .env.local 환경변수 사용
// URL  : https://ghwjqtwtsfqsdmsnopfn.supabase.co  (base URL, /rest/v1 제외)
// KEY  : sb_publishable_*** (새 publishable key 포맷)
//
// ⚠️  sb_publishable_ 키는 Host 허용 목록(origin allowlist)이 활성화되어 있으면
//     허용된 Origin 에서 온 요청만 통과합니다.
//     Supabase 대시보드 > Settings > API > API Keys 에서 localhost:3000 추가 필요.
// =====================================================================
const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 클라이언트 인스턴스 (CSR / SSR 공용)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      // 서버사이드에서도 Origin 을 명시 → Supabase allowlist 통과
      ...(typeof window === 'undefined' && {
        Origin: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
      }),
    },
  },
})

// =====================================================================
// Database 타입 정의
// hospital_master  – 병원 기본 정보
// hospital_metrics – 병원별 지표/통계 데이터
// (실제 컬럼 확인 후 /test 페이지의 결과를 보고 타입 구체화 가능)
// =====================================================================
export type Database = {
  public: {
    Tables: {
      hospital_master: {
        Row:    Record<string, unknown>
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
      hospital_metrics: {
        Row:    Record<string, unknown>
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
    }
  }
}

export type HospitalMasterRow  = Database['public']['Tables']['hospital_master']['Row']
export type HospitalMetricsRow = Database['public']['Tables']['hospital_metrics']['Row']

// =====================================================================
// 쿼리 헬퍼
// =====================================================================

export async function fetchHospitalMaster(opts?: { limit?: number; offset?: number }) {
  const { limit = 100, offset = 0 } = opts ?? {}
  return supabase
    .from('hospital_master')
    .select('*')
    .range(offset, offset + limit - 1)
}

export async function fetchHospitalMetrics(opts?: {
  limit?:      number
  offset?:     number
  hospitalId?: unknown
}) {
  const { limit = 100, offset = 0, hospitalId } = opts ?? {}
  let q = supabase
    .from('hospital_metrics')
    .select('*')
    .range(offset, offset + limit - 1)

  if (hospitalId !== undefined) {
    q = q.eq('hospital_id', hospitalId as string)
  }
  return q
}

export async function pingSupabase(): Promise<{ ok: boolean; latency: number; error?: string }> {
  const t = Date.now()
  try {
    const { error } = await supabase
      .from('hospital_master')
      .select('*', { count: 'exact', head: true })
    const latency = Date.now() - t
    if (error) return { ok: false, latency, error: error.message }
    return { ok: true, latency }
  } catch (e) {
    return { ok: false, latency: Date.now() - t, error: String(e) }
  }
}
