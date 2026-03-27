export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getServerProfile } from "@/lib/helpers/auth-helper";
import { LandingImagesClient } from "./LandingImagesClient";

export default async function LandingImagesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/signin");

  const { profile } = await getServerProfile<{ id: string; role: string }>(
    user.id,
    "id, role"
  );

  if (!profile || !["admin", "platform_admin"].includes(profile.role)) {
    redirect("/admin/dashboard");
  }

  const { data: configs } = await supabase
    .from("site_config")
    .select("key, value, label, section, updated_at")
    .order("section")
    .order("key");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Images Vitrine</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez les images affichées sur la page d&apos;accueil. Les changements sont visibles sous 1h.
        </p>
      </div>
      <LandingImagesClient configs={configs ?? []} />
    </div>
  );
}
