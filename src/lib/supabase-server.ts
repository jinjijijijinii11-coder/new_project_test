/**
 * 서버사이드 전용 Supabase 클라이언트
 *
 * sb_publishable_ 키는 Origin allowlist 제한이 있습니다.
 * SUPABASE_SERVICE_ROLE_KEY가 설정된 경우 해당 키를 사용합니다.
 * 미설정 시 global.fetch를 커스텀하여 Origin 헤더 없이 요청합니다.
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const hasRealServiceKey =
  !!SERVICE_KEY && SERVICE_KEY !== 'your-service-role-key-here'

export const hasServiceKey = hasRealServiceKey

/**
 * service_role 키가 있으면 사용.
 * 없으면 anon 키로 fallback하되, Origin 헤더를 제거하는 custom fetch 사용
 * (sb_publishable_ 키의 Origin allowlist 우회)
 */
export function createServerClient() {
  const key = hasRealServiceKey ? SERVICE_KEY! : ANON_KEY

  // custom fetch: Origin 헤더 제거 (서버→서버 요청에서 allowlist 체크 우회)
  const customFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers)
    headers.delete('origin')
    headers.delete('Origin')
    headers.delete('referer')
    headers.delete('Referer')
    return fetch(input, { ...init, headers })
  }

  return createClient(SUPABASE_URL, key, {
    auth:   { persistSession: false, autoRefreshToken: false },
    global: { fetch: customFetch },
  })
}
