export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/provider/quotes/[id]/accept
 *
 * Acceptation d'un devis prestataire par le proprietaire (owner_profile_id)
 * ou un admin. Cote owner : action "Accepter ce devis" depuis la page
 * de detail du devis.
 *
 * Body :
 *   - signed_name (string, requis) : nom complet (signature simple)
 *   - signed_otp_code (string, requis si total > seuil) : code 6 chiffres
 *     recu par email via /signature/request-otp.
 *
 * Niveaux de signature :
 *   - 'simple' (eIDAS SES)  : nom + IP + UA + timestamp
 *   - 'advanced' (eIDAS AES) : SES + OTP + hash SHA-256 + HMAC-SHA256.
 *     Active automatiquement si total_amount > seuil (defaut 10 000 EUR).
 *
 * Idempotent : si le devis est deja en statut 'accepted', renvoie 200.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { sendProviderQuoteApprovedEmail } from '@/lib/emails/resend.service';
import {
  sendProviderQuoteApprovedSms,
  sendProviderSmsBestEffort,
} from '@/lib/sms/provider-notifications';
import {
  computeQuoteHash,
  hashOtpCode,
  requiresAdvancedSignature,
  signQuoteHash,
} from '@/lib/signature/quote-signature';
import { z } from 'zod';

