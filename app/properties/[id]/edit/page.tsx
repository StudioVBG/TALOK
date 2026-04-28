import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Route legacy /properties/[id]/edit — redirige vers la fiche role-aware.
 * Pour owner : édition inline sur /owner/properties/[id].
 * Pour admin : page d'édition dédiée /admin/properties/[id]/edit.
 */
export default async function LegacyEditPropertyPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/signin?redirectTo=${encodeURIComponent(`/properties/${id}/edit`)}`);
  }

  const serviceClient = getServiceClient();
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  switch (profile?.role) {
    case "admin":
      redirect(`/admin/properties/${id}/edit`);
    case "agency":
      redirect(`/agency/properties/${id}`);
    case "owner":
      redirect(`/owner/properties/${id}`);
    default:
      redirect(`/dashboard`);
  }
}
