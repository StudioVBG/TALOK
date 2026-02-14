"use client";
import { DashboardError } from "@/components/ui/dashboard-error";
export default function ProvidersError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DashboardError error={error} reset={reset} section="owner" title="Erreur dans la gestion des prestataires" returnHref="/owner/dashboard" />;
}
