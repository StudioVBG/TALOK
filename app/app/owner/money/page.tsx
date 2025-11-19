import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchInvoices } from "../_data/fetchInvoices";
import { MoneyClient } from "./MoneyClient";

export default async function OwnerMoneyPage() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/signin");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "owner") {
    redirect("/dashboard");
  }

  // Charger les factures (50 dernières par défaut)
  const invoicesData = await fetchInvoices({
      ownerId: profile.id,
      limit: 50
  });

  return <MoneyClient data={invoicesData} />;
}
