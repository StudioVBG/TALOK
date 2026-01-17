export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

// =====================================================
// API Route: Invitation COPRO individuelle
// GET /api/copro/invites/[token] - Valider une invitation
// POST /api/copro/invites/[token] - Accepter une invitation
// DELETE /api/copro/invites/[token] - Annuler une invitation
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: { token: string };
}

// GET: Valider une invitation (public)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { token } = params;
    
    // Appeler la fonction de validation
    const { data, error } = await supabase
      .rpc('validate_copro_invite', { p_token: token });
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      return NextResponse.json(data[0]);
    }
    
    return NextResponse.json({
      is_valid: false,
      error_message: 'Invitation non trouvée',
    });
  } catch (error: unknown) {
    console.error('Erreur GET /api/copro/invites/[token]:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

// POST: Accepter une invitation
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { token } = params;
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    // Vérifier que l'email correspond
    const { data: invite } = await supabase
      .from('copro_invites')
      .select('email')
      .eq('token', token)
      .single();
    
    if (invite && invite.email.toLowerCase() !== user.email?.toLowerCase()) {
      return NextResponse.json({
        success: false,
        error_message: 'Cette invitation est destinée à une autre adresse email',
      }, { status: 403 });
    }
    
    // Accepter l'invitation
    const { data, error } = await supabase
      .rpc('accept_copro_invite', {
        p_token: token,
        p_user_id: user.id,
      });
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      const result = data[0];
      
      // Déterminer la redirection
      let redirect_url = '/copro/dashboard';
      if (result.role_assigned === 'syndic') {
        redirect_url = '/syndic/dashboard';
      }
      
      return NextResponse.json({
        ...result,
        redirect_url,
      });
    }
    
    return NextResponse.json({
      success: false,
      error_message: 'Erreur lors de l\'acceptation',
    }, { status: 400 });
  } catch (error: unknown) {
    console.error('Erreur POST /api/copro/invites/[token]:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

// DELETE: Annuler une invitation
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { token } = params;
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    // Annuler l'invitation
    const { error } = await supabase
      .from('copro_invites')
      .update({ status: 'cancelled' })
      .eq('token', token);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Erreur DELETE /api/copro/invites/[token]:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

// PATCH: Renvoyer une invitation
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { token } = params;
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    // Récupérer l'invitation
    const { data: invite, error: fetchError } = await supabase
      .from('copro_invites')
      .select('*')
      .eq('token', token)
      .single();
    
    if (fetchError || !invite) {
      return NextResponse.json({ error: 'Invitation non trouvée' }, { status: 404 });
    }
    
    // Mettre à jour et renvoyer
    const { data, error } = await supabase
      .from('copro_invites')
      .update({
        status: 'sent',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        reminder_count: (invite.reminder_count || 0) + 1,
        last_reminder_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
      })
      .eq('token', token)
      .select()
      .single();
    
    if (error) throw error;
    
    // TODO: Renvoyer l'email
    
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Erreur PATCH /api/copro/invites/[token]:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

