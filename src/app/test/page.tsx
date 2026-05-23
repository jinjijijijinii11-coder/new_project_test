'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

// ──────────────────────────────────────────────────────────────────────
// 브라우저에서 직접 Supabase 호출 (CSR-only)
// sb_publishable_ 키의 host allowlist 는 브라우저 Origin 기준
// ──────────────────────────────────────────────────────────────────────

interface TableResult {
  ok:          boolean
  latency_ms:  number
  total_count: number | null
  sample_rows: Record<string, unknown>[] | null
  columns:     string[]
  error:       string | null
}

interface TestState {
  hospital_master:  TableResult | null
  hospital_metrics: TableResult | null
  env: { url: string; key_prefix: string } | null
}

// ── 서브 컴포넌트 ────────────────────────────────────────────────────
function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
        ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
      {ok ? '연결 성공' : '연결 실패'}
    </span>
  )
}

function TableCard({ name, result }: { name: string; result: TableResult }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`card border-l-4 ${result.ok ? 'border-l-emerald-400' : 'border-l-red-400'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <code className="text-sm font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
              {name}
            </code>
            <StatusDot ok={result.ok} />
          </div>
          <p className="text-xs text-slate-400">
            응답: {result.latency_ms}ms
            {result.total_count !== null && ` · 전체 ${result.total_count.toLocaleString()}행`}
          </p>
        </div>
      </div>

      {result.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <p className="text-xs text-red-600 font-mono break-all">{result.error}</p>
          {result.error.includes('allowlist') && (
            <div className="mt-2 pt-2 border-t border-red-200">
              <p className="text-xs text-red-700 font-semibold mb-1">🔒 Host Allowlist 해결 방법:</p>
              <ol className="text-xs text-red-600 space-y-1 list-decimal list-inside">
                <li>Supabase 대시보드 → Settings → API → API Keys</li>
                <li>사용 중인 키 선택 → Allowed origins 항목에 추가:</li>
                <li>
                  <code className="bg-red-100 px-1 rounded">http://localhost:3000</code>
                  {' '}또는{' '}
                  <code className="bg-red-100 px-1 rounded">*</code> (개발용 전체 허용)
                </li>
              </ol>
            </div>
          )}
        </div>
      )}

      {result.columns.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-slate-500 mb-1.5">컬럼 ({result.columns.length}개)</p>
          <div className="flex flex-wrap gap-1">
            {result.columns.map(col => (
              <code key={col} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                {col}
              </code>
            ))}
          </div>
        </div>
      )}

      {result.sample_rows && result.sample_rows.length > 0 && (
        <>
          <button
            onClick={() => setOpen(v => !v)}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium mb-2 flex items-center gap-1"
          >
            {open ? '▲ 샘플 접기' : `▼ 샘플 데이터 (${result.sample_rows.length}행) 보기`}
          </button>
          {open && (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {result.columns.map(col => (
                      <th key={col} className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.sample_rows.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      {result.columns.map(col => (
                        <td key={col} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[200px] truncate">
                          {row[col] === null
                            ? <span className="text-slate-300">null</span>
                            : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────────────
export default function TestPage() {
  const [state, setState]       = useState<TestState>({ hospital_master: null, hospital_metrics: null, env: null })
  const [loading, setLoading]   = useState(false)
  const [testedAt, setTestedAt] = useState<string | null>(null)

  const runTest = useCallback(async () => {
    setLoading(true)

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // 브라우저에서 직접 Supabase 호출 (CSR)
    const client = createClient(url, key)

    async function testTable(name: string): Promise<TableResult> {
      const t = Date.now()
      try {
        const { data, error, count } = await client
          .from(name)
          .select('*', { count: 'exact' })
          .limit(5)
        return {
          ok:          !error,
          latency_ms:  Date.now() - t,
          total_count: count,
          sample_rows: data,
          columns:     data?.[0] ? Object.keys(data[0]) : [],
          error:       error?.message ?? null,
        }
      } catch (e) {
        return {
          ok:          false,
          latency_ms:  Date.now() - t,
          total_count: null,
          sample_rows: null,
          columns:     [],
          error:       String(e),
        }
      }
    }

    const [master, metrics] = await Promise.all([
      testTable('hospital_master'),
      testTable('hospital_metrics'),
    ])

    setState({
      hospital_master:  master,
      hospital_metrics: metrics,
      env: { url, key_prefix: key.slice(0, 22) + '…' },
    })
    setTestedAt(new Date().toLocaleTimeString('ko-KR'))
    setLoading(false)
  }, [])

  useEffect(() => { runTest() }, [runTest])

  const allOk = state.hospital_master?.ok && state.hospital_metrics?.ok

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔌</span>
            <span className="font-bold text-slate-800">Supabase 연결 테스트</span>
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">CSR · 브라우저 직접 호출</span>
          </div>
          <Link href="/" className="btn-secondary text-xs py-1.5">← 대시보드</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* 전체 상태 */}
        <div className={`card border-2 ${
          loading       ? 'border-slate-200' :
          allOk         ? 'border-emerald-300 bg-emerald-50/40' :
          !state.hospital_master ? 'border-slate-200' :
                          'border-red-200 bg-red-50/40'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">
                {loading ? '⏳' : allOk ? '✅' : !state.hospital_master ? '⏸️' : '❌'}
              </span>
              <div>
                <h1 className="font-bold text-slate-800">
                  {loading
                    ? '테스트 중…'
                    : allOk
                    ? 'Supabase 연결 성공!'
                    : !state.hospital_master
                    ? '테스트 대기'
                    : 'Supabase 연결 실패'}
                </h1>
                {testedAt && !loading && (
                  <p className="text-xs text-slate-400 mt-0.5">마지막 테스트: {testedAt}</p>
                )}
              </div>
            </div>
            <button
              onClick={runTest}
              disabled={loading}
              className="btn-primary text-xs py-2 disabled:opacity-50"
            >
              {loading ? '실행 중…' : '🔄 재테스트'}
            </button>
          </div>

          {state.env && (
            <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400">Supabase URL</span>
                <code className="block text-slate-700 font-mono mt-0.5 text-xs">{state.env.url}</code>
              </div>
              <div>
                <span className="text-slate-400">Anon Key</span>
                <code className="block text-slate-700 font-mono mt-0.5 text-xs">{state.env.key_prefix}</code>
              </div>
            </div>
          )}
        </div>

        {/* 로딩 */}
        {loading && (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-slate-100 rounded w-1/2 mb-3" />
                <div className="flex gap-1.5">
                  {[...Array(6)].map((_, j) => (
                    <div key={j} className="h-5 bg-blue-100 rounded w-16" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 결과 */}
        {!loading && state.hospital_master && (
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">테이블 조회 결과</h2>
            <TableCard name="hospital_master"  result={state.hospital_master} />
            <TableCard name="hospital_metrics" result={state.hospital_metrics!} />
          </div>
        )}

        {/* 성공 시 다음 단계 */}
        {!loading && allOk && (
          <div className="card bg-blue-50 border border-blue-200">
            <h3 className="font-semibold text-blue-800 mb-3">🎉 연결 성공! 다음 단계</h3>
            <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
              <li>위 컬럼 목록을 확인 후 <code className="bg-blue-100 px-1 rounded">src/types/hospital.ts</code> 타입 구체화</li>
              <li><code className="bg-blue-100 px-1 rounded">src/hooks/useHospitalData.ts</code> → <code className="bg-blue-100 px-1 rounded">USE_REAL_DATA = true</code></li>
              <li><Link href="/" className="underline font-medium">대시보드</Link>에서 실제 데이터 확인</li>
            </ol>
          </div>
        )}

        {/* Allowlist 안내 */}
        {!loading && state.hospital_master && !allOk && (
          <div className="card bg-amber-50 border border-amber-200">
            <h3 className="font-semibold text-amber-800 mb-3">⚙️ Supabase Allowlist 설정 방법</h3>
            <div className="text-sm text-amber-700 space-y-2">
              <p className="font-medium">방법 1 – API Key Allowed Origins 추가</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Supabase 대시보드 접속</li>
                <li>Settings → API → API Keys 이동</li>
                <li>현재 사용 중인 publishable key 선택</li>
                <li>
                  <strong>Allowed origins</strong> 에 아래 값 추가:
                  <code className="block bg-amber-100 px-2 py-1 rounded mt-1 text-xs font-mono">
                    http://localhost:3000
                  </code>
                </li>
              </ol>
              <p className="font-medium mt-3">방법 2 – 모든 origin 허용 (개발용)</p>
              <code className="block bg-amber-100 px-2 py-1 rounded text-xs font-mono">*</code>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
