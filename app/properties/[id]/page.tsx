import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Route legacy /properties/[id] — redirige vers la route canonique correspondante
 * au rôle de l'utilisateur. Avant : redirection aveugle vers /owner/properties/[id]
 * qui produisait des 403 pour admin/agency/tenant.
 */
export default async function LegacyPropertyDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/signin?redirectTo=${encodeURIComponent(`/properties/${id}`)}`);
  }

  const serviceClient = getServiceClient();
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  switch (profile?.role) {
    case "admin":
      redirect(`/admin/properties/${id}`);
    case "agency":
      redirect(`/agency/properties/${id}`);
    case "owner":
      redirect(`/owner/properties/${id}`);
    case "tenant":
      // Le locataire n'a pas de page de détail bien dédiée — il consulte son bail.
      redirect(`/tenant/lease`);
    default:
      redirect(`/dashboard`);
  }
}
