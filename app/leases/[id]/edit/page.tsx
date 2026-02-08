"use client";
// @ts-nocheck

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { LeaseForm } from "@/features/leases/components/lease-form";
import { leasesService } from "@/features/leases/services/leases.service";
import type { Lease } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";

function EditLeasePageContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [lease, setLease] = useState<Lease | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLease = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const data = await leasesService.getLeaseById(id);
      setLease(data);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger le bail.",
        variant: "destructive",
      });
      router.push("/owner/leases");
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  useEffect(() => {
    if (params.id) {
      fetchLease(params.id as string);
    }
  }, [params.id, fetchLease]);

  const handleSuccess = () => {
    router.push(`/owner/leases/${params.id}`);
  };

  const handleCancel = () => {
    router.push(`/owner/leases/${params.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!lease) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <LeaseForm lease={lease} onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  );
}

export default function EditLeasePage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "owner"]}>
      <EditLeasePageContent />
    </ProtectedRoute>
  );
}

