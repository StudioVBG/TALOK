
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  console.log("Checking owner_profiles columns...");
  
  const { data, error } = await supabase
    .from("owner_profiles")
    .select("profile_id, raison_sociale")
    .limit(1);

  if (error) {
    console.error("Error checking columns:", error);
  } else {
    console.log("Columns exist!", data);
  }
}

check();











































