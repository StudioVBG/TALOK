export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// @ts-nocheck
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchDocuments } from "../_data/fetchDocuments";
import { OwnerDocumentsClient } from "./OwnerDocumentsClient";

export default async function OwnerDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ property_id?: string; lease_id?: string; type?: string; search?: string }>;
}) {
  // Next.js 15: searchParams est une Promise
  const params = await searchParams;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "owner") {
    redirect("/dashboard");
  }

  // Récupérer les documents
  // On fetch les 50 derniers par défaut
  const { documents } = await fetchDocuments({
    ownerId: profile.id,
    propertyId: params.property_id,
    leaseId: params.lease_id,
    type: params.type,
    limit: 50,
  });

  return <OwnerDocumentsClient initialDocuments={documents} />;
}
