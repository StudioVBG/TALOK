export const runtime = 'nodejs';

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/sync-signatures
 * Synchronise les images de signature entre signature_image (base64) et signature_image_path (Storage)
 * Utile pour réparer les signatures qui ont été enregistrées en base64 mais pas dans Storage
 */
export async function POST(request: Request) {
  try {
    // Vérifier que l'utilisateur est admin
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });
    }

    // Client admin pour bypass RLS
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Trouver les signataires qui ont signé mais sans image dans Storage
    const { data: signersToFix, error: fetchError } = await adminClient
      .from("lease_signers")
      .select(`
        id,
        lease_id,
        role,
        signature_status,
        signed_at,
        signature_image,
        signature_image_path
      `)
      .eq("signature_status", "signed")
      .not("signed_at", "is", null)
      .is("signature_image_path", null)
      .not("signature_image", "is", null);

    if (fetchError) {
      console.error("[Sync Signatures] Erreur fetch:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    console.log(`[Sync Signatures] ${signersToFix?.length || 0} signataires à réparer`);

    const results = {
      total: signersToFix?.length || 0,
      fixed: 0,
      failed: 0,
      details: [] as any[],
    };

    // 2. Pour chaque signataire, uploader l'image base64 dans Storage
    for (const signer of signersToFix || []) {
      try {
        // Vérifier que c'est bien une image base64
        if (!signer.signature_image?.startsWith("data:image/")) {
          console.log(`[Sync Signatures] Signer ${signer.id}: pas une image base64, skip`);
          continue;
        }

        // Extraire les données base64
        const base64Data = signer.signature_image.replace(/^data:image\/\w+;base64,/, "");
        const signatureBuffer = Buffer.from(base64Data, "base64");

        // Chemin de stockage
        const signaturePath = `signatures/${signer.lease_id}/${signer.id}_synced_${Date.now()}.png`;

        // Upload dans Storage
        const { error: uploadError } = await adminClient.storage
          .from("documents")
          .upload(signaturePath, signatureBuffer, {
            contentType: "image/png",
            upsert: true,
          });

        if (uploadError) {
          console.error(`[Sync Signatures] Erreur upload signer ${signer.id}:`, uploadError);
          results.failed++;
          results.details.push({
            signer_id: signer.id,
            status: "failed",
            error: uploadError.message,
          });
          continue;
        }

        // Mettre à jour le signataire avec le nouveau path
        const { error: updateError } = await adminClient
          .from("lease_signers")
          .update({ signature_image_path: signaturePath })
          .eq("id", signer.id);

        if (updateError) {
          console.error(`[Sync Signatures] Erreur update signer ${signer.id}:`, updateError);
          results.failed++;
          results.details.push({
            signer_id: signer.id,
            status: "failed",
            error: updateError.message,
          });
          continue;
        }

        console.log(`[Sync Signatures] ✅ Signer ${signer.id} réparé: ${signaturePath}`);
        results.fixed++;
        results.details.push({
          signer_id: signer.id,
          lease_id: signer.lease_id,
          role: signer.role,
          status: "fixed",
          path: signaturePath,
        });

      } catch (err: any) {
        console.error(`[Sync Signatures] Exception signer ${signer.id}:`, err);
        results.failed++;
        results.details.push({
          signer_id: signer.id,
          status: "failed",
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.fixed}/${results.total} signatures synchronisées`,
      results,
    });

  } catch (error: any) {
    console.error("[Sync Signatures] Erreur:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/admin/sync-signatures
 * Diagnostic: liste les signatures à réparer
 */
export async function GET(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Statistiques des signatures
    const { data: stats } = await adminClient
      .from("lease_signers")
      .select("signature_status, signature_image, signature_image_path")
      .eq("signature_status", "signed");

    const totalSigned = stats?.length || 0;
    const withPath = stats?.filter(s => s.signature_image_path).length || 0;
    const withBase64Only = stats?.filter(s => s.signature_image && !s.signature_image_path).length || 0;
    const withNothing = stats?.filter(s => !s.signature_image && !s.signature_image_path).length || 0;

    return NextResponse.json({
      diagnostic: {
        total_signed: totalSigned,
        with_storage_path: withPath,
        with_base64_only: withBase64Only,
        with_no_image: withNothing,
        needs_sync: withBase64Only,
      },
      message: withBase64Only > 0 
        ? `${withBase64Only} signature(s) peuvent être synchronisées vers Storage`
        : "Toutes les signatures sont synchronisées",
    });

  } catch (error: any) {
    console.error("[Sync Signatures GET] Erreur:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

