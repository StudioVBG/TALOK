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

    // Trouver les signataires signés sans image dans Storage
    const { data: signersWithoutPath, error: fetchError } = await adminClient
      .from("lease_signers")
      .select("id, lease_id, role, signature_status, signed_at, signature_image_path")
      .eq("signature_status", "signed")
      .not("signed_at", "is", null)
      .is("signature_image_path", null);

    if (fetchError) {
      console.error("[Sync Signatures] Erreur fetch:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${signersWithoutPath?.length || 0} signataire(s) signés sans image en Storage`,
      signers_without_path: signersWithoutPath?.map(s => ({
        id: s.id,
        lease_id: s.lease_id,
        role: s.role,
      })) ?? [],
    });

  } catch (error: unknown) {
    console.error("[Sync Signatures] Erreur:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
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
      .select("signature_status, signature_image_path")
      .eq("signature_status", "signed");

    const totalSigned = stats?.length || 0;
    const withPath = stats?.filter(s => s.signature_image_path).length || 0;
    const withNothing = stats?.filter(s => !s.signature_image_path).length || 0;

    return NextResponse.json({
      diagnostic: {
        total_signed: totalSigned,
        with_storage_path: withPath,
        with_no_image: withNothing,
      },
      message: "Diagnostic des signatures terminé",
    });

  } catch (error: unknown) {
    console.error("[Sync Signatures GET] Erreur:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

