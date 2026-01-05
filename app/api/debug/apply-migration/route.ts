export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { isDevOnly, prodDisabledResponse } from "@/app/api/_lib/supabase";

/**
 * GET /api/debug/apply-migration
 * Applique la migration pour ajouter les nouveaux statuts de bail
 *
 * SECURITE: Route désactivée en production
 */
export async function GET(request: Request) {
  // Bloquer en production
  if (!isDevOnly()) {
    return prodDisabledResponse();
  }

  try {
    const serviceClient = getServiceClient();
    
    // 1. Supprimer l'ancienne contrainte
    const { error: dropError } = await serviceClient.rpc('exec_sql', {
      sql: `ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_statut_check;`
    }).single();
    
    // Si la fonction RPC n'existe pas, essayer directement via raw SQL
    // Note: Cette approche nécessite que le service client ait les droits admin
    
    // Tentative alternative : Mettre à jour le statut en utilisant une valeur existante
    // puis modifier la contrainte via le dashboard Supabase
    
    // Pour l'instant, retournons les instructions
    const instructions = {
      message: "Migration à appliquer manuellement dans Supabase SQL Editor",
      sql: `
-- Exécutez ce SQL dans l'éditeur SQL de Supabase Dashboard :

-- 1. Supprimer l'ancienne contrainte
ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_statut_check;

-- 2. Ajouter la nouvelle contrainte avec tous les statuts
ALTER TABLE leases
ADD CONSTRAINT leases_statut_check
CHECK (statut IN (
  'draft',
  'sent',
  'pending_signature',
  'partially_signed',
  'pending_owner_signature',
  'fully_signed',
  'active',
  'amended',
  'suspended',
  'terminated',
  'archived'
));

-- 3. Ajouter les colonnes (si elles n'existent pas)
ALTER TABLE leases ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS entry_edl_id UUID;

-- 4. Mettre à jour le bail signé vers fully_signed
UPDATE leases 
SET statut = 'fully_signed' 
WHERE id = 'bb79e040-9fdf-4365-a4a5-6090d417ae97';

-- Vérification
SELECT id, statut FROM leases WHERE id = 'bb79e040-9fdf-4365-a4a5-6090d417ae97';
      `,
      steps: [
        "1. Allez sur https://supabase.com/dashboard",
        "2. Sélectionnez votre projet",
        "3. Allez dans 'SQL Editor'",
        "4. Collez et exécutez le SQL ci-dessus",
        "5. Rafraîchissez la page du bail"
      ]
    };
    
    return NextResponse.json(instructions);
    
  } catch (error: any) {
    console.error("[apply-migration] Erreur:", error);
    return NextResponse.json({ 
      error: error.message,
      fallback: "Appliquez la migration manuellement dans Supabase SQL Editor"
    }, { status: 500 });
  }
}




