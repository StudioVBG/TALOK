/**
 * Script : Créer le trigger pour auto-création d'abonnement
 * Usage: npx tsx scripts/create-subscription-trigger.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function createTrigger() {
  console.log('🔧 Création du trigger pour auto-création d\'abonnement...\n');

  // SQL pour créer la fonction et le trigger
  const sql = `
    -- Fonction pour créer l'abonnement propriétaire automatiquement
    CREATE OR REPLACE FUNCTION create_owner_subscription()
    RETURNS TRIGGER AS $$
    DECLARE
      v_plan_id UUID;
    BEGIN
      -- Seulement pour les propriétaires
      IF NEW.role = 'owner' THEN
        -- Récupérer l'ID du plan solo/gratuit
        SELECT id INTO v_plan_id 
        FROM subscription_plans 
        WHERE slug IN ('gratuit', 'solo')
        ORDER BY slug
        LIMIT 1;
        
        -- Créer l'abonnement si le plan existe
        IF v_plan_id IS NOT NULL THEN
          INSERT INTO subscriptions (
            owner_id, 
            plan_id, 
            status, 
            billing_cycle, 
            current_period_start,
            current_period_end,
            trial_end,
            properties_count,
            leases_count
          )
          VALUES (
            NEW.id,
            v_plan_id,
            'active',
            'monthly',
            NOW(),
            NOW() + INTERVAL '1 month',
            NOW() + INTERVAL '30 days',
            0,
            0
          )
          ON CONFLICT (owner_id) DO NOTHING;
        END IF;
      END IF;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Supprimer le trigger s'il existe
    DROP TRIGGER IF EXISTS trg_create_owner_subscription ON profiles;

    -- Créer le trigger
    CREATE TRIGGER trg_create_owner_subscription
      AFTER INSERT OR UPDATE OF role ON profiles
      FOR EACH ROW
      WHEN (NEW.role = 'owner')
      EXECUTE FUNCTION create_owner_subscription();
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    // Si la fonction RPC n'existe pas, essayer une autre approche
    console.log('⚠️  RPC exec_sql non disponible, le trigger doit être créé manuellement.');
    console.log('\nCopiez ce SQL dans le SQL Editor de Supabase Dashboard:\n');
    console.log('='.repeat(60));
    console.log(sql);
    console.log('='.repeat(60));
    return;
  }

  console.log('✅ Trigger créé avec succès!');
  console.log('\nDésormais, tout nouveau propriétaire aura automatiquement un abonnement Solo.');
}

createTrigger().catch(err => {
  console.error('Erreur:', err.message);
});

