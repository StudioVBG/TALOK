"use client";
import { DashboardError } from "@/components/ui/dashboard-error";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DashboardError error={error} reset={reset} section="admin" title="Erreur - Forfaits & Tarifs" returnHref="/admin/dashboard" />;
}
