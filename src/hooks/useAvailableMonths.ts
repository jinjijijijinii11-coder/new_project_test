'use client'

import { useState, useEffect } from 'react'

export interface AvailableMonthsData {
  /** 'YYYY-MM' 형식 오름차순 정렬 — 마지막 원소가 최신 */
  months:    string[]
  isLoading: boolean
  error:     string | null
}

/**
 * /api/months 에서 hospital_metrics 의 distinct source_month 목록을 가져옵니다.
 */
export function useAvailableMonths(): AvailableMonthsData {
  const [months,    setMonths]  = useState<string[]>([])
  const [isLoading, setLoading] = useState(true)
  const [error,     setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/months')
      .then(r => r.json())
      .then((data: { ok: boolean; months?: string[]; error?: string }) => {
        if (data.ok && Array.isArray(data.months) && data.months.length > 0) {
          setMonths(data.months)   // 이미 오름차순 정렬됨
        } else {
          setError(data.error ?? '조회 실패')
        }
      })
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  return { months, isLoading, error }
}
