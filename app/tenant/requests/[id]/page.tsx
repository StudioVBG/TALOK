"use client";

import { useParams } from "next/navigation";
import { PageTransition } from "@/components/ui/page-transition";
import { TicketDetailView } from "@/features/tickets/components/ticket-detail";

/**
 * Page détail ticket locataire — SOTA 2026
 * Utilise le composant TicketDetailView partagé.
 */
export default function TenantTicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;

  return (
    <PageTransition>
      <TicketDetailView
        ticketId={ticketId}
        userRole="tenant"
        backHref="/tenant/requests"
      />
    </PageTransition>
  );
}
