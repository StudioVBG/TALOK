/**
 * Helpers pour récupérer la cover_url d'une propriété depuis la table `photos`.
 *
 * Note : `cover_url` n'existe PAS comme colonne sur la table `properties`.
 * Elle doit être calculée à partir de la table `photos` (is_main desc, ordre asc).
 */

type SupabaseLike = {
  from: (table: string) => any;
};

/**
 * Récupère la cover_url d'une seule propriété.
 */
export async function fetchPropertyCoverUrl(
  client: SupabaseLike,
  propertyId: string,
): Promise<string | null> {
  const { data } = await client
    .from("photos")
    .select("url")
    .eq("property_id", propertyId)
    .order("is_main", { ascending: false })
    .order("ordre", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { url?: string | null } | null)?.url ?? null;
}

/**
 * Récupère les cover_url pour un lot de propriétés.
 * Retourne une Map<property_id, url|null>.
 */
export async function fetchPropertyCoverUrls(
  client: SupabaseLike,
  propertyIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (propertyIds.length === 0) return map;
  for (const id of propertyIds) map.set(id, null);

  const { data } = await client
    .from("photos")
    .select("property_id, url, is_main, ordre")
    .in("property_id", propertyIds)
    .order("is_main", { ascending: false })
    .order("ordre", { ascending: true });

  for (const row of (data ?? []) as Array<{ property_id: string; url: string | null }>) {
    if (!map.get(row.property_id)) {
      map.set(row.property_id, row.url ?? null);
    }
  }
  return map;
}
