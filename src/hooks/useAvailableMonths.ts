'use client'

import { useState, useEffect } from 'react'

export interface AvailableMonthsData {
  /** 'YYYY-MM' 형식 오름차순 정렬 */
  months:    string[]
  isLoading: boolean
  error:     string | null
}

/**
 * hospital_metrics.source_month 의 distinct 값을 조회해 반환합니다.
 * 최신 source_month 가 배열의 마지막 원소입니다.
 */
export function useAvailableMonths(): AvailableMonthsData {
  const [months,    setMonths]  = useState<string[]>([])
  const [isLoading, setLoading] = useState(true)
  const [error,     setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/db?table=hospital_metrics&distinct=source_month')
      .then(r => r.json())
      .then((data: { ok: boolean; values?: string[]; error?: { message: string } }) => {
        if (data.ok && Array.isArray(data.values)) {
          setMonths(data.values.sort())   // 오름차순 → 마지막이 최신
        } else {
          setError(data.error?.message ?? '조회 실패')
        }
      })
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  return { months, isLoading, error }
}
