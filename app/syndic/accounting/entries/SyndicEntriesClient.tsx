"use client";

import { useState, useCallback } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useCoproSites, useCoproLots } from "@/lib/hooks/use-copro-lots";
import { COPRO_CHARGE_ACCOUNTS } from "@/lib/hooks/use-copro-budget";
import { formatCents } from "@/lib/utils/format-cents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Building2,
  Receipt,
  ArrowDownCircle,
  Upload,
  Check,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/hooks/use-auth";

// -- Types for entries -------------------------------------------------------

interface SyndicJournalEntry {
  id: string;
  date: string;
  label: string;
  debit_account: string;
  credit_account: string;
  amount_cents: number;
  category: string;
  created_at: string;
}

// -- Repartition keys --------------------------------------------------------

const REPARTITION_KEYS = [
  { value: "generale", label: "Generale" },
  { value: "ascenseur", label: "Ascenseur" },
  { value: "chauffage", label: "Chauffage" },
  { value: "autre", label: "Autre" },
] as const;

// -- Encaissement types -------------------------------------------------------

const ENCAISSEMENT_TYPES = [
  { value: "appel_courant", label: "Appel courant" },
  { value: "appel_travaux", label: "Appel travaux" },
  { value: "autre", label: "Autre" },
] as const;

export default function SyndicEntriesClient() {
  return (
    <PlanGate feature="copro_module" mode="blur">
      <SyndicEntriesContent />
    </PlanGate>
  );
}

