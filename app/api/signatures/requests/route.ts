export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServerClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { CreateSignatureRequestDTO, SignatureRequest } from "@/lib/signatures/types";

// Schema de validation
const createRequestSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
  document_type: z.enum([
    "bail", "avenant", "edl_entree", "edl_sortie", "quittance",
    "caution", "devis", "facture", "note_service", "reglement_interieur", "autre"
  ]),
  related_entity_type: z.enum(["lease", "inspection", "quote", "internal"]).optional(),
  related_entity_id: z.string().uuid().optional(),
  source_document_id: z.string().uuid(),
  signers: z.array(z.object({
    profile_id: z.string().uuid().optional(),
    email: z.string().email(),
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    phone: z.string().optional(),
    role: z.enum([
      "proprietaire", "locataire_principal", "colocataire",
      "garant", "representant_legal", "temoin", "autre"
    ]),
    signing_order: z.number().int().min(1).optional(),
    signature_level: z.enum([
      "electronic_signature", "advanced_electronic_signature", "qualified_electronic_signature"
    ]).optional(),
  })).min(1, "Au moins un signataire requis"),
  validation_required: z.boolean().optional().default(false),
  deadline: z.string().datetime().optional(),
  ordered_signers: z.boolean().optional().default(false),
  reminder_interval_days: z.number().int().min(1).max(14).optional().default(3),
});

/**
 * POST /api/signatures/requests - Créer une demande de signature
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Valider les données
    const body = await request.json();
    const validated = createRequestSchema.parse(body);

    // Vérifier que le document source existe
    const { data: sourceDoc, error: docError } = await supabase
      .from("documents")
      .select("id, storage_path")
      .eq("id", validated.source_document_id)
      .single();

    if (docError || !sourceDoc) {
      return NextResponse.json(
        { error: "Document source non trouvé" },
        { status: 404 }
      );
    }

    // Utiliser service role pour insérer
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Créer la demande de signature
    const { data: signatureRequest, error: createError } = await adminSupabase
      .from("signature_requests")
      .insert({
        name: validated.name,
        description: validated.description,
        document_type: validated.document_type,
        related_entity_type: validated.related_entity_type,
        related_entity_id: validated.related_entity_id,
        source_document_id: validated.source_document_id,
        created_by: profile.id,
        owner_id: profile.id,
        validation_required: validated.validation_required,
        ordered_signers: validated.ordered_signers,
        reminder_interval_days: validated.reminder_interval_days,
        deadline: validated.deadline,
        status: "draft",
      })
      .select()
      .single();

    if (createError) {
      console.error("[POST /api/signatures/requests] Error:", createError);
      return NextResponse.json(
        { error: "Erreur lors de la création" },
        { status: 500 }
      );
    }

    // Ajouter les signataires
    const signersToInsert = validated.signers.map((signer, index) => ({
      signature_request_id: signatureRequest.id,
      profile_id: signer.profile_id,
      email: signer.email,
      first_name: signer.first_name,
      last_name: signer.last_name,
      phone: signer.phone,
      role: signer.role,
      signing_order: signer.signing_order || index + 1,
      signature_level: signer.signature_level || "electronic_signature",
      status: "pending",
    }));

    const { error: signersError } = await adminSupabase
      .from("signature_request_signers")
      .insert(signersToInsert);

    if (signersError) {
      console.error("[POST /api/signatures/requests] Signers error:", signersError);
      // Rollback : supprimer la demande
      await adminSupabase
        .from("signature_requests")
        .delete()
        .eq("id", signatureRequest.id);
      return NextResponse.json(
        { error: "Erreur lors de l'ajout des signataires" },
        { status: 500 }
      );
    }

    // Audit log
    await adminSupabase.from("signature_audit_log").insert({
      signature_request_id: signatureRequest.id,
      action: "created",
      actor_profile_id: profile.id,
      details: { signers_count: validated.signers.length },
    });

    // Retourner la demande avec les signataires
    const { data: fullRequest } = await adminSupabase
      .from("signature_requests")
      .select(`
        *,
        signers:signature_request_signers(*)
      `)
      .eq("id", signatureRequest.id)
      .single();

    return NextResponse.json(fullRequest, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/signatures/requests] Error:", error);
    
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

/**
 * GET /api/signatures/requests - Lister les demandes de signature
 */
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const relatedEntityType = searchParams.get("related_entity_type");
    const relatedEntityId = searchParams.get("related_entity_id");

    // Utiliser service role pour bypasser RLS complexe
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let query = adminSupabase
      .from("signature_requests")
      .select(`
        *,
        signers:signature_request_signers(*),
        source_document:documents!source_document_id(id, title, storage_path)
      `)
      .order("created_at", { ascending: false });

    // Filtrer selon le rôle
    if (profile.role !== "admin") {
      query = query.or(`owner_id.eq.${profile.id},created_by.eq.${profile.id}`);
    }

    // Filtres optionnels
    if (status) {
      query = query.eq("status", status);
    }
    if (relatedEntityType) {
      query = query.eq("related_entity_type", relatedEntityType);
    }
    if (relatedEntityId) {
      query = query.eq("related_entity_id", relatedEntityId);
    }

    const { data: requests, error } = await query;

    if (error) {
      console.error("[GET /api/signatures/requests] Error:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    return NextResponse.json(requests);
  } catch (error: unknown) {
    console.error("[GET /api/signatures/requests] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

