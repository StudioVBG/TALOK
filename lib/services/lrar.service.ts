/**
 * Service LRAR — Lettre Recommandée avec Accusé de Réception
 *
 * Sprint 3 — S3-2
 *
 * Architecture provider-agnostique :
 *   - Interface `LRARProvider` définit le contrat
 *   - Implémentation par défaut : Merci Facteur (MVP)
 *   - Changement de fournisseur = swap du provider, pas du code appelant
 *
 * Fournisseurs envisagés :
 *   - Merci Facteur (LRAR papier, API REST, ~5€/envoi, DROM-COM OK)
 *   - AR24 (LRE eIDAS, lettre recommandée électronique)
 *   - Maileva (La Poste, LRAR papier + électronique)
 *   - Docapost (Enterprise)
 *
 * Configuration : les clés API sont dans les variables d'environnement :
 *   - LRAR_PROVIDER : nom du provider actif (default: 'merci_facteur')
 *   - MERCI_FACTEUR_API_KEY : clé API Merci Facteur
 *   - MERCI_FACTEUR_SANDBOX : 'true' en dev/staging
 *
 * Usage :
 *   ```ts
 *   import { getLRARProvider } from '@/lib/services/lrar.service';
 *
 *   const lrar = getLRARProvider();
 *   const result = await lrar.sendLetter({ sender, recipient, documents });
 *   const status = await lrar.getStatus(result.trackingNumber);
 *   ```
 *
 * Les coûts LRAR sont à la charge du syndic (pas absorbés par Talok).
 */

// ============================================
// TYPES
// ============================================

export interface LRARSender {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  country?: string;
  siret?: string;
}

export interface LRARRecipient {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  country?: string;
}

export interface LRARDocument {
  filename: string;
  /** Contenu du document (Buffer ou base64) */
  content: Buffer | string;
  /** MIME type (default: application/pdf) */
  mimeType?: string;
}

export interface LRARSendOptions {
  /** Impression couleur (défaut: false = N&B) */
  color?: boolean;
  /** Recto-verso (défaut: true) */
  duplex?: boolean;
  /** Demander un accusé de réception (défaut: true pour LRAR) */
  acknowledgment?: boolean;
  /** Type d'envoi */
  deliveryType?: "lrar" | "lre_numerique" | "postal_recommande" | "postal_simple";
  /** Référence interne pour le suivi côté Talok */
  internalReference?: string;
}

export interface LRARSendResult {
  /** Numéro de suivi postal ou identifiant LRE */
  trackingNumber: string;
  /** Date de livraison estimée */
  estimatedDelivery?: Date;
  /** Coût en centimes (si connu au moment de l'envoi) */
  costCents?: number;
  /** Identifiant externe chez le fournisseur */
  externalId?: string;
}

export type LRARDeliveryStatus =
  | "created"
  | "sent"
  | "in_transit"
  | "delivered"
  | "returned"
  | "refused"
  | "failed"
  | "unknown";

export interface LRARStatusResult {
  status: LRARDeliveryStatus;
  /** Date de livraison effective */
  deliveredAt?: Date;
  /** URL du scan de l'accusé de réception */
  acknowledgmentUrl?: string;
  /** Date de signature de l'accusé */
  acknowledgmentSignedAt?: Date;
  /** Motif de retour/échec */
  failureReason?: string;
}

// ============================================
// INTERFACE PROVIDER
// ============================================

export interface LRARProvider {
  /** Nom du fournisseur pour le logging */
  readonly providerName: string;

  /**
   * Envoie une lettre recommandée avec les documents joints.
   * @throws Error si l'envoi échoue (clé manquante, API down, etc.)
   */
  sendLetter(params: {
    sender: LRARSender;
    recipient: LRARRecipient;
    documents: LRARDocument[];
    options?: LRARSendOptions;
  }): Promise<LRARSendResult>;

  /**
   * Interroge le statut d'une lettre envoyée.
   * @param trackingNumber — numéro retourné par sendLetter()
   */
  getStatus(trackingNumber: string): Promise<LRARStatusResult>;

  /**
   * Vérifie si le provider est correctement configuré (clés API, etc.)
   */
  isConfigured(): boolean;
}

// ============================================
// FACTORY
// ============================================

/**
 * Retourne le provider LRAR actif selon la configuration.
 * Lazy-loaded pour éviter d'importer les modules fournisseur si pas utilisé.
 */
export function getLRARProvider(): LRARProvider {
  const providerName = process.env.LRAR_PROVIDER || "merci_facteur";

  switch (providerName) {
    case "merci_facteur": {
      // Import dynamique lazy du provider Merci Facteur
      const {
        MerciFacteurProvider,
      } = require("./lrar-providers/merci-facteur") as {
        MerciFacteurProvider: new () => LRARProvider;
      };
      return new MerciFacteurProvider();
    }

    default:
      throw new Error(
        `[LRAR] Provider inconnu: ${providerName}. Valeurs acceptées: merci_facteur`
      );
  }
}
