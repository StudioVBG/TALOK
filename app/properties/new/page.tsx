import { redirect } from "next/navigation";

/**
 * Redirection vers la route canonique d'ajout de logement
 * Route legacy : /properties/new → /owner/properties/new
 */
export default function LegacyNewPropertyPage() {
  redirect("/owner/properties/new");
}

