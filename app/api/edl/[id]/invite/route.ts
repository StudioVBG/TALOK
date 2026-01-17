export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Helper: Vérifie si un email est un placeholder
 */
function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  return email.includes('@a-definir') || 
         email.includes('@placeholder') ||
         email.includes('@example') ||
         email === 'locataire@a-definir.com';
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
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const body = await request.json();
    const { signer_profile_id, invited_email } = body;

    // ===============================
    // 1. RÉCUPÉRER L'EDL AVEC LE BAIL ET SES SIGNATAIRES
    // ===============================
    const { data: edl, error: edlError } = await supabaseAdmin
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
      const { data: profile } = await supabaseAdmin
          .from("profiles")
        .select("id, email, prenom, nom, user_id")
          .eq("id", signer_profile_id)
          .single();

      if (profile) {
        targetProfileId = profile.id;
        targetUserId = profile.user_id;
        targetEmail = profile.email;
        targetName = `${profile.prenom || ''} ${profile.nom || ''}`.trim();
        console.log("[EDL Invite] Utilisation du profile_id fourni:", targetProfileId);
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
          console.log("[EDL Invite] Locataire trouvé via bail avec profil:", targetEmail);
        } 
        // Ou un email valide (non placeholder)?
        else if (tenantSigner.invited_email && !isPlaceholderEmail(tenantSigner.invited_email)) {
          targetEmail = tenantSigner.invited_email;
          targetName = tenantSigner.invited_name || tenantSigner.invited_email.split('@')[0];
          console.log("[EDL Invite] Locataire trouvé via bail avec email invité:", targetEmail);
        }
      }
    }

    // Étape 3: Utiliser l'email fourni si valide
    if (!targetEmail && invited_email && !isPlaceholderEmail(invited_email)) {
      targetEmail = invited_email;
      targetName = invited_email.split('@')[0];
      console.log("[EDL Invite] Utilisation de l'email fourni:", targetEmail);
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
      let { data: existingSig } = await supabaseAdmin
        .from("edl_signatures")
        .select("*")
        .eq("edl_id", edlId)
        .eq("signer_role", "tenant")
        .maybeSingle();

    const invitationToken = existingSig?.invitation_token || crypto.randomUUID();

      if (!existingSig) {
      // Créer une nouvelle signature EDL
        const { data: newSig, error: insertError } = await supabaseAdmin
          .from("edl_signatures")
          .insert({
            edl_id: edlId,
          signer_profile_id: targetProfileId,
          signer_user: targetUserId,
            signer_role: 'tenant',
          invitation_token: invitationToken,
            invitation_sent_at: new Date().toISOString(),
          })
        .select()
          .single();

        if (insertError) {
        console.error("[EDL Invite] Erreur création signature:", insertError);
        return NextResponse.json({ error: "Impossible de créer la signature EDL" }, { status: 500 });
        }
        existingSig = newSig;
      console.log("[EDL Invite] Signature EDL créée:", existingSig?.id);
    } else {
      // Mettre à jour la signature existante
      const updates: any = {
        invitation_sent_at: new Date().toISOString(),
        invitation_token: invitationToken,
      };
      
      // Mettre à jour le profile_id si on l'a trouvé et qu'il manquait
      if (targetProfileId && !existingSig.signer_profile_id) {
        updates.signer_profile_id = targetProfileId;
        updates.signer_user = targetUserId;
        console.log("[EDL Invite] Mise à jour du profile_id manquant:", targetProfileId);
      }
    
    await supabaseAdmin
      .from("edl_signatures")
        .update(updates)
        .eq("id", existingSig.id);
      
      console.log("[EDL Invite] Signature EDL mise à jour:", existingSig.id);
    }

    // ===============================
    // 5. ENVOYER L'EMAIL VIA OUTBOX
    // ===============================
    await supabase.from("outbox").insert({
      event_type: "EDL.InvitationSent",
      payload: {
        edl_id: edlId,
        signer_id: existingSig?.id,
        signer_profile_id: targetProfileId,
        email: targetEmail,
        name: targetName,
        token: invitationToken,
        type: (edl as any).type
      },
    } as any);

    // ===============================
    // 6. JOURNALISER
    // ===============================
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "edl_invitation_sent",
      entity_type: "edl",
      entity_id: edlId,
      metadata: {
        recipient: targetEmail,
        has_profile: !!targetProfileId
      },
    } as any);

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
