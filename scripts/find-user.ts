import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getServiceClient } from "../lib/supabase/service-client";

async function findUser() {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, user_id")
    .ilike("nom", "VOLBERG")
    .ilike("prenom", "Thomas")
    .maybeSingle();

  if (error) {
    console.error("Erreur:", error);
    return;
  }

  if (data) {
    console.log("USER_FOUND:", JSON.stringify(data));
  } else {
    console.log("USER_NOT_FOUND");
  }
}

findUser();

