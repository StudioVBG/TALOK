"use client";
// @ts-nocheck

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { ChargeForm } from "@/features/billing/components/charge-form";
import { chargesService } from "@/features/billing/services/charges.service";
import type { Charge } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";

function EditChargePageContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [charge, setCharge] = useState<Charge | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCharge = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const data = await chargesService.getChargeById(id);
      setCharge(data);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger la charge.",
        variant: "destructive",
      });
      router.push("/charges");
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  useEffect(() => {
    if (params.id) {
      fetchCharge(params.id as string);
    }
  }, [params.id, fetchCharge]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!charge) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Modifier la charge</h1>
        <p className="text-muted-foreground">Modifiez les informations de la charge</p>
      </div>

      <ChargeForm charge={charge} />
    </div>
  );
}

export default function EditChargePage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "owner"]}>
      <EditChargePageContent />
    </ProtectedRoute>
  );
}

