export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/provider/quotes/[id]/reject
 *
 * Refus d'un devis prestataire par le proprietaire (owner_profile_id)
 * ou un admin. Symetrique a /accept.
 *
 * Effets : provider_quotes.status -> 'rejected' + rejected_at = NOW()
 *          + rejection_reason si fourni dans le body.
 *
 * Idempotent : 200 si deja 'rejected'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { z } from 'zod';

const bodySchema = z
  .object({
    reason: z.string().max(500).optional(),
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

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
    }

    let body: z.infer<typeof bodySchema> = {};
    try {
      const raw = await request.json();
      const parsed = bodySchema.safeParse(raw);
      if (parsed.success) body = parsed.data;
    } catch {
      // body optionnel
    }

    const { data: quote, error: fetchError } = await serviceClient
      .from('provider_quotes')
      .select('id, status, owner_profile_id')
      .eq('id', id)
      .single();

    if (fetchError || !quote) {
      return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 });
    }

    const isOwner = quote.owner_profile_id === profile.id;
    const isAdmin = profile.role === 'admin';
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Seul le destinataire peut refuser ce devis' },
        { status: 403 },
      );
    }

    if (quote.status === 'rejected') {
      return NextResponse.json({ ok: true, already: true });
    }

    const transitionable = ['sent', 'viewed'];
    if (!transitionable.includes(quote.status)) {
      return NextResponse.json(
        {
          error: `Devis non refusable depuis le statut "${quote.status}".`,
        },
        { status: 400 },
      );
    }

    const rejectedAt = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: 'rejected',
      rejected_at: rejectedAt,
    };
    if (body.reason) {
      updatePayload.rejection_reason = body.reason;
    }

    const { error: updateError } = await serviceClient
      .from('provider_quotes')
      .update(updatePayload)
      .eq('id', id);

    if (updateError) {
      console.error('[provider/quotes/:id/reject] update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, rejected_at: rejectedAt });
  } catch (error: unknown) {
    console.error('Error in POST /api/provider/quotes/[id]/reject:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}
