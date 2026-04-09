import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/helpers/auth-helper'
import { verifyPhoneOtp } from '@/lib/identity/identity-verification.service'

export async function POST(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req)
  if (error || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { code } = await req.json()
  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'Code invalide (6 chiffres requis)' }, { status: 400 })
  }

  const result = await verifyPhoneOtp(user.id, code)
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true })
}
