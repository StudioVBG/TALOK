/**
 * Service post-signature EDL — SOTA 2026
 *
 * Genere le PDF definitif de l'etat des lieux signe (entree ou sortie) des
 * que toutes les parties ont signe, puis scelle l'EDL via RPC seal_edl
 * (pattern aligne sur seal_lease).
 *
 * Appele par :
 *  - POST /api/edl/[id]/sign                 (proprietaire signe via l'app)
 *  - POST /api/signature/edl/[token]/sign    (locataire signe via token)
 *
 * Idempotent : si un PDF signe existe deja, retourne l'existant. Si l'EDL
 * est deja scelle, seal_edl renvoie FALSE sans erreur.
 *
 * IMPORTANT : ce service throw en cas d'echec (generation PDF OU seal RPC).
 * Les routes appelantes DOIVENT wrapper dans try/catch et rollback le
 * status='signed' pour eviter un etat incoherent (signed sans PDF final).
 */

import { generateSignedEdlPdf } from "@/lib/pdf/edl-signed-pdf";
import { getServiceClient } from "@/lib/supabase/service-client";

export interface EDLPostSignatureResult {
  storagePath: string;
  sealed: boolean;
}

export async function handleEDLFullySigned(edlId: string): Promise<EDLPostSignatureResult> {
  // 1. Generation PDF (sync, throw si echec).
  const generated = await generateSignedEdlPdf(edlId);

  if (!generated.storagePath) {
    throw new Error(`[edl-post-signature] Generation PDF EDL ${edlId} echouee (pas de storagePath)`);
  }

  // 2. Scellement atomique via RPC seal_edl.
  const serviceClient = getServiceClient();
  const { data: sealed, error: sealError } = await serviceClient.rpc("seal_edl" as any, {
    p_edl_id: edlId,
    p_pdf_path: generated.storagePath,
  });

  if (sealError) {
    throw new Error(`[edl-post-signature] seal_edl echoue pour ${edlId}: ${sealError.message}`);
  }

  return {
    storagePath: generated.storagePath,
    sealed: sealed === true,
  };
}
