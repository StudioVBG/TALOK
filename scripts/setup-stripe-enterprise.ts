/**
 * Script de configuration Stripe pour les plans Enterprise
 * 
 * Exécution:
 *   npx ts-node --skip-project scripts/setup-stripe-enterprise.ts
 * 
 * Ou avec Bun:
 *   bun scripts/setup-stripe-enterprise.ts
 * 
 * Prérequis:
 *   - STRIPE_SECRET_KEY configurée
 *   - SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY configurés
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Configuration
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY manquante');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables Supabase manquantes');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================
// CONFIGURATION DES PLANS
// ============================================

interface PlanConfig {
  slug: string;
  name: string;
  description: string;
  price_monthly: number; // en centimes
  price_yearly: number;  // en centimes
  features: string[];
}

const PLANS_TO_CREATE: PlanConfig[] = [
  {
    slug: 'gratuit',
    name: 'Gratuit',
    description: 'Découvrez la gestion locative simplifiée avec 1 bien',
    price_monthly: 0,
    price_yearly: 0,
    features: ['1 bien inclus', 'Quittances PDF', 'Suivi des loyers'],
  },
  {
    slug: 'starter',
    name: 'Starter',
    description: 'Idéal pour gérer jusqu\'à 3 biens en toute simplicité',
    price_monthly: 900,
    price_yearly: 9000,
    features: ['3 biens inclus', 'Paiement en ligne', 'Relances email'],
  },
  {
    slug: 'confort',
    name: 'Confort',
    description: 'Pour les propriétaires actifs avec plusieurs biens',
    price_monthly: 2900,
    price_yearly: 29000,
    features: ['10 biens inclus', '1 signature/mois', 'Open Banking', 'Scoring IA'],
  },
  {
    slug: 'pro',
    name: 'Pro',
    description: 'Pour les gestionnaires professionnels et SCI',
    price_monthly: 5900,
    price_yearly: 59000,
    features: ['50 biens inclus', '5 signatures/mois', 'Multi-utilisateurs', 'API'],
  },
  {
    slug: 'enterprise_s',
    name: 'Enterprise S',
    description: 'Pour les gestionnaires de 50 à 100 biens',
    price_monthly: 19900,
    price_yearly: 199000,
    features: ['100 biens', '20 signatures/mois', 'Support prioritaire', 'Frais réduits'],
  },
  {
    slug: 'enterprise_m',
    name: 'Enterprise M',
    description: 'Pour les gestionnaires de 100 à 200 biens',
    price_monthly: 29900,
    price_yearly: 299000,
    features: ['200 biens', '30 signatures/mois', 'White label basic', 'Frais réduits'],
  },
  {
    slug: 'enterprise_l',
    name: 'Enterprise L',
    description: 'Pour les gestionnaires de 200 à 500 biens',
    price_monthly: 44900,
    price_yearly: 449000,
    features: ['500 biens', '50 signatures/mois', 'Account Manager partagé', 'Custom domain'],
  },
  {
    slug: 'enterprise_xl',
    name: 'Enterprise XL',
    description: 'Solution sur-mesure pour +500 biens',
    price_monthly: 69900,
    price_yearly: 699000,
    features: ['Biens illimités', 'Signatures illimitées', 'Account Manager dédié', 'SSO'],
  },
];

// ============================================
// FONCTIONS
// ============================================

async function findOrCreateProduct(plan: PlanConfig): Promise<Stripe.Product> {
  console.log(`\n📦 Recherche du produit ${plan.name}...`);
  
  // Chercher si le produit existe déjà
  const existingProducts = await stripe.products.search({
    query: `metadata['plan_slug']:'${plan.slug}'`,
    limit: 1,
  });

  if (existingProducts.data.length > 0) {
    console.log(`  ✅ Produit existant trouvé: ${existingProducts.data[0].id}`);
    return existingProducts.data[0];
  }

  // Créer le produit
  const product = await stripe.products.create({
    name: `Talok - ${plan.name}`,
    description: plan.description,
    metadata: {
      plan_slug: plan.slug,
      app: 'gestion_locative',
    },
    features: plan.features.map(f => ({ name: f })),
  });

  console.log(`  ✨ Produit créé: ${product.id}`);
  return product;
}

async function findOrCreatePrice(
  product: Stripe.Product, 
  plan: PlanConfig, 
  interval: 'month' | 'year'
): Promise<Stripe.Price | null> {
  const amount = interval === 'year' ? plan.price_yearly : plan.price_monthly;
  
  if (amount === 0) {
    console.log(`  ⏭️  Plan gratuit - pas de prix Stripe`);
    return null;
  }

  console.log(`  💰 Recherche du prix ${interval === 'year' ? 'annuel' : 'mensuel'}...`);

  // Chercher si le prix existe déjà
  const existingPrices = await stripe.prices.list({
    product: product.id,
    active: true,
    type: 'recurring',
    limit: 10,
  });

  const existingPrice = existingPrices.data.find(p => 
    p.recurring?.interval === interval && p.unit_amount === amount
  );

  if (existingPrice) {
    console.log(`    ✅ Prix existant: ${existingPrice.id} (${amount/100}€/${interval})`);
    return existingPrice;
  }

  // Créer le prix
  const price = await stripe.prices.create({
    product: product.id,
    currency: 'eur',
    unit_amount: amount,
    recurring: {
      interval,
    },
    metadata: {
      plan_slug: plan.slug,
      billing_cycle: interval === 'year' ? 'yearly' : 'monthly',
    },
  });

  console.log(`    ✨ Prix créé: ${price.id} (${amount/100}€/${interval})`);
  return price;
}

async function updateSupabasePlan(
  slug: string, 
  monthlyPriceId: string | null, 
  yearlyPriceId: string | null,
  stripeProductId: string
): Promise<void> {
  console.log(`  📝 Mise à jour BDD pour ${slug}...`);

  const { error } = await supabase
    .from('subscription_plans')
    .update({
      stripe_product_id: stripeProductId,
      stripe_price_monthly_id: monthlyPriceId,
      stripe_price_yearly_id: yearlyPriceId,
      updated_at: new Date().toISOString(),
    })
    .eq('slug', slug);

  if (error) {
    console.error(`    ❌ Erreur: ${error.message}`);
  } else {
    console.log(`    ✅ BDD mise à jour`);
  }
}

async function main() {
  console.log('🚀 Configuration Stripe pour les plans Enterprise\n');
  console.log('=' .repeat(50));

  const results: Array<{
    slug: string;
    productId: string;
    monthlyPriceId: string | null;
    yearlyPriceId: string | null;
  }> = [];

  for (const plan of PLANS_TO_CREATE) {
    try {
      // 1. Créer ou récupérer le produit
      const product = await findOrCreateProduct(plan);

      // 2. Créer ou récupérer les prix
      const monthlyPrice = await findOrCreatePrice(product, plan, 'month');
      const yearlyPrice = await findOrCreatePrice(product, plan, 'year');

      // 3. Mettre à jour Supabase
      await updateSupabasePlan(
        plan.slug,
        monthlyPrice?.id || null,
        yearlyPrice?.id || null,
        product.id
      );

      results.push({
        slug: plan.slug,
        productId: product.id,
        monthlyPriceId: monthlyPrice?.id || null,
        yearlyPriceId: yearlyPrice?.id || null,
      });
    } catch (error: any) {
      console.error(`❌ Erreur pour ${plan.slug}: ${error.message}`);
    }
  }

  // Afficher le résumé
  console.log('\n' + '=' .repeat(50));
  console.log('📊 RÉSUMÉ\n');
  console.log('| Plan | Product ID | Monthly Price | Yearly Price |');
  console.log('|------|------------|---------------|--------------|');
  
  for (const r of results) {
    console.log(`| ${r.slug.padEnd(12)} | ${r.productId.slice(0, 10)}... | ${(r.monthlyPriceId || '-').slice(0, 13)} | ${(r.yearlyPriceId || '-').slice(0, 12)} |`);
  }

  console.log('\n✅ Configuration terminée!');
  console.log('\n📋 Prochaines étapes:');
  console.log('   1. Vérifier les produits dans le dashboard Stripe');
  console.log('   2. Configurer le webhook Stripe vers /api/webhooks/stripe');
  console.log('   3. Tester le checkout sur /pricing');
}

main().catch(console.error);

