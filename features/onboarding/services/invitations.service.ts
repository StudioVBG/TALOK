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
    return invitation as unknown as Invitation;
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
    if (new Date(data.expires_at as string) < new Date()) {
      return null; // Expiré
    }

    // Vérifier si déjà utilisé
    if (data.used_at) {
      return null; // Déjà utilisé
    }

    return data as unknown as Invitation;
  }

  /**
   * Marquer une invitation comme utilisée ET lier le profile_id au lease_signers
   * Avec retry (2 tentatives max) et auto-link global par email
   */
  async markInvitationAsUsed(token: string, userId: string): Promise<void> {
    // 1. Récupérer le profil de l'utilisateur
    const { data: profile, error: profileError } = await this.supabase
      .from("profiles")
      .select("id, user_id")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) throw new Error("Profil non trouvé");
    const profileData = profile as any;

    // 2. Récupérer l'invitation pour avoir le lease_id et l'email
    const { data: invitation, error: invError } = await this.supabase
      .from("invitations")
      .select("id, lease_id, email, property_id")
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
    //    Avec retry en cas d'erreur transitoire
    if (invitationData.lease_id) {
      let linked = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        const { data: updated, error: signerError } = await this.supabase
          .from("lease_signers")
          .update({ profile_id: profileData.id } as any)
          .eq("lease_id", invitationData.lease_id)
          .eq("invited_email", invitationData.email)
          .is("profile_id", null)
          .select("id");

        if (signerError) {
          console.error(`[markInvitationAsUsed] Tentative ${attempt}/2 - Erreur liaison lease_signers:`, signerError);
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 500)); // attente avant retry
          }
        } else {
          const updatedCount = (updated || []).length;
          console.log(`[markInvitationAsUsed] ✅ ${updatedCount} lease_signers liés au profil ${profileData.id} pour bail ${invitationData.lease_id}`);
          linked = true;
          break;
        }
      }

      if (!linked) {
        console.error("[markInvitationAsUsed] ⚠️ Échec liaison après 2 tentatives — sera rattrapé par auto-link dans le layout");
      }
    }

    // 5. ✅ AUTO-LINK GLOBAL : Lier TOUS les lease_signers orphelins avec le même email
    //    Couvre le cas où le locataire a plusieurs invitations (colocation, changement de bail)
    if (invitationData.email) {
      try {
        const { data: otherOrphans } = await this.supabase
          .from("lease_signers")
          .select("id")
          .ilike("invited_email", invitationData.email)
          .is("profile_id", null)
          .neq("lease_id", invitationData.lease_id || "");

        if (otherOrphans && otherOrphans.length > 0) {
          await this.supabase
            .from("lease_signers")
            .update({ profile_id: profileData.id } as any)
            .ilike("invited_email", invitationData.email)
            .is("profile_id", null);

          console.log(`[markInvitationAsUsed] ✅ ${otherOrphans.length} lease_signers orphelins supplémentaires liés`);
        }
      } catch (globalLinkErr) {
        console.warn("[markInvitationAsUsed] Erreur auto-link global (non-bloquante):", globalLinkErr);
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

