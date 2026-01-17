export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

// =====================================================
// API Route: Sites COPRO
// GET /api/copro/sites - Liste des sites
// POST /api/copro/sites - Créer un site
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sitesService } from '@/features/copro/services';
import { z } from 'zod';

// Schéma de validation pour la création
const CreateSiteSchema = z.object({
  name: z.string().min(2, 'Nom requis (min 2 caractères)'),
  type: z.enum(['copropriete', 'lotissement', 'residence_mixte', 'asl', 'aful']),
  address_line1: z.string().min(5, 'Adresse requise'),
  address_line2: z.string().optional(),
  postal_code: z.string().min(5, 'Code postal requis'),
  city: z.string().min(2, 'Ville requise'),
  country: z.string().default('FR'),
  siret: z.string().optional(),
  numero_immatriculation: z.string().optional(),
  date_reglement: z.string().optional(),
  fiscal_year_start_month: z.number().min(1).max(12).default(1),
  total_tantiemes_general: z.number().min(1).default(10000),
  syndic_type: z.enum(['professionnel', 'benevole', 'cooperatif']).default('professionnel'),
  syndic_company_name: z.string().optional(),
  syndic_siret: z.string().optional(),
  syndic_address: z.string().optional(),
  syndic_email: z.string().email().optional(),
  syndic_phone: z.string().optional(),
});

// GET: Liste des sites
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }
    
    // Récupérer les sites accessibles
    const { data: sites, error } = await supabase
      .from('sites')
      .select(`
        *,
        buildings:buildings(count),
        units:copro_units(count)
      `)
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    
    return NextResponse.json(sites || []);
  } catch (error: unknown) {
    console.error('Erreur GET /api/copro/sites:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST: Créer un site
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }
    
    // Parser et valider le body
    const body = await request.json();
    const validationResult = CreateSiteSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const input = validationResult.data;
    
    // Récupérer le profile_id de l'utilisateur pour le syndic
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    
    // Créer le site
    const { data: site, error } = await supabase
      .from('sites')
      .insert({
        ...input,
        syndic_profile_id: profile?.id,
        created_by: user.id,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Attribuer le rôle syndic à l'utilisateur pour ce site
    await supabase
      .from('user_roles')
      .insert({
        user_id: user.id,
        role_code: 'syndic',
        site_id: site.id,
        granted_by: user.id,
      });
    
    return NextResponse.json(site, { status: 201 });
  } catch (error: unknown) {
    console.error('Erreur POST /api/copro/sites:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

