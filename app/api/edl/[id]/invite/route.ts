export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * POST /api/edl/[id]/invite - Envoyer une invitation de signature à un locataire
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Client Admin pour contourner RLS sur la lecture des profils locataires
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const body = await request.json();
    const { signer_profile_id } = body;

    if (!signer_profile_id) {
      return NextResponse.json(
        { error: "ID du signataire requis" },
        { status: 400 }
      );
    }

    // 1. Vérifier que l'EDL existe et que l'utilisateur a accès
    const { data: edl, error: edlError } = await supabase
      .from("edl")
      .select("*, property:properties(owner_id)")
      .eq("id", params.id)
      .single();

    if (edlError || !edl) {
      return NextResponse.json({ error: "EDL non trouvé" }, { status: 404 });
    }

    // 2. Vérifier si le signataire existe déjà, sinon le créer depuis le bail
    let { data: signature, error: sigError } = await supabaseAdmin
      .from("edl_signatures")
      .select("*, profile:profiles(email, prenom, nom, user_id)")
      .eq("edl_id", params.id)
      .eq("signer_profile_id", signer_profile_id)
      .maybeSingle();

    if (!signature) {
      // Le signataire n'existe pas encore pour cet EDL, on le crée
      // On récupère les infos du profil via ADMIN pour avoir l'email
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("email, prenom, nom, user_id, role")
        .eq("id", signer_profile_id)
        .single();

      if (profileError || !profile) {
        console.error("Erreur récupération profil:", profileError);
        return NextResponse.json({ error: "Profil signataire non trouvé" }, { status: 404 });
      }

      // Créer l'entrée de signature
      const { data: newSignature, error: insertError } = await supabaseAdmin
        .from("edl_signatures")
        .insert({
          edl_id: params.id,
          signer_profile_id: signer_profile_id,
          signer_user: profile.user_id,
          signer_role: profile.role === 'owner' ? 'owner' : 'tenant',
        } as any)
        .select("*, profile:profiles(email, prenom, nom, user_id)")
        .single();

      if (insertError) {
        return NextResponse.json({ error: "Impossible de créer le signataire pour cet EDL" }, { status: 500 });
      }
      signature = newSignature;
    }

    const profile = (signature as any).profile;
    // Si l'email manque dans la signature (jointure RLS), on le re-fetch en admin
    let targetEmail = profile?.email;
    let targetName = `${profile?.prenom || ''} ${profile?.nom || ''}`.trim();

    if (!targetEmail) {
       const { data: adminProfile } = await supabaseAdmin
        .from("profiles")
        .select("email, prenom, nom")
        .eq("id", signature.signer_profile_id)
        .single();
       
       if (adminProfile) {
         targetEmail = adminProfile.email;
         targetName = `${adminProfile.prenom || ''} ${adminProfile.nom || ''}`.trim();
       }
    }

    if (!targetEmail) {
      return NextResponse.json({ error: "Email du locataire manquant" }, { status: 400 });
    }

    // 3. Mettre à jour la date d'invitation et générer un nouveau token si besoin
    const invitation_token = (signature as any).invitation_token || crypto.randomUUID();
    
    await supabaseAdmin
      .from("edl_signatures")
      .update({
        invitation_sent_at: new Date().toISOString(),
        invitation_token,
        signer_name: targetName // On en profite pour sauvegarder le nom
      } as any)
      .eq("id", signature.id);

    // 4. Envoyer l'email (Simulation pour l'instant via Outbox pour traitement par Edge Function)
    await supabase.from("outbox").insert({
      event_type: "EDL.InvitationSent",
      payload: {
        edl_id: params.id,
        signer_id: signature.id,
        signer_profile_id: signature.signer_profile_id,
        email: targetEmail,
        name: targetName,
        token: invitation_token,
        type: edl.type
      },
    } as any);

    // 5. Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "edl_invitation_sent",
      entity_type: "edl",
      entity_id: params.id,
      metadata: { recipient: targetEmail },
    } as any);

    return NextResponse.json({ success: true, sent_to: targetEmail });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

