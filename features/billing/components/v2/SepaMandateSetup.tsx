"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

type LeaseContext = {
  lease: {
    id: string;
    statut?: string | null;
  } | null;
  property: {
    adresse_complete?: string | null;
  } | null;
};

interface SepaMandateSetupProps {
  onSuccess?: () => void;
}

export function SepaMandateSetup({ onSuccess }: SepaMandateSetupProps) {
  const { toast } = useToast();
  const [leaseContext, setLeaseContext] = useState<LeaseContext | null>(null);
  const [isLoadingLease, setIsLoadingLease] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    iban: "",
    accountHolderName: "",
    collectionDay: "5",
  });

  useEffect(() => {
    let isMounted = true;

    const loadLease = async () => {
      try {
        const response = await fetch("/api/tenant/lease", { credentials: "include" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Impossible de charger le bail");
        }
        if (!isMounted) return;
        setLeaseContext({
          lease: data.lease ?? null,
          property: data.property ?? null,
        });
      } catch (error) {
        if (!isMounted) return;
        toast({
          title: "Bail indisponible",
          description: error instanceof Error ? error.message : "Impossible de charger votre bail courant.",
          variant: "destructive",
        });
      } finally {
        if (isMounted) setIsLoadingLease(false);
      }
    };

    void loadLease();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!leaseContext?.lease?.id) {
      toast({
        title: "Aucun bail actif",
        description: "Le mandat SEPA ne peut être créé qu'une fois votre bail disponible.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/payments/setup-sepa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lease_id: leaseContext.lease.id,
          iban: form.iban.replace(/\s+/g, "").toUpperCase(),
          account_holder_name: form.accountHolderName.trim(),
          collection_day: Number(form.collectionDay),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Impossible de créer le mandat");
      }

      toast({
        title: "Mandat SEPA créé",
        description: `Référence ${data.mandate_reference}. Premier prélèvement prévu le ${new Date(
          data.first_collection_date
        ).toLocaleDateString("fr-FR")}.`,
      });
      setForm({ iban: "", accountHolderName: "", collectionDay: form.collectionDay });
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Échec de la configuration SEPA",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingLease) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-indigo-600" />
          Activer le prélèvement SEPA
        </CardTitle>
        <CardDescription>
          Le mandat sera rattaché à votre bail courant{leaseContext?.property?.adresse_complete ? ` pour ${leaseContext.property.adresse_complete}` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!leaseContext?.lease?.id ? (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Aucun bail exploitable n&apos;est disponible pour créer un mandat SEPA.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm text-indigo-800">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Le prélèvement automatique est traité de façon sécurisée pour le compte de la plateforme. Les informations bancaires sont tokenisées et ne transitent pas en clair par l&apos;application.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                value={form.iban}
                onChange={(event) => setForm((current) => ({ ...current, iban: event.target.value }))}
                placeholder="FR76 1234 5678 9012 3456 7890 123"
                autoComplete="off"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-holder-name">Titulaire du compte</Label>
              <Input
                id="account-holder-name"
                value={form.accountHolderName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, accountHolderName: event.target.value }))
                }
                placeholder="Nom Prénom"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="collection-day">Jour de prélèvement souhaité</Label>
              <Input
                id="collection-day"
                type="number"
                min={1}
                max={28}
                value={form.collectionDay}
                onChange={(event) => setForm((current) => ({ ...current, collectionDay: event.target.value }))}
                required
              />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full gap-2">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
              Créer le mandat SEPA
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
