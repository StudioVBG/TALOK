export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Routes pour un template de devis specifique
 * GET    /api/provider/quote-templates/[id] - Recuperer un template + ses lignes
 * PUT    /api/provider/quote-templates/[id] - Mettre a jour le template + ses lignes
 * DELETE /api/provider/quote-templates/[id] - Supprimer (ou archiver) un template
 *
 * PUT replace-all : si "items" est fourni, les lignes existantes sont remplacees.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { z } from 'zod';

const itemSchema = z.object({
  position: z.number().int().min(0).optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unit: z.string().optional(),
  unit_price_cents: z.number().int().min(0),
  tax_rate: z.number().min(0).max(100).default(20),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  default_validity_days: z.number().int().min(1).max(365).optional(),
  default_tax_rate: z.number().min(0).max(100).optional(),
  default_terms: z.string().nullable().optional(),
  default_payment_conditions: z.string().nullable().optional(),
  is_archived: z.boolean().optional(),
  items: z.array(itemSchema).optional(),
});

async function authProvider() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Non autorise' }, { status: 401 }) };
  }
  const serviceClient = getServiceClient();
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .single();
  if (!profile || profile.role !== 'provider') {
    return {
      error: NextResponse.json({ error: 'Acces non autorise' }, { status: 403 }),
    };
  }
  return { profile, serviceClient };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authProvider();
    if (auth.error) return auth.error;
    const { profile, serviceClient } = auth;

    const { data: template, error } = await serviceClient
      .from('quote_templates')
      .select(`*, items:quote_template_items(*)`)
      .eq('id', id)
      .eq('provider_profile_id', profile.id)
      .single();

    if (error || !template) {
      return NextResponse.json({ error: 'Template introuvable' }, { status: 404 });
    }

    template.items = (template.items || []).sort(
      (a: { position: number }, b: { position: number }) => a.position - b.position,
    );

    return NextResponse.json({ template });
  } catch (error: unknown) {
    console.error('Error in GET /api/provider/quote-templates/[id]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authProvider();
    if (auth.error) return auth.error;
    const { profile, serviceClient } = auth;

    const body = await request.json();
    const validation = updateTemplateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: validation.error.errors },
        { status: 400 },
      );
    }
    const data = validation.data;

    // Verifier ownership avant update
    const { data: existing, error: existingError } = await serviceClient
      .from('quote_templates')
      .select('id')
      .eq('id', id)
      .eq('provider_profile_id', profile.id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Template introuvable' }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {};
    for (const key of [
      'name',
      'description',
      'category',
      'default_validity_days',
      'default_tax_rate',
      'default_terms',
      'default_payment_conditions',
      'is_archived',
    ] as const) {
      if (data[key] !== undefined) {
        updatePayload[key] = data[key];
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await serviceClient
        .from('quote_templates')
        .update(updatePayload)
        .eq('id', id);

      if (updateError) {
        console.error('[provider/quote-templates/:id] PUT update error:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    if (data.items !== undefined) {
      // Replace-all : delete + insert
      const { error: deleteError } = await serviceClient
        .from('quote_template_items')
        .delete()
        .eq('template_id', id);

      if (deleteError) {
        console.error('[provider/quote-templates/:id] PUT delete items error:', deleteError);
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      if (data.items.length > 0) {
        const itemsRows = data.items.map((it, idx) => ({
          template_id: id,
          position: it.position ?? idx,
          title: it.title,
          description: it.description ?? null,
          quantity: it.quantity,
          unit: it.unit ?? null,
          unit_price_cents: it.unit_price_cents,
          tax_rate: it.tax_rate,
        }));

        const { error: insertError } = await serviceClient
          .from('quote_template_items')
          .insert(itemsRows);

        if (insertError) {
          console.error('[provider/quote-templates/:id] PUT insert items error:', insertError);
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      }
    }

    const { data: full } = await serviceClient
      .from('quote_templates')
      .select(`*, items:quote_template_items(*)`)
      .eq('id', id)
      .single();

    return NextResponse.json({ template: full });
  } catch (error: unknown) {
    console.error('Error in PUT /api/provider/quote-templates/[id]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authProvider();
    if (auth.error) return auth.error;
    const { profile, serviceClient } = auth;

    const { searchParams } = new URL(request.url);
    const archive = searchParams.get('archive') === 'true';

    const { data: existing, error: existingError } = await serviceClient
      .from('quote_templates')
      .select('id')
      .eq('id', id)
      .eq('provider_profile_id', profile.id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Template introuvable' }, { status: 404 });
    }

    if (archive) {
      const { error: archiveError } = await serviceClient
        .from('quote_templates')
        .update({ is_archived: true })
        .eq('id', id);
      if (archiveError) {
        return NextResponse.json({ error: archiveError.message }, { status: 500 });
      }
      return NextResponse.json({ archived: true });
    }

    const { error: deleteError } = await serviceClient
      .from('quote_templates')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error: unknown) {
    console.error('Error in DELETE /api/provider/quote-templates/[id]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}
