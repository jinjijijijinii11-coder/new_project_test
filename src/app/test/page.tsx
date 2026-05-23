'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { parseSupabaseError, ERROR_TYPE_LABELS, SupabaseErrorDetail } from '@/hooks/useDashboardData'

// ── 테이블 진단 결과 ─────────────────────────────────────────────────
interface TableDiag {
  ok:          boolean
  latency_ms:  number
  total_count: number | null
  sample_rows: Record<string, unknown>[] | null
  columns:     string[]
  error:       SupabaseErrorDetail | null
}

interface DiagState {
  hospital_master:  TableDiag | null
  hospital_metrics: TableDiag | null
  env: {
    url:        string
    key_prefix: string
    url_ok:     boolean
    key_ok:     boolean
  } | null
}

// ── 에러 타입 뱃지 ─────────────────────────────────────────────────
function ErrorBadge({ err }: { err: SupabaseErrorDetail }) {
  const info = ERROR_TYPE_LABELS[err.type]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${info.color}`}>
      {info.icon} {info.label}
    </span>
  )
}

// ── 테이블 진단 카드 ─────────────────────────────────────────────────
function DiagCard({ name, diag }: { name: string; diag: TableDiag }) {
  const [showRows,    setShowRows]    = useState(false)
  const [showErrJson, setShowErrJson] = useState(false)

  return (
    <div className={`card border-l-4 ${diag.ok ? 'border-l-emerald-400' : 'border-l-red-400'}`}>
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-sm font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
            {name}
          </code>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold
            ${diag.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${diag.ok ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            {diag.ok ? '조회 성공' : '조회 실패'}
          </span>
          {diag.error && <ErrorBadge err={diag.error} />}
        </div>
        <p className="text-xs text-slate-400 shrink-0">{diag.latency_ms}ms</p>
      </div>

      {/* 오류 상세 */}
      {diag.error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-red-700">오류 메시지</p>
            <button
              onClick={() => setShowErrJson(v => !v)}
              className="text-[10px] text-red-500 underline"
            >
              {showErrJson ? 'JSON 접기' : 'JSON 전체 보기'}
            </button>
          </div>
          <p className="text-xs font-mono text-red-600 break-all">
            {diag.error.message}
            {diag.error.code    && <span className="ml-2 opacity-70">[code: {diag.error.code}]</span>}
          </p>
          {diag.error.details && (
            <p className="text-xs text-red-500 mt-1">details: {diag.error.details}</p>
          )}
          {diag.error.hint && (
            <p className="text-xs text-red-500">hint: {diag.error.hint}</p>
          )}
          {showErrJson && (
            <pre className="mt-2 text-[10px] font-mono bg-red-100 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-40">
              {diag.error.raw}
            </pre>
          )}

          {/* 오류 타입별 해결책 */}
          <div className="mt-2 pt-2 border-t border-red-200">
            {diag.error.type === 'auth' && (
              <div className="text-xs text-red-700 space-y-1">
                <p className="font-semibold">🔑 인증 오류 해결 방법:</p>
                <ol className="list-decimal list-inside space-y-0.5 ml-2">
                  <li>Supabase 대시보드 → Settings → API → API Keys</li>
                  <li>Allowed origins 에 <code className="bg-red-100 px-1 rounded">http://localhost:3000</code> 추가</li>
                  <li>또는 개발용 전체 허용: <code className="bg-red-100 px-1 rounded">*</code></li>
                </ol>
              </div>
            )}
            {diag.error.type === 'rls' && (
              <div className="text-xs text-purple-700 space-y-1">
                <p className="font-semibold">🔒 RLS 해결 방법:</p>
                <ol className="list-decimal list-inside space-y-0.5 ml-2">
                  <li>Supabase → Table Editor → {name} → RLS 탭</li>
                  <li>"New Policy" → "Enable read access for all users" 선택</li>
                  <li>또는 SQL: <code className="bg-purple-100 px-1 rounded">CREATE POLICY "public read" ON {name} FOR SELECT USING (true);</code></li>
                </ol>
              </div>
            )}
            {diag.error.type === 'table' && (
              <div className="text-xs text-red-700 space-y-1">
                <p className="font-semibold">🗄️ 테이블 없음 해결 방법:</p>
                <p className="ml-2">supabase/schema.sql 을 Supabase SQL Editor에서 실행하세요.</p>
              </div>
            )}
            {diag.error.type === 'column' && (
              <div className="text-xs text-amber-700 space-y-1">
                <p className="font-semibold">📋 컬럼명 오류 해결 방법:</p>
                <p className="ml-2">아래 실제 컬럼 목록을 확인하고 <code className="bg-amber-100 px-1 rounded">metrics-config.ts</code>를 수정하세요.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 통계 */}
      {diag.ok && (
        <div className="flex gap-4 mb-3 text-xs text-slate-500">
          <span>전체: <strong className="text-slate-700">{diag.total_count?.toLocaleString() ?? '?'}행</strong></span>
          <span>샘플: <strong className="text-slate-700">{diag.sample_rows?.length ?? 0}건</strong></span>
          <span>컬럼: <strong className="text-slate-700">{diag.columns.length}개</strong></span>
        </div>
      )}

      {/* 컬럼 목록 */}
      {diag.columns.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-slate-500 mb-2">
            📋 컬럼 목록 ({diag.columns.length}개) — metrics-config.ts 에서 key 값으로 사용
          </p>
          <div className="flex flex-wrap gap-1">
            {diag.columns.map(col => (
              <code
                key={col}
                className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded cursor-pointer select-all"
                title="클릭하여 선택"
              >
                {col}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* 샘플 데이터 */}
      {diag.sample_rows && diag.sample_rows.length > 0 && (
        <div>
          <button
            onClick={() => setShowRows(v => !v)}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium mb-2"
          >
            {showRows ? '▲ 샘플 데이터 접기' : `▼ 샘플 데이터 ${diag.sample_rows.length}건 보기`}
          </button>

          {showRows && (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {diag.columns.map(col => (
                      <th key={col} className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {diag.sample_rows.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      {diag.columns.map(col => (
                        <td key={col} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[200px] truncate">
                          {row[col] === null || row[col] === undefined
                            ? <span className="text-slate-300">null</span>
                            : <span title={String(row[col])}>{String(row[col])}</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────────────
export default function TestPage() {
  const [state,      setState]    = useState<DiagState>({ hospital_master: null, hospital_metrics: null, env: null })
  const [loading,    setLoading]  = useState(false)
  const [testedAt,   setTestedAt] = useState<string | null>(null)

  const runTest = useCallback(async () => {
    setLoading(true)

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

    // 환경변수 기본 검증
    const url_ok = url.startsWith('https://') && url.includes('supabase')
    const key_ok = key.length > 20

    const client = createClient(url, key)

    async function diagTable(name: string): Promise<TableDiag> {
      const t = Date.now()
      try {
        const { data, error, count } = await client
          .from(name)
          .select('*', { count: 'exact' })
          .limit(5)

        const latency_ms = Date.now() - t

        if (error) {
          const parsed = parseSupabaseError(error, `${name} 조회`)
          console.error(`[/test ${name}]`, parsed.raw)
          return { ok: false, latency_ms, total_count: null, sample_rows: null, columns: [], error: parsed }
        }

        console.log(`[/test ${name}]`, count, '건, 첫행:', JSON.stringify(data?.[0]))
        return {
          ok:          true,
          latency_ms,
          total_count: count,
          sample_rows: data as Record<string, unknown>[],
          columns:     data?.[0] ? Object.keys(data[0]) : [],
          error:       null,
        }
      } catch (e) {
        const parsed = parseSupabaseError(e, `${name} 예외`)
        console.error(`[/test ${name} catch]`, parsed.raw)
        return { ok: false, latency_ms: Date.now() - t, total_count: null, sample_rows: null, columns: [], error: parsed }
      }
    }

    const [master, metrics] = await Promise.all([
      diagTable('hospital_master'),
      diagTable('hospital_metrics'),
    ])

    setState({ hospital_master: master, hospital_metrics: metrics, env: { url, key_prefix: key.slice(0, 24) + '…', url_ok, key_ok } })
    setTestedAt(new Date().toLocaleTimeString('ko-KR'))
    setLoading(false)
  }, [])

  useEffect(() => { runTest() }, [runTest])

  const allOk = state.hospital_master?.ok && state.hospital_metrics?.ok

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔌</span>
            <span className="font-bold text-slate-800">Supabase 연결 진단</span>
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
              브라우저 직접 호출 (CSR)
            </span>
          </div>
          <Link href="/" className="btn-secondary text-xs py-1.5">← 대시보드</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* 전체 상태 카드 */}
        <div className={`card border-2 ${
          loading           ? 'border-slate-200' :
          allOk             ? 'border-emerald-300 bg-emerald-50/40' :
          !state.hospital_master ? 'border-slate-200' :
                              'border-red-200 bg-red-50/40'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">
                {loading ? '⏳' : allOk ? '✅' : !state.hospital_master ? '⏸️' : '❌'}
              </span>
              <div>
                <h1 className="font-bold text-slate-800 text-lg">
                  {loading ? '진단 중…' : allOk ? 'Supabase 연결 성공!' : !state.hospital_master ? '대기' : '오류 발생'}
                </h1>
                {testedAt && <p className="text-xs text-slate-400">마지막 테스트: {testedAt}</p>}
              </div>
            </div>
            <button onClick={runTest} disabled={loading} className="btn-primary text-xs disabled:opacity-50">
              {loading ? '실행 중…' : '🔄 재테스트'}
            </button>
          </div>

          {/* 환경변수 상태 */}
          {state.env && (
            <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  <span>NEXT_PUBLIC_SUPABASE_URL</span>
                  <span className={state.env.url_ok ? 'text-emerald-600' : 'text-red-500'}>
                    {state.env.url_ok ? '✓' : '✗'}
                  </span>
                </div>
                <code className="text-slate-600 font-mono text-[11px]">{state.env.url}</code>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  <span>NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
                  <span className={state.env.key_ok ? 'text-emerald-600' : 'text-red-500'}>
                    {state.env.key_ok ? '✓' : '✗'}
                  </span>
                </div>
                <code className="text-slate-600 font-mono text-[11px]">{state.env.key_prefix}</code>
              </div>
            </div>
          )}
        </div>

        {/* 로딩 스켈레톤 */}
        {loading && (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
                <div className="flex gap-1.5">
                  {[...Array(5)].map((_, j) => <div key={j} className="h-5 bg-blue-100 rounded w-16" />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 테이블 진단 결과 */}
        {!loading && state.hospital_master && (
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              테이블 진단 결과
            </h2>
            <DiagCard name="hospital_master"  diag={state.hospital_master} />
            <DiagCard name="hospital_metrics" diag={state.hospital_metrics!} />
          </div>
        )}

        {/* 성공 후 다음 단계 */}
        {!loading && allOk && (
          <div className="card bg-blue-50 border border-blue-200">
            <h3 className="font-semibold text-blue-800 mb-3">🎉 연결 성공! 다음 단계</h3>
            <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
              <li>위에서 확인된 <strong>컬럼명</strong>을{' '}
                <code className="bg-blue-100 px-1 rounded">src/lib/metrics-config.ts</code>의
                각 MetricField.key 에 정확히 입력
              </li>
              <li>SCHEMA.MASTER.NAME / TYPE / ID 컬럼명도 실제 DB 컬럼명으로 확인</li>
              <li><Link href="/" className="underline font-medium">대시보드로 이동</Link>해서 실제 데이터 확인</li>
            </ol>
          </div>
        )}
      </main>
    </div>
  )
}
