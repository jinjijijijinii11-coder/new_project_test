/**
 * 서버사이드 전용 Supabase 클라이언트
 * - SUPABASE_SERVICE_ROLE_KEY 사용 → Origin 제한 없음
 * - 브라우저에 절대 노출되지 않음 (NEXT_PUBLIC_ 접두사 없음)
 */
import { createClient } from '@supabase/supabase-js'

const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY

/** service_role 키가 있으면 사용, 없으면 anon 키 사용 */
export function createServerClient() {
  const key = service && service !== 'your-service-role-key-here'
    ? service
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export const hasServiceKey =
  !!service && service !== 'your-service-role-key-here'
