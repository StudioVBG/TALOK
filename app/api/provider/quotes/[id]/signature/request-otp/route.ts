export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/provider/quotes/[id]/signature/request-otp
 *
 * Genere et envoie un code OTP au proprietaire pour signer electroniquement
 * un devis depasse le seuil de signature avancee (defaut 10 000 EUR TTC).
 *
 * Cooldown : 60 secondes entre 2 demandes (anti-spam).
 * Expiration : 10 minutes.
 *
 * Le code en clair est UNIQUEMENT envoye par email — JAMAIS retourne dans
 * la reponse HTTP ni stocke en clair en DB.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { sendOwnerQuoteSignatureOtpEmail } from '@/lib/emails/resend.service';
import {
  generateOtpCode,
  generateOtpSalt,
  hashOtpCode,
  requiresAdvancedSignature,
} from '@/lib/signature/quote-signature';

const COOLDOWN_SECONDS = 60;
const EXPIRY_MINUTES = 10;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role, email, prenom, nom')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
    }
    if (!profile.email) {
      return NextResponse.json(
        { error: 'Email du profil manquant — impossible d\'envoyer le code' },
        { status: 400 },
      );
    }

    const { data: quote, error: fetchError } = await serviceClient
      .from('provider_quotes')
      .select('id, status, owner_profile_id, total_amount, reference, title')
      .eq('id', id)
      .single();

    if (fetchError || !quote) {
      return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 });
    }

    const isOwner = quote.owner_profile_id === profile.id;
    const isAdmin = profile.role === 'admin';
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Seul le destinataire peut demander un code de signature' },
        { status: 403 },
      );
    }

    const transitionable = ['sent', 'viewed'];
    if (!transitionable.includes(quote.status)) {
      return NextResponse.json(
        { error: `Devis non signable depuis le statut "${quote.status}"` },
        { status: 400 },
      );
    }

    if (!requiresAdvancedSignature(quote.total_amount)) {
      return NextResponse.json(
        {
          error: 'Ce devis ne necessite pas de signature avancee — utilisez l\'acceptation simple',
          requires_advanced: false,
        },
        { status: 400 },
      );
    }

    // Cooldown : verifier qu'aucun OTP non utilise n'a ete envoye dans les 60s
    const { data: recent } = await serviceClient
      .from('quote_signature_otps')
      .select('created_at')
      .eq('quote_id', quote.id)
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent) {
      const createdAt = new Date(recent.created_at as string).getTime();
      const elapsed = (Date.now() - createdAt) / 1000;
      if (elapsed < COOLDOWN_SECONDS) {
        const remaining = Math.ceil(COOLDOWN_SECONDS - elapsed);
        return NextResponse.json(
          {
            error: `Veuillez attendre ${remaining}s avant de redemander un code`,
            cooldown_remaining: remaining,
          },
          { status: 429 },
        );
      }
    }

    // Invalider tous les OTP non utilises de ce profil sur ce devis
    await serviceClient
      .from('quote_signature_otps')
      .update({ used_at: new Date().toISOString() })
      .eq('quote_id', quote.id)
      .eq('profile_id', profile.id)
      .is('used_at', null);

    // Generer + persister
    const code = generateOtpCode();
    const salt = generateOtpSalt();
    const codeHash = hashOtpCode(code, salt);
    const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000).toISOString();

    const { error: insertError } = await serviceClient
      .from('quote_signature_otps')
      .insert({
        quote_id: quote.id,
        profile_id: profile.id,
        code_hash: codeHash,
        salt,
        delivery_method: 'email',
        delivery_destination: profile.email,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error('[quotes/:id/signature/request-otp] insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Envoyer l'email (en attendant l'envoi pour ne pas reussir si Resend echoue)
    const recipientName =
      `${profile.prenom || ''} ${profile.nom || ''}`.trim() || 'Proprietaire';
    const totalEuros =
      typeof quote.total_amount === 'string'
        ? parseFloat(quote.total_amount)
        : (quote.total_amount as number);

    const emailResult = await sendOwnerQuoteSignatureOtpEmail({
      ownerEmail: profile.email,
      recipientName,
      code,
      quoteId: quote.id,
      quoteReference: quote.reference,
      quoteTitle: quote.title,
      totalAmountEuros: Number.isFinite(totalEuros) ? totalEuros : 0,
      expiresInMinutes: EXPIRY_MINUTES,
    });

    if (!emailResult.success) {
      // Email plante — on garde la trace OTP mais on previent le client
      return NextResponse.json(
        {
          error: 'OTP genere mais envoi email echoue. Reessayez ou contactez le support.',
          email_error: emailResult.error,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      delivery_method: 'email',
      destination_hint: maskEmail(profile.email),
      expires_at: expiresAt,
      expires_in_seconds: EXPIRY_MINUTES * 60,
    });
  } catch (error: unknown) {
    console.error('Error in POST /api/provider/quotes/[id]/signature/request-otp:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}
