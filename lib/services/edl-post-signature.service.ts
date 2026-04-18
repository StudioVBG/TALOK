/**
 * Service post-signature EDL — SOTA 2026
 *
 * Genere le PDF definitif de l'etat des lieux signe (entree ou sortie) des
 * que toutes les parties ont signe. Remplace l'ancien signed_document.html.
 *
 * Appele par :
 *  - POST /api/edl/[id]/sign                 (proprietaire signe via l'app)
 *  - POST /api/signature/edl/[token]/sign    (locataire signe via token)
 *
 * Idempotent : si un PDF signe existe deja, retourne l'existant.
 */

import { generateSignedEdlPdf } from "@/lib/pdf/edl-signed-pdf";

export interface EDLPostSignatureResult {
  htmlStored: boolean;
  storagePath: string | null;
}

export async function handleEDLFullySigned(edlId: string): Promise<EDLPostSignatureResult> {
  try {
    const generated = await generateSignedEdlPdf(edlId);
    return {
      htmlStored: true,
      storagePath: generated.storagePath,
    };
  } catch (err) {
    console.warn("[edl-post-signature] Exception (non bloquant):", String(err));
    return { htmlStored: false, storagePath: null };
  }
}
