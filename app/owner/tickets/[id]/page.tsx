"use client";

import { useParams } from "next/navigation";
import { PageTransition } from "@/components/ui/page-transition";
import { TicketDetailView } from "@/features/tickets/components/ticket-detail";

/**
 * Page de détail d'un ticket — SOTA 2026
 * Utilise le composant TicketDetailView partagé avec state machine complète,
 * timeline, commentaires, assignation prestataire, et satisfaction.
 */
export default function OwnerTicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;

  return (
    <PageTransition>
      <TicketDetailView
        ticketId={ticketId}
        userRole="owner"
        backHref="/owner/tickets"
      />
    </PageTransition>
  );
}
