import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Variables d'environnement manquantes !");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function diagnose() {
  const propertyId = "23aa5434-6543-4581-952e-2d176b6ff4c3"; // ID visible dans l'URL
  
  console.log(`🔍 Diagnostic pour la propriété: ${propertyId}`);

  // 1. Vérifier si la propriété existe (via Service Role - Bypass RLS)
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, owner_id, type, adresse_complete")
    .eq("id", propertyId)
    .single();

  if (propertyError || !property) {
    console.error("❌ Propriété introuvable en base (même admin) :", propertyError?.message);
    return;
  }

  console.log("✅ Propriété trouvée en base :", property);

  // 2. Vérifier le profil owner associé
  const { data: ownerProfile, error: ownerError } = await supabase
    .from("profiles")
    .select("id, user_id, email:user_id(email)")
    .eq("id", property.owner_id)
    .single();

  if (ownerError) {
    console.error("⚠️ Impossible de trouver le profil du propriétaire :", ownerError.message);
  } else {
    console.log("👤 Propriétaire associé (DB) :", {
      profile_id: ownerProfile.id,
      user_id: ownerProfile.user_id,
      // @ts-ignore
      email: ownerProfile.email?.email
    });
  }
}

diagnose();
