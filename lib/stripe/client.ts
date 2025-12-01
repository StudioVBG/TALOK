/**
 * Configuration Stripe côté client
 */

import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null>;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    
    if (!publishableKey) {
      console.warn("⚠️ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY n'est pas configurée");
      return Promise.resolve(null);
    }
    
    stripePromise = loadStripe(publishableKey);
  }
  
  return stripePromise;
}

