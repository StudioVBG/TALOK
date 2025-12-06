// =====================================================
// API: Portfolio prestataire
// GET/POST /api/provider/portfolio
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createPortfolioItemSchema = z.object({
  service_type: z.string().min(1),
  intervention_type: z.string().optional(),
  title: z.string().min(3).max(100),
  description: z.string().max(1000).optional(),
  before_photo_url: z.string().url().optional(),
  before_photo_caption: z.string().max(200).optional(),
  after_photo_url: z.string().url(),
  after_photo_caption: z.string().max(200).optional(),
  additional_photos: z.array(z.object({
    url: z.string().url(),
    caption: z.string().max(200).optional(),
    type: z.enum(['before', 'after', 'during']),
  })).optional(),
  location_type: z.enum(['appartement', 'maison', 'commerce', 'bureau', 'autre']).optional(),
  location_city: z.string().max(100).optional(),
  location_department: z.string().max(3).optional(),
  completed_at: z.string().optional(),
  duration_hours: z.number().positive().optional(),
  total_cost: z.number().positive().optional(),
  is_public: z.boolean().optional().default(true),
  is_featured: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional(),
  work_order_id: z.string().uuid().optional(),
});

// GET - Récupérer le portfolio
export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('provider_id');
    const publicOnly = searchParams.get('public_only') === 'true';
    const featuredOnly = searchParams.get('featured_only') === 'true';
    const serviceType = searchParams.get('service_type');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Si pas de provider_id, récupérer celui de l'utilisateur connecté
    let targetProviderId = providerId;
    
    if (!targetProviderId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .single();
      
      if (!profile || profile.role !== 'provider') {
        return NextResponse.json({ error: 'Accès réservé aux prestataires' }, { status: 403 });
      }
      
      targetProviderId = profile.id;
    }
    
    // Construire la requête
    let query = supabase
      .from('provider_portfolio_items')
      .select('*', { count: 'exact' })
      .eq('provider_profile_id', targetProviderId)
      .order('is_featured', { ascending: false })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Filtres
    if (publicOnly || providerId) {
      // Si on consulte le portfolio d'un autre, uniquement public et approuvé
      query = query
        .eq('is_public', true)
        .eq('moderation_status', 'approved');
    }
    
    if (featuredOnly) {
      query = query.eq('is_featured', true);
    }
    
    if (serviceType) {
      query = query.eq('service_type', serviceType);
    }
    
    const { data: items, error, count } = await query;
    
    if (error) {
      console.error('Erreur récupération portfolio:', error);
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      items,
      total: count,
      limit,
      offset,
    });
    
  } catch (error) {
    console.error('Erreur API portfolio GET:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST - Créer un item de portfolio
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
    
    if (!profile || profile.role !== 'provider') {
      return NextResponse.json({ error: 'Accès réservé aux prestataires' }, { status: 403 });
    }
    
    // Parser et valider le body
    const body = await request.json();
    const validationResult = createPortfolioItemSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const data = validationResult.data;
    
    // Vérifier le nombre d'items en vedette si is_featured
    if (data.is_featured) {
      const { count: featuredCount } = await supabase
        .from('provider_portfolio_items')
        .select('*', { count: 'exact', head: true })
        .eq('provider_profile_id', profile.id)
        .eq('is_featured', true);
      
      if ((featuredCount || 0) >= 3) {
        return NextResponse.json(
          { error: 'Maximum 3 réalisations en vedette autorisées' },
          { status: 400 }
        );
      }
    }
    
    // Créer l'item
    const { data: item, error: createError } = await supabase
      .from('provider_portfolio_items')
      .insert({
        provider_profile_id: profile.id,
        ...data,
        moderation_status: 'pending', // Toujours en attente de modération
      })
      .select()
      .single();
    
    if (createError) {
      console.error('Erreur création portfolio item:', createError);
      return NextResponse.json({ error: 'Erreur création' }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      item,
      message: 'Réalisation ajoutée. Elle sera visible après modération.',
    });
    
  } catch (error) {
    console.error('Erreur API portfolio POST:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

