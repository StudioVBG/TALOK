"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Toggle la visibilité d'un document pour le locataire
 */
export async function toggleDocumentVisibility(
  documentId: string,
  leaseId: string,
  visible: boolean
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const { error } = await supabase
    .from("documents")
    .update({ visible_tenant: visible } as any)
    .eq("id", documentId);

  if (error) throw error;

  revalidatePath(`/owner/leases/${leaseId}`);
  return { success: true };
}

/**
 * Archive un document (remplacement = archive l'ancien + upload nouveau)
 */
export async function archiveDocument(documentId: string, leaseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const { error } = await supabase
    .from("documents")
    .update({ is_archived: true } as any)
    .eq("id", documentId);

  if (error) throw error;

  revalidatePath(`/owner/leases/${leaseId}`);
  return { success: true };
}
