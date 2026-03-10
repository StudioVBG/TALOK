import { redirect } from "next/navigation";

/**
 * Redirection SOTA 2026 : la gestion de l'abonnement est désormais
 * dans l'onglet "Mon forfait" de la page Finances unifiée.
 */
export default function BillingPage() {
  redirect("/owner/money?tab=forfait");
}
