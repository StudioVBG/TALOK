/**
 * Script: Synchroniser les plans tarifaires 2025
 * Usage: npx tsx scripts/sync-pricing-plans.ts
 * 
 * NOUVELLE GRILLE:
 * - starter: 9€/mois (3 biens)
 * - confort: 29€/mois (10 biens)
 * - pro: 59€/mois (50 biens)
 * - enterprise: Sur devis
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

const NEW_PLANS = [
  {
    slug: 'starter',
    name: 'Starter',
    description: 'Idéal pour gérer jusqu\'à 3 biens en toute simplicité',
    price_monthly: 900,  // 9€
    price_yearly: 9000,  // 90€
    max_properties: 3,
    max_leases: 5,
    max_tenants: 10,
    max_documents_gb: 1,
    features: {
      signatures: false,
      open_banking: false,
      auto_reminders: false,
      tenant_portal: 'basic',
      lease_generation: true,
      scoring_tenant: false,
      edl_digital: false,
    },
    is_popular: false,
    display_order: 0,
  },
  {
    slug: 'confort',
    name: 'Confort',
    description: 'Pour les propriétaires actifs avec plusieurs biens',
    price_monthly: 2900,  // 29€
    price_yearly: 29000,  // 290€
    max_properties: 10,
    max_leases: 25,
    max_tenants: 40,
    max_documents_gb: 5,
    features: {
      signatures: true,
      signatures_monthly_quota: 5,
      open_banking: true,
      auto_reminders: true,
      tenant_portal: 'advanced',
      lease_generation: true,
      scoring_tenant: true,
      edl_digital: true,
    },
    is_popular: true,
    display_order: 1,
  },
  {
    slug: 'pro',
    name: 'Pro',
    description: 'Pour les gestionnaires professionnels et SCI',
    price_monthly: 5900,  // 59€
    price_yearly: 59000,  // 590€
    max_properties: 50,
    max_leases: -1,
    max_tenants: -1,
    max_documents_gb: 20,
    features: {
      signatures: true,
      signatures_monthly_quota: -1,
      open_banking: true,
      auto_reminders: true,
      auto_reminders_sms: true,
      tenant_portal: 'full',
      lease_generation: true,
      scoring_tenant: true,
      edl_digital: true,
      multi_users: true,
      max_users: 5,
      api_access: true,
      providers_management: true,
    },
    is_popular: false,
    display_order: 2,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    description: 'Solution sur-mesure : white label, API complète, SLA',
    price_monthly: null,
    price_yearly: null,
    max_properties: -1,
    max_leases: -1,
    max_tenants: -1,
    max_documents_gb: -1,
    features: {
      signatures: true,
      signatures_monthly_quota: -1,
      open_banking: true,
      auto_reminders: true,
      auto_reminders_sms: true,
      tenant_portal: 'full',
      lease_generation: true,
      scoring_tenant: true,
      edl_digital: true,
      multi_users: true,
      max_users: -1,
      api_access: true,
      webhooks: true,
      white_label: true,
      sso: true,
      providers_management: true,
      copro_module: true,
    },
    is_popular: false,
    display_order: 3,
  },
];

async function syncPlans() {
  console.log('🔄 Synchronisation des plans tarifaires 2025...\n');

  // 1. Mettre à jour ou créer chaque plan
  for (const plan of NEW_PLANS) {
    const { error } = await supabase
      .from('subscription_plans')
      .upsert({
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        price_monthly: plan.price_monthly,
        price_yearly: plan.price_yearly,
        max_properties: plan.max_properties,
        max_leases: plan.max_leases,
        max_tenants: plan.max_tenants,
        max_documents_gb: plan.max_documents_gb,
        features: plan.features,
        is_popular: plan.is_popular,
        display_order: plan.display_order,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'slug' });

    if (error) {
      console.error(`❌ Erreur ${plan.slug}:`, error.message);
    } else {
      const price = plan.price_monthly ? `${plan.price_monthly / 100}€/mois` : 'Sur devis';
      console.log(`✅ ${plan.name} (${plan.slug}) → ${price}`);
    }
  }

  // 2. Migrer les abonnements solo → starter
  console.log('\n📋 Migration des abonnements existants...');
  
  // Récupérer l'ID du plan starter
  const { data: starterPlan } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('slug', 'starter')
    .single();

  if (starterPlan) {
    // Récupérer l'ID du plan solo
    const { data: soloPlan } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('slug', 'solo')
      .single();

    if (soloPlan) {
      // Migrer les abonnements solo → starter
      const { data: migrated, error: migrateError } = await supabase
        .from('subscriptions')
        .update({ plan_id: starterPlan.id })
        .eq('plan_id', soloPlan.id)
        .select('id');

      if (migrateError) {
        console.error('❌ Erreur migration solo→starter:', migrateError.message);
      } else {
        console.log(`   ✅ ${migrated?.length || 0} abonnement(s) migrés de Solo → Starter`);
      }
    }

    // Migrer les gratuit → starter si existe
    const { data: gratuitPlan } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('slug', 'gratuit')
      .single();

    if (gratuitPlan) {
      const { data: migratedGratuit } = await supabase
        .from('subscriptions')
        .update({ plan_id: starterPlan.id })
        .eq('plan_id', gratuitPlan.id)
        .select('id');

      console.log(`   ✅ ${migratedGratuit?.length || 0} abonnement(s) migrés de Gratuit → Starter`);
    }
  }

  // 3. Supprimer les anciens plans inutilisés
  console.log('\n🗑️  Nettoyage des anciens plans...');
  
  const oldSlugs = ['solo', 'gratuit', 'free', 'business'];
  for (const slug of oldSlugs) {
    const { error } = await supabase
      .from('subscription_plans')
      .delete()
      .eq('slug', slug);
    
    if (!error) {
      console.log(`   ✅ Plan "${slug}" supprimé`);
    }
  }

  // 4. Afficher le résultat final
  console.log('\n📊 Plans finaux:');
  const { data: finalPlans } = await supabase
    .from('subscription_plans')
    .select('slug, name, price_monthly, is_popular')
    .order('display_order');

  finalPlans?.forEach(p => {
    const price = p.price_monthly ? `${p.price_monthly / 100}€/mois` : 'Sur devis';
    const popular = p.is_popular ? ' ⭐' : '';
    console.log(`   ${p.slug}: ${p.name} - ${price}${popular}`);
  });

  console.log('\n🎉 Synchronisation terminée!');
}

syncPlans().catch(console.error);

