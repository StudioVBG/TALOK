export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TenantPaymentSettingsClient } from "./TenantPaymentSettingsClient";

export default async function TenantPaymentSettingsPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "tenant") redirect("/auth/signin");

  return <TenantPaymentSettingsClient profileId={profile.id} />;
}
