import { redirect } from "next/navigation";

/**
 * Redirection vers la route canonique d'ajout de logement
 * Route legacy : /properties/new → /app/owner/properties/new
 */
export default function LegacyNewPropertyPage() {
  redirect("/app/owner/properties/new");
}

