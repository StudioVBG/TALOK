"use client";

import { useEffect, useState, useMemo } from "react";
import { LeaseCard } from "./lease-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { leasesService } from "../services/leases.service";
import type { Lease } from "@/lib/types";
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
import { LeasesListSkeleton } from "@/components/skeletons/leases-list-skeleton";
import Link from "next/link";

interface LeasesListProps {
  propertyId?: string;
  showPropertyFilter?: boolean;
}

export function LeasesList({ propertyId, showPropertyFilter = false }: LeasesListProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchLeases();
    }
  }, [profile, propertyId]);

  async function fetchLeases() {
    if (!profile) return;

    try {
      setLoading(true);
      let data: Lease[];

      if (propertyId) {
        data = await leasesService.getLeasesByProperty(propertyId);
      } else if (profile.role === "owner" || profile.role === "admin") {
        data = await leasesService.getLeasesByOwner(profile.id);
      } else if (profile.role === "tenant") {
        data = await leasesService.getLeasesByTenant(profile.id);
      } else {
        data = [];
      }

      setLeases(data);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de charger les baux.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const pagination = usePagination({
    totalItems: leases.length,
    itemsPerPage: 12,
  });

  const paginatedLeases = useMemo(() => {
    return leases.slice(pagination.startIndex, pagination.endIndex);
  }, [leases, pagination.startIndex, pagination.endIndex]);

  if (loading) {
    return <LeasesListSkeleton />;
  }

  if (leases.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Aucun bail enregistré.</p>
        {!propertyId && (profile?.role === "owner" || profile?.role === "admin") && (
          <Link href="/owner/leases/new">
            <Button>Créer un bail</Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Mes baux ({leases.length})</h2>
        {!propertyId && (profile?.role === "owner" || profile?.role === "admin") && (
          <Link href="/owner/leases/new">
            <Button>Créer un bail</Button>
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {paginatedLeases.map((lease) => (
          <LeaseCard key={lease.id} lease={lease} onDelete={fetchLeases} />
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

