/**
 * Provider LRAR : Merci Facteur (https://www.mercifacteur.com)
 *
 * Sprint 3 — S3-2
 *
 * API REST simple, LRAR papier en France métropolitaine + DROM-COM.
 * Tarif indicatif : ~5€/envoi pour une LRAR A4 N&B.
 *
 * Variables d'environnement :
 *   - MERCI_FACTEUR_API_KEY : clé API (obtenue dans le dashboard MF)
 *   - MERCI_FACTEUR_SANDBOX : 'true' pour utiliser l'environnement de test
 *
 * Documentation API : https://www.mercifacteur.com/api/doc
 *
 * NOTE : cette implémentation est un stub fonctionnel. Les appels HTTP
 * réels sont structurés mais les endpoints exacts doivent être validés
 * contre la documentation API Merci Facteur au moment du déploiement.
 * En mode sandbox, les envois sont simulés et aucun courrier réel n'est
 * posté.
 */

import type {
  LRARProvider,
  LRARSendResult,
  LRARStatusResult,
  LRARSender,
  LRARRecipient,
  LRARDocument,
  LRARSendOptions,
  LRARDeliveryStatus,
} from "../lrar.service";

const PRODUCTION_BASE_URL = "https://www.mercifacteur.com/api/v1";
const SANDBOX_BASE_URL = "https://sandbox.mercifacteur.com/api/v1";

export class MerciFacteurProvider implements LRARProvider {
  readonly providerName = "merci_facteur";

  private get apiKey(): string {
    const key = process.env.MERCI_FACTEUR_API_KEY;
    if (!key) {
      throw new Error(
        "[LRAR:MerciFact] MERCI_FACTEUR_API_KEY non configurée. " +
          "Ajoutez la clé API dans les variables d'environnement."
      );
    }
    return key;
  }

  private get isSandbox(): boolean {
    return process.env.MERCI_FACTEUR_SANDBOX === "true";
  }

  private get baseUrl(): string {
    return this.isSandbox ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL;
  }

  isConfigured(): boolean {
    return !!process.env.MERCI_FACTEUR_API_KEY;
  }

  async sendLetter(params: {
    sender: LRARSender;
    recipient: LRARRecipient;
    documents: LRARDocument[];
    options?: LRARSendOptions;
  }): Promise<LRARSendResult> {
    if (!this.isConfigured()) {
      throw new Error(
        "[LRAR:MerciFact] Service non configuré. Clé API manquante."
      );
    }

    const { sender, recipient, documents, options } = params;

    // Préparer le payload selon l'API Merci Facteur
    const formData = new FormData();

    // Expéditeur
    formData.append("sender_name", sender.name);
    formData.append("sender_address", sender.address);
    formData.append("sender_postal_code", sender.postalCode);
    formData.append("sender_city", sender.city);
    formData.append("sender_country", sender.country || "FR");
    if (sender.siret) {
      formData.append("sender_siret", sender.siret);
    }

    // Destinataire
    formData.append("recipient_name", recipient.name);
    formData.append("recipient_address", recipient.address);
    formData.append("recipient_postal_code", recipient.postalCode);
    formData.append("recipient_city", recipient.city);
    formData.append("recipient_country", recipient.country || "FR");

    // Options
    formData.append(
      "letter_type",
      options?.deliveryType === "postal_simple"
        ? "simple"
        : "recommande_ar"
    );
    formData.append("color", options?.color ? "true" : "false");
    formData.append("duplex", (options?.duplex ?? true) ? "true" : "false");

    if (options?.internalReference) {
      formData.append("reference", options.internalReference);
    }

    // Documents (PDF)
    for (const doc of documents) {
      const blob =
        typeof doc.content === "string"
          ? new Blob([Buffer.from(doc.content, "base64")], {
              type: doc.mimeType || "application/pdf",
            })
          : new Blob([doc.content], {
              type: doc.mimeType || "application/pdf",
            });
      formData.append("documents", blob, doc.filename);
    }

    console.log(
      `[LRAR:MerciFact] Envoi ${
        this.isSandbox ? "SANDBOX" : "PRODUCTION"
      } → ${recipient.name}, ${recipient.postalCode} ${recipient.city}`
    );

    const response = await fetch(`${this.baseUrl}/letters`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error("[LRAR:MerciFact] Erreur API:", response.status, errorBody);
      throw new Error(
        `[LRAR:MerciFact] Erreur ${response.status}: ${
          errorBody || "Envoi impossible"
        }`
      );
    }

    const data = await response.json();

    return {
      trackingNumber: data.tracking_number || data.id || "",
      estimatedDelivery: data.estimated_delivery
        ? new Date(data.estimated_delivery)
        : undefined,
      costCents: data.cost_cents || data.price_cents || undefined,
      externalId: data.id || data.letter_id || undefined,
    };
  }

  async getStatus(trackingNumber: string): Promise<LRARStatusResult> {
    if (!this.isConfigured()) {
      throw new Error(
        "[LRAR:MerciFact] Service non configuré. Clé API manquante."
      );
    }

    const response = await fetch(
      `${this.baseUrl}/letters/${encodeURIComponent(trackingNumber)}/status`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return { status: "unknown" };
      }
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `[LRAR:MerciFact] Erreur ${response.status}: ${errorBody}`
      );
    }

    const data = await response.json();

    // Mapper les statuts Merci Facteur vers notre enum
    const statusMap: Record<string, LRARDeliveryStatus> = {
      created: "created",
      queued: "created",
      printing: "created",
      dispatched: "sent",
      in_transit: "in_transit",
      delivered: "delivered",
      signed: "delivered",
      returned: "returned",
      refused: "refused",
      lost: "failed",
      error: "failed",
    };

    return {
      status: statusMap[data.status] || "unknown",
      deliveredAt: data.delivered_at
        ? new Date(data.delivered_at)
        : undefined,
      acknowledgmentUrl: data.acknowledgment_url || data.ar_scan_url || undefined,
      acknowledgmentSignedAt: data.ar_signed_at
        ? new Date(data.ar_signed_at)
        : undefined,
      failureReason: data.failure_reason || data.return_reason || undefined,
    };
  }
}
