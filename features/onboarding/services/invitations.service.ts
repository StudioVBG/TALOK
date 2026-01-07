import { createClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";

export interface Invitation {
  id: string;
  token: string;
  email: string;
  role: "locataire_principal" | "colocataire" | "garant";
  property_id: string | null;
  unit_id: string | null;
  lease_id: string | null;
  created_by: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
  created_at: string;
}

export interface CreateInvitationData {
  email: string;
  role: "locataire_principal" | "colocataire" | "garant";
  property_id?: string;
  unit_id?: string;
  lease_id?: string;
}

export class InvitationsService {
  private supabase = createClient();

  /**
   * Créer une invitation
   */
  async createInvitation(data: CreateInvitationData): Promise<Invitation> {
    // Générer un token unique
    const token = this.generateToken();

    // Date d'expiration : 7 jours
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Récupérer l'utilisateur actuel
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Utilisateur non authentifié");

    const { data: profile, error: profileError } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) throw new Error("Profil non trouvé");
    const profileData = profile as any;

    const { data: invitation, error } = await this.supabase
      .from("invitations")
      .insert({
        token,
        email: data.email,
        role: data.role,
        property_id: data.property_id || null,
        unit_id: data.unit_id || null,
        lease_id: data.lease_id || null,
        created_by: profileData.id,
        expires_at: expiresAt.toISOString(),
      } as any)
      .select()
      .single();

    if (error) throw error;
    return invitation;
  }

  /**
   * Valider un token d'invitation
   */
  async validateInvitationToken(token: string): Promise<Invitation | null> {
    const { data, error } = await this.supabase
      .from("invitations")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !data) return null;

    // Vérifier l'expiration
    if (new Date(data.expires_at) < new Date()) {
      return null; // Expiré
    }

    // Vérifier si déjà utilisé
    if (data.used_at) {
      return null; // Déjà utilisé
    }

    return data;
  }

  /**
   * Marquer une invitation comme utilisée ET lier le profile_id au lease_signers
   */
  async markInvitationAsUsed(token: string, userId: string): Promise<void> {
    // 1. Récupérer le profil de l'utilisateur
    const { data: profile, error: profileError } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) throw new Error("Profil non trouvé");
    const profileData = profile as any;

    // 2. Récupérer l'invitation pour avoir le lease_id et l'email
    const { data: invitation, error: invError } = await this.supabase
      .from("invitations")
      .select("id, lease_id, email")
      .eq("token", token)
      .single();

    if (invError || !invitation) throw new Error("Invitation non trouvée");
    const invitationData = invitation as any;

    // 3. Marquer l'invitation comme utilisée
    const { error } = await this.supabase
      .from("invitations")
      .update({
        used_at: new Date().toISOString(),
        used_by: profileData.id,
      } as any)
      .eq("token", token);

    if (error) throw error;

    // 4. ✅ CRITIQUE : Lier le profile_id au lease_signers si un bail existe
    if (invitationData.lease_id) {
      const { error: signerError } = await this.supabase
        .from("lease_signers")
        .update({ profile_id: profileData.id } as any)
        .eq("lease_id", invitationData.lease_id)
        .eq("invited_email", invitationData.email)
        .is("profile_id", null);

      if (signerError) {
        console.error("[markInvitationAsUsed] Erreur liaison lease_signers:", signerError);
      } else {
        console.log(`[markInvitationAsUsed] ✅ Profile ${profileData.id} lié au lease_signers pour bail ${invitationData.lease_id}`);
      }
    }
  }

  /**
   * Vérifier si un email a déjà une invitation en attente
   */
  async hasPendingInvitation(email: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("invitations")
      .select("id")
      .eq("email", email)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1);

    if (error) return false;
    return (data?.length || 0) > 0;
  }

  /**
   * Renvoyer une invitation (régénère le token)
   * Utilise la fonction RPC PostgreSQL pour garantir la sécurité et la cohérence
   */
  async resendInvitation(invitationId: string): Promise<Invitation> {
    // Utiliser la fonction RPC PostgreSQL pour régénérer le token
    const { data, error } = await this.supabase.rpc("resend_invitation", {
      p_invitation_id: invitationId,
    });

    if (error) throw error;
    return data as Invitation;
  }

  /**
   * Générer un token unique
   */
  private generateToken(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

export const invitationsService = new InvitationsService();

