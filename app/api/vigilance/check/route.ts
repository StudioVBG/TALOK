export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =====================================================
// API: Vérification de vigilance
// POST /api/vigilance/check
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import { checkVigilanceServer, logVigilanceCheck } from '@/lib/services/vigilance-check.service';
import { z } from 'zod';

const checkVigilanceSchema = z.object({
  provider_id: z.string().uuid(),
  amount_ht: z.number().positive(),
  owner_id: z.string().uuid().optional(),
  quote_id: z.string().uuid().optional(),
  work_order_id: z.string().uuid().optional(),
  log_check: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    // Récupérer le profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();
    
    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }
    
    // Parser et valider le body
    const body = await request.json();
    const validationResult = checkVigilanceSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const { provider_id, amount_ht, owner_id, quote_id, work_order_id, log_check } = validationResult.data;
    
    // Effectuer la vérification
    const result = await checkVigilanceServer(
      supabase,
      provider_id,
      amount_ht,
      owner_id || profile.id
    );
    
    // Logger la vérification si demandé
    if (log_check && result.isRequired) {
      await logVigilanceCheck(supabase, {
        owner_id: owner_id || profile.id,
        provider_id,
        quote_id,
        work_order_id,
        amount_ht,
        result,
        action_taken: result.isCompliant ? 'approved' : 'blocked',
      });
    }
    
    return NextResponse.json({
      success: true,
      vigilance: result,
    });
    
  } catch (error) {
    console.error('Erreur API vigilance/check:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET pour récupérer le cumul annuel
export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('provider_id');
    const ownerId = searchParams.get('owner_id');
    
    if (!providerId) {
      return NextResponse.json({ error: 'provider_id requis' }, { status: 400 });
    }
    
    // Récupérer le profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }
    
    // Appeler la fonction SQL pour le cumul annuel
    const { data: yearlyTotal, error } = await supabase
      .rpc('get_vigilance_yearly_total', {
        p_owner_id: ownerId || profile.id,
        p_provider_id: providerId,
      });
    
    if (error) {
      console.error('Erreur cumul annuel:', error);
      return NextResponse.json({ error: 'Erreur calcul cumul' }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      yearly_total_ht: (yearlyTotal as number) || 0,
      threshold_ht: 5000,
      is_above_threshold: ((yearlyTotal as number) || 0) >= 5000,
    });
    
  } catch (error) {
    console.error('Erreur API vigilance/check GET:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

