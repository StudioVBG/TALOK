export const runtime = 'nodejs';

// =====================================================
// API: Portfolio prestataire - Item individuel
// GET/PATCH/DELETE /api/provider/portfolio/[id]
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updatePortfolioItemSchema = z.object({
  service_type: z.string().min(1).optional(),
  intervention_type: z.string().optional(),
  title: z.string().min(3).max(100).optional(),
  description: z.string().max(1000).optional(),
  before_photo_url: z.string().url().optional().nullable(),
  before_photo_caption: z.string().max(200).optional(),
  after_photo_url: z.string().url().optional(),
  after_photo_caption: z.string().max(200).optional(),
  additional_photos: z.array(z.object({
    url: z.string().url(),
    caption: z.string().max(200).optional(),
    type: z.enum(['before', 'after', 'during']),
  })).optional(),
  location_type: z.enum(['appartement', 'maison', 'commerce', 'bureau', 'autre']).optional(),
  location_city: z.string().max(100).optional(),
  completed_at: z.string().optional(),
  duration_hours: z.number().positive().optional(),
  is_public: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  display_order: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Récupérer un item spécifique
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createRouteHandlerClient();
    
    const { data: item, error } = await supabase
      .from('provider_portfolio_items')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !item) {
      return NextResponse.json({ error: 'Item non trouvé' }, { status: 404 });
    }
    
    // Vérifier si l'item est public ou si c'est le propriétaire
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!item.is_public || item.moderation_status !== 'approved') {
      if (!user) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .single();
      
      if (!profile || (profile.id !== item.provider_profile_id && profile.role !== 'admin')) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
      }
    }
    
    // Incrémenter le compteur de vues
    await supabase
      .from('provider_portfolio_items')
      .update({ view_count: ((item.view_count as number) || 0) + 1 })
      .eq('id', id);
    
    return NextResponse.json({
      success: true,
      item,
    });
    
  } catch (error) {
    console.error('Erreur API portfolio GET [id]:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH - Mettre à jour un item
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
    
    // Vérifier que l'item appartient au prestataire (ou admin)
    const { data: existingItem } = await supabase
      .from('provider_portfolio_items')
      .select('provider_profile_id, is_featured')
      .eq('id', id)
      .single();
    
    if (!existingItem) {
      return NextResponse.json({ error: 'Item non trouvé' }, { status: 404 });
    }
    
    if (existingItem.provider_profile_id !== profile.id && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }
    
    // Parser et valider le body
    const body = await request.json();
    const validationResult = updatePortfolioItemSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const data = validationResult.data;
    
    // Vérifier le nombre d'items en vedette si on passe à featured
    if (data.is_featured && !existingItem.is_featured) {
      const { count: featuredCount } = await supabase
        .from('provider_portfolio_items')
        .select('*', { count: 'exact', head: true })
        .eq('provider_profile_id', existingItem.provider_profile_id as string)
        .eq('is_featured', true);
      
      if ((featuredCount || 0) >= 3) {
        return NextResponse.json(
          { error: 'Maximum 3 réalisations en vedette autorisées' },
          { status: 400 }
        );
      }
    }
    
    // Si modification substantielle, repasser en modération
    const needsReModeration = data.after_photo_url || data.before_photo_url || data.additional_photos;
    
    // Mettre à jour l'item
    const { data: item, error: updateError } = await supabase
      .from('provider_portfolio_items')
      .update({
        ...data,
        ...(needsReModeration && profile.role !== 'admin' ? { moderation_status: 'pending' } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) {
      console.error('Erreur mise à jour portfolio item:', updateError);
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      item,
      message: needsReModeration && profile.role !== 'admin' 
        ? 'Modification enregistrée. Les nouvelles photos seront vérifiées.'
        : 'Modification enregistrée.',
    });
    
  } catch (error) {
    console.error('Erreur API portfolio PATCH [id]:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE - Supprimer un item
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
    
    // Vérifier que l'item appartient au prestataire (ou admin)
    const { data: existingItem } = await supabase
      .from('provider_portfolio_items')
      .select('provider_profile_id')
      .eq('id', id)
      .single();
    
    if (!existingItem) {
      return NextResponse.json({ error: 'Item non trouvé' }, { status: 404 });
    }
    
    if (existingItem.provider_profile_id !== profile.id && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }
    
    // Supprimer l'item
    const { error: deleteError } = await supabase
      .from('provider_portfolio_items')
      .delete()
      .eq('id', id);
    
    if (deleteError) {
      console.error('Erreur suppression portfolio item:', deleteError);
      return NextResponse.json({ error: 'Erreur suppression' }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Réalisation supprimée.',
    });
    
  } catch (error) {
    console.error('Erreur API portfolio DELETE [id]:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

