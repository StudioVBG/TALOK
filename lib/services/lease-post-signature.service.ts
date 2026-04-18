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
import { generateSignedLeasePdf } from "@/lib/pdf/lease-signed-pdf";
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

export async function handleLeaseFullySigned(
  leaseId: string,
  options?: { force?: boolean }
): Promise<PostSignatureResult> {
  const serviceClient = getServiceClient();
  const force = options?.force ?? false;

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

  // Si déjà scellé avec un vrai PDF, ne rien refaire (sauf si force=true)
  if (!force && lease.sealed_at && lease.signed_pdf_path && !lease.signed_pdf_path.startsWith("pending_generation_")) {
    result.pdfStored = true;
    result.pdfPath = lease.signed_pdf_path;
    result.sealedAt = lease.sealed_at;
    result.sealed = true;
    return result;
  }

  // En mode force, réinitialiser sealed_at et signed_pdf_path pour permettre le re-scellement
  if (force && lease.sealed_at) {
    await serviceClient
      .from("leases")
      .update({ sealed_at: null, signed_pdf_path: null } as any)
      .eq("id", leaseId);
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

  // ── 2. Générer le PDF signé (rendu Puppeteer, typographie Manrope justifiée) ──
  let sealedDocPath: string | null = null;
  try {
    const generated = await generateSignedLeasePdf(leaseId, { force });
    sealedDocPath = generated.storagePath;
    result.pdfStored = true;
    result.pdfPath = generated.storagePath;
  } catch (pdfErr) {
    console.warn("[post-signature] Exception génération PDF (non bloquant):", String(pdfErr));
  }

  // ── 3. Sceller le bail (seal_lease RPC) ────────────────────────────
  const finalPdfPath = result.pdfStored && sealedDocPath
    ? sealedDocPath
    : `pending_generation_${Date.now()}`;

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
