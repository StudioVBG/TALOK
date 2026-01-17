export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =====================================================
// API Route: Invitations COPRO
// GET /api/copro/invites?siteId= - Liste des invitations
// POST /api/copro/invites - Créer une/des invitation(s)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Schéma pour une invitation
const InviteSchema = z.object({
  email: z.string().email('Email invalide'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  site_id: z.string().uuid(),
  unit_id: z.string().uuid().optional(),
  target_role: z.enum([
    'syndic', 'conseil_syndical', 'president_cs',
    'coproprietaire_occupant', 'coproprietaire_bailleur',
    'coproprietaire_nu', 'usufruitier',
    'locataire', 'gardien', 'prestataire'
  ]).default('coproprietaire_occupant'),
  ownership_type: z.enum([
    'pleine_propriete', 'nue_propriete', 'usufruit', 'indivision', 'sci'
  ]).optional(),
  ownership_share: z.number().min(0).max(1).default(1),
  personal_message: z.string().optional(),
});

// Schéma pour création batch
const BatchInvitesSchema = z.object({
  site_id: z.string().uuid(),
  invites: z.array(z.object({
    email: z.string().email(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    unit_id: z.string().uuid().optional(),
    target_role: z.enum([
      'syndic', 'conseil_syndical', 'president_cs',
      'coproprietaire_occupant', 'coproprietaire_bailleur',
      'coproprietaire_nu', 'usufruitier',
      'locataire', 'gardien', 'prestataire'
    ]).default('coproprietaire_occupant'),
    ownership_type: z.enum([
      'pleine_propriete', 'nue_propriete', 'usufruit', 'indivision', 'sci'
    ]).optional(),
    ownership_share: z.number().min(0).max(1).default(1),
  })),
  send_emails: z.boolean().default(true),
  personal_message: z.string().optional(),
});

// GET: Liste des invitations
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const status = searchParams.get('status');
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    if (!siteId) {
      return NextResponse.json({ error: 'siteId requis' }, { status: 400 });
    }
    
    let query = supabase
      .from('copro_invites')
      .select(`
        *,
        site:sites(name),
        unit:copro_units(lot_number, unit_type)
      `)
      .eq('site_id', siteId)
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    return NextResponse.json(data || []);
  } catch (error: unknown) {
    console.error('Erreur GET /api/copro/invites:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

// POST: Créer des invitations
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    const body = await request.json();
    
    // Vérifier si c'est une création batch
    if (body.invites && Array.isArray(body.invites)) {
      const validationResult = BatchInvitesSchema.safeParse(body);
      
      if (!validationResult.success) {
        return NextResponse.json(
          { error: 'Données invalides', details: validationResult.error.errors },
          { status: 400 }
        );
      }
      
      const { site_id, invites, send_emails, personal_message } = validationResult.data;
      
      const created = [];
      const errors = [];
      
      for (const invite of invites) {
        try {
          const { data, error } = await supabase
            .from('copro_invites')
            .insert({
              ...invite,
              site_id,
              personal_message,
              invited_by: user.id,
              expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .select()
            .single();
          
          if (error) {
            errors.push({ email: invite.email, error: error instanceof Error ? error.message : "Une erreur est survenue" });
            continue;
          }
          
          created.push(data);
          
          // Envoyer l'email si demandé
          if (send_emails && data) {
            try {
              await sendInviteEmail(data, supabase);
            } catch (emailError) {
              // Ne pas bloquer si l'email échoue
              console.error('Erreur envoi email:', emailError);
            }
          }
        } catch (err: any) {
          errors.push({ email: invite.email, error: err.message });
        }
      }
      
      return NextResponse.json({
        created,
        errors,
        sent: send_emails ? created.length : 0,
      }, { status: 201 });
    }
    
    // Création simple
    const validationResult = InviteSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const { data: invite, error } = await supabase
      .from('copro_invites')
      .insert({
        ...validationResult.data,
        invited_by: user.id,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(invite, { status: 201 });
  } catch (error: unknown) {
    console.error('Erreur POST /api/copro/invites:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

// Fonction helper pour envoyer l'email d'invitation
async function sendInviteEmail(invite: any, supabase: any) {
  // Récupérer les infos du site
  const { data: site } = await supabase
    .from('sites')
    .select('name')
    .eq('id', invite.site_id)
    .single();
  
  // Appeler l'API d'envoi d'email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  await fetch(`${appUrl}/api/emails/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: invite.email,
      template: 'copro-invite',
      data: {
        first_name: invite.first_name || 'Futur copropriétaire',
        site_name: site?.name || 'votre copropriété',
        invite_url: `${appUrl}/invite/copro?token=${invite.token}`,
        personal_message: invite.personal_message,
        expires_at: invite.expires_at,
      },
    }),
  });
  
  // Mettre à jour le statut
  await supabase
    .from('copro_invites')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', invite.id);
}

