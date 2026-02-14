"use client";
import { DashboardError } from "@/components/ui/dashboard-error";
export default function MessagesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DashboardError error={error} reset={reset} section="owner" title="Erreur dans la messagerie" returnHref="/owner/dashboard" />;
}
