/**
 * Service post-signature bail — SOTA 2026
 *
 * Centralise TOUTE la logique exécutée après que tous les signataires
 * ont signé un bail (statut → fully_signed).
 *
 * Appelé par :
 *  - POST /api/leases/[id]/sign       (propriétaire signe via l'app)
 *  - POST /api/signature/[token]/sign  (locataire signe via token)
 *  - Self-healing dans fetchLeaseDetails (rattrapage baux corrompus)
 *
 * Utilise getServiceClient() — aucune authentification utilisateur requise.
 */

import { getServiceClient } from "@/lib/supabase/service-client";
import { generateSignedLeasePDF } from "@/lib/services/lease-pdf-generator";
import { ensureInitialInvoiceForLease } from "@/lib/services/lease-initial-invoice.service";

// ─── Types ───────────────────────────────────────────────────────────

export interface PostSignatureResult {
  pdfStored: boolean;
  pdfPath: string | null;
  sealedAt: string | null;
  sealed: boolean;
  invoiceId: string | null;
  invoiceCreated: boolean;
  invoiceAmount: number;
  depositAmount: number;
}

// ─── Fonction principale ─────────────────────────────────────────────

export async function handleLeaseFullySigned(leaseId: string): Promise<PostSignatureResult> {
  const serviceClient = getServiceClient();

  const result: PostSignatureResult = {
    pdfStored: false,
    pdfPath: null,
    sealedAt: null,
    sealed: false,
    invoiceId: null,
    invoiceCreated: false,
    invoiceAmount: 0,
    depositAmount: 0,
  };

  // ── 1. Vérifier que le bail existe et que tous les signataires sont signed ──
  const { data: lease } = await serviceClient
    .from("leases")
    .select("id, statut, sealed_at, signed_pdf_path, property_id")
    .eq("id", leaseId)
    .single();

  if (!lease) {
    console.error("[post-signature] Bail non trouvé:", leaseId);
    return result;
  }

  // Si déjà scellé avec un vrai PDF, ne rien refaire
  if (lease.sealed_at && lease.signed_pdf_path && !lease.signed_pdf_path.startsWith("pending_generation_")) {
    result.pdfStored = true;
    result.pdfPath = lease.signed_pdf_path;
    result.sealedAt = lease.sealed_at;
    result.sealed = true;
    return result;
  }

  const { data: signers } = await serviceClient
    .from("lease_signers")
    .select("id, signature_status")
    .eq("lease_id", leaseId);

  const allSigned =
    signers &&
    signers.length >= 2 &&
    signers.every((s) => s.signature_status === "signed");

  if (!allSigned) {
    console.warn("[post-signature] Signataires incomplets pour", leaseId);
    return result;
  }

  // ── 2. Générer le document HTML signé ─────────────────────────────
  const sealedDocPath = `bails/${leaseId}/signed_final.html`;

  try {
    const { html } = await generateSignedLeasePDF(leaseId);
    const htmlBuffer = Buffer.from(html, "utf-8");

    const { error: uploadErr } = await serviceClient.storage
      .from("documents")
      .upload(sealedDocPath, htmlBuffer, {
        contentType: "text/html; charset=utf-8",
        upsert: true,
        cacheControl: "31536000",
      });

    if (uploadErr) {
      console.warn("[post-signature] Erreur upload HTML:", uploadErr.message);
    } else {
      result.pdfStored = true;
      result.pdfPath = sealedDocPath;
      console.log("[post-signature] HTML signé stocké:", sealedDocPath, "size:", htmlBuffer.length);

      // ── 3. Upsert document bail_signe en DB ─────────────────────────
      const { data: existingDoc } = await serviceClient
        .from("documents")
        .select("id")
        .eq("type", "bail_signe")
        .eq("lease_id", leaseId)
        .maybeSingle();

      const docMetadata = {
        sealed: true,
        sealed_at: new Date().toISOString(),
        size_bytes: htmlBuffer.length,
        content_type: "text/html",
      };

      if (existingDoc) {
        await serviceClient
          .from("documents")
          .update({
            storage_path: sealedDocPath,
            metadata: docMetadata,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", existingDoc.id);
      } else {
        const { data: leaseForProperty } = await serviceClient
          .from("leases")
          .select("property_id, properties(owner_id, adresse_complete)")
          .eq("id", leaseId)
          .single();

        const prop = (leaseForProperty as any)?.properties;

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
          title: `Bail signé - ${prop?.adresse_complete || leaseId.slice(0, 8)}`,
          owner_id: prop?.owner_id,
          tenant_id: tenantSigner?.profile_id || null,
          property_id: (leaseForProperty as any)?.property_id,
          lease_id: leaseId,
          storage_path: sealedDocPath,
          metadata: docMetadata,
        } as any);
      }
    }
  } catch (pdfErr) {
    console.warn("[post-signature] Exception génération document (non bloquant):", String(pdfErr));
  }

  // ── 4. Sceller le bail (seal_lease RPC) ────────────────────────────
  const finalPdfPath = result.pdfStored ? sealedDocPath : `pending_generation_${Date.now()}`;

  try {
    const { error: sealError } = await serviceClient.rpc("seal_lease", {
      p_lease_id: leaseId,
      p_pdf_path: finalPdfPath,
    });

    if (sealError) {
      console.warn("[post-signature] Erreur seal_lease:", sealError.message);
      try {
        await serviceClient.from("outbox").insert({
          event_type: "Lease.SealRetry",
          payload: {
            lease_id: leaseId,
            reason: "seal_lease_failed",
            error: sealError.message,
            pdf_stored: result.pdfStored,
          },
        });
      } catch {
        // non bloquant
      }
    } else {
      result.sealed = true;
      result.sealedAt = new Date().toISOString();
      console.log("[post-signature] Bail scellé:", leaseId);
    }
  } catch (sealErr) {
    console.warn("[post-signature] Exception scellement:", String(sealErr));
    try {
      await serviceClient.from("outbox").insert({
        event_type: "Lease.SealRetry",
        payload: { lease_id: leaseId, reason: "seal_lease_exception", error: String(sealErr) },
      });
    } catch {
      // non bloquant
    }
  }

  // ── 5. Créer la facture initiale ───────────────────────────────────
  try {
    const invoiceResult = await ensureInitialInvoiceForLease(
      serviceClient as unknown as Parameters<typeof ensureInitialInvoiceForLease>[0],
      leaseId
    );

    result.invoiceId = invoiceResult.invoiceId;
    result.invoiceCreated = invoiceResult.created;
    result.invoiceAmount = invoiceResult.amount;
    result.depositAmount = invoiceResult.depositAmount;

    console.log("[post-signature] Facture initiale:", {
      invoiceId: invoiceResult.invoiceId,
      created: invoiceResult.created,
      amount: invoiceResult.amount,
    });

    if (invoiceResult.created) {
      await serviceClient.from("outbox").insert({
        event_type: "Invoice.InitialCreated",
        payload: {
          lease_id: leaseId,
          invoice_id: invoiceResult.invoiceId,
          tenant_profile_id: invoiceResult.tenantProfileId,
          owner_profile_id: invoiceResult.ownerProfileId,
          amount: invoiceResult.amount,
          includes_deposit: invoiceResult.depositAmount > 0,
          deposit_amount: invoiceResult.depositAmount,
        },
      } as any);
    }
  } catch (invoiceErr) {
    console.warn("[post-signature] Exception facture initiale (non bloquant):", String(invoiceErr));
  }

  return result;
}
