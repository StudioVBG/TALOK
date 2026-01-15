"use client";

/**
 * @deprecated Ce composant est déprécié. Utilisez `TicketListUnified` depuis
 * `@/features/tickets/components/ticket-list-unified` pour les nouvelles implémentations.
 *
 * Ce composant est conservé pour la compatibilité avec les pages existantes:
 * - features/properties/components/v3/property-detail-premium.tsx
 *
 * Différences avec TicketListUnified:
 * - Ce composant récupère ses propres données (propertyId prop)
 * - TicketListUnified reçoit les données en props (tickets, variant)
 */

import { useEffect, useState, useMemo } from "react";
import { TicketCard } from "./ticket-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ticketsService } from "../services/tickets.service";
import type { Ticket } from "@/lib/types";
import { useAuth } from "@/lib/hooks/use-auth";
import { usePagination } from "@/lib/hooks/use-pagination";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { TicketsListSkeleton } from "@/components/skeletons/tickets-list-skeleton";
import Link from "next/link";

interface TicketsListProps {
  propertyId?: string;
}

export function TicketsList({ propertyId }: TicketsListProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchTickets();
    }
  }, [profile, propertyId]);

  async function fetchTickets() {
    if (!profile) return;

    try {
      setLoading(true);
      let data: Ticket[];

      if (propertyId) {
        data = await ticketsService.getTicketsByProperty(propertyId);
      } else if (profile.role === "owner" || profile.role === "admin") {
        data = await ticketsService.getTicketsByOwner(profile.id);
      } else if (profile.role === "tenant") {
        data = await ticketsService.getTicketsByTenant(profile.id);
      } else {
        data = [];
      }

      setTickets(data);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de charger les tickets.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const pagination = usePagination({
    totalItems: tickets.length,
    itemsPerPage: 12,
  });

  const paginatedTickets = useMemo(() => {
    return tickets.slice(pagination.startIndex, pagination.endIndex);
  }, [tickets, pagination.startIndex, pagination.endIndex]);

  if (loading) {
    return <TicketsListSkeleton />;
  }

  if (tickets.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Aucun ticket enregistré.</p>
        {propertyId && (
          <Link href={`/tickets/new?propertyId=${propertyId}`}>
            <Button>Créer un ticket</Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Tickets ({tickets.length})</h2>
        {propertyId && (
          <Link href={`/tickets/new?propertyId=${propertyId}`}>
            <Button>Créer un ticket</Button>
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {paginatedTickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} onDelete={fetchTickets} />
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={pagination.previousPage}
                className={!pagination.canGoPrevious ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => pagination.goToPage(page)}
                  isActive={page === pagination.currentPage}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={pagination.nextPage}
                className={!pagination.canGoNext ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

