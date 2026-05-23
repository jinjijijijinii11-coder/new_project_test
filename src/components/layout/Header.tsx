export function Header() {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
            <span className="text-white text-base">🏥</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">병원군 비교분석 대시보드</h1>
            <p className="text-xs text-slate-400">Hospital Group Analytics</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
            데모 모드 · 목업 데이터
          </span>
          <a
            href="https://supabase.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs py-1.5"
          >
            🔗 Supabase 연결
          </a>
        </div>
      </div>
    </header>
  )
}
