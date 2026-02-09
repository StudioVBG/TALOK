"use client";
import { DashboardError } from "@/components/ui/dashboard-error";
export default function OwnerTicketsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DashboardError error={error} reset={reset} section="owner" title="Erreur dans votre espace Propriétaire" returnHref="/owner/dashboard" />;
}
