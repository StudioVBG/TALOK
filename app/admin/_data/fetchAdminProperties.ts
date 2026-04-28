import { requireAdminServiceClient } from "./requireAdminServiceClient";

export async function fetchAdminProperties(options: { status?: string; search?: string; limit?: number; offset?: number } = {}) {
  const serviceClient = await requireAdminServiceClient();
  if (!serviceClient) return { properties: [], total: 0 };

  const { status, search, limit = 50, offset = 0 } = options;

  let query = serviceClient
    .from("properties")
    .select(
      "*, owner:profiles!properties_owner_id_fkey(id, prenom, nom)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== "all") {
    query = query.eq("statut", status);
  }

  if (search) {
    query = query.ilike("adresse_complete", `%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("Error fetching admin properties:", error);
    return { properties: [], total: 0 };
  }

  // Enrichir avec cover_url (table photos prioritaire, fallback documents).
  // Pas de colonne `cover_url` sur properties — elle est calculée à la volée.
  let enriched = data ?? [];
  if (enriched.length > 0) {
    try {
      const { fetchPropertyCoverUrls } = await import("@/lib/properties/cover-url");
      const propertyIds = enriched.map((p: any) => p.id).filter(Boolean);
      const coverMap = await fetchPropertyCoverUrls(serviceClient, propertyIds);
      enriched = enriched.map((p: any) => ({
        ...p,
        cover_url: coverMap.get(p.id) ?? null,
      }));
    } catch (coverErr) {
      console.warn("[fetchAdminProperties] cover_url enrichment failed (non-blocking):", coverErr);
    }
  }

  return { properties: enriched, total: count || 0 };
}
