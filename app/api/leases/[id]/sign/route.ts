// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";

/**
 * POST /api/leases/[id]/sign - Signer un bail (SES/AES/QES)
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

    // Rate limiting pour les signatures
    const limiter = getRateLimiterByUser(rateLimitPresets.api);
    const limitResult = limiter(user.id);
    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error: "Trop de requêtes. Veuillez réessayer plus tard.",
          resetAt: limitResult.resetAt,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitPresets.api.maxRequests.toString(),
            "X-RateLimit-Remaining": limitResult.remaining.toString(),
            "X-RateLimit-Reset": limitResult.resetAt.toString(),
          },
        }
      );
    }

    const body = await request.json();
    const { level = "SES", otp_code, signature_image } = body;

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    // Vérifier que l'utilisateur est signataire du bail
    const { data: signer } = await supabase
      .from("lease_signers")
      .select("*")
      .eq("lease_id", params.id as any)
      .eq("profile_id", (profile as any).id as any)
      .single();

    if (!signer) {
      return NextResponse.json(
        { error: "Vous n'êtes pas signataire de ce bail" },
        { status: 403 }
      );
    }

    // Récupérer le draft du bail
    const { data: draft } = await supabase
      .from("lease_drafts")
      .select("*")
      .eq("lease_id", params.id as any)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (!draft || !("id" in draft)) {
      return NextResponse.json(
        { error: "Brouillon de bail non trouvé" },
        { status: 404 }
      );
    }

    // Vérifier OTP si requis (pour AES/QES)
    if (level !== "SES" && otp_code) {
      // TODO: Vérifier l'OTP via service d'authentification
      // Pour l'instant, on accepte
    }

    // Récupérer IP et User Agent
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;
    const userAgent = request.headers.get("user-agent") || null;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Uploader l'image de signature si fournie (SES)
    let signatureImagePath = null;
    if (signature_image && level === "SES") {
      // Convertir base64 en buffer et uploader
      const base64Data = signature_image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const fileName = `signatures/${params.id}/${user.id}_${Date.now()}.png`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, buffer, {
          contentType: "image/png",
          upsert: false,
        });

      if (!uploadError && uploadData) {
        signatureImagePath = uploadData.path;
      }
    }

    // Calculer le hash du document (simplifié, devrait être SHA-256 du PDF)
    const docHash = (draft as any).pdf_hash || `sha256_${Date.now()}`;

    // Créer la signature
    const signatureData: any = {
      draft_id: (draft as any).id,
      lease_id: params.id as any,
      signer_user: user.id as any,
      signer_profile_id: (profile as any).id as any,
      level,
      signed_at: new Date().toISOString(),
      doc_hash: docHash,
      ip_inet: ip,
      user_agent: userAgent,
    };

    if (level === "SES") {
      signatureData.otp_verified = true;
      signatureData.signature_image_path = signatureImagePath;
    }

    // TODO: Pour AES/QES, appeler le provider (Yousign/DocuSign)
    if (level === "AES" || level === "QES") {
      // const providerResult = await callSignatureProvider(...);
      signatureData.provider_ref = `mock_provider_${Date.now()}`;
      signatureData.provider_data = {};
      
      // Émettre un événement pour escalade
      await supabase.from("outbox").insert({
        event_type: "signature.escalated",
        payload: {
          signature_level: level,
          lease_id: params.id as any,
          draft_id: (draft as any).id,
        },
      } as any);
    }

    const { data: signature, error: signatureError } = await supabase
      .from("signatures")
      .insert(signatureData as any)
      .select()
      .single();

    if (signatureError) throw signatureError;

    const signatureResult = signature as any;

    // Créer la preuve de signature
    const { data: evidence, error: evidenceError } = await supabase
      .from("signature_evidence")
      .insert({
        signature_id: signatureResult.id,
        doc_id: (draft as any).id,
        owner_id: (profile as any).id,
        ip_inet: ip,
        user_agent: userAgent,
        signed_at: new Date().toISOString(),
        timezone,
        signature_png_url: signatureImagePath,
        payload_snapshot: {
          level,
          doc_hash: docHash,
          draft_version: (draft as any).version,
        },
        doc_hash: docHash,
      } as any)
      .select()
      .single();

    if (evidenceError) {
      console.error("Erreur création preuve signature:", evidenceError);
      // Ne pas bloquer si la preuve échoue
    }

    // Mettre à jour le statut du signataire
    await supabase
      .from("lease_signers")
      .update({
        signature_status: "signed",
        signed_at: new Date().toISOString(),
      } as any)
      .eq("id", (signer as any).id as any);

    // Vérifier si tous les signataires ont signé
    const { data: allSigners } = await supabase
      .from("lease_signers")
      .select("signature_status")
      .eq("lease_id", params.id as any);

    const allSigned = allSigners?.every((s: any) => s.signature_status === "signed");

    if (allSigned) {
      // Mettre à jour le statut du bail
      await supabase
        .from("leases")
        .update({ statut: "active" } as any)
        .eq("id", params.id as any);

      // Émettre un événement
      await supabase.from("outbox").insert({
        event_type: "lease.signed",
        payload: {
          lease_id: params.id as any,
          draft_id: (draft as any).id,
        },
      } as any);
    }

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "sign",
      entity_type: "lease",
      entity_id: params.id,
      metadata: { level, signature_id: signatureData.id },
      ip_inet: ip,
      user_agent: userAgent,
    } as any);

    return NextResponse.json({
      success: true,
      signature,
      evidence,
      lease_status: allSigned ? "active" : "pending_signature",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

