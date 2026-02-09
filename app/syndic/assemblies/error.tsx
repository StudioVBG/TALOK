"use client";
import { DashboardError } from "@/components/ui/dashboard-error";
export default function SyndicAssembliesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DashboardError error={error} reset={reset} section="syndic" title="Erreur dans votre espace Syndic" returnHref="/syndic/dashboard" />;
}
