export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Routes pour les templates de devis prestataire (devis-types reutilisables)
 * GET  /api/provider/quote-templates       - Liste des templates
 * POST /api/provider/quote-templates       - Creer un template (avec lignes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { z } from 'zod';

const itemSchema = z.object({
  position: z.number().int().min(0).optional(),
  title: z.string().min(1, 'Titre requis'),
  description: z.string().optional(),
  quantity: z.number().positive('Quantite > 0'),
  unit: z.string().optional(),
  unit_price_cents: z.number().int().min(0, 'Prix unitaire >= 0'),
  tax_rate: z.number().min(0).max(100).default(20),
});

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(120),
  description: z.string().optional(),
  category: z.string().optional(),
  default_validity_days: z.number().int().min(1).max(365).default(30),
  default_tax_rate: z.number().min(0).max(100).default(20),
  default_terms: z.string().optional(),
  default_payment_conditions: z.string().optional(),
  items: z.array(itemSchema).default([]),
});

export async function GET(request: NextRequest) {
  try {
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

    if (!profile || profile.role !== 'provider') {
      return NextResponse.json({ error: 'Acces non autorise' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('include_archived') === 'true';
    const category = searchParams.get('category');

    let query = serviceClient
      .from('quote_templates')
      .select(`
        *,
        items:quote_template_items (
          id,
          position,
          title,
          description,
          quantity,
          unit,
          unit_price_cents,
          tax_rate
        )
      `)
      .eq('provider_profile_id', profile.id)
      .order('updated_at', { ascending: false });

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }
    if (category) {
      query = query.eq('category', category);
    }

    const { data: templates, error } = await query;

    if (error) {
      console.error('[provider/quote-templates] GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      templates: (templates || []).map((t) => ({
        ...t,
        items: (t.items || []).sort(
          (a: { position: number }, b: { position: number }) => a.position - b.position,
        ),
      })),
    });
  } catch (error: unknown) {
    console.error('Error in GET /api/provider/quote-templates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    if (!profile || profile.role !== 'provider') {
      return NextResponse.json({ error: 'Acces non autorise' }, { status: 403 });
    }

    const body = await request.json();
    const validation = createTemplateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: validation.error.errors },
        { status: 400 },
      );
    }
    const data = validation.data;

    const { data: template, error: insertError } = await serviceClient
      .from('quote_templates')
      .insert({
        provider_profile_id: profile.id,
        name: data.name,
        description: data.description ?? null,
        category: data.category ?? null,
        default_validity_days: data.default_validity_days,
        default_tax_rate: data.default_tax_rate,
        default_terms: data.default_terms ?? null,
        default_payment_conditions: data.default_payment_conditions ?? null,
      })
      .select()
      .single();

    if (insertError || !template) {
      console.error('[provider/quote-templates] POST insert error:', insertError);
      return NextResponse.json(
        { error: insertError?.message || 'Erreur creation template' },
        { status: 500 },
      );
    }

    if (data.items.length > 0) {
      const itemsRows = data.items.map((it, idx) => ({
        template_id: template.id,
        position: it.position ?? idx,
        title: it.title,
        description: it.description ?? null,
        quantity: it.quantity,
        unit: it.unit ?? null,
        unit_price_cents: it.unit_price_cents,
        tax_rate: it.tax_rate,
      }));

      const { error: itemsError } = await serviceClient
        .from('quote_template_items')
        .insert(itemsRows);

      if (itemsError) {
        await serviceClient.from('quote_templates').delete().eq('id', template.id);
        console.error('[provider/quote-templates] POST items error:', itemsError);
        return NextResponse.json({ error: itemsError.message }, { status: 500 });
      }
    }

    const { data: full } = await serviceClient
      .from('quote_templates')
      .select(`*, items:quote_template_items(*)`)
      .eq('id', template.id)
      .single();

    return NextResponse.json({ template: full }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error in POST /api/provider/quote-templates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}
