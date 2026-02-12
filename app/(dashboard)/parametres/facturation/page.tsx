import { redirect } from "next/navigation";

/**
 * /parametres/facturation — redirige vers la route canonique
 * La page billing est désormais à /owner/settings/billing
 */
export default function FacturationPage() {
  redirect("/owner/settings/billing");
}
