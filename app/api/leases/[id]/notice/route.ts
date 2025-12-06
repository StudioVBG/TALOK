/**
 * API Routes pour les préavis de départ
 * GET /api/leases/[id]/notice - Récupérer le préavis d'un bail
 * POST /api/leases/[id]/notice - Créer un préavis de départ
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, createRouteHandlerClient } from "@/lib/supabase/server";
import { z } from "zod";

const createNoticeSchema = z.object({
  initiated_by: z.enum(["tenant", "owner"]),
  notice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expected_departure_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notice_period_months: z.number().int().min(1).max(6).optional().default(3),
  reason: z.enum([
    "standard",
    "zone_tendue",
    "mutation_professionnelle",
    "perte_emploi",
    "nouvel_emploi",
    "raison_sante",
    "rsa_beneficiaire",
    "aah_beneficiaire",
    "premier_logement",
    "conge_vente",
    "conge_reprise",
    "motif_legitime",
    "autre",
  ]).optional(),
  reason_details: z.string().max(1000).optional(),
  acknowledgment_method: z.enum([
    "lettre_recommandee",
    "acte_huissier",
    "remise_main_propre",
    "email_certifie",
  ]).optional(),
  notes: z.string().max(2000).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leaseId } = await params;
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le préavis avec les détails
    const { data: notice, error } = await supabase
      .from("departure_notices")
      .select(`
        *,
        lease:leases!departure_notices_lease_id_fkey(
          id, loyer, charges_forfaitaires, date_debut,
          property:properties(id, adresse_complete, ville)
        ),
        initiator:profiles!departure_notices_initiator_profile_id_fkey(
          id, prenom, nom
        )
      `)
      .eq("lease_id", leaseId)
      .neq("status", "withdrawn")
      .maybeSingle();

    if (error) {
      console.error("Erreur récupération préavis:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!notice) {
      return NextResponse.json({ error: "Préavis non trouvé" }, { status: 404 });
    }

    return NextResponse.json(notice);
  } catch (error: any) {
    console.error("Erreur API notice GET:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leaseId } = await params;
    const supabase = await createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
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

    // Vérifier que le bail existe et que l'utilisateur y a accès
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select(`
        id, statut, date_debut,
        property:properties(id, owner_id)
      `)
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    // Vérifier l'accès selon le rôle
    const isOwner = (lease.property as any)?.owner_id === profile.id;
    const { data: isSigner } = await supabase
      .from("lease_signers")
      .select("id")
      .eq("lease_id", leaseId)
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (!isOwner && !isSigner && profile.role !== "admin") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Vérifier qu'il n'y a pas déjà un préavis actif
    const { data: existingNotice } = await supabase
      .from("departure_notices")
      .select("id")
      .eq("lease_id", leaseId)
      .not("status", "in", "(withdrawn)")
      .maybeSingle();

    if (existingNotice) {
      return NextResponse.json(
        { error: "Un préavis existe déjà pour ce bail" },
        { status: 409 }
      );
    }

    // Valider les données
    const body = await request.json();
    const validatedData = createNoticeSchema.parse(body);

    // Vérifier la cohérence initiated_by / rôle
    if (validatedData.initiated_by === "owner" && !isOwner && profile.role !== "admin") {
      return NextResponse.json(
        { error: "Seul le propriétaire peut donner un congé" },
        { status: 403 }
      );
    }

    if (validatedData.initiated_by === "tenant" && isOwner && !isSigner) {
      return NextResponse.json(
        { error: "Seul le locataire peut donner un préavis de départ" },
        { status: 403 }
      );
    }

    // Créer le préavis
    const serviceClient = createServiceRoleClient();
    const { data: notice, error: createError } = await serviceClient
      .from("departure_notices")
      .insert({
        lease_id: leaseId,
        initiator_profile_id: profile.id,
        ...validatedData,
        status: "pending",
      })
      .select(`
        *,
        lease:leases!departure_notices_lease_id_fkey(
          id, loyer, charges_forfaitaires,
          property:properties(id, adresse_complete, ville)
        )
      `)
      .single();

    if (createError) {
      console.error("Erreur création préavis:", createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // TODO: Envoyer notification à l'autre partie

    return NextResponse.json(notice, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur API notice POST:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}







