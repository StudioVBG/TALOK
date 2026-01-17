"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { leasesService } from "../services/leases.service";
import { useAuth } from "@/lib/hooks/use-auth";
import type { LeaseSigner } from "@/lib/types";
import { formatDateShort, formatFullName } from "@/lib/helpers/format";

interface LeaseSignersProps {
  leaseId: string;
  onUpdate?: () => void;
}

export function LeaseSigners({ leaseId, onUpdate }: LeaseSignersProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [signers, setSigners] = useState<(LeaseSigner & { profiles: any })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSigners();
  }, [leaseId]);

  async function fetchSigners() {
    try {
      setLoading(true);
      const data = await leasesService.getLeaseSigners(leaseId);
      setSigners(data);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger les signataires.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const handleSign = async (signerId: string) => {
    try {
      await leasesService.signLease(leaseId, signerId);
      toast({
        title: "Bail signé",
        description: "Votre signature a été enregistrée.",
      });
      fetchSigners();
      onUpdate?.();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de signer le bail.",
        variant: "destructive",
      });
    }
  };

  const handleRefuse = async (signerId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir refuser ce bail ?")) return;

    try {
      await leasesService.refuseLease(leaseId, signerId);
      toast({
        title: "Bail refusé",
        description: "Le bail a été refusé.",
      });
      fetchSigners();
      onUpdate?.();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de refuser le bail.",
        variant: "destructive",
      });
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      proprietaire: "Propriétaire",
      locataire_principal: "Locataire principal",
      colocataire: "Colocataire",
      garant: "Garant",
    };
    return labels[role] || role;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "En attente",
      signed: "Signé",
      refused: "Refusé",
    };
    return labels[status] || status;
  };

  if (loading) {
    return <div className="text-center py-4">Chargement des signataires...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signataires</CardTitle>
        <CardDescription>Liste des personnes devant signer le bail</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {signers.map((signer) => {
            const isCurrentUser = signer.profile_id === profile?.id;
            const canSign = isCurrentUser && signer.signature_status === "pending";

            return (
              <div
                key={signer.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <p className="font-medium">
                    {formatFullName(
                      signer.profiles?.prenom || null,
                      signer.profiles?.nom || null
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {getRoleLabel(signer.role)} - {getStatusLabel(signer.signature_status)}
                  </p>
                  {signer.signed_at && (
                    <p className="text-xs text-muted-foreground">
                      Signé le {formatDateShort(signer.signed_at)}
                    </p>
                  )}
                </div>
                {canSign && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSign(signer.id)}
                    >
                      Signer
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRefuse(signer.id)}
                    >
                      Refuser
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

