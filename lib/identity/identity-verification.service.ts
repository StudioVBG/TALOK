import { createClient } from '@/lib/supabase/server'

export type IdentityStatus =
  | 'unverified'
  | 'phone_verified'
  | 'document_uploaded'
  | 'identity_verified'
  | 'identity_rejected'
  | 'identity_review'

export type OnboardingStep =
  | 'account_created'
  | 'phone_pending'
  | 'phone_done'
  | 'profile_pending'
  | 'profile_done'
  | 'document_pending'
  | 'document_done'
  | 'complete'

// Tables not yet in generated types — use untyped client for these
function untyped(supabase: any) {
  return supabase as {
    from: (table: string) => any
  }
}

export async function sendPhoneOtp(
  profileId: string,
  phoneNumber: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const db = untyped(supabase)
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    await db
      .from('phone_otp_codes')
      .update({ verified: true })
      .eq('profile_id', profileId)
      .eq('verified', false)

    await db.from('phone_otp_codes').insert({
      profile_id: profileId,
      phone_number: phoneNumber,
      code, // TODO: hasher avec bcrypt via Edge Function
    })

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: phoneNumber,
          From: process.env.TWILIO_PHONE_NUMBER!,
          Body: `Votre code de vérification Talok : ${code}. Valable 10 minutes.`,
        }),
      }
    )

    if (!twilioRes.ok) {
      return { success: false, error: "Impossible d'envoyer le SMS. Vérifiez le numéro." }
    }

    await db.from('identity_verification_log').insert({
      profile_id: profileId,
      event_type: 'otp_sent',
      metadata: { phone: phoneNumber.slice(0, -4) + '****' },
    })

    return { success: true }
  } catch (err) {
    console.error('[OTP] sendPhoneOtp error:', err)
    return { success: false, error: "Erreur serveur lors de l'envoi du code." }
  }
}

export async function verifyPhoneOtp(
  profileId: string,
  inputCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const db = untyped(supabase)

    const { data: otp } = await db
      .from('phone_otp_codes')
      .select('id, code, attempts, expires_at')
      .eq('profile_id', profileId)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!otp) {
      return { success: false, error: 'Code expiré ou introuvable. Demandez un nouveau code.' }
    }

    if (otp.attempts >= 5) {
      return { success: false, error: 'Trop de tentatives. Demandez un nouveau code.' }
    }

    await db
      .from('phone_otp_codes')
      .update({ attempts: otp.attempts + 1 })
      .eq('id', otp.id)

    // Comparaison directe (TODO: bcrypt quand hash activé)
    if (inputCode !== otp.code) {
      return { success: false, error: 'Code incorrect.' }
    }

    await db
      .from('phone_otp_codes')
      .update({ verified: true })
      .eq('id', otp.id)

    const { data: otpRow } = await db
      .from('phone_otp_codes')
      .select('phone_number')
      .eq('id', otp.id)
      .single()

    await (supabase as any)
      .from('profiles')
      .update({
        telephone: otpRow?.phone_number,
        phone_verified: true,
        phone_verified_at: new Date().toISOString(),
        identity_status: 'phone_verified',
        onboarding_step: 'phone_done',
      })
      .eq('id', profileId)

    await db.from('identity_verification_log').insert({
      profile_id: profileId,
      event_type: 'otp_verified',
      metadata: { success: true },
    })

    return { success: true }
  } catch (err) {
    console.error('[OTP] verifyPhoneOtp error:', err)
    return { success: false, error: 'Erreur serveur lors de la vérification.' }
  }
}
