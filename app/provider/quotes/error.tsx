"use client";
import { DashboardError } from "@/components/ui/dashboard-error";
export default function ProviderQuotesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DashboardError error={error} reset={reset} section="provider" title="Erreur dans votre espace Prestataire" returnHref="/provider/dashboard" />;
}
