import { redirect } from "next/navigation";

/**
 * SOTA 2026 — Redirect Immeubles vers Mes biens consolidé (onglet Immeubles)
 * Les immeubles sont maintenant un onglet de la page Mes biens unifiée.
 * Ce redirect préserve les bookmarks et liens existants.
 * Les sous-pages /owner/buildings/[id] restent accessibles.
 */
export default function BuildingsPage() {
  redirect("/owner/properties?tab=immeubles");
}
