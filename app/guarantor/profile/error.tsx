"use client";
import { DashboardError } from "@/components/ui/dashboard-error";
export default function GuarantorProfileError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DashboardError error={error} reset={reset} section="guarantor" title="Erreur dans votre espace Garant" returnHref="/guarantor/dashboard" />;
}
