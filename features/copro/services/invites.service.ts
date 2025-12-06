// =====================================================
// Service: Invitations COPRO
// =====================================================

import { createClient } from '@/lib/supabase/client';
import type { 
  CoproInvite, 
  CreateInviteInput, 
  BatchInviteInput,
  InviteValidationResult,
  InviteAcceptResult
} from '@/lib/types/copro';

// =====================================================
// CRUD INVITATIONS
// =====================================================

export async function getInvitesBySite(siteId: string): Promise<CoproInvite[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('copro_invites')
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getInviteByToken(token: string): Promise<CoproInvite | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('copro_invites')
    .select('*')
    .eq('token', token)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  return data;
}

export async function createInvite(input: CreateInviteInput): Promise<CoproInvite> {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');
  
  const { data, error } = await supabase
    .from('copro_invites')
    .insert({
      ...input,
      invited_by: user.id,
      ownership_share: input.ownership_share || 1.0,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 jours
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function createInvitesBatch(
  input: BatchInviteInput
): Promise<{ created: CoproInvite[]; sent: number; errors: string[] }> {
  const supabase = createClient();
  const errors: string[] = [];
  const created: CoproInvite[] = [];
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');
  
  for (const invite of input.invites) {
    try {
      const { data, error } = await supabase
        .from('copro_invites')
        .insert({
          ...invite,
          site_id: input.site_id,
          invited_by: user.id,
          ownership_share: invite.ownership_share || 1.0,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();
      
      if (error) {
        errors.push(`${invite.email}: ${error.message}`);
        continue;
      }
      
      created.push(data);
      
      // Envoyer l'email si demandé
      if (input.send_emails) {
        try {
          await sendInviteEmail(data);
        } catch (emailError) {
          errors.push(`${invite.email}: Erreur envoi email`);
        }
      }
    } catch (err) {
      errors.push(`${invite.email}: Erreur inconnue`);
    }
  }
  
  return {
    created,
    sent: input.send_emails ? created.length - errors.filter(e => e.includes('email')).length : 0,
    errors,
  };
}

export async function cancelInvite(id: string): Promise<void> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('copro_invites')
    .update({ status: 'cancelled' })
    .eq('id', id);
  
  if (error) throw error;
}

export async function resendInvite(id: string): Promise<CoproInvite> {
  const supabase = createClient();
  
  // Mettre à jour la date d'expiration et réinitialiser
  const { data, error } = await supabase
    .from('copro_invites')
    .update({
      status: 'sent',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      reminder_count: 0,
      sent_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  // Renvoyer l'email
  await sendInviteEmail(data);
  
  return data;
}

// =====================================================
// VALIDATION
// =====================================================

export async function validateInvite(
  token: string
): Promise<InviteValidationResult> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .rpc('validate_copro_invite', { p_token: token });
  
  if (error) throw error;
  
  if (data && data.length > 0) {
    return data[0] as InviteValidationResult;
  }
  
  return {
    is_valid: false,
    invite_id: null,
    email: null,
    first_name: null,
    last_name: null,
    site_id: null,
    site_name: null,
    unit_id: null,
    lot_number: null,
    target_role: null,
    ownership_type: null,
    ownership_share: null,
    error_message: 'Invitation introuvable',
  };
}

// =====================================================
// ACCEPTATION
// =====================================================

export async function acceptInvite(
  token: string,
  userId: string
): Promise<InviteAcceptResult> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .rpc('accept_copro_invite', {
      p_token: token,
      p_user_id: userId,
    });
  
  if (error) throw error;
  
  if (data && data.length > 0) {
    return data[0] as InviteAcceptResult;
  }
  
  return {
    success: false,
    invite_id: null,
    role_assigned: null,
    ownership_created: false,
    error_message: 'Erreur lors de l\'acceptation',
  };
}

// =====================================================
// ENVOI D'EMAIL
// =====================================================

async function sendInviteEmail(invite: CoproInvite): Promise<void> {
  // Appeler l'API d'envoi d'email
  const response = await fetch('/api/copro/invites/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invite_id: invite.id }),
  });
  
  if (!response.ok) {
    throw new Error('Erreur envoi email');
  }
  
  // Mettre à jour le statut
  const supabase = createClient();
  await supabase
    .from('copro_invites')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', invite.id);
}

// =====================================================
// STATISTIQUES
// =====================================================

export interface InviteStats {
  total: number;
  pending: number;
  sent: number;
  accepted: number;
  expired: number;
  cancelled: number;
}

export async function getInviteStats(siteId: string): Promise<InviteStats> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('copro_invites')
    .select('status')
    .eq('site_id', siteId);
  
  if (error) throw error;
  
  const invites = data || [];
  
  return {
    total: invites.length,
    pending: invites.filter(i => i.status === 'pending').length,
    sent: invites.filter(i => i.status === 'sent').length,
    accepted: invites.filter(i => i.status === 'accepted').length,
    expired: invites.filter(i => i.status === 'expired').length,
    cancelled: invites.filter(i => i.status === 'cancelled').length,
  };
}

// =====================================================
// EXPORT
// =====================================================

export const invitesService = {
  getInvitesBySite,
  getInviteByToken,
  createInvite,
  createInvitesBatch,
  cancelInvite,
  resendInvite,
  validateInvite,
  acceptInvite,
  getInviteStats,
};

export default invitesService;

