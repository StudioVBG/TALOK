/**
 * Configuration des add-ons Stripe
 *
 * Les Price IDs sont lus depuis les variables d'environnement.
 * Les prix affichés sont indicatifs — le montant réel vient de Stripe.
 */

export type AddonType =
  | 'signature_pack'
  | 'storage_20gb'
  | 'sms'
  | 'rar_electronic'
  | 'etat_date';

export type AddonStatus =
  | 'pending'
  | 'active'
  | 'consumed'
  | 'cancelled'
  | 'expired';

export interface AddonConfig {
  type: AddonType;
  label: string;
  description: string;
  priceLabel: string;
  mode: 'payment' | 'subscription';
  defaultQuantity: number;
  envPriceKey: string;
  /** Resource this addon extends, if applicable */
  resource?: 'signatures' | 'storage';
}

export const ADDON_CONFIGS: Record<AddonType, AddonConfig> = {
  signature_pack: {
    type: 'signature_pack',
    label: 'Pack 10 signatures',
    description: '10 signatures électroniques supplémentaires',
    priceLabel: '19 €',
    mode: 'payment',
    defaultQuantity: 10,
    envPriceKey: 'STRIPE_PRICE_SIGNATURES_PACK',
    resource: 'signatures',
  },
  storage_20gb: {
    type: 'storage_20gb',
    label: 'Stockage +20 Go',
    description: '20 Go de stockage supplémentaire',
    priceLabel: '4,90 €/mois',
    mode: 'subscription',
    defaultQuantity: 1,
    envPriceKey: 'STRIPE_PRICE_STORAGE_20GB',
    resource: 'storage',
  },
  sms: {
    type: 'sms',
    label: 'SMS',
    description: 'Envoi de SMS (facturation à l\'usage)',
    priceLabel: '0,08 €/SMS',
    mode: 'subscription',
    defaultQuantity: 1,
    envPriceKey: 'STRIPE_PRICE_SMS_UNIT',
  },
  rar_electronic: {
    type: 'rar_electronic',
    label: 'RAR électronique',
    description: 'Lettre recommandée avec accusé de réception électronique',
    priceLabel: '3,50 €',
    mode: 'payment',
    defaultQuantity: 1,
    envPriceKey: 'STRIPE_PRICE_RAR_ELECTRONIC',
  },
  etat_date: {
    type: 'etat_date',
    label: 'État daté syndic',
    description: 'Génération d\'un état daté pour une vente en copropriété',
    priceLabel: '10 €',
    mode: 'payment',
    defaultQuantity: 1,
    envPriceKey: 'STRIPE_PRICE_ETAT_DATE',
  },
};

export function getAddonPriceId(addonType: AddonType): string {
  const config = ADDON_CONFIGS[addonType];
  const priceId = process.env[config.envPriceKey];
  if (!priceId) {
    throw new Error(`Missing environment variable ${config.envPriceKey} for addon ${addonType}`);
  }
  return priceId;
}
