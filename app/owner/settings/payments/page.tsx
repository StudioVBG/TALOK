import { redirect } from "next/navigation";

/**
 * Redirection SOTA 2026 : la gestion des moyens de paiement est désormais
 * dans l'onglet "Moyens de paiement" de la page Finances unifiée.
 */
export default function OwnerPaymentsPage() {
  redirect("/owner/money?tab=paiement");
}
