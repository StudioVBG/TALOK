"use client";
import { DashboardError } from "@/components/ui/dashboard-error";
export default function TenantDocumentsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DashboardError error={error} reset={reset} section="tenant" title="Erreur dans votre espace Locataire" returnHref="/tenant/dashboard" />;
}
