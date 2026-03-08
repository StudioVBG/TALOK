import { redirect } from "next/navigation";

/**
 * SOTA 2026 — Redirect GED vers Documents consolidé
 * Le coffre-fort est maintenant un onglet de la page Documents unifiée.
 * Ce redirect préserve les bookmarks et liens existants.
 */
export default async function GedPage({
  searchParams,
}: {
  searchParams: Promise<{ property_id?: string; lease_id?: string; type?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  query.set("tab", "coffre-fort");
  if (params.property_id) query.set("property_id", params.property_id);
  if (params.lease_id) query.set("lease_id", params.lease_id);
  if (params.type) query.set("type", params.type);

  redirect(`/owner/documents?${query.toString()}`);
}
