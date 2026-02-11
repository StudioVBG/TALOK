export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * POST /api/leases/[id]/visale/verify - Vérifier une attestation Visale
 *
 * Visale est un dispositif de cautionnement gratuit géré par Action Logement.
 * Il remplace le garant physique pour les locataires éligibles.
 *
 * API Visale (Action Logement) :
 * - Production: https://www.visale.fr/api/v1/attestation/verify
 * - Documentation: https://www.visale.fr/partenaires/api
 *
 * Flow :
 * 1. Le locataire fournit son numéro de visa Visale
 * 2. L'API vérifie l'attestation auprès d'Action Logement
 * 3. Si valide, le garant Visale est enregistré sur le bail
 *
 * @version 2026-02-11 - Intégration API Visale réelle + fallback
 */

const verifyVisaleSchema = z.object({
  // Numéro de visa Visale (format: V-XXXXXXXXX ou numéro attestation)
  visa_number: z.string().min(5, "Numéro de visa trop court").optional(),
  // URL de l'attestation téléchargée
  attestation_url: z.string().url().optional(),
  // Document uploadé contenant l'attestation
  document_id: z.string().uuid().optional(),
  // Données manuelles (si API indisponible)
  manual_data: z.object({
    numero: z.string(),
    date_debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    date_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    montant_garanti: z.number().positive(),
    nom_locataire: z.string().optional(),
  }).optional(),
}).refine(
  (data) => data.visa_number || data.attestation_url || data.document_id || data.manual_data,
  { message: "visa_number, attestation_url, document_id ou manual_data requis" }
);

/**
 * Appelle l'API Visale Action Logement pour vérifier une attestation
 */
