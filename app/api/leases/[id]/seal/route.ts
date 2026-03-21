export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { generateSignedLeasePDF } from "@/lib/services/lease-pdf-generator";

/**
 * POST /api/leases/[id]/seal
 *
 * Scelle un bail après signature complète :
 * 1. Vérifie que toutes les signatures sont présentes
 * 2. Génère le HTML final avec signatures injectées et certificat
 * 3. Stocke le document dans Supabase Storage
 * 4. Met à jour le bail avec le chemin du PDF et la date de scellement
 * 5. Crée l'entrée document associée
 *
 * Paramètre optionnel : ?regenerate=true
 * Permet de re-générer le document pour un bail déjà scellé
 * (corrige les baux scellés avec un contenu placeholder).
 *
 * Un bail scellé ne peut plus être modifié (contenu contractuel).
 * Seul le statut peut évoluer (fully_signed → active → terminated).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const leaseId = id;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();
    const url = new URL(request.url);
    const isRegenerate = url.searchParams.get("regenerate") === "true";

    // 1. Récupérer le bail avec signataires
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select(`
        id, statut, property_id, sealed_at, signed_pdf_path,
        property:properties!leases_property_id_fkey(id, owner_id),
        signers:lease_signers(id, role, signature_status, signed_at, profile:profiles(prenom, nom, profile_id:id))
      `)
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    // 2. Vérifier l'état du bail
    if ((lease as any).sealed_at && !isRegenerate) {
      return NextResponse.json({
        error: "Ce bail est déjà scellé",
        signed_pdf_path: (lease as any).signed_pdf_path
      }, { status: 400 });
    }

    // 3. Vérifier que toutes les signatures sont présentes
    const signers = (lease as any).signers || [];
    const allSigned = signers.length > 0 &&
      signers.every((s: any) => s.signature_status === "signed");

    if (!allSigned) {
      const pendingSigners = signers
        .filter((s: any) => s.signature_status !== "signed")
        .map((s: any) => s.role);

      return NextResponse.json({
        error: "Toutes les signatures ne sont pas collectées",
        pending_signers: pendingSigners
      }, { status: 400 });
    }

    // 4. Générer le HTML complet avec signatures injectées et certificat
    const { html: fullHtml } = await generateSignedLeasePDF(leaseId);

    // 5. Stocker dans Storage (chemin unifié avec handleLeaseFullySigned)
    const storagePath = `bails/${leaseId}/signed_final.html`;
    const htmlBuffer = Buffer.from(fullHtml, "utf-8");

    const { error: uploadError } = await serviceClient.storage
      .from("documents")
      .upload(storagePath, htmlBuffer, {
        contentType: "text/html; charset=utf-8",
        upsert: true,
      });

    if (uploadError) {
      console.error("[Seal] Erreur upload:", uploadError);
      return NextResponse.json({
        error: "Erreur lors du stockage du document",
        details: uploadError.message
      }, { status: 500 });
    }

    const now = new Date().toISOString();
    const propertyOwnerId = (lease as any).property?.owner_id;

    if (isRegenerate) {
      // Mode régénération : mettre à jour uniquement le chemin du document
      const { error: updateError } = await serviceClient
        .from("leases")
        .update({ signed_pdf_path: storagePath })
        .eq("id", leaseId);

      if (updateError) {
        console.error("[Seal] Erreur mise à jour (regenerate):", updateError);
        return NextResponse.json({ error: "Erreur mise à jour", details: updateError.message }, { status: 500 });
      }

      // Mettre à jour le document existant si présent
      const { data: existingDoc } = await serviceClient
        .from("documents")
        .select("id")
        .eq("lease_id", leaseId)
        .in("type", ["bail", "bail_signe"])
        .limit(1)
        .maybeSingle();

      if (existingDoc) {
        await serviceClient.from("documents")
          .update({ storage_path: storagePath, updated_at: now } as any)
          .eq("id", existingDoc.id);
      }

      await serviceClient.from("audit_log").insert({
        user_id: user.id,
        action: "regenerate_sealed_lease",
        entity_type: "lease",
        entity_id: leaseId,
        metadata: { storage_path: storagePath },
      });

      return NextResponse.json({
        success: true,
        message: "Document du bail régénéré avec succès",
        signed_pdf_path: storagePath,
        regenerated: true,
      });
    }

    // 6. Sceller le bail (première fois)
    const { error: updateError } = await serviceClient
      .from("leases")
      .update({
        signed_pdf_path: storagePath,
        sealed_at: now,
        statut: "fully_signed",
      })
      .eq("id", leaseId);

    if (updateError) {
      console.error("[Seal] Erreur mise à jour bail:", updateError);
      await serviceClient.storage.from("documents").remove([storagePath]);
      return NextResponse.json({
        error: "Erreur lors de la mise à jour du bail",
        details: updateError.message
      }, { status: 500 });
    }

    // 7. Créer l'entrée document
    // Récupérer le tenant_id depuis les signataires
    const { data: tenantSigner } = await serviceClient
      .from("lease_signers")
      .select("profile_id")
      .eq("lease_id", leaseId)
      .in("role", ["locataire_principal", "locataire", "tenant", "principal"] as any)
      .limit(1)
      .maybeSingle();

    await serviceClient.from("documents").insert({
      type: "bail_signe",
      lease_id: leaseId,
      property_id: (lease as any).property_id,
      owner_id: propertyOwnerId,
      tenant_id: tenantSigner?.profile_id || null,
      storage_path: storagePath,
      title: "Bail de location signé",
      metadata: {
        sealed: true,
        sealed_at: now,
        size_bytes: htmlBuffer.length,
        content_type: "text/html",
        signers: signers.map((s: any) => ({
          role: s.role,
          name: `${s.profile?.prenom || ""} ${s.profile?.nom || ""}`.trim(),
          signed_at: s.signed_at,
        })),
      },
    } as any);

    // 8. Émettre un événement
    await serviceClient.from("outbox").insert({
      event_type: "lease.sealed",
      payload: {
        lease_id: leaseId,
        sealed_by: user.id,
        storage_path: storagePath,
      },
    });

    // 9. Audit
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "seal_lease",
      entity_type: "lease",
      entity_id: leaseId,
      metadata: {
        storage_path: storagePath,
        signers_count: signers.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Bail scellé avec succès",
      signed_pdf_path: storagePath,
      sealed_at: now,
    });

  } catch (error: unknown) {
    console.error("[Seal] Erreur:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Erreur serveur"
    }, { status: 500 });
  }
}

/**
 * GET /api/leases/[id]/seal
 * Vérifie si un bail est scellé et retourne ses informations
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const leaseId = id;
  
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    
    const serviceClient = getServiceClient();
    
    const { data: lease, error } = await serviceClient
      .from("leases")
      .select("id, statut, signed_pdf_path, sealed_at")
      .eq("id", leaseId)
      .single();
    
    if (error || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }
    
    const isSealed = !!(lease as any).sealed_at;
    
    return NextResponse.json({
      is_sealed: isSealed,
      sealed_at: (lease as any).sealed_at,
      signed_pdf_path: (lease as any).signed_pdf_path,
      statut: lease.statut,
      is_editable: !isSealed && ["draft", "sent", "pending_signature"].includes(lease.statut || ""),
    });
    
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}




