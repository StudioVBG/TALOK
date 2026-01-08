
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

async function checkRpc() {
  console.log("Checking exec_sql RPC...");
  
  const { error } = await supabase.rpc("exec_sql", { sql_query: "SELECT 1;" });

  if (error) {
    console.error("exec_sql check failed:", error);
    if (error.message.includes("does not exist")) {
        console.log("RPC exec_sql does not exist.");
    }
  } else {
    console.log("exec_sql exists and works!");
  }
}

checkRpc();







































