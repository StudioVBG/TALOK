// =====================================================
// Page: Nouvelle Facture - SOTA 2026
// Permet de créer une facture manuellement
// =====================================================

"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useOwnerData } from "../../_data/OwnerDataProvider";
import { ArrowLeft, Euro, FileText, Building2, User, Calendar, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/helpers/format";

interface LeaseOption {
  id: string;
  property_address: string;
  tenant_name: string;
  loyer: number;
  charges: number;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { properties, contracts } = useOwnerData();
  const [isPending, startTransition] = useTransition();

  // État du formulaire
  const [selectedLeaseId, setSelectedLeaseId] = useState<string>("");
  const [periode, setPeriode] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [montantLoyer, setMontantLoyer] = useState<string>("");
  const [montantCharges, setMontantCharges] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Préparer les options de baux
  const leaseOptions: LeaseOption[] = (contracts || [])
    .filter((c: any) => c.statut === "active")
    .map((c: any) => ({
      id: c.id,
      property_address: c.property?.adresse_complete || "Adresse inconnue",
      tenant_name: c.signers?.find((s: any) => s.role === "locataire_principal")?.profile?.prenom || "Locataire",
      loyer: c.loyer || 0,
      charges: c.charges_forfaitaires || 0,
    }));

  // Quand un bail est sélectionné, pré-remplir les montants
  useEffect(() => {
    if (selectedLeaseId) {
      const lease = leaseOptions.find((l) => l.id === selectedLeaseId);
      if (lease) {
        setMontantLoyer(String(lease.loyer));
        setMontantCharges(String(lease.charges));
      }
    }
  }, [selectedLeaseId, leaseOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLeaseId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un bail",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lease_id: selectedLeaseId,
            periode,
            montant_loyer: parseFloat(montantLoyer) || 0,
            montant_charges: parseFloat(montantCharges) || 0,
            notes,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Erreur lors de la création");
        }

        const invoice = await response.json();

        toast({
          title: "Facture créée",
          description: `Facture pour ${periode} créée avec succès`,
        });

        router.push(`/owner/invoices/${invoice.id}`);
      } catch (error: any) {
        toast({
          title: "Erreur",
          description: error.message || "Impossible de créer la facture",
          variant: "destructive",
        });
      }
    });
  };

  const montantTotal =
    (parseFloat(montantLoyer) || 0) + (parseFloat(montantCharges) || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto p-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/owner/money">
          <Button variant="ghost" size="icon" aria-label="Retour">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Nouvelle facture
          </h1>
          <p className="text-muted-foreground">
            Créer une facture manuellement
          </p>
        </div>
      </div>

      {/* Formulaire */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" aria-hidden="true" />
            Détails de la facture
          </CardTitle>
          <CardDescription>
            Remplissez les informations pour créer une nouvelle facture
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Sélection du bail */}
            <div className="space-y-2">
              <Label htmlFor="lease">Bail concerné *</Label>
              <Select
                value={selectedLeaseId}
                onValueChange={setSelectedLeaseId}
              >
                <SelectTrigger id="lease" aria-label="Sélectionner un bail">
                  <SelectValue placeholder="Sélectionner un bail actif" />
                </SelectTrigger>
                <SelectContent>
                  {leaseOptions.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      Aucun bail actif
                    </SelectItem>
                  ) : (
                    leaseOptions.map((lease) => (
                      <SelectItem key={lease.id} value={lease.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                          <span className="truncate max-w-[200px]">
                            {lease.property_address}
                          </span>
                          <span className="text-muted-foreground">
                            ({lease.tenant_name})
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Période */}
            <div className="space-y-2">
              <Label htmlFor="periode">Période *</Label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="periode"
                  type="month"
                  value={periode}
                  onChange={(e) => setPeriode(e.target.value)}
                  required
                  aria-label="Période de facturation"
                />
              </div>
            </div>

            {/* Montants */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loyer">Loyer (€) *</Label>
                <div className="relative">
                  <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="loyer"
                    type="number"
                    step="0.01"
                    min="0"
                    value={montantLoyer}
                    onChange={(e) => setMontantLoyer(e.target.value)}
                    className="pl-9"
                    placeholder="0.00"
                    required
                    aria-label="Montant du loyer"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="charges">Charges (€)</Label>
                <div className="relative">
                  <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="charges"
                    type="number"
                    step="0.01"
                    min="0"
                    value={montantCharges}
                    onChange={(e) => setMontantCharges(e.target.value)}
                    className="pl-9"
                    placeholder="0.00"
                    aria-label="Montant des charges"
                  />
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Montant total
                </span>
                <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {formatCurrency(montantTotal)}
                </span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes internes sur cette facture..."
                rows={3}
                aria-label="Notes sur la facture"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isPending}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isPending || !selectedLeaseId}>
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    Création...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" aria-hidden="true" />
                    Créer la facture
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
