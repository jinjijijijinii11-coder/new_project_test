import Link from 'next/link'

interface HeaderProps {
  year:  number
  month: number
  onYearChange:  (y: number) => void
  onMonthChange: (m: number) => void
}

export function Header({ year, month, onYearChange, onMonthChange }: HeaderProps) {
  const years  = [2025, 2024, 2023, 2022]
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between gap-4">

        {/* 제목 */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white text-base">
            🏥
          </div>
          <h1 className="text-lg font-bold text-slate-900">병원군별 비교분석</h1>
        </div>

        {/* 조회월 선택 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 font-medium">조회월</span>
          <select
            value={year}
            onChange={e => onYearChange(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white
                       focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            {years.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select
            value={month}
            onChange={e => onMonthChange(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white
                       focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            {months.map(m => <option key={m} value={m}>{m}월</option>)}
          </select>

          <Link
            href="/test"
            className="ml-2 text-xs text-slate-400 hover:text-primary-600 border border-slate-200
                       hover:border-primary-300 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            🔌 DB 연결 확인
          </Link>
        </div>
      </div>
    </header>
  )
}
