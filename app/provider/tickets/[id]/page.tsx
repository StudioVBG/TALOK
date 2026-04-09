"use client";

import { useParams } from "next/navigation";
import { PageTransition } from "@/components/ui/page-transition";
import { TicketDetailView } from "@/features/tickets/components/ticket-detail";

export default function ProviderTicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;

  return (
    <PageTransition>
      <TicketDetailView
        ticketId={ticketId}
        userRole="provider"
        backHref="/provider/tickets"
      />
    </PageTransition>
  );
}
