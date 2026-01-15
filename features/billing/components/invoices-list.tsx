"use client";

/**
 * @deprecated Ce composant est déprécié. Utilisez `InvoiceListUnified` depuis
 * `@/features/billing/components/invoice-list-unified` pour les nouvelles implémentations.
 *
 * Ce composant est conservé pour la compatibilité avec les pages existantes:
 * - app/leases/[id]/page.tsx
 *
 * Différences avec InvoiceListUnified:
 * - Ce composant récupère ses propres données (leaseId prop)
 * - InvoiceListUnified reçoit les données en props (invoices, variant)
 */

import { useEffect, useState, useMemo } from "react";
import { InvoiceCard } from "./invoice-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { invoicesService } from "../services/invoices.service";
import type { Invoice } from "@/lib/types";
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
import { InvoicesListSkeleton } from "@/components/skeletons/invoices-list-skeleton";
import Link from "next/link";

interface InvoicesListProps {
  leaseId?: string;
}

export function InvoicesList({ leaseId }: InvoicesListProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchInvoices();
    }
  }, [profile, leaseId]);

  async function fetchInvoices() {
    if (!profile) return;

    try {
      setLoading(true);
      let data: Invoice[];

      if (leaseId) {
        data = await invoicesService.getInvoicesByLease(leaseId);
      } else if (profile.role === "owner" || profile.role === "admin") {
        data = await invoicesService.getInvoicesByOwner(profile.id);
      } else if (profile.role === "tenant") {
        data = await invoicesService.getInvoicesByTenant(profile.id);
      } else {
        data = [];
      }

      setInvoices(data);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de charger les factures.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const pagination = usePagination({
    totalItems: invoices.length,
    itemsPerPage: 12,
  });

  const paginatedInvoices = useMemo(() => {
    return invoices.slice(pagination.startIndex, pagination.endIndex);
  }, [invoices, pagination.startIndex, pagination.endIndex]);

  if (loading) {
    return <InvoicesListSkeleton />;
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Aucune facture enregistrée.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Factures ({invoices.length})</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {paginatedInvoices.map((invoice) => (
          <InvoiceCard key={invoice.id} invoice={invoice} onDelete={fetchInvoices} />
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

