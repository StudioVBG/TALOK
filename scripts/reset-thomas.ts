import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getServiceClient } from "../lib/supabase/service-client";

const PROFILE_ID = "7a1f85cb-b27c-4882-9b9a-42f520dce88b";
const USER_ID = "6337af52-2fb7-41d7-b620-d9ddd689d294";

async function resetThomas() {
  const supabase = getServiceClient();

  console.log("🚀 Démarrage du nettoyage pour Thomas VOLBERG...");

  // 1. lease_signers
  const { error: lsError } = await supabase
    .from("lease_signers")
    .delete()
    .eq("profile_id", PROFILE_ID);
  if (lsError) console.error("❌ Erreur lease_signers:", lsError);
  else console.log("✅ lease_signers nettoyés");

  // 2. tickets
  const { error: tError } = await supabase
    .from("tickets")
    .delete()
    .eq("created_by_profile_id", PROFILE_ID);
  if (tError) console.error("❌ Erreur tickets:", tError);
  else console.log("✅ tickets nettoyés");

  // 3. edl_signatures
  const { error: edlError } = await supabase
    .from("edl_signatures")
    .delete()
    .eq("signer_profile_id", PROFILE_ID);
  if (edlError) console.error("❌ Erreur edl_signatures:", edlError);
  else console.log("✅ edl_signatures nettoyés");

  // 4. onboarding_progress
  const { error: opError } = await supabase
    .from("onboarding_progress")
    .delete()
    .eq("user_id", USER_ID);
  if (opError) console.error("❌ Erreur onboarding_progress:", opError);
  else console.log("✅ onboarding_progress nettoyés");

  // 5. onboarding_drafts
  const { error: odError } = await supabase
    .from("onboarding_drafts")
    .delete()
    .eq("user_id", USER_ID);
  if (odError) console.error("❌ Erreur onboarding_drafts:", odError);
  else console.log("✅ onboarding_drafts nettoyés");

  console.log("✨ Nettoyage terminé.");
}

resetThomas();

