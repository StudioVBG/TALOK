"use client";
import { DashboardError } from "@/components/ui/dashboard-error";
export default function AgencyDashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DashboardError error={error} reset={reset} section="agency" title="Erreur dans votre espace Agence" returnHref="/agency/dashboard" />;
}
