export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServerClient } from "@supabase/supabase-js";
import { z } from "zod";

const validateSchema = z.object({
  approved: z.boolean(),
  comment: z.string().optional(),
  validator_role: z.enum(["hierarchique", "juridique", "rh", "finance", "direction"]).optional(),
});

/**
 * POST /api/signatures/requests/[id]/validate - Valider/Rejeter une demande
 */
export async function POST(
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
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const body = await request.json();
    const { approved, comment, validator_role } = validateSchema.parse(body);

    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Vérifier que la demande existe et est en attente de validation
    const { data: signatureRequest } = await adminSupabase
      .from("signature_requests")
      .select("*")
      .eq("id", params.id)
      .single();

    if (!signatureRequest) {
      return NextResponse.json({ error: "Demande non trouvée" }, { status: 404 });
    }

    if (signatureRequest.status !== "pending_validation") {
      return NextResponse.json(
        { error: "Cette demande n'est pas en attente de validation" },
        { status: 400 }
      );
    }

    // Créer l'enregistrement de validation
    await adminSupabase.from("signature_validations").insert({
      signature_request_id: params.id,
      validator_profile_id: profile.id,
      validator_role: validator_role || "hierarchique",
      status: approved ? "approved" : "rejected",
      comment,
      validated_at: new Date().toISOString(),
    });

    // Mettre à jour la demande
    const newStatus = approved ? "validated" : "rejected";
    await adminSupabase
      .from("signature_requests")
      .update({
        status: newStatus,
        validated_by: profile.id,
        validated_at: new Date().toISOString(),
        validation_comment: comment,
      })
      .eq("id", params.id);

    // Audit log
    await adminSupabase.from("signature_audit_log").insert({
      signature_request_id: params.id,
      action: approved ? "validated" : "rejected",
      actor_profile_id: profile.id,
      details: { comment, validator_role: validator_role || "hierarchique" },
    });

    // Notifier le créateur
    await adminSupabase.from("notifications").insert({
      profile_id: signatureRequest.created_by,
      type: approved ? "signature_validated" : "signature_rejected",
      title: approved ? "Demande de signature validée" : "Demande de signature refusée",
      message: approved 
        ? `Votre demande "${signatureRequest.name}" a été validée. Vous pouvez maintenant l'envoyer aux signataires.`
        : `Votre demande "${signatureRequest.name}" a été refusée. ${comment || ""}`,
      data: { signature_request_id: params.id },
    });

    return NextResponse.json({
      success: true,
      status: newStatus,
    });
  } catch (error: any) {
    console.error("[POST /api/signatures/requests/[id]/validate] Error:", error);
    
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