const acceptBodySchema = z
  .object({
    signed_name: z.string().trim().min(2).max(120).optional(),
    signed_otp_code: z.string().regex(/^\d{6}$/).optional(),
  })
  .partial()
  .default({});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    let body: z.infer<typeof acceptBodySchema> = {};
    try {
      const raw = await request.json();
      const parsed = acceptBodySchema.safeParse(raw);
      if (parsed.success) body = parsed.data;
    } catch {
      // body absent
    }

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
    }

    // Fetch devis + items pour le hash canonique
    const { data: quote, error: fetchError } = await serviceClient
      .from('provider_quotes')
      .select(`
        id, status, accepted_at,
        title, reference, description,
        subtotal, tax_amount, total_amount,
        valid_until, created_at,
        terms_and_conditions,
        owner_profile_id,
        provider_profile_id,
        property_id,
        ticket_id,
        provider:profiles!provider_quotes_provider_profile_id_fkey (
          email, prenom, nom, telephone
        ),
        owner:profiles!provider_quotes_owner_profile_id_fkey (
          prenom, nom
        ),
        property:properties (
          adresse_complete, code_postal, ville
        ),
        items:provider_quote_items (
          description, quantity, unit, unit_price, tax_rate, sort_order
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !quote) {
      return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 });
    }

    const isOwner = quote.owner_profile_id === profile.id;
    const isAdmin = profile.role === 'admin';
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Seul le destinataire peut accepter ce devis' },
        { status: 403 },
      );
    }

    if (quote.status === 'accepted') {
      return NextResponse.json({ ok: true, already: true });
    }

    const transitionable = ['sent', 'viewed'];
    if (!transitionable.includes(quote.status)) {
      return NextResponse.json(
        {
          error: `Devis non acceptable depuis le statut "${quote.status}". Le prestataire doit d'abord l'envoyer.`,
        },
        { status: 400 },
      );
    }

    if (!body.signed_name) {
      return NextResponse.json(
        { error: 'Signature requise : saisissez votre nom complet (signed_name).' },
        { status: 400 },
      );
    }

    const needsAdvanced = requiresAdvancedSignature(quote.total_amount);
    const acceptedAt = new Date().toISOString();

    // Capture preuves
    const headers = request.headers;
    const ip =
      headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headers.get('x-real-ip') ||
      null;
    const userAgent = headers.get('user-agent') || null;

    const updatePayload: Record<string, unknown> = {
      status: 'accepted',
      accepted_at: acceptedAt,
      acceptance_signed_name: body.signed_name,
      acceptance_signed_at: acceptedAt,
      acceptance_signed_ip: ip,
      acceptance_signed_user_agent: userAgent,
      signature_level: 'simple',
    };

    // Signature avancee : exige + valide OTP, calcule hash + HMAC
    if (needsAdvanced) {
      if (!body.signed_otp_code) {
        return NextResponse.json(
          {
            error: 'Code de signature requis pour ce montant. Demandez un code via /signature/request-otp.',
            requires_otp: true,
          },
          { status: 400 },
        );
      }

      // Recuperer l'OTP actif le plus recent du profil sur ce devis
      const { data: otp } = await serviceClient
        .from('quote_signature_otps')
        .select('id, code_hash, salt, expires_at, attempts, used_at')
        .eq('quote_id', quote.id)
        .eq('profile_id', profile.id)
        .is('used_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otp) {
        return NextResponse.json(
          { error: 'Aucun code actif. Demandez un nouveau code.', requires_otp: true },
          { status: 400 },
        );
      }
      if (new Date(otp.expires_at as string) < new Date()) {
        return NextResponse.json(
          { error: 'Code expire. Demandez un nouveau code.', requires_otp: true },
          { status: 400 },
        );
      }
      if ((otp.attempts as number) >= 3) {
        // Brule cet OTP (impossible de reessayer)
        await serviceClient
          .from('quote_signature_otps')
          .update({ used_at: new Date().toISOString() })
          .eq('id', otp.id);
        return NextResponse.json(
          { error: 'Trop de tentatives. Demandez un nouveau code.', requires_otp: true },
          { status: 400 },
        );
      }

      const expectedHash = hashOtpCode(body.signed_otp_code, otp.salt as string);
      if (expectedHash !== otp.code_hash) {
        await serviceClient
          .from('quote_signature_otps')
          .update({ attempts: (otp.attempts as number) + 1 })
          .eq('id', otp.id);
        return NextResponse.json(
          {
            error: 'Code incorrect.',
            attempts_remaining: Math.max(0, 3 - ((otp.attempts as number) + 1)),
          },
          { status: 400 },
        );
      }

      // OTP valide -> bruler + calculer hash + HMAC
      await serviceClient
        .from('quote_signature_otps')
        .update({ used_at: acceptedAt })
        .eq('id', otp.id);

      const items = ((quote.items || []) as Array<{
        description: string;
        quantity: number | string;
        unit?: string | null;
        unit_price: number | string;
        tax_rate: number | string;
        sort_order?: number | null;
      }>).map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unit: it.unit ?? null,
        unit_price: it.unit_price,
        tax_rate: it.tax_rate,
        sort_order: it.sort_order ?? 0,
      }));

      const documentHash = computeQuoteHash({
        id: quote.id,
        reference: quote.reference,
        title: quote.title,
        description: quote.description ?? null,
        subtotal: quote.subtotal,
        tax_amount: quote.tax_amount,
        total_amount: quote.total_amount,
        valid_until: quote.valid_until ?? null,
        created_at: quote.created_at,
        provider_profile_id: quote.provider_profile_id,
        owner_profile_id: quote.owner_profile_id ?? null,
        property_id: quote.property_id ?? null,
        ticket_id: quote.ticket_id ?? null,
        terms_and_conditions: quote.terms_and_conditions ?? null,
        items,
      });

      let hmac: string;
      try {
        hmac = signQuoteHash({
          documentHash,
          quoteId: quote.id,
          signedAtIso: acceptedAt,
        });
      } catch (err) {
        console.error('[provider/quotes/:id/accept] HMAC error:', err);
        return NextResponse.json(
          {
            error: 'Configuration serveur incomplete (SIGNATURE_HMAC_KEY manquant). Contactez le support.',
          },
          { status: 500 },
        );
      }

      updatePayload.signature_level = 'advanced';
      updatePayload.signature_otp_method = 'email';
      updatePayload.signature_otp_verified_at = acceptedAt;
      updatePayload.signature_document_hash = documentHash;
      updatePayload.signature_hmac = hmac;
    }

    const { error: updateError } = await serviceClient
      .from('provider_quotes')
      .update(updatePayload)
      .eq('id', id);

    if (updateError) {
      console.error('[provider/quotes/:id/accept] update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Email prestataire (best-effort, non bloquant)
    const provider = quote.provider as {
      email?: string | null;
      prenom?: string | null;
      nom?: string | null;
      telephone?: string | null;
    } | null;
    const owner = quote.owner as {
      prenom?: string | null;
      nom?: string | null;
    } | null;
    const property = quote.property as {
      adresse_complete?: string | null;
      code_postal?: string | null;
      ville?: string | null;
    } | null;

    if (provider?.email) {
      const recipientName =
        `${provider.prenom || ''} ${provider.nom || ''}`.trim() || 'Prestataire';
      const clientName = owner
        ? `${owner.prenom || ''} ${owner.nom || ''}`.trim() || null
        : null;
      const propertyAddress = property
        ? [property.adresse_complete, [property.code_postal, property.ville].filter(Boolean).join(' ')]
            .filter(Boolean)
            .join(', ')
        : null;
      const totalEuros =
        typeof quote.total_amount === 'string'
          ? parseFloat(quote.total_amount)
          : (quote.total_amount as number);

      sendProviderQuoteApprovedEmail({
        providerEmail: provider.email,
        recipientName,
        quoteReference: quote.reference,
        quoteTitle: quote.title,
        clientName,
        propertyAddress,
        totalAmountEuros: Number.isFinite(totalEuros) ? totalEuros : 0,
        acceptedAt,
        quoteId: quote.id,
      }).catch((err) => {
        console.error('[provider/quotes/:id/accept] sendProviderQuoteApprovedEmail failed:', err);
      });
    }

    // SMS prestataire (best-effort, non bloquant) — uniquement si telephone connu
    if (provider?.telephone) {
      const totalEuros =
        typeof quote.total_amount === 'string'
          ? parseFloat(quote.total_amount)
          : (quote.total_amount as number);
      sendProviderSmsBestEffort(
        () =>
          sendProviderQuoteApprovedSms({
            phone: provider.telephone!,
            providerProfileId: quote.provider_profile_id,
            quoteReference: quote.reference,
            totalAmountEuros: Number.isFinite(totalEuros) ? totalEuros : 0,
            quoteId: quote.id,
          }),
        'quote_approved',
      );
    }

    return NextResponse.json({
      ok: true,
      accepted_at: acceptedAt,
      signature_level: updatePayload.signature_level,
    });
  } catch (error: unknown) {
    console.error('Error in POST /api/provider/quotes/[id]/accept:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}
