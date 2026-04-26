export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { accountingService } from "@/features/accounting/services/accounting.service";
import { TenantAccountStatementClient } from "./TenantAccountStatementClient";

export default async function TenantAccountStatementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();
  if (!profile || profile.role !== "tenant") redirect("/auth/signin");

  let situation: Awaited<
    ReturnType<typeof accountingService.generateSituationLocataire>
  > | null = null;
  let errorMessage: string | null = null;
  try {
    situation = await accountingService.generateSituationLocataire(profile.id);
  } catch (err) {
    errorMessage =
      err instanceof Error
        ? err.message
        : "Impossible de generer le releve pour le moment.";
  }

  return (
    <TenantAccountStatementClient
      situation={situation}
      errorMessage={errorMessage}
      tenantId={profile.id}
    />
  );
}