function SyndicEntriesContent() {
  const { data: sites } = useCoproSites();
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const activeSiteId = selectedSiteId || sites?.[0]?.id || "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <Link
            href="/syndic/accounting"
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Retour"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
              Saisie simplifiee
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enregistrer depenses et encaissements
            </p>
          </div>
        </div>

        {sites && sites.length > 1 && (
          <Select value={activeSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger className="w-56">
              <Building2 className="w-4 h-4 mr-2 text-cyan-600" />
              <SelectValue placeholder="Copropriete" />
            </SelectTrigger>
            <SelectContent>
              {sites.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Two masks */}
      <Tabs defaultValue="depense">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="depense" className="flex-1 sm:flex-initial">
            <Receipt className="w-4 h-4 mr-1.5" />
            Enregistrer une depense
          </TabsTrigger>
          <TabsTrigger value="encaissement" className="flex-1 sm:flex-initial">
            <ArrowDownCircle className="w-4 h-4 mr-1.5" />
            Enregistrer un encaissement
          </TabsTrigger>
        </TabsList>

        <TabsContent value="depense" className="mt-4">
          <DepenseForm siteId={activeSiteId} />
        </TabsContent>

        <TabsContent value="encaissement" className="mt-4">
          <EncaissementForm siteId={activeSiteId} />
        </TabsContent>
      </Tabs>

      {/* Recent journal entries */}
      <RecentJournalEntries siteId={activeSiteId} />
    </div>
  );
}

// -- Mask 1: Depense ----------------------------------------------------------

function DepenseForm({ siteId }: { siteId: string }) {
  const queryClient = useQueryClient();
  const [fournisseur, setFournisseur] = useState("");
  const [montant, setMontant] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [categorie, setCategorie] = useState("");
  const [repartition, setRepartition] = useState("generale");
  const [justificatif, setJustificatif] = useState<File | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const account = COPRO_CHARGE_ACCOUNTS.find(
        (a) => a.account_number === categorie
      );
      const payload = {
        site_id: siteId,
        fournisseur,
        amount_cents: Math.round(parseFloat(montant) * 100),
        date,
        debit_account: categorie,
        credit_account: "401000",
        label: `${account?.label ?? "Depense"} - ${fournisseur}`,
        repartition_key: repartition,
      };
      return apiClient.post("/syndic/entries", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["syndic", "entries", siteId] });
      setFournisseur("");
      setMontant("");
      setCategorie("");
      setJustificatif(null);
    },
  });

  const isValid =
    fournisseur.trim() !== "" && montant !== "" && parseFloat(montant) > 0 && categorie !== "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="w-4 h-4 text-cyan-600" />
          Enregistrer une depense
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Cree automatiquement : D:{categorie || "6XXXXX"} / C:401000
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Fournisseur
            </label>
            <Input
              value={fournisseur}
              onChange={(e) => setFournisseur(e.target.value)}
              placeholder="Nom du fournisseur"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Montant TTC
            </label>
            <Input
              type="number"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="0,00"
              step="0.01"
              min="0"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Date
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Categorie
            </label>
            <Select value={categorie} onValueChange={setCategorie}>
              <SelectTrigger>
                <SelectValue placeholder="Selectionner" />
              </SelectTrigger>
              <SelectContent>
                {COPRO_CHARGE_ACCOUNTS.map((acc) => (
                  <SelectItem
                    key={acc.account_number}
                    value={acc.account_number}
                  >
                    {acc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Cle de repartition
            </label>
            <Select value={repartition} onValueChange={setRepartition}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPARTITION_KEYS.map((key) => (
                  <SelectItem key={key.value} value={key.value}>
                    {key.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Justificatif (optionnel)
            </label>
            <div className="relative">
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) =>
                  setJustificatif(e.target.files?.[0] ?? null)
                }
                className="text-sm"
              />
              {justificatif && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  {justificatif.name}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!isValid || createMutation.isPending}
            loading={createMutation.isPending}
            className="bg-cyan-600 hover:bg-cyan-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// -- Mask 2: Encaissement -----------------------------------------------------

function EncaissementForm({ siteId }: { siteId: string }) {
  const queryClient = useQueryClient();
  const { lots, isLoading: lotsLoading } = useCoproLots(siteId);

  const [selectedLot, setSelectedLot] = useState("");
  const [montant, setMontant] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [type, setType] = useState("appel_courant");

  const selectedLotData = lots.find((l) => l.id === selectedLot);

  const createMutation = useMutation({
    mutationFn: async () => {
      const creditAccount =
        selectedLotData
          ? `4500${selectedLotData.lot_number.padStart(2, "0")}`
          : "450000";
      const payload = {
        site_id: siteId,
        lot_id: selectedLot,
        amount_cents: Math.round(parseFloat(montant) * 100),
        date,
        debit_account: "512000",
        credit_account: creditAccount,
        label: `Encaissement ${selectedLotData?.owner_name ?? ""}`,
        encaissement_type: type,
      };
      return apiClient.post("/syndic/entries", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["syndic", "entries", siteId] });
      setSelectedLot("");
      setMontant("");
      setType("appel_courant");
    },
  });

  const isValid =
    selectedLot !== "" && montant !== "" && parseFloat(montant) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowDownCircle className="w-4 h-4 text-cyan-600" />
          Enregistrer un encaissement
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Cree automatiquement : D:512000 / C:4500XX
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Coproprietaire
            </label>
            <Select value={selectedLot} onValueChange={setSelectedLot}>
              <SelectTrigger>
                <SelectValue placeholder="Selectionner un lot" />
              </SelectTrigger>
              <SelectContent>
                {lots.map((lot) => (
                  <SelectItem key={lot.id} value={lot.id}>
                    Lot {lot.lot_number} - {lot.owner_name} ({lot.tantiemes}/
                    {lot.tantiemes_total})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Montant
            </label>
            <Input
              type="number"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="0,00"
              step="0.01"
              min="0"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Date
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Type
            </label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENCAISSEMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!isValid || createMutation.isPending}
            loading={createMutation.isPending}
            className="bg-cyan-600 hover:bg-cyan-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// -- Recent Journal Entries ---------------------------------------------------

function RecentJournalEntries({ siteId }: { siteId: string }) {
  const { profile } = useAuth();

  const { data: entries, isLoading } = useQuery({
    queryKey: ["syndic", "entries", siteId],
    queryFn: async (): Promise<SyndicJournalEntry[]> => {
      if (!siteId) return [];
      try {
        const data = await apiClient.get<SyndicJournalEntry[]>(
          `/syndic/entries?site_id=${siteId}&limit=20`
        );
        return data ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!profile && !!siteId,
    staleTime: 30 * 1000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-600" />
          Journal recent
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-muted rounded" />
            ))}
          </div>
        ) : !entries || entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucune ecriture recente
          </p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:-mx-6">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                    Date
                  </th>
                  <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                    Libelle
                  </th>
                  <th className="text-center py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                    Debit
                  </th>
                  <th className="text-center py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                    Credit
                  </th>
                  <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                    Montant
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-2.5 px-4 sm:px-6 text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="py-2.5 px-4 sm:px-6 text-foreground">
                      {entry.label}
                    </td>
                    <td className="py-2.5 px-4 sm:px-6 text-center">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {entry.debit_account}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 sm:px-6 text-center">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {entry.credit_account}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 sm:px-6 text-right font-medium text-foreground">
                      {formatCents(entry.amount_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