async function verifyWithVisaleAPI(visaNumber: string): Promise<{
  valid: boolean;
  data: any;
  source: "api" | "fallback";
}> {
  const apiKey = process.env.VISALE_API_KEY;
  const apiUrl = process.env.VISALE_API_URL || "https://www.visale.fr/api/v1/attestation/verify";

  if (!apiKey) {
    console.warn("[Visale] VISALE_API_KEY non configurée, utilisation du mode vérification manuelle");
    return {
      valid: false,
      data: null,
      source: "fallback",
    };
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "X-Partner-Id": process.env.VISALE_PARTNER_ID || "",
      },
      body: JSON.stringify({
        visa_number: visaNumber,
        // Champs optionnels pour affiner la recherche
        type_verification: "attestation",
      }),
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { valid: false, data: { error: "Attestation non trouvée" }, source: "api" };
      }
      if (response.status === 401 || response.status === 403) {
        console.error("[Visale] Clé API invalide ou accès refusé");
        return { valid: false, data: null, source: "fallback" };
      }
      throw new Error(`Visale API: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    return {
      valid: result.statut === "VALIDE" || result.valid === true,
      data: {
        numero: result.numero_visa || visaNumber,
        date_debut: result.date_debut_garantie || result.date_debut,
        date_fin: result.date_fin_garantie || result.date_fin,
        montant_garanti: result.montant_garanti || result.plafond_loyer,
        nom_locataire: result.nom_locataire,
        statut: result.statut,
        type_logement: result.type_logement,
        zone_geographique: result.zone_geographique,
      },
      source: "api",
    };
  } catch (error) {
    console.warn("[Visale] API indisponible:", error);
    return { valid: false, data: null, source: "fallback" };
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leaseId } = await params;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validated = verifyVisaleSchema.parse(body);

    const serviceClient = getServiceClient();

    // Vérifier l'accès au bail
    const { data: lease } = await serviceClient
      .from("leases")
      .select(`
        id,
        statut,
        loyer,
        property:properties!leases_property_id_fkey (owner_id, adresse_complete),
        signers:lease_signers (profile_id, role)
      `)
      .eq("id", leaseId)
      .single();

    if (!lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const isOwner = (lease as any).property?.owner_id === profile?.id;
    const isTenant = (lease as any).signers?.some(
      (s: any) => s.profile_id === profile?.id
    );

    if (!isOwner && !isTenant) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // ── Vérification de l'attestation ──
    let visaleData: any = null;
    let verificationSource: "api" | "manual" | "document" = "manual";
    let isValid = false;

    // Mode 1: Vérification via API Action Logement
    if (validated.visa_number) {
      const apiResult = await verifyWithVisaleAPI(validated.visa_number);

      if (apiResult.source === "api") {
        isValid = apiResult.valid;
        visaleData = apiResult.data;
        verificationSource = "api";
      } else if (validated.manual_data) {
        // Fallback: données manuelles si API indisponible
        isValid = true;
        visaleData = validated.manual_data;
        verificationSource = "manual";
      } else {
        return NextResponse.json({
          error: "L'API Visale est indisponible. Fournissez les données manuellement via le champ manual_data.",
          api_available: false,
          hint: "Ajoutez manual_data: { numero, date_debut, date_fin, montant_garanti }",
        }, { status: 503 });
      }
    }
    // Mode 2: Données manuelles directes
    else if (validated.manual_data) {
      isValid = true;
      visaleData = validated.manual_data;
      verificationSource = "manual";

      // Validations basiques sur les dates
      const debut = new Date(validated.manual_data.date_debut);
      const fin = new Date(validated.manual_data.date_fin);
      if (fin <= debut) {
        return NextResponse.json(
          { error: "La date de fin doit être postérieure à la date de début" },
          { status: 400 }
        );
      }
      if (fin < new Date()) {
        return NextResponse.json(
          { error: "L'attestation Visale a expiré" },
          { status: 400 }
        );
      }
    }
    // Mode 3: Document uploadé (vérification OCR future)
    else if (validated.document_id) {
      // Vérifier que le document existe
      const { data: doc } = await serviceClient
        .from("documents")
        .select("id, type, metadata")
        .eq("id", validated.document_id)
        .single();

      if (!doc) {
        return NextResponse.json({ error: "Document non trouvé" }, { status: 404 });
      }

      // Extraire les métadonnées si disponibles (OCR ou saisie manuelle)
      if (validated.manual_data) {
        visaleData = validated.manual_data;
        isValid = true;
      } else {
        return NextResponse.json({
          error: "Document uploadé mais données non extractibles. Fournissez les données via manual_data.",
          document_id: validated.document_id,
          hint: "L'OCR automatique des attestations Visale n'est pas encore supporté. Ajoutez manual_data.",
        }, { status: 400 });
      }
      verificationSource = "document";
    }

    if (!isValid || !visaleData) {
      return NextResponse.json(
        { error: "Attestation Visale invalide ou données insuffisantes" },
        { status: 400 }
      );
    }

    // ── Enregistrer le garant Visale ──
    // Trouver le locataire (le tenant qui soumet, ou le principal)
    const tenantSigner = (lease as any).signers?.find(
      (s: any) => s.profile_id === profile?.id &&
        ["locataire_principal", "locataire", "tenant", "principal", "colocataire"].includes(s.role)
    ) || (lease as any).signers?.find(
      (s: any) => ["locataire_principal", "locataire", "tenant", "principal"].includes(s.role)
    );

    // Chercher le roommate correspondant
    const { data: roommate } = await serviceClient
      .from("roommates")
      .select("id")
      .eq("lease_id", leaseId)
      .eq("profile_id", tenantSigner?.profile_id || profile?.id)
      .maybeSingle();

    if (roommate) {
      // Upsert le garant Visale
      const { data: existingGuarantor } = await serviceClient
        .from("guarantors")
        .select("id")
        .eq("roommate_id", roommate.id)
        .eq("type", "visale" as any)
        .maybeSingle();

      const guarantorPayload = {
        roommate_id: roommate.id,
        type: "visale",
        status: verificationSource === "api" ? "accepted" : "pending_verification",
        metadata: {
          ...visaleData,
          verification_source: verificationSource,
          verified_at: new Date().toISOString(),
          verified_by: user.id,
          api_available: verificationSource === "api",
        },
      } as any;

      if (existingGuarantor) {
        await serviceClient
          .from("guarantors")
          .update(guarantorPayload)
          .eq("id", existingGuarantor.id);
      } else {
        await serviceClient.from("guarantors").insert(guarantorPayload);
      }
    }

    // ── Outbox event ──
    await serviceClient.from("outbox").insert({
      event_type: "Guarantee.Validated",
      aggregate_id: leaseId,
      payload: {
        lease_id: leaseId,
        type: "visale",
        visale_data: visaleData,
        verification_source: verificationSource,
      },
    } as any);

    // ── Audit log ──
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "visale_attestation_verified",
      entity_type: "lease",
      entity_id: leaseId,
      metadata: {
        visa_number: visaleData.numero,
        verification_source: verificationSource,
        montant_garanti: visaleData.montant_garanti,
        valid_until: visaleData.date_fin,
      },
    });

    return NextResponse.json({
      success: true,
      visale: visaleData,
      verification: {
        source: verificationSource,
        api_verified: verificationSource === "api",
        status: verificationSource === "api" ? "verified" : "pending_manual_review",
      },
      message: verificationSource === "api"
        ? "Attestation Visale vérifiée via l'API Action Logement"
        : "Attestation Visale enregistrée (vérification manuelle recommandée)",
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("[Visale] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





