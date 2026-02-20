export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient, createClientFromRequest } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendLeaseInviteEmail } from "@/lib/services/email-service";
import { generateSecureToken } from "@/lib/utils/secure-token";
import { getMaxDepotLegal } from "@/lib/validations/lease-financial";

// Schéma pour un invité de colocation
const inviteeSchema = z.object({
  email: z.string().email("Email invalide"),
  name: z.string().nullable().optional(),
  role: z.enum(["principal", "colocataire"]),
  weight: z.number().min(0).max(1).optional(),
  room_label: z.string().nullable().optional(),
  has_guarantor: z.boolean().optional(),
  guarantor_email: z.string().email().nullable().optional(),
  guarantor_name: z.string().nullable().optional(),
});

// Schéma pour la configuration colocation
const colocConfigSchema = z.object({
  nb_places: z.number().min(2).max(10),
  bail_type: z.enum(["unique", "individuel"]),
  solidarite: z.boolean(),
  solidarite_duration_months: z.number().min(1).max(6),
  split_mode: z.enum(["equal", "custom", "by_room"]),
});

// Schéma de validation (supporte bail standard ET colocation)
const inviteSchema = z.object({
  property_id: z.string().uuid("ID de propriété invalide"),
  type_bail: z.string().min(1, "Type de bail requis"),
  signatory_entity_id: z.string().uuid("ID entité invalide").nullable().optional(),
  loyer: z.number().positive("Loyer doit être positif"),
  charges_forfaitaires: z.number().min(0).default(0),
  charges_type: z.enum(["forfait", "provisions"]).default("forfait"),
  depot_garantie: z.number().min(0).default(0),
  date_debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide"),
  date_fin: z.string().nullable().optional(),
  // Bail standard
  tenant_email: z.string().email("Email du locataire invalide").nullable().optional(), // Nullable pour manual draft
  tenant_name: z.string().nullable().optional(),
  is_manual_draft: z.boolean().optional(), // Nouveau flag
  // Clauses personnalisées (P2-6)
  custom_clauses: z.array(z.object({
    id: z.string(),
    text: z.string(),
    isCustom: z.boolean(),
  })).optional(),
  // ✅ BIC Compliance: régime fiscal meublé
  tax_regime: z.enum(["micro_bic", "reel_bic", "micro_foncier", "reel_foncier"]).nullable().optional(),
  lmnp_status: z.enum(["lmnp", "lmp"]).nullable().optional(),
  furniture_inventory: z.array(z.object({
    name: z.string(),
    condition: z.string(),
    quantity: z.number(),
    is_mandatory: z.boolean(),
  })).optional(),
  furniture_additional: z.array(z.object({
    name: z.string(),
    condition: z.string(),
    quantity: z.number(),
  })).optional(),
  // Colocation
  coloc_config: colocConfigSchema.optional(),
  invitees: z.array(inviteeSchema).optional(),
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
      supabase = await createClientFromRequest(request);
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
    
    // Vérifier qu'on a soit tenant_email, soit invitees, soit is_manual_draft
    const isColocationRequest = validated.type_bail === "colocation" && validated.invitees && validated.invitees.length > 0;
    const isManualDraft = validated.is_manual_draft === true;

    if (!isColocationRequest && !validated.tenant_email && !isManualDraft) {
      return NextResponse.json({ 
        error: "Email du locataire requis",
        hint: "Pour un bail standard, l'email du locataire est obligatoire, sauf en mode manuel."
      }, { status: 400 });
    }

    // Vérifier que le bien appartient au propriétaire
    const { data: property, error: propError } = await supabase
      .from("properties")
      .select("id, owner_id, adresse_complete, code_postal, ville, dpe_classe_energie")
      .eq("id", validated.property_id)
      .single();

    if (propError || !property) {
      return NextResponse.json({ error: "Bien non trouvé" }, { status: 404 });
    }

    if (property.owner_id !== profile.id && profile.role !== "admin") {
      return NextResponse.json({ error: "Ce bien ne vous appartient pas" }, { status: 403 });
    }

    // P1-5: Loi Climat et Résilience — Interdiction de louer les passoires thermiques
    const isHabitation = ["nu", "meuble", "colocation", "bail_mobilite", "etudiant", "bail_mixte"].includes(validated.type_bail);
    const dpe = (property as any).dpe_classe_energie?.toUpperCase();
    if (isHabitation && dpe === "G") {
      return NextResponse.json({
        error: "Location interdite — DPE classe G",
        details: "Depuis le 1er janvier 2025, les logements classés G au DPE ne peuvent plus être proposés à la location (Loi Climat et Résilience, art. 160). Réalisez des travaux de rénovation énergétique pour améliorer le classement.",
      }, { status: 422 });
    }

    // Utiliser le service client pour bypass les RLS (évite la récursion infinie)
    const serviceClient = getServiceClient();

    // Déterminer si c'est une colocation
    const isColocation = validated.type_bail === "colocation" && validated.invitees && validated.invitees.length > 0;
    
    // Liste des emails à traiter (soit un seul locataire, soit plusieurs colocataires)
    // En mode manuel, cette liste peut être vide
    let emailsToProcess: any[] = [];
    
    if (isColocation) {
      emailsToProcess = validated.invitees!.map(inv => ({ 
        email: inv.email, 
        name: inv.name, 
        role: inv.role,
        weight: inv.weight || (1 / validated.coloc_config!.nb_places),
        room_label: inv.room_label,
        has_guarantor: inv.has_guarantor,
        guarantor_email: inv.guarantor_email,
        guarantor_name: inv.guarantor_name,
      }));
    } else if (validated.tenant_email) {
      emailsToProcess = [{ 
        email: validated.tenant_email, 
        name: validated.tenant_name, 
        role: "principal" as const,
        weight: 1,
        room_label: null,
        has_guarantor: false,
        guarantor_email: null,
        guarantor_name: null,
      }];
    }

    // SOTA 2026: RPC find_profile_by_email au lieu de listUsers() (O(1) par email)
    const existingProfiles: Map<string, { id: string; user_id: string }> = new Map();

    for (const invitee of emailsToProcess) {
      try {
        const { data: profileRows, error: rpcError } = await serviceClient.rpc("find_profile_by_email", {
          target_email: invitee.email,
        });
        if (rpcError) {
          console.warn(`[API leases/invite] RPC find_profile_by_email failed for ${invitee.email}:`, rpcError.message);
          continue;
        }
        const tenantProfile = Array.isArray(profileRows) ? profileRows[0] : profileRows;
        if (tenantProfile?.id) {
          existingProfiles.set(invitee.email.toLowerCase(), {
            id: tenantProfile.id,
            user_id: tenantProfile.user_id,
          });
          console.log(`[API leases/invite] Profil existant trouvé pour ${invitee.email}:`, tenantProfile.id);
        }
      } catch (err) {
        console.warn(`[API leases/invite] Exception find_profile_by_email for ${invitee.email}:`, err);
        // Continue: signer will be created with invited_email only (fallback)
      }
    }

    // ✅ Valider et calculer le dépôt final (source unique: lib/validations/lease-financial)
    const maxDepotLegal = getMaxDepotLegal(validated.type_bail, validated.loyer);
    // Si dépôt non fourni ou 0, utiliser le max légal par défaut
    // Si dépôt > max légal, corriger au max légal
    const depotDemande = validated.depot_garantie || 0;
    const depotFinal = depotDemande > 0 
      ? Math.min(depotDemande, maxDepotLegal)
      : maxDepotLegal;
    
    console.log(`[API leases/invite] Dépôt: demandé=${depotDemande}, max=${maxDepotLegal}, final=${depotFinal}`);

    // Créer le bail
    const leaseData: any = {
      property_id: validated.property_id,
      type_bail: validated.type_bail,
      signatory_entity_id: validated.signatory_entity_id || null,
      loyer: validated.loyer,
      charges_forfaitaires: validated.charges_forfaitaires,
      charges_type: validated.charges_type,
      depot_de_garantie: depotFinal,
      date_debut: validated.date_debut,
      date_fin: validated.date_fin || null,
      // Si manuel, le statut est "draft", sinon "pending_signature"
      statut: isManualDraft ? "draft" : "pending_signature",
      // P2-6: Clauses personnalisées → colonne clauses_particulieres (TEXT)
      clauses_particulieres: validated.custom_clauses && validated.custom_clauses.length > 0
        ? JSON.stringify(validated.custom_clauses)
        : null,
      // ✅ BIC Compliance: régime fiscal + inventaire mobilier
      tax_regime: validated.tax_regime || null,
      lmnp_status: validated.lmnp_status || null,
      furniture_inventory: validated.furniture_inventory
        ? JSON.stringify({
            mandatory: validated.furniture_inventory,
            additional: validated.furniture_additional || [],
            created_at: new Date().toISOString(),
          })
        : null,
    };
    
    // Ajouter la config colocation si applicable
    if (isColocation && validated.coloc_config) {
      leaseData.coloc_config = validated.coloc_config;
    }

    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .insert(leaseData)
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

    // Traiter chaque invité (locataire standard ou colocataires)
    const processedInvitees: { email: string; exists: boolean; notified: boolean }[] = [];
    
    for (const invitee of emailsToProcess) {
      const existingProfile = existingProfiles.get(invitee.email.toLowerCase());
      
      // Créer le roommate pour les colocations
      if (isColocation) {
        const roommateData: any = {
          lease_id: lease.id,
          role: invitee.role === "principal" ? "principal" : "tenant",
          weight: invitee.weight,
          joined_on: validated.date_debut,
          invitation_status: existingProfile ? "accepted" : "pending",
          invited_email: invitee.email,
          // FIX: Store room_label and guarantor data
          room_label: invitee.room_label || null,
          has_guarantor: invitee.has_guarantor || false,
          guarantor_email: invitee.guarantor_email || null,
          guarantor_name: invitee.guarantor_name || null,
        };

        if (existingProfile) {
          roommateData.user_id = existingProfile.user_id;
        }
        
        const { data: roommate, error: roommateError } = await serviceClient
          .from("roommates")
          .insert(roommateData)
          .select()
          .single();
          
        if (roommateError) {
          console.error(`Erreur création roommate pour ${invitee.email}:`, roommateError);
        } else {
          console.log(`[API leases/invite] Roommate créé pour ${invitee.email}:`, roommate?.id);
          
          // Créer la part de dépôt de garantie
          if (validated.depot_garantie > 0) {
            const depositAmount = validated.depot_garantie * invitee.weight;
            const { error: depositError } = await serviceClient
              .from("deposit_shares")
              .insert({
                lease_id: lease.id,
                roommate_id: roommate.id,
                amount: depositAmount,
                status: "pending",
              });
              
            if (depositError) {
              console.warn(`Erreur création deposit_share pour ${invitee.email}:`, depositError);
            }
          }
        }
      }
      
      // Si le profil existe, l'ajouter comme signataire et créer une notification
      if (existingProfile) {
        // Ajouter comme signataire
        const signerRole = invitee.role === "principal" 
          ? "locataire_principal" 
          : "colocataire";
          
        const { error: tenantSignerError } = await serviceClient
          .from("lease_signers")
          .insert({
            lease_id: lease.id,
            profile_id: existingProfile.id,
            role: signerRole,
            signature_status: "pending",
          });

        if (tenantSignerError) {
          console.error(`Erreur ajout signataire ${invitee.email}:`, tenantSignerError);
        } else {
          console.log(`[API leases/invite] ${invitee.email} ajouté comme signataire (${signerRole})`);
        }

        // Créer notification in-app
        const partText = isColocation 
          ? ` Votre part : ${Math.round(invitee.weight * 100)}% (${Math.round(validated.loyer * invitee.weight)}€/mois).`
          : "";
          
        // ✅ FIX: Ajouter profile_id en plus de user_id pour cohérence avec GET /api/notifications
        const { error: notifError } = await serviceClient
          .from("notifications")
          .insert({
            user_id: existingProfile.user_id,
            profile_id: existingProfile.id,
            type: "lease_invite",
            title: isColocation ? "Invitation colocation" : "Nouveau bail à signer",
            body: `${profile.prenom} ${profile.nom} vous invite à ${isColocation ? "rejoindre une colocation" : "signer un bail"} pour ${property.adresse_complete}, ${property.code_postal} ${property.ville}.${partText}`,
            read: false,
            is_read: false,
            metadata: {
              lease_id: lease.id,
              property_id: validated.property_id,
              owner_name: `${profile.prenom} ${profile.nom}`,
              loyer: validated.loyer,
              type_bail: validated.type_bail,
              is_colocation: isColocation,
              weight: invitee.weight,
            },
          });

        if (notifError) {
          console.error(`Erreur notification pour ${invitee.email}:`, notifError);
        } else {
          console.log(`[API leases/invite] ✅ Notification créée pour ${invitee.email}`);
        }
        
        processedInvitees.push({ email: invitee.email, exists: true, notified: true });
      } else {
        // Le locataire n'a pas encore de compte - créer un signataire avec invited_email
        const signerRole = invitee.role === "principal" 
          ? "locataire_principal" 
          : "colocataire";
          
        const { error: inviteSignerError } = await serviceClient
          .from("lease_signers")
          .insert({
            lease_id: lease.id,
            profile_id: null, // Sera rempli quand le locataire créera son compte
            invited_email: invitee.email,
            invited_name: invitee.name || null,
            role: signerRole,
            signature_status: "pending",
          });
          
        if (inviteSignerError) {
          console.error(`[API leases/invite] Erreur ajout signataire invité ${invitee.email}:`, inviteSignerError);
        } else {
          console.log(`[API leases/invite] ✅ ${invitee.email} ajouté comme signataire invité (${signerRole})`);
        }
        
        processedInvitees.push({ email: invitee.email, exists: false, notified: false });
      }
    }

    // Construire l'URL d'invitation de base
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    
    // Envoyer les emails à chaque invité
    const emailResults: { email: string; sent: boolean; inviteUrl: string }[] = [];
    
    // Si c'est un draft manuel, on n'envoie pas d'emails
    if (!isManualDraft) {
      for (const invitee of emailsToProcess) {
        // FIX P0-E3: Générer un token HMAC sécurisé au lieu de base64url en clair
        // L'ancien format exposait lease_id et email sans signature cryptographique
        const inviteToken = generateSecureToken({
          entityId: lease.id,
          entityType: "lease",
          email: invitee.email,
          expirationDays: 30,
        });
        const inviteUrl = `${appUrl}/signature/${inviteToken}`;
        
        let emailSent = false;
        try {
          // Personnaliser le message pour les colocations
          const rentAmount = isColocation 
            ? Math.round(validated.loyer * invitee.weight)
            : validated.loyer;
          const chargesAmount = isColocation
            ? Math.round(validated.charges_forfaitaires * invitee.weight)
            : validated.charges_forfaitaires;
            
          const emailResult = await sendLeaseInviteEmail({
            to: invitee.email,
            tenantName: invitee.name || undefined,
            ownerName: `${profile.prenom} ${profile.nom}`,
            propertyAddress: `${property.adresse_complete}, ${property.code_postal} ${property.ville}`,
            rent: rentAmount,
            charges: chargesAmount,
            leaseType: isColocation ? "colocation" : validated.type_bail,
            inviteUrl,
          });
          emailSent = emailResult.success;
          if (!emailResult.success) {
            console.warn(`[API leases/invite] Email non envoyé à ${invitee.email}:`, emailResult.error);
          } else {
            console.log(`[API leases/invite] ✅ Email envoyé à ${invitee.email}, ID:`, emailResult.messageId);
          }
        } catch (emailError) {
          console.error(`[API leases/invite] Erreur envoi email à ${invitee.email}:`, emailError);
        }
        
        emailResults.push({ email: invitee.email, sent: emailSent, inviteUrl });
      }
    }
    
    // Statistiques d'envoi
    const emailsSentCount = emailResults.filter(r => r.sent).length;
    const existingCount = processedInvitees.filter(p => p.exists).length;

    // Construire le message de retour
    let message = "";
    if (isManualDraft) {
      message = "Bail créé avec succès en mode manuel (sans invitation).";
    } else if (isColocation) {
      message = `Bail colocation créé avec ${emailsToProcess.length} colocataire(s). `;
      if (existingCount > 0) {
        message += `${existingCount} avai(en)t déjà un compte et ont reçu une notification. `;
      }
      if (emailsSentCount > 0) {
        message += `${emailsSentCount} email(s) d'invitation envoyé(s).`;
      }
    } else {
      const tenantExists = processedInvitees[0]?.exists;
      const firstEmailResult = emailResults[0];
      if (tenantExists) {
        message = `Le locataire ${emailsToProcess[0]?.email} a déjà un compte. `;
        message += firstEmailResult?.sent 
          ? "Une notification et un email lui ont été envoyés." 
          : "Une notification in-app a été créée.";
      } else {
        const email = emailsToProcess[0]?.email;
        message = firstEmailResult?.sent 
          ? `Invitation envoyée par email à ${email}` 
          : `Invitation créée. Lien d'invitation : ${firstEmailResult?.inviteUrl} (email non envoyé - vérifiez la configuration)`;
      }
    }

    // ✅ Invalider les caches pour forcer le rechargement des pages
    revalidatePath(`/owner/properties/${validated.property_id}`);
    revalidatePath("/owner/properties");
    revalidatePath("/owner/leases");

    return NextResponse.json({
      success: true,
      lease_id: lease.id,
      is_colocation: isColocation,
      invitees: emailResults.map(r => ({
        email: r.email,
        invite_url: r.inviteUrl,
        email_sent: r.sent,
      })),
      emails_sent_count: emailsSentCount,
      existing_accounts_count: existingCount,
      message,
    });

  } catch (error: unknown) {
    console.error("Erreur API invite:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
