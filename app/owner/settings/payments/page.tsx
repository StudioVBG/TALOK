export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OwnerPaymentSettingsClient } from "./OwnerPaymentSettingsClient";

export default async function OwnerPaymentsPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || (profile.role !== "owner" && profile.role !== "admin")) redirect("/auth/signin");

  return <OwnerPaymentSettingsClient profileId={profile.id} />;
}
