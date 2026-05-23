'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── 서버사이드 /api/db 를 통해 조회 (Origin 제한 우회) ─────────────

interface DbResult {
  ok:           boolean
  table?:       string
  count?:       number | null
  rows?:        Record<string, unknown>[] | null
  columns?:     string[]
  has_service_key?: boolean
  error?: {
    message: string
    code?:   string
    details?: string
    hint?:   string
    raw:     string
  }
}

interface TestState {
  master:  DbResult | null
  metrics: DbResult | null
  latency: { master: number; metrics: number }
}

// ── 오류 분류 ────────────────────────────────────────────────────────
function classifyError(err: DbResult['error']): { label: string; icon: string; color: string; solution: string[] } {
  if (!err) return { label: '', icon: '', color: '', solution: [] }
  const m = err.message.toLowerCase()
  const c = (err.code ?? '').toLowerCase()

  if (m.includes('host') && m.includes('allowlist'))
    return {
      label: '🔑 Host Allowlist 차단',
      icon: '🔑', color: 'bg-rose-50 border-rose-300 text-rose-800',
      solution: [
        'SUPABASE_SERVICE_ROLE_KEY 를 .env.local 에 추가해야 합니다.',
        'Supabase 대시보드 → Settings → API → service_role 키 복사',
        '또는: Supabase 대시보드 → Settings → API → API Keys → Allowed origins 에 http://localhost:3000 추가',
      ],
    }
  if (c === '42501' || m.includes('row-level security'))
    return {
      label: '🔒 RLS 차단',
      icon: '🔒', color: 'bg-purple-50 border-purple-300 text-purple-800',
      solution: [
        `Supabase 대시보드 → Table Editor → ${err.raw.includes('hospital_master') ? 'hospital_master' : 'hospital_metrics'} → RLS 탭`,
        '"New Policy" → "Enable read access for all users" 선택',
        'SQL: CREATE POLICY "public read" ON <table> FOR SELECT USING (true);',
      ],
    }
  if (c === '42p01' || (m.includes('does not exist') && m.includes('relation')))
    return {
      label: '🗄️ 테이블 없음',
      icon: '🗄️', color: 'bg-orange-50 border-orange-300 text-orange-800',
      solution: ['Supabase SQL Editor에서 supabase/schema.sql 실행'],
    }
  if (c === '42703' || (m.includes('does not exist') && m.includes('column')))
    return {
      label: '📋 컬럼명 불일치',
      icon: '📋', color: 'bg-amber-50 border-amber-300 text-amber-800',
      solution: ['src/lib/metrics-config.ts 의 SCHEMA 섹션 컬럼명 수정'],
    }
  return {
    label: '❓ 알 수 없는 오류',
    icon: '❓', color: 'bg-slate-50 border-slate-300 text-slate-800',
    solution: ['아래 전체 JSON 확인'],
  }
}

// ── 컬럼 카드 ────────────────────────────────────────────────────────
function ColumnList({ columns }: { columns: string[] }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-slate-500 mb-2">
        📋 실제 컬럼 목록 ({columns.length}개) — metrics-config.ts의 key 값으로 사용
      </p>
      <div className="flex flex-wrap gap-1">
        {columns.map(col => (
          <code
            key={col}
            className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded select-all cursor-pointer hover:bg-blue-100"
            title={`클릭하여 선택: ${col}`}
          >
            {col}
          </code>
        ))}
      </div>
    </div>
  )
}

