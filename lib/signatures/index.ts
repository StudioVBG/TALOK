/**
 * Module de signatures électroniques internes TALOK
 *
 * Système de signature électronique simple (SES) intégré
 * avec capture d'image de signature et audit trail
 *
 * @example
 * ```typescript
 * import { createSignatureRequest, signDocument } from "@/lib/signatures";
 *
 * // Créer une demande de signature
 * const request = await createSignatureRequest({
 *   name: "Bail - Appartement Paris",
 *   document_type: "bail",
 *   related_entity_type: "lease",
 *   related_entity_id: leaseId,
 *   source_document_id: documentId,
 *   signers: [
 *     { email: "owner@example.com", first_name: "Jean", last_name: "Dupont", role: "proprietaire" },
 *     { email: "tenant@example.com", first_name: "Marie", last_name: "Martin", role: "locataire_principal" },
 *   ],
 * }, creatorProfileId);
 *
 * // Envoyer aux signataires
 * await sendSignatureRequest(request.id);
 *
 * // Signer un document
 * await signDocument(request.id, signerId, {
 *   signature_image_base64: "data:image/png;base64,...",
 *   ip_address: "192.168.1.1",
 *   user_agent: "Mozilla/5.0...",
 * });
 * ```
 */

export * from "./types";
export * from "./service";
