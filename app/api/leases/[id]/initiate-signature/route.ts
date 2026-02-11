export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { LEASE_STATUS } from "@/lib/constants/roles";

/**
 * POST /api/leases/[id]/initiate-signature
 *
 * Passe le bail de "draft" à "pending_signature" et notifie les signataires.
 * Prérequis : au moins 1 propriétaire + 1 locataire dans lease_signers.
 *
 * @version SSOT 2026
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leaseId } = await params;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    // 1. Récupérer le bail
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select("id, statut, property_id")
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    // 2. Vérifier que le bail est en brouillon
    if (lease.statut !== LEASE_STATUS.DRAFT) {
      return NextResponse.json(
        {
          error: `Le bail est déjà en statut "${lease.statut}". Seuls les brouillons peuvent être envoyés pour signature.`,
        },
        { status: 400 }
      );
    }

    // 3. Vérifier que l'utilisateur est le propriétaire du bien
    const { data: property } = await serviceClient
      .from("properties")
      .select("owner_id")
      .eq("id", lease.property_id)
      .single();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!property || !profile || property.owner_id !== profile.id) {
      return NextResponse.json(
        { error: "Seul le propriétaire peut envoyer le bail pour signature" },
        { status: 403 }
      );
    }

    // 4. Vérifier les annexes obligatoires (Art. 3-3 Loi 89-462 / Loi ALUR)
    const { data: leaseFull } = await serviceClient
      .from("leases")
      .select("type_bail, property_id")
      .eq("id", leaseId)
      .single();

    const typeBail = (leaseFull as any)?.type_bail || "nu";

    // Annexes obligatoires pour tous les baux résidentiels
    const MANDATORY_ANNEXES: Record<string, { label: string; condition?: (type: string) => boolean }> = {
      dpe: { label: "DPE (Diagnostic de Performance Énergétique)" },
      diagnostic_electricite: { label: "Diagnostic Électricité (installation > 15 ans)" },
      diagnostic_gaz: { label: "Diagnostic Gaz (installation > 15 ans)" },
      diagnostic_plomb: { label: "Diagnostic Plomb / CREP (immeuble avant 1949)" },
      erp: { label: "État des Risques et Pollutions (ERP)" },
      inventaire: {
        label: "Inventaire du mobilier (Décret 2015-981)",
        condition: (t) => ["meuble", "colocation", "etudiant", "bail_mobilite"].includes(t)
      },
    };

    // Vérifier les documents uploadés pour ce bail
    const { data: documents } = await serviceClient
      .from("documents")
      .select("type")
      .eq("lease_id", leaseId);

    // Vérifier aussi les documents liés au bien
    const { data: propertyDocs } = await serviceClient
      .from("documents")
      .select("type")
      .eq("property_id", lease.property_id);

    const allDocTypes = new Set([
      ...(documents || []).map((d: any) => d.type),
      ...(propertyDocs || []).map((d: any) => d.type),
    ]);

    const missingAnnexes: string[] = [];
    const commercialTypes = ["commercial_3_6_9", "commercial_derogatoire", "professionnel", "location_gerance", "bail_rural", "contrat_parking"];
    const isResidential = !commercialTypes.includes(typeBail);

    if (isResidential) {
      for (const [docType, config] of Object.entries(MANDATORY_ANNEXES)) {
        // Si condition spécifique par type de bail
        if (config.condition && !config.condition(typeBail)) continue;
        if (!allDocTypes.has(docType)) {
          missingAnnexes.push(config.label);
        }
      }
    }

    // Body pour options
    const reqBody = await request.json().catch(() => ({}));
    const { force_without_annexes = false } = reqBody;

    if (missingAnnexes.length > 0 && !force_without_annexes) {
      return NextResponse.json({
        error: "Annexes obligatoires manquantes",
        missing_annexes: missingAnnexes,
        missing_count: missingAnnexes.length,
        hint: "Uploadez les diagnostics obligatoires avant l'envoi pour signature (Art. 3-3 Loi 89-462). Utilisez force_without_annexes: true pour forcer.",
        can_force: true,
        conformity: "non_conforme"
      }, { status: 400 });
    }

    // 5. Vérifier les signataires requis (min 1 proprio + 1 locataire)
    const { data: signers } = await serviceClient
      .from("lease_signers")
      .select("id, role, invited_email, profile_id")
      .eq("lease_id", leaseId);

    if (!signers || signers.length < 2) {
      return NextResponse.json(
        {
          error:
            "Au moins 2 signataires sont requis (propriétaire + locataire)",
          missing: "signers",
        },
        { status: 400 }
      );
    }

    const ownerRoles = ["proprietaire", "owner", "bailleur"];
    const tenantRoles = [
      "locataire_principal",
      "locataire",
      "tenant",
      "principal",
    ];

    const hasOwner = signers.some((s: any) =>
      ownerRoles.includes((s.role || "").toLowerCase())
    );
    const hasTenant = signers.some((s: any) =>
      tenantRoles.includes((s.role || "").toLowerCase())
    );

    if (!hasOwner) {
      return NextResponse.json(
        { error: "Un signataire propriétaire est requis", missing: "owner" },
        { status: 400 }
      );
    }
    if (!hasTenant) {
      return NextResponse.json(
        { error: "Un signataire locataire est requis", missing: "tenant" },
        { status: 400 }
      );
    }

    // 5. Passer le statut à pending_signature
    const { error: updateError } = await serviceClient
      .from("leases")
      .update({
        statut: LEASE_STATUS.PENDING_SIGNATURE,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", leaseId);

    if (updateError) {
      console.error("[initiate-signature] Update error:", updateError);
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour du statut" },
        { status: 500 }
      );
    }

    // 6. Journaliser l'action
    await serviceClient
      .from("audit_log")
      .insert({
        user_id: user.id,
        action: "lease_sent_for_signature",
        entity_type: "lease",
        entity_id: leaseId,
        metadata: {
          signers_count: signers.length,
          has_owner: hasOwner,
          has_tenant: hasTenant,
          conformity: missingAnnexes.length === 0 ? "conforme" : "forced",
          missing_annexes: missingAnnexes,
        },
      } as any)
      .then(() => {})
      .catch((err: any) =>
        console.warn("[initiate-signature] Audit log error:", err)
      );

    // 7. Émettre un événement outbox pour notifications (si la table existe)
    await serviceClient
      .from("outbox")
      .insert({
        event_type: "Lease.SentForSignature",
        aggregate_id: leaseId,
        payload: {
          lease_id: leaseId,
          signers: signers.map((s: any) => ({
            id: s.id,
            role: s.role,
            email: s.invited_email,
          })),
        },
      } as any)
      .then(() => {})
      .catch((err: any) =>
        console.warn("[initiate-signature] Outbox error:", err)
      );

    return NextResponse.json({
      success: true,
      lease_id: leaseId,
      new_status: LEASE_STATUS.PENDING_SIGNATURE,
      signers_count: signers.length,
    });
  } catch (error) {
    console.error("[initiate-signature] Unexpected error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