// ── 샘플 테이블 ──────────────────────────────────────────────────────
function SampleTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: string[] }) {
  const [open, setOpen] = useState(true)
  if (!rows.length) return <p className="text-xs text-slate-400">데이터 없음</p>

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="text-xs text-primary-600 font-medium mb-2 hover:underline"
      >
        {open ? '▲ 샘플 접기' : `▼ 샘플 ${rows.length}건 펼치기`}
      </button>
      {open && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {columns.map(col => (
                  <th key={col} className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  {columns.map(col => (
                    <td key={col} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[180px] truncate"
                      title={String(row[col] ?? '')}>
                      {row[col] == null
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
    </div>
  )
}

// ── 결과 카드 ────────────────────────────────────────────────────────
function ResultCard({ name, result, latency }: { name: string; result: DbResult; latency: number }) {
  const [showJson, setShowJson] = useState(false)
  const errInfo = classifyError(result.error)

  return (
    <div className={`card border-l-4 ${result.ok ? 'border-l-emerald-400' : 'border-l-red-400'}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-sm font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{name}</code>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
            ${result.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
            {result.ok ? '✅ 조회 성공' : '❌ 조회 실패'}
          </span>
          {result.ok && (
            <span className="text-xs text-slate-400">
              전체 {result.count?.toLocaleString() ?? '?'}행 · {latency}ms
            </span>
          )}
        </div>
      </div>

      {/* 오류 */}
      {result.error && (
        <div className={`rounded-xl border p-3 mb-4 ${errInfo.color}`}>
          <p className="font-bold text-sm mb-1">{errInfo.label}</p>
          <p className="font-mono text-xs mb-2 break-all">{result.error.message}</p>
          {result.error.code    && <p className="text-xs">code: <code>{result.error.code}</code></p>}
          {result.error.details && <p className="text-xs">details: {result.error.details}</p>}
          {result.error.hint    && <p className="text-xs">hint: {result.error.hint}</p>}

          <div className="mt-2 pt-2 border-t border-current/20">
            <p className="text-xs font-semibold mb-1">💡 해결 방법:</p>
            <ol className="text-xs list-decimal list-inside space-y-0.5">
              {errInfo.solution.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>

          <button
            onClick={() => setShowJson(v => !v)}
            className="mt-2 text-xs underline opacity-60"
          >
            {showJson ? '전체 JSON 접기' : '전체 JSON 보기'}
          </button>
          {showJson && (
            <pre className="mt-1 text-[10px] font-mono bg-black/10 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-40">
              {result.error.raw}
            </pre>
          )}
        </div>
      )}

      {/* 성공: 컬럼 + 샘플 */}
      {result.ok && result.columns && result.rows && (
        <>
          <ColumnList columns={result.columns} />
          <SampleTable rows={result.rows.slice(0, 5)} columns={result.columns} />
        </>
      )}
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────────────────
export default function TestPage() {
  const [state,    setState]    = useState<TestState>({ master: null, metrics: null, latency: { master: 0, metrics: 0 } })
  const [loading,  setLoading]  = useState(false)
  const [testedAt, setTestedAt] = useState<string | null>(null)

  const runTest = useCallback(async () => {
    setLoading(true)
    const t0 = Date.now()

    async function fetchTable(table: string, extra = ''): Promise<[DbResult, number]> {
      const t = Date.now()
      try {
        const res  = await fetch(`/api/db?table=${table}&limit=5${extra}`)
        const json = await res.json() as DbResult
        return [json, Date.now() - t]
      } catch (e) {
        return [{ ok: false, error: { message: String(e), raw: String(e) } }, Date.now() - t]
      }
    }

    const [[master, lm], [metrics, lme]] = await Promise.all([
      fetchTable('hospital_master'),
      fetchTable('hospital_metrics'),
    ])

    setState({ master, metrics, latency: { master: lm, metrics: lme } })
    setTestedAt(new Date().toLocaleTimeString('ko-KR'))
    setLoading(false)
  }, [])

  useEffect(() => { runTest() }, [runTest])

  const allOk   = state.master?.ok && state.metrics?.ok
  const hasKey  = state.master?.has_service_key

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔌</span>
            <span className="font-bold text-slate-800">Supabase 연결 진단</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              서버사이드 /api/db 경유
            </span>
          </div>
          <Link href="/" className="btn-secondary text-xs py-1.5">← 대시보드</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* 전체 상태 */}
        <div className={`card border-2 ${
          loading ? 'border-slate-200' :
          allOk   ? 'border-emerald-300 bg-emerald-50/40' :
          !state.master ? 'border-slate-200' :
                   'border-red-200 bg-red-50/40'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{loading ? '⏳' : allOk ? '✅' : !state.master ? '⏸️' : '❌'}</span>
              <div>
                <h1 className="font-bold text-slate-800 text-lg">
                  {loading ? '진단 중…' : allOk ? 'Supabase 연결 성공!' : !state.master ? '대기' : '연결 실패'}
                </h1>
                {testedAt && <p className="text-xs text-slate-400">마지막: {testedAt}</p>}
              </div>
            </div>
            <button onClick={runTest} disabled={loading} className="btn-primary text-xs disabled:opacity-50">
              {loading ? '실행 중…' : '🔄 재테스트'}
            </button>
          </div>

          {/* 서비스 키 상태 */}
          {!loading && state.master !== null && (
            <div className={`mt-3 pt-3 border-t border-slate-200 text-xs rounded-lg px-3 py-2
              ${hasKey ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {hasKey
                ? '✅ SUPABASE_SERVICE_ROLE_KEY 적용됨 — Origin 제한 없이 동작'
                : '⚠️ SUPABASE_SERVICE_ROLE_KEY 미설정 — .env.local 에 service_role 키를 추가하면 Origin 제한 없이 동작합니다.'}
            </div>
          )}
        </div>

        {/* service_role 키 안내 (실패 시) */}
        {!loading && state.master && !allOk && !hasKey && (
          <div className="card bg-rose-50 border border-rose-300">
            <h3 className="font-bold text-rose-800 mb-2">🔑 SUPABASE_SERVICE_ROLE_KEY 설정 필요</h3>
            <ol className="text-sm text-rose-700 space-y-1.5 list-decimal list-inside">
              <li>Supabase 대시보드 접속 → 프로젝트 선택</li>
              <li>Settings → API → Project API Keys</li>
              <li><strong>service_role</strong> 키 복사 (eyJhbG... 로 시작하는 JWT)</li>
              <li>
                프로젝트의 <code className="bg-rose-100 px-1 rounded">.env.local</code> 파일에 추가:
                <pre className="mt-1 bg-rose-100 rounded p-2 text-xs font-mono">SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...</pre>
              </li>
              <li>서버 재시작 후 이 페이지에서 재테스트</li>
            </ol>
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
                <div className="flex gap-1.5">
                  {[...Array(5)].map((_, j) => <div key={j} className="h-5 bg-blue-100 rounded w-20" />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 결과 */}
        {!loading && state.master && (
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">테이블 조회 결과</h2>
            <ResultCard name="hospital_master"  result={state.master}  latency={state.latency.master} />
            <ResultCard name="hospital_metrics" result={state.metrics!} latency={state.latency.metrics} />
          </div>
        )}

        {/* 성공 후 다음 단계 */}
        {!loading && allOk && (
          <div className="card bg-blue-50 border border-blue-200">
            <h3 className="font-semibold text-blue-800 mb-3">🎉 다음 단계: 컬럼명 맞추기</h3>
            <p className="text-sm text-blue-700 mb-2">위에서 확인한 컬럼명을 아래 파일에 반영하세요:</p>
            <ol className="text-sm text-blue-700 space-y-1.5 list-decimal list-inside">
              <li>
                <code className="bg-blue-100 px-1 rounded">src/lib/metrics-config.ts</code> →
                SCHEMA 섹션의 NAME / TYPE / ID / HOSPITAL_ID 컬럼명 수정
              </li>
              <li>각 CategoryConfig의 MetricField.key 를 실제 컬럼명으로 수정</li>
              <li><Link href="/" className="underline font-medium">대시보드</Link>에서 실제 데이터 확인</li>
            </ol>
          </div>
        )}
      </main>
    </div>
  )
}
