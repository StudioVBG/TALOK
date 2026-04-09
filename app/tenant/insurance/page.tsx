export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TenantInsuranceClient } from "./TenantInsuranceClient";

export default async function TenantInsurancePage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "tenant") {
    redirect("/dashboard");
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <TenantInsuranceClient profileId={profile.id} />
    </div>
  );
}
