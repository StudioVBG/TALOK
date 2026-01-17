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
  } catch (error: any) {
    console.error('Erreur GET /api/copro/invites:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
            errors.push({ email: invite.email, error: error.message });
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
  } catch (error: any) {
    console.error('Erreur POST /api/copro/invites:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const firstName = invite.first_name || 'Futur copropriétaire';
  const siteName = site?.name || 'votre copropriété';
  const inviteUrl = `${appUrl}/invite/copro?token=${invite.token}`;

  // Générer le HTML de l'email
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation Copropriété</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 32px; text-align: center;">
        <span style="font-size: 24px; font-weight: 700; color: white;">🏢 Talok</span>
      </div>
      <div style="padding: 40px;">
        <h1 style="margin: 0 0 16px 0; font-size: 24px; color: #111827;">Invitation à rejoindre ${siteName}</h1>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">Bonjour ${firstName},</p>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
          Vous êtes invité(e) à rejoindre la copropriété <strong>${siteName}</strong> sur Talok.
        </p>
        ${invite.personal_message ? `
        <div style="background: #f9fafb; border-left: 4px solid #2563eb; padding: 16px 20px; margin: 24px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; color: #374151; font-style: italic;">${invite.personal_message}</p>
        </div>
        ` : ''}
        <div style="text-align: center; margin: 32px 0;">
          <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Accepter l'invitation
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          Ce lien expire le ${new Date(invite.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.
        </p>
      </div>
      <div style="background: #f9fafb; padding: 24px; text-align: center;">
        <p style="margin: 0; color: #6b7280; font-size: 13px;">
          © ${new Date().getFullYear()} Talok. Tous droits réservés.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  // Appeler l'API d'envoi d'email avec la clé API interne
  const response = await fetch(`${appUrl}/api/emails/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-api-key': process.env.INTERNAL_EMAIL_API_KEY || '',
    },
    body: JSON.stringify({
      to: invite.email,
      subject: `🏢 Invitation à rejoindre ${siteName}`,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Email send failed: ${response.status}`);
  }

  // Mettre à jour le statut
  await supabase
    .from('copro_invites')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', invite.id);
}

