export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServerClient } from "@supabase/supabase-js";

/**
 * GET /api/signatures/requests/[id] - Récupérer une demande de signature
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: signatureRequest, error } = await adminSupabase
      .from("signature_requests")
      .select(`
        *,
        signers:signature_request_signers(*),
        validations:signature_validations(*),
        audit_log:signature_audit_log(*, actor:profiles(prenom, nom)),
        source_document:documents!source_document_id(id, title, storage_path),
        signed_document:documents!signed_document_id(id, title, storage_path),
        proof_document:documents!proof_document_id(id, title, storage_path),
        created_by_profile:profiles!created_by(prenom, nom, email)
      `)
      .eq("id", params.id)
      .single();

    if (error || !signatureRequest) {
      return NextResponse.json({ error: "Demande non trouvée" }, { status: 404 });
    }

    return NextResponse.json(signatureRequest);
  } catch (error: unknown) {
    console.error("[GET /api/signatures/requests/[id]] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

/**
 * DELETE /api/signatures/requests/[id] - Supprimer une demande (brouillon uniquement)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Vérifier que la demande existe et appartient à l'utilisateur
    const { data: existing } = await adminSupabase
      .from("signature_requests")
      .select("id, status, owner_id")
      .eq("id", params.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Demande non trouvée" }, { status: 404 });
    }

    if (existing.owner_id !== profile.id) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "Seuls les brouillons peuvent être supprimés" },
        { status: 400 }
      );
    }

    // Supprimer (cascade sur signers, validations, audit_log)
    const { error } = await adminSupabase
      .from("signature_requests")
      .delete()
      .eq("id", params.id);

    if (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[DELETE /api/signatures/requests/[id]] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

