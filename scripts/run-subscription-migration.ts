/**
 * Script de migration : Créer les abonnements manquants pour les propriétaires
 * Usage: npx tsx scripts/run-subscription-migration.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function runMigration() {
  console.log('🚀 Exécution de la migration des abonnements...\n');

  // 1. Vérifier les plans existants
  const { data: plans, error: plansError } = await supabase
    .from('subscription_plans')
    .select('id, slug, name')
    .in('slug', ['gratuit', 'solo'])
    .order('slug')
    .limit(1);

  if (plansError) {
    console.error('❌ Erreur lecture plans:', plansError.message);
    process.exit(1);
  }

  if (!plans || plans.length === 0) {
    console.error('❌ Aucun plan gratuit/solo trouvé dans subscription_plans!');
    console.log('\nVérifiez que la table subscription_plans contient des plans.');
    process.exit(1);
  }

  const planId = plans[0].id;
  const planName = plans[0].name;
  const planSlug = plans[0].slug;
  console.log(`✅ Plan par défaut trouvé: ${planName} (${planSlug})`);

  // 2. Récupérer tous les propriétaires
  const { data: owners, error: ownersError } = await supabase
    .from('profiles')
    .select('id, prenom, nom, user_id')
    .eq('role', 'owner');

  if (ownersError) {
    console.error('❌ Erreur lecture propriétaires:', ownersError.message);
    process.exit(1);
  }

  console.log(`📋 ${owners?.length || 0} propriétaire(s) trouvé(s)`);

  if (!owners || owners.length === 0) {
    console.log('\n✅ Aucun propriétaire dans la base.');
    process.exit(0);
  }

  // 3. Vérifier les abonnements existants
  const { data: existingSubs, error: subsError } = await supabase
    .from('subscriptions')
    .select('owner_id');

  if (subsError) {
    console.error('❌ Erreur lecture abonnements:', subsError.message);
    process.exit(1);
  }

  const existingOwnerIds = new Set(existingSubs?.map(s => s.owner_id) || []);
  const ownersWithoutSub = owners.filter(o => !existingOwnerIds.has(o.id));

  console.log(`📊 ${existingSubs?.length || 0} abonnement(s) existant(s)`);
  console.log(`⚠️  ${ownersWithoutSub.length} propriétaire(s) sans abonnement\n`);

  if (ownersWithoutSub.length === 0) {
    console.log('✅ Tous les propriétaires ont déjà un abonnement!');
    process.exit(0);
  }

  // 4. Compter les propriétés et baux pour chaque propriétaire
  console.log('📝 Création des abonnements manquants...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const owner of ownersWithoutSub) {
    // Compter les propriétés
    const { count: propertiesCount } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', owner.id);

    // Compter les baux actifs
    const { data: properties } = await supabase
      .from('properties')
      .select('id')
      .eq('owner_id', owner.id);

    let leasesCount = 0;
    if (properties && properties.length > 0) {
      const propertyIds = properties.map(p => p.id);
      const { count } = await supabase
        .from('leases')
        .select('*', { count: 'exact', head: true })
        .in('property_id', propertyIds)
        .eq('statut', 'active');
      leasesCount = count || 0;
    }

    const now = new Date().toISOString();
    const oneMonthLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const twoWeeksLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase
      .from('subscriptions')
      .insert({
        owner_id: owner.id,
        plan_id: planId,
        status: 'active',
        billing_cycle: 'monthly',
        current_period_start: now,
        current_period_end: oneMonthLater,
        trial_end: twoWeeksLater,
        properties_count: propertiesCount || 0,
        leases_count: leasesCount
      });

    if (insertError) {
      console.error(`   ❌ ${owner.prenom || ''} ${owner.nom || ''}: ${insertError.message}`);
      errorCount++;
    } else {
      console.log(`   ✅ ${owner.prenom || ''} ${owner.nom || ''} → ${planName} (${propertiesCount || 0} biens, ${leasesCount} baux)`);
      successCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`🎉 Migration terminée!`);
  console.log(`   ✅ ${successCount} abonnement(s) créé(s)`);
  if (errorCount > 0) {
    console.log(`   ❌ ${errorCount} erreur(s)`);
  }
}

runMigration().catch(err => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});
