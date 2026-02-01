/**
 * Configuration Stripe côté serveur
 * Ne pas importer ce fichier côté client !
 */

import Stripe from "stripe";

// Initialisation paresseuse de Stripe pour éviter les erreurs de build
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (_stripe) {
    return _stripe;
  }
  
  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey) {
    console.warn("⚠️ STRIPE_SECRET_KEY n'est pas configurée. Les paiements ne fonctionneront pas.");
    // Retourner un client "dummy" pour le build
    // En production, les appels échoueront avec une erreur claire
    _stripe = new Stripe("sk_test_placeholder", {
      apiVersion: "2024-11-20.acacia" as any,
      typescript: true,
    });
    return _stripe;
  }

  _stripe = new Stripe(secretKey, {
    apiVersion: "2024-11-20.acacia" as any,
    typescript: true,
  });
  
  return _stripe;
}

// Export un proxy qui initialise Stripe de manière paresseuse
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as any)[prop];
  }
});

// Types pour les métadonnées
export interface PaymentMetadata {
  invoiceId: string;
  userId: string;
  profileId: string;
  leaseId?: string;
  propertyId?: string;
  type: "rent" | "deposit" | "charge" | "other";
}

// Helpers
export function formatAmountForStripe(amount: number): number {
  // Stripe attend les montants en centimes
  return Math.round(amount * 100);
}

export function formatAmountFromStripe(amount: number): number {
  // Convertir centimes en euros
  return amount / 100;
}

// Vérification du webhook
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET n'est pas configurée");
  }

  return getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
}
