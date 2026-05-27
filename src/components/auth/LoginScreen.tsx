'use client'

import { useState, FormEvent } from 'react'

interface Props {
  onSuccess: () => void
}

export function LoginScreen({ onSuccess }: Props) {
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      })

      if (res.ok) {
        sessionStorage.setItem('dashboard_auth', '1')
        onSuccess()
      } else {
        const data = await res.json().catch(() => ({}))
        if (res.status === 500 && data.error) {
          setError(data.error)
        } else {
          setError('비밀번호가 올바르지 않습니다.')
        }
        setPassword('')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 w-full max-w-sm mx-4">
        {/* 로고 + 제목 */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary-600 flex items-center justify-center
                          text-2xl mx-auto mb-4 shadow-sm">
            🏥
          </div>
          <h1 className="text-xl font-bold text-slate-900">병원군별 비교분석</h1>
          <p className="text-sm text-slate-500 mt-1.5">비밀번호를 입력해주세요.</p>
        </div>

        {/* 입력 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(null) }}
            placeholder="비밀번호"
            autoFocus
            autoComplete="current-password"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
                       placeholder:text-slate-300 transition-shadow"
          />

          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1.5">
              <span>⚠️</span>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-primary-600 text-white rounded-xl px-4 py-3 text-sm font-semibold
                       hover:bg-primary-700 active:scale-[0.98]
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-150 shadow-sm"
          >
            {loading ? '확인 중…' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
