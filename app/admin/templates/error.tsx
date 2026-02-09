"use client";
import { DashboardError } from "@/components/ui/dashboard-error";
export default function AdminTemplatesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DashboardError error={error} reset={reset} section="admin" title="Erreur dans le panneau Admin" returnHref="/admin/dashboard" />;
}
