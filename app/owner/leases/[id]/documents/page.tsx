export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// @ts-nocheck
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentsView } from "./DocumentsView";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeaseDocumentsPage({ params }: PageProps) {
  const { id: leaseId } = await params;
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

  if (!profile || profile.role !== "owner") redirect("/dashboard");

  // Verify lease ownership
  const { data: lease } = await supabase
    .from("leases")
    .select(`
      id, statut,
      property:properties!inner(id, owner_id)
    `)
    .eq("id", leaseId)
    .single();

  if (!lease || (lease.property as any)?.owner_id !== profile.id) {
    redirect("/owner/leases");
  }

  // Fetch documents linked to this lease
  const { data: documents } = await supabase
    .from("documents")
    .select("id, type, title, name, storage_path, created_at, metadata")
    .eq("lease_id", leaseId)
    .order("created_at", { ascending: false });

  // Fetch GED documents linked to this lease
  const { data: gedDocuments } = await supabase
    .from("ged_documents")
    .select("id, document_type, title, file_path, status, expiry_date, created_at, category")
    .eq("lease_id", leaseId)
    .order("created_at", { ascending: false });

  return (
    <DocumentsView
      leaseId={leaseId}
      propertyId={(lease.property as any).id}
      documents={documents || []}
      gedDocuments={gedDocuments || []}
    />
  );
}
