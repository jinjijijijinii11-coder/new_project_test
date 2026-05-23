import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '병원군 비교분석 대시보드',
  description: 'Supabase 기반 병원군별 의료 통계 비교 분석 대시보드',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
