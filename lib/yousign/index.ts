/**
 * Module Yousign - Signatures électroniques eIDAS
 * 
 * @example
 * ```typescript
 * import { createSignatureRequest, addSigner, activateSignatureRequest } from "@/lib/yousign";
 * 
 * // Créer une procédure
 * const procedure = await createSignatureRequest({ name: "Mon contrat" });
 * 
 * // Ajouter le document et les signataires
 * const doc = await addDocument(procedure.id, documentBase64, "contrat.pdf");
 * await addSigner(procedure.id, signerData, doc.id, fields);
 * 
 * // Activer (envoyer aux signataires)
 * await activateSignatureRequest(procedure.id);
 * ```
 */

export * from "./types";
export * from "./service";

