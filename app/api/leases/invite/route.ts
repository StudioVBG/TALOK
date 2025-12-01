// @ts-nocheck
import { createClient, createClientFromRequest } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sendLeaseInviteEmail } from "@/lib/services/email-service";

// Schéma de validation
const inviteSchema = z.object({
  property_id: z.string().uuid("ID de propriété invalide"),
  type_bail: z.string().min(1, "Type de bail requis"),
  loyer: z.number().positive("Loyer doit être positif"),
  charges_forfaitaires: z.number().min(0).default(0),
  depot_garantie: z.number().min(0).default(0),
  date_debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide"),
  date_fin: z.string().nullable().optional(),
  tenant_email: z.string().email("Email du locataire invalide"),
  tenant_name: z.string().nullable().optional(),
});

/**
 * POST /api/leases/invite
 * Créer un bail draft et envoyer une invitation au locataire
 */
export async function POST(request: Request) {
  try {
    // Essayer d'abord avec createClient standard
    let supabase = await createClient();
    
    // Vérifier l'authentification
    let { data: { user }, error: authError } = await supabase.auth.getUser();
    
    // Si échec, essayer avec createClientFromRequest
    if (authError || !user) {
      console.log("[API leases/invite] Fallback to createClientFromRequest");
      supabase = createClientFromRequest(request);
      const authResult = await supabase.auth.getUser();
      user = authResult.data.user;
      authError = authResult.error;
    }
    
    if (authError || !user) {
      console.error("[API leases/invite] Auth error:", authError?.message);
      return NextResponse.json({ 
        error: "Non authentifié",
        details: authError?.message 
      }, { status: 401 });
    }

    console.log("[API leases/invite] User authenticated:", user.id, user.email);

    // Récupérer le profil propriétaire (sans email car pas dans la table profiles)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    // Debug logs
    console.log("[API leases/invite] User ID:", user.id);
    console.log("[API leases/invite] Profile Error:", profileError?.message, profileError?.code);
    console.log("[API leases/invite] Profile:", profile);

    if (profileError) {
      console.error("[API leases/invite] Erreur récupération profil:", profileError);
      
      // Si c'est une erreur RLS, essayer avec un client service role
      if (profileError.code === "PGRST301" || profileError.message?.includes("RLS")) {
        return NextResponse.json({ 
          error: "Erreur de permissions",
          details: "Les règles de sécurité empêchent l'accès à votre profil. Contactez l'administrateur.",
          code: profileError.code
        }, { status: 403 });
      }
      
      return NextResponse.json({ 
        error: "Erreur lors de la récupération du profil",
        details: profileError.message,
        code: profileError.code,
        hint: "Vérifiez que votre compte propriétaire est bien configuré"
      }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ 
        error: "Profil non trouvé",
        hint: "Aucun profil associé à cet utilisateur. Veuillez compléter votre inscription.",
        user_id: user.id
      }, { status: 404 });
    }

    if (profile.role !== "owner" && profile.role !== "admin") {
      return NextResponse.json({ 
        error: "Accès non autorisé",
        hint: `Votre rôle est "${profile.role}". Seuls les propriétaires peuvent créer des baux.`,
        current_role: profile.role
      }, { status: 403 });
    }
    
    console.log("[API leases/invite] Profile found:", profile.id, profile.role);

    // Valider les données
    const body = await request.json();
    const validated = inviteSchema.parse(body);

    // Vérifier que le bien appartient au propriétaire
    const { data: property, error: propError } = await supabase
      .from("properties")
      .select("id, owner_id, adresse_complete, code_postal, ville")
      .eq("id", validated.property_id)
      .single();

    if (propError || !property) {
      return NextResponse.json({ error: "Bien non trouvé" }, { status: 404 });
    }

    if (property.owner_id !== profile.id && profile.role !== "admin") {
      return NextResponse.json({ error: "Ce bien ne vous appartient pas" }, { status: 403 });
    }

    // Utiliser le service client pour bypass les RLS (évite la récursion infinie)
    const serviceClient = getServiceClient();

    // Vérifier si le locataire a déjà un compte
    const { data: existingTenantAuth } = await serviceClient.auth.admin.listUsers();
    const existingUser = existingTenantAuth?.users?.find(
      (u) => u.email?.toLowerCase() === validated.tenant_email.toLowerCase()
    );

    let existingTenantProfile: { id: string; user_id: string } | null = null;
    
    if (existingUser) {
      // Récupérer le profil du locataire existant
      const { data: tenantProfile } = await serviceClient
        .from("profiles")
        .select("id, user_id, role")
        .eq("user_id", existingUser.id)
        .single();
      
      if (tenantProfile) {
        existingTenantProfile = tenantProfile;
        console.log("[API leases/invite] Locataire existant trouvé:", tenantProfile.id);
      }
    }

    // Créer le bail en mode draft (colonnes de base uniquement)
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .insert({
        property_id: validated.property_id,
        type_bail: validated.type_bail,
        loyer: validated.loyer,
        charges_forfaitaires: validated.charges_forfaitaires,
        depot_de_garantie: validated.depot_garantie,
        date_debut: validated.date_debut,
        date_fin: validated.date_fin || null,
        statut: "pending_signature", // Statut indiquant qu'on attend la signature du locataire
      })
      .select()
      .single();

    if (leaseError) {
      console.error("Erreur création bail:", leaseError);
      return NextResponse.json(
        { error: "Erreur lors de la création du bail", details: leaseError.message },
        { status: 500 }
      );
    }

    console.log("[API leases/invite] Bail créé:", lease.id);

    // Ajouter le propriétaire comme signataire
    const { error: signerError } = await serviceClient
      .from("lease_signers")
      .insert({
        lease_id: lease.id,
        profile_id: profile.id,
        role: "proprietaire",
        signature_status: "pending",
      });

    if (signerError) {
      console.error("Erreur ajout signataire propriétaire:", signerError);
    }

    // Si le locataire existe, l'ajouter comme signataire et créer une notification
    if (existingTenantProfile) {
      // Ajouter le locataire comme signataire
      const { error: tenantSignerError } = await serviceClient
        .from("lease_signers")
        .insert({
          lease_id: lease.id,
          profile_id: existingTenantProfile.id,
          role: "locataire_principal",
          signature_status: "pending",
        });

      if (tenantSignerError) {
        console.error("Erreur ajout signataire locataire:", tenantSignerError);
      } else {
        console.log("[API leases/invite] Locataire ajouté comme signataire");
      }

      // Créer une notification in-app pour le locataire
      const { error: notifError } = await serviceClient
        .from("notifications")
        .insert({
          user_id: existingTenantProfile.user_id,
          type: "lease_invite",
          title: "🏠 Nouveau bail à signer",
          message: `${profile.prenom} ${profile.nom} vous invite à signer un bail pour ${property.adresse_complete}, ${property.code_postal} ${property.ville}. Loyer : ${validated.loyer}€/mois.`,
          read: false,
          metadata: {
            lease_id: lease.id,
            property_id: validated.property_id,
            owner_name: `${profile.prenom} ${profile.nom}`,
            loyer: validated.loyer,
            type_bail: validated.type_bail,
          },
        });

      if (notifError) {
        console.error("Erreur création notification:", notifError);
      } else {
        console.log("[API leases/invite] ✅ Notification créée pour le locataire");
      }
    }

    // Générer un token simple basé sur l'ID du bail (encodé en base64)
    const inviteToken = Buffer.from(`${lease.id}:${validated.tenant_email}:${Date.now()}`).toString("base64url");

    // Construire l'URL d'invitation
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${appUrl}/signature/${inviteToken}`;

    // Envoyer l'email d'invitation via le service centralisé
    let emailSent = false;
    try {
      const emailResult = await sendLeaseInviteEmail({
        to: validated.tenant_email,
        tenantName: validated.tenant_name || undefined,
        ownerName: `${profile.prenom} ${profile.nom}`,
        propertyAddress: `${property.adresse_complete}, ${property.code_postal} ${property.ville}`,
        rent: validated.loyer,
        charges: validated.charges_forfaitaires,
        leaseType: validated.type_bail,
        inviteUrl,
      });
      emailSent = emailResult.success;
      if (!emailResult.success) {
        console.warn("[API leases/invite] Email non envoyé:", emailResult.error);
      } else {
        console.log("[API leases/invite] ✅ Email envoyé avec succès, ID:", emailResult.messageId);
      }
    } catch (emailError) {
      console.error("[API leases/invite] Erreur envoi email:", emailError);
      // On continue même si l'email échoue - le lien est toujours valide
    }

    // Construire le message de retour
    let message = "";
    if (existingTenantProfile) {
      message = `Le locataire ${validated.tenant_email} a déjà un compte. `;
      message += emailSent 
        ? "Une notification et un email lui ont été envoyés." 
        : "Une notification in-app a été créée.";
    } else {
      message = emailSent 
        ? `Invitation envoyée par email à ${validated.tenant_email}` 
        : `Invitation créée. Lien d'invitation : ${inviteUrl} (email non envoyé - vérifiez la configuration)`;
    }

    return NextResponse.json({
      success: true,
      lease_id: lease.id,
      invite_url: inviteUrl,
      email_sent: emailSent,
      tenant_exists: !!existingTenantProfile,
      tenant_notified: !!existingTenantProfile,
      message,
    });

  } catch (error: any) {
    console.error("Erreur API invite:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}


