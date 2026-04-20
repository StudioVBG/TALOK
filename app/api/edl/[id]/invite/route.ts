export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

/**
 * Helper: Vérifie si un email est un placeholder
 */
function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  const lower = email.toLowerCase();
  return lower.includes('@a-definir') ||
         lower.includes('@a-définir') ||
         lower.includes('@placeholder') ||
         lower.includes('@example') ||
         lower.includes('@unknown') ||
         lower.includes('@talok.local') ||
         lower === 'locataire@a-definir.com';
}

/**
 * POST /api/edl/[id]/invite - Envoyer une invitation de signature à un locataire
 * 
 * Stratégie de résolution:
 * 1. Si signer_profile_id fourni → utiliser ce profil
 * 2. Sinon chercher le locataire dans le bail avec profile_id
 * 3. Sinon utiliser invited_email si valide (non placeholder)
 * 4. Sinon → erreur
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: edlId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Client Admin pour contourner RLS
    const serviceClient = getServiceClient();

    const body = await request.json();
    const { signer_profile_id, invited_email } = body;

    // ===============================
    // 1. RÉCUPÉRER L'EDL AVEC LE BAIL ET SES SIGNATAIRES
    // ===============================
    const { data: edl, error: edlError } = await serviceClient
      .from("edl")
      .select(`
        *,
        property:properties(owner_id),
        lease:leases(
          id,
          signers:lease_signers(
            profile_id,
            role,
            invited_email,
            invited_name,
            signed_at,
            profile:profiles(id, email, prenom, nom, user_id)
          )
        )
      `)
      .eq("id", edlId)
      .single();

    if (edlError || !edl) {
      console.error("[EDL Invite] EDL non trouvé:", edlError);
      return NextResponse.json({ error: "EDL non trouvé" }, { status: 404 });
    }

    // ===============================
    // 2. STRATÉGIE DE RÉSOLUTION DU LOCATAIRE
    // ===============================
    let targetProfileId: string | null = null;
    let targetUserId: string | null = null;
    let targetEmail: string | null = null;
    let targetName: string = "";

    // Étape 1: Si on a un profile_id explicite, l'utiliser
    if (signer_profile_id) {
      const { data: profile } = await serviceClient
          .from("profiles")
        .select("id, email, prenom, nom, user_id")
          .eq("id", signer_profile_id)
          .single();

      if (profile) {
        targetProfileId = profile.id;
        targetUserId = profile.user_id ?? null;
        targetEmail = profile.email ?? null;
        targetName = `${profile.prenom || ''} ${profile.nom || ''}`.trim();
        }
    }

    // Étape 2: Sinon, chercher le locataire dans le bail
    if (!targetProfileId && edl.lease?.signers) {
      const tenantSigner = edl.lease.signers.find((s: any) => 
        ['locataire_principal', 'locataire', 'tenant'].includes(s.role)
      );

      if (tenantSigner) {
        // Le locataire a-t-il un vrai profil?
        if (tenantSigner.profile_id && tenantSigner.profile) {
          const profile = tenantSigner.profile as any;
          targetProfileId = tenantSigner.profile_id;
          targetUserId = profile.user_id;
          targetEmail = profile.email;
          targetName = `${profile.prenom || ''} ${profile.nom || ''}`.trim();
        } 
        // Ou un email valide (non placeholder)?
        else if (tenantSigner.invited_email && !isPlaceholderEmail(tenantSigner.invited_email)) {
          targetEmail = tenantSigner.invited_email;
          targetName = tenantSigner.invited_name || tenantSigner.invited_email.split('@')[0];
        }
      }
    }

    // Étape 3: Utiliser l'email fourni si valide
    if (!targetEmail && invited_email && !isPlaceholderEmail(invited_email)) {
      targetEmail = invited_email;
      targetName = invited_email.split('@')[0];
    }

    // Étape 4: Si on a un email mais pas de profile_id, chercher le profil par email
    if (targetEmail && !targetProfileId) {
      const { data: profileByEmail } = await serviceClient
        .from("profiles")
        .select("id, user_id, prenom, nom")
        .ilike("email", targetEmail)
        .maybeSingle();

      if (profileByEmail) {
        targetProfileId = profileByEmail.id;
        targetUserId = profileByEmail.user_id ?? null;
        if (!targetName) {
          targetName = `${profileByEmail.prenom || ''} ${profileByEmail.nom || ''}`.trim();
        }
      }
    }

    // ===============================
    // 3. VALIDATION FINALE
    // ===============================
    if (!targetEmail) {
      return NextResponse.json({
        error: "Impossible d'envoyer l'invitation : aucun locataire valide trouvé. Veuillez d'abord configurer le locataire dans le bail.",
        code: "NO_VALID_TENANT"
      }, { status: 400 });
    }

    if (isPlaceholderEmail(targetEmail)) {
      return NextResponse.json({
        error: "L'email du locataire est invalide (placeholder). Modifiez le bail pour ajouter un vrai email.",
        code: "PLACEHOLDER_EMAIL"
      }, { status: 400 });
      }

    // ===============================
    // 4. CRÉATION/MISE À JOUR DE LA SIGNATURE EDL
    // ===============================
    
    // Chercher une signature EDL existante pour le locataire
      let { data: existingSig } = await serviceClient
        .from("edl_signatures")
        .select("*")
        .eq("edl_id", edlId)
        .eq("signer_role", "tenant")
        .maybeSingle();

    const invitationToken = (existingSig as { invitation_token?: string } | null)?.invitation_token || crypto.randomUUID();

      if (!existingSig) {
      // Créer une nouvelle signature EDL
        const { data: newSig, error: insertError } = await serviceClient
          .from("edl_signatures")
          .insert({
            edl_id: edlId,
            signer_profile_id: targetProfileId,
            signer_user: targetUserId ?? undefined,
            signer_role: 'tenant',
            invitation_token: invitationToken,
            invitation_sent_at: new Date().toISOString(),
          } as Record<string, unknown>)
        .select()
          .single();

        if (insertError) {
        console.error("[EDL Invite] Erreur création signature:", insertError);
        return NextResponse.json({ error: "Impossible de créer la signature EDL" }, { status: 500 });
        }
        existingSig = newSig;
    } else {
      // Mettre à jour la signature existante
      const updates: any = {
        invitation_sent_at: new Date().toISOString(),
        invitation_token: invitationToken,
      };
      
      // Mettre à jour le profile_id si on l'a trouvé et qu'il manquait
      if (targetProfileId && !(existingSig as { signer_profile_id?: string }).signer_profile_id) {
        updates.signer_profile_id = targetProfileId;
        updates.signer_user = targetUserId;
      }
    
    await serviceClient
      .from("edl_signatures")
        .update(updates)
        .eq("id", existingSig.id);
      
    }

    // ===============================
    // 4b. ASSURER QUE LE LOCATAIRE EXISTE DANS lease_signers
    // ===============================
    // Si l'EDL est lié à un bail et qu'il n'y a pas de signer tenant, en créer un.
    // Cela corrige le cas "manual draft" où aucun lease_signer n'existait pour le locataire.
    if (edl.lease_id) {
      const { data: existingTenantSigner } = await serviceClient
        .from("lease_signers")
        .select("id")
        .eq("lease_id", edl.lease_id)
        .in("role", ["locataire_principal", "colocataire"] as any)
        .maybeSingle();

      if (!existingTenantSigner) {
        const signerData: Record<string, unknown> = {
          lease_id: edl.lease_id,
          role: "locataire_principal",
          signature_status: "pending",
          invited_email: targetEmail,
          invited_name: targetName || null,
        };
        if (targetProfileId) {
          signerData.profile_id = targetProfileId;
        }
        const { error: signerInsertError } = await serviceClient
          .from("lease_signers")
          .insert(signerData);

        if (signerInsertError) {
          console.warn("[EDL Invite] Failed to create lease_signer:", signerInsertError.message);
        } else {
        }
      }
    }

    // ===============================
    // 5. ENVOYER L'EMAIL VIA OUTBOX (service client, non-blocking)
    // ===============================
    try {
      await serviceClient.from("outbox").insert({
        event_type: "EDL.InvitationSent",
        payload: {
          edl_id: edlId,
          signer_id: existingSig?.id,
          signer_profile_id: targetProfileId,
          tenant_user_id: targetUserId,
          email: targetEmail,
          name: targetName,
          token: invitationToken,
          type: (edl as any).type,
          property_address: (edl as any).property?.adresse_complete || "",
        },
      } as any);
    } catch (e) {
      console.error(`[EDL Invite ${edlId}] Outbox error:`, e);
    }

    // ===============================
    // 5a. ENVOYER L'EMAIL TRANSACTIONNEL (Resend — template dédié EDL)
    // ===============================
    try {
      // Récupérer le nom complet du propriétaire pour le template
      const ownerId = (edl as any).property?.owner_id as string | undefined;
      let ownerName = "Votre propriétaire";
      if (ownerId) {
        const { data: ownerProfile } = await serviceClient
          .from("profiles")
          .select("prenom, nom")
          .eq("id", ownerId)
          .maybeSingle() as { data: { prenom: string | null; nom: string | null } | null };
        if (ownerProfile) {
          const full = `${ownerProfile.prenom || ""} ${ownerProfile.nom || ""}`.trim();
          if (full) ownerName = full;
        }
      }

      const edlType = ((edl as any).type === "sortie" ? "sortie" : "entree") as "entree" | "sortie";
      const propertyAddress = (edl as any).property?.adresse_complete || "votre logement";

      const { sendEDLSignatureRequest } = await import("@/lib/emails/resend.service");
      sendEDLSignatureRequest({
        signerEmail: targetEmail,
        signerName: targetName || targetEmail.split("@")[0],
        ownerName,
        propertyAddress,
        edlId,
        edlType,
        signatureToken: invitationToken,
      }).catch((e) => console.warn(`[EDL Invite ${edlId}] Email Resend échoué:`, String(e)));
    } catch (e) {
      console.warn(`[EDL Invite ${edlId}] Email dispatch error:`, String(e));
    }

    // ===============================
    // 5b. NOTIFICATION IN-APP DIRECTE
    // ===============================
    if (targetProfileId || targetUserId) {
      try {
        const notifPayload: Record<string, unknown> = {
          type: "edl_invitation",
          title: "Invitation à signer l'état des lieux",
          message: `Vous êtes invité à signer l'état des lieux ${(edl as any).type === 'entree' ? "d'entrée" : "de sortie"}.`,
          body: `Vous êtes invité à signer l'état des lieux ${(edl as any).type === 'entree' ? "d'entrée" : "de sortie"}.`,
          is_read: false,
          metadata: { edl_id: edlId, token: invitationToken },
          data: { edl_id: edlId, token: invitationToken },
          action_url: `/signature-edl/${invitationToken}`,
        };
        if (targetUserId) notifPayload.user_id = targetUserId;
        if (targetProfileId) notifPayload.profile_id = targetProfileId;

        await serviceClient.from("notifications").insert(notifPayload as any);
      } catch (e) {
        console.warn(`[EDL Invite ${edlId}] Notification directe échouée:`, e);
      }
    } else {
      console.warn(`[EDL Invite ${edlId}] Pas de profile_id ni user_id — notification impossible`);
    }

    // ===============================
    // 6. JOURNALISER (service client, non-blocking)
    // ===============================
    try {
      await serviceClient.from("audit_log").insert({
        user_id: user.id,
        action: "edl_invitation_sent",
        entity_type: "edl",
        entity_id: edlId,
        metadata: {
          recipient: targetEmail,
          has_profile: !!targetProfileId
        },
      } as any);
    } catch (e) {
      console.error(`[EDL Invite ${edlId}] Audit log error:`, e);
    }

    return NextResponse.json({ 
      success: true, 
      sent_to: targetEmail,
      has_profile: !!targetProfileId
    });

  } catch (error: unknown) {
    console.error("[EDL Invite] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
