/**
 * POST /api/auth
 * 요청 body: { password: string }
 * 환경변수 DASHBOARD_PASSWORD 와 비교하여 인증합니다.
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const correct = process.env.DASHBOARD_PASSWORD
  if (!correct) {
    return NextResponse.json(
      { ok: false, error: 'DASHBOARD_PASSWORD 환경변수가 설정되지 않았습니다.' },
      { status: 500 },
    )
  }

  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  if (body.password === correct) {
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ ok: false }, { status: 401 })
}
