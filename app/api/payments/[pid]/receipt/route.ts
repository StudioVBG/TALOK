export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextRequest, NextResponse } from "next/server";
import { generateReceiptPDF, type ReceiptData } from "@/lib/services/receipt-generator";
import crypto from "crypto";

/**
 * GET /api/payments/[pid]/receipt - Télécharger la quittance PDF d'un paiement
 *
 * PATTERN: Création unique → Lectures multiples
 * 1. Vérifier si quittance existe déjà dans documents
 * 2. Si oui → retourner URL signée (LECTURE)
 * 3. Si non → générer, stocker, puis retourner (CRÉATION UNIQUE)
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pid: string }> }
) {
  try {
    const { pid } = await params;
    const supabase = await createClient();
    const serviceClient = getServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const paymentId = pid;

    // === ÉTAPE 1: Vérifier si la quittance existe déjà (LECTURE) ===
    const { data: existingDoc } = await serviceClient
      .from("documents")
      .select("id, storage_path")
      .eq("type", "quittance")
      .filter("metadata->>payment_id", "eq", paymentId)
      .maybeSingle();

    if (existingDoc?.storage_path) {
      // Document existe → retourner URL signée (LECTURE)
      const { data: signedUrl, error: urlError } = await serviceClient.storage
        .from("documents")
        .createSignedUrl(existingDoc.storage_path, 3600); // 1h

      if (!urlError && signedUrl?.signedUrl) {
        // Journaliser l'accès
        await serviceClient.from("audit_log").insert({
          user_id: user.id,
          action: "read",
          entity_type: "document",
          entity_id: existingDoc.id,
          metadata: { type: "quittance", cached: true },
        } as any);

        return NextResponse.redirect(signedUrl.signedUrl);
      }
    }

    // === ÉTAPE 2: Récupérer les données du paiement ===
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select(`
        *,
        invoice:invoices!inner(
          id,
          lease_id,
          periode,
          montant_total,
          montant_loyer,
          montant_charges,
          owner_id,
          tenant_id,
          lease:leases!inner(
            id,
            property:properties!inner(
              id,
              owner_id,
              adresse_complete,
              ville,
              code_postal
            )
          )
        )
      `)
      .eq("id", paymentId as any)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: "Paiement non trouvé" },
        { status: 404 }
      );
    }

    const paymentData = payment as any;

    // === ÉTAPE 3: Vérifier les permissions ===
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileData = profile as any;

    // Vérifier les permissions (propriétaire, locataire, colocataire, admin)
    const { data: roommate } = await supabase
      .from("roommates")
      .select("id")
      .eq("lease_id", paymentData.invoice.lease_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const isOwner = paymentData.invoice.lease.property.owner_id === profileData.id;
    const isTenant = paymentData.invoice.tenant_id === profileData.id || !!roommate;
    const isAdmin = profileData.role === "admin";

    if (!isOwner && !isTenant && !isAdmin) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Vérifier si le paiement a réussi
    if (paymentData.statut !== "succeeded") {
      return NextResponse.json(
        { error: "Le paiement n'a pas réussi, impossible de générer une quittance" },
        { status: 400 }
      );
    }

    // === ÉTAPE 4: Récupérer les informations complémentaires ===
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("prenom, nom")
      .eq("id", paymentData.invoice.owner_id)
      .single();

    const { data: ownerDetails } = await supabase
      .from("owner_profiles")
      .select("siret, adresse_facturation, adresse_siege, type, raison_sociale")
      .eq("profile_id", paymentData.invoice.owner_id)
      .single();

    const { data: tenantProfile } = await supabase
      .from("profiles")
      .select("prenom, nom")
      .eq("id", paymentData.invoice.tenant_id)
      .single();

    // Déterminer le nom et l'adresse du propriétaire (particulier vs société)
    const isOwnerSociete = ownerDetails?.type === "societe" && ownerDetails?.raison_sociale;
    const ownerDisplayName = isOwnerSociete 
      ? ownerDetails.raison_sociale 
      : ownerProfile 
        ? `${ownerProfile.prenom || ""} ${ownerProfile.nom || ""}`.trim() || "Propriétaire"
        : "Propriétaire";
    const ownerAddress = ownerDetails?.adresse_facturation || ownerDetails?.adresse_siege || "";

    // === ÉTAPE 5: Construire les données pour la quittance ===
    const receiptData: ReceiptData = {
      ownerName: ownerDisplayName,
      ownerAddress: ownerAddress,
      ownerSiret: ownerDetails?.siret || undefined,
      tenantName: tenantProfile 
        ? `${tenantProfile.prenom || ""} ${tenantProfile.nom || ""}`.trim() || "Locataire"
        : "Locataire",
      propertyAddress: paymentData.invoice.lease.property.adresse_complete || "",
      propertyCity: paymentData.invoice.lease.property.ville || "",
      propertyPostalCode: paymentData.invoice.lease.property.code_postal || "",
      period: paymentData.invoice.periode,
      rentAmount: Number(paymentData.invoice.montant_loyer) || 0,
      chargesAmount: Number(paymentData.invoice.montant_charges) || 0,
      totalAmount: Number(paymentData.montant) || Number(paymentData.invoice.montant_total) || 0,
      paymentDate: paymentData.date_paiement || new Date().toISOString().split("T")[0],
      paymentMethod: paymentData.moyen || "cb",
      invoiceId: paymentData.invoice.id,
      paymentId: paymentData.id,
      leaseId: paymentData.invoice.lease_id,
    };

    // === ÉTAPE 6: Générer le PDF (CRÉATION UNIQUE) ===
    const pdfBytes = await generateReceiptPDF(receiptData);

    // Calculer le hash pour l'intégrité
    const documentHash = crypto
      .createHash("sha256")
      .update(`${paymentId}-${receiptData.period}-${receiptData.totalAmount}`)
      .digest("hex");

    // === ÉTAPE 7: Stocker dans Supabase Storage ===
    const storagePath = `quittances/${paymentData.invoice.tenant_id}/${paymentData.invoice.periode}/${paymentId}.pdf`;

    const { error: uploadError } = await serviceClient.storage
      .from("documents")
      .upload(storagePath, Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        upsert: true, // Remplacer si existe
        cacheControl: "31536000", // Cache 1 an (document immuable)
      });

    if (uploadError) {
      console.error("[receipt] Erreur upload Storage:", uploadError);
      // Fallback: retourner le PDF directement sans stockage permanent
      const filename = `quittance-${receiptData.period}-${paymentId.slice(0, 8)}.pdf`;
      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": pdfBytes.length.toString(),
        },
      });
    }

    // === ÉTAPE 8: Créer l'entrée dans la table documents ===
    const { data: newDoc, error: insertError } = await serviceClient
      .from("documents")
      .insert({
        type: "quittance",
        owner_id: paymentData.invoice.owner_id,
        tenant_id: paymentData.invoice.tenant_id,
        property_id: paymentData.invoice.lease.property.id,
        lease_id: paymentData.invoice.lease_id,
        storage_path: storagePath,
        metadata: {
          payment_id: paymentId,
          invoice_id: paymentData.invoice.id,
          periode: receiptData.period,
          montant: receiptData.totalAmount,
          hash: documentHash,
          generated_at: new Date().toISOString(),
        },
      } as any)
      .select("id")
      .single();

    if (insertError) {
      console.warn("[receipt] Erreur insertion documents:", insertError);
    }

    // === ÉTAPE 9: Journaliser la création ===
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "create",
      entity_type: "document",
      entity_id: newDoc?.id || paymentId,
      metadata: { 
        type: "quittance", 
        storage_path: storagePath,
        cached: false,
      },
    } as any);

    // === ÉTAPE 10: Retourner URL signée ===
    const { data: signedUrl, error: signError } = await serviceClient.storage
      .from("documents")
      .createSignedUrl(storagePath, 3600); // 1h

    if (!signError && signedUrl?.signedUrl) {
      return NextResponse.redirect(signedUrl.signedUrl);
    }

    // Fallback: retourner le buffer directement
    const filename = `quittance-${receiptData.period}-${paymentId.slice(0, 8)}.pdf`;
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBytes.length.toString(),
      },
    });

  } catch (error: unknown) {
    console.error("[receipt] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
