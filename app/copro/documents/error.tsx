"use client";
import { DashboardError } from "@/components/ui/dashboard-error";
export default function CoproDocumentsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DashboardError error={error} reset={reset} section="copro" title="Erreur dans votre espace Copropriété" returnHref="/copro/dashboard" />;
}
