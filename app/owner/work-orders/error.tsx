"use client";
import { DashboardError } from "@/components/ui/dashboard-error";
export default function WorkOrdersError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DashboardError error={error} reset={reset} section="owner" title="Erreur dans les ordres de travail" returnHref="/owner/dashboard" />;
}
