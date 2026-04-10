import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/helpers/auth-helper'
import { createServiceRoleClient } from '@/lib/supabase/service-client'
import { sendPhoneOtp } from '@/lib/identity/identity-verification.service'
import { z } from 'zod'

const schema = z.object({
  phone: z.string().regex(/^\+\d{7,15}$/, 'Format international requis : +596696XXXXXX'),
})

export async function POST(req: NextRequest) {
  const { user, error, supabase } = await getAuthenticatedUser(req)
  if (error || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const serviceClient = createServiceRoleClient()
  const { data: existing } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('telephone', parsed.data.phone)
    .neq('id', user.id)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Ce numéro est déjà associé à un autre compte.' }, { status: 409 })
  }

  await serviceClient
    .from('profiles')
    .update({ telephone: parsed.data.phone, onboarding_step: 'phone_pending' })
    .eq('id', user.id)

  const result = await sendPhoneOtp(user.id, parsed.data.phone)
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ success: true })
}
