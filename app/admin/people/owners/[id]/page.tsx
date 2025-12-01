import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAdminOwnerDetails } from "../../../_data/fetchAdminOwnerDetails";
import { OwnerDetailsClient } from "./OwnerDetailsClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OwnerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/signin");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  const ownerDetails = await fetchAdminOwnerDetails(id);

  if (!ownerDetails) {
    return <div>Propriétaire introuvable</div>;
  }

  return <OwnerDetailsClient owner={ownerDetails} />;
}
