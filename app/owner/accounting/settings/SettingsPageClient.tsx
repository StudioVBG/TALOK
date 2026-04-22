"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Info, Loader2 } from "lucide-react";

import { PlanGate } from "@/components/subscription/plan-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import { useEntityStore } from "@/stores/useEntityStore";

type DeclarationMode = "micro_foncier" | "reel" | "is_comptable";

interface SettingsResponse {
  success: boolean;
  data: {
    entityId: string;
    accountingEnabled: boolean;
    declarationMode: DeclarationMode;
    regimeFiscal: string | null;
  };
}

interface PatchPayload {
  entityId: string;
  accountingEnabled?: boolean;
  declarationMode?: DeclarationMode;
}

export default function SettingsPageClient() {
  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <SettingsContent />
    </PlanGate>
  );
}

function SettingsContent() {
  const entities = useEntityStore((s) => s.entities);
  const activeEntityId = useEntityStore((s) => s.activeEntityId);
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(
    activeEntityId,
  );

  const entityId = selectedEntityId ?? activeEntityId;

  const selectedEntity = useMemo(
    () => entities.find((e) => e.id === entityId) ?? null,
    [entities, entityId],
  );

  const { data, isLoading, isFetching } = useQuery<SettingsResponse>({
    queryKey: ["accounting-settings", entityId],
    queryFn: () =>
      apiClient.get<SettingsResponse>(
        `/accounting/settings?entityId=${entityId}`,
      ),
    enabled: !!entityId,
  });

  const settings = data?.data;

  const mutation = useMutation<SettingsResponse, Error, PatchPayload>({
    mutationFn: (body) => apiClient.patch<SettingsResponse>("/accounting/settings", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-settings", entityId] });
      toast({
        title: "Paramètres enregistrés",
        description: "Les préférences comptables de cette entité ont été mises à jour.",
      });
    },
    onError: (err) => {
      toast({
        title: "Erreur",
        description: err?.message ?? "Mise à jour impossible",
        variant: "destructive",
      });
    },
  });

  function handleToggleAccounting(checked: boolean) {
    if (!entityId) return;
    mutation.mutate({ entityId, accountingEnabled: checked });
  }

  function handleChangeDeclarationMode(value: string) {
    if (!entityId) return;
    if (
      value !== "micro_foncier" &&
      value !== "reel" &&
      value !== "is_comptable"
    ) {
      return;
    }
    mutation.mutate({ entityId, declarationMode: value });
  }

  if (entities.length === 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-medium">Aucune entité juridique</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Créez une entité juridique (SCI, SARL, patrimoine personnel…) pour
              configurer sa comptabilité.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-3xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Paramètres comptables
        </h1>
        <p className="text-sm text-muted-foreground">
          Activez et configurez la génération automatique des écritures pour
          chaque entité juridique.
        </p>
      </header>

      {/* Entity picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Entité</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="entity-select">Entité concernée</Label>
            <Select
              value={entityId ?? undefined}
              onValueChange={(v) => {
                setSelectedEntityId(v);
                setActiveEntity(v);
              }}
            >
              <SelectTrigger id="entity-select" className="max-w-md">
                <SelectValue placeholder="Sélectionner une entité" />
              </SelectTrigger>
              <SelectContent>
                {entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nom}
                    {e.legalForm ? ` · ${e.legalForm}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement des paramètres…
        </div>
      )}

      {settings && (
        <>
          {/* Toggle activation */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Activation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="accounting-toggle" className="text-sm font-medium">
                    Comptabilité automatique
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Lorsqu'elle est activée, Talok génère automatiquement les
                    écritures correspondant à vos quittances, paiements, dépôts
                    de garantie et dépenses pour{" "}
                    <span className="font-medium text-foreground">
                      {selectedEntity?.nom}
                    </span>
                    .
                  </p>
                </div>
                <Switch
                  id="accounting-toggle"
                  checked={settings.accountingEnabled}
                  onCheckedChange={handleToggleAccounting}
                  disabled={mutation.isPending || isFetching}
                />
              </div>

              {settings.accountingEnabled && (
                <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-muted-foreground">
                    Les événements futurs généreront automatiquement une
                    écriture. Pour rattraper l'historique, utilisez le bouton
                    d'import en bas de page.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Declaration mode */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Régime déclaratif</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Détermine le niveau de détail comptable requis et la déclaration
                fiscale cible. Indépendant du régime juridique (
                <span className="font-medium text-foreground">
                  {settings.regimeFiscal?.toUpperCase() ?? "—"}
                </span>
                ) configuré à la création de l'entité.
              </p>

              <RadioGroup
                value={settings.declarationMode}
                onValueChange={handleChangeDeclarationMode}
                disabled={mutation.isPending || isFetching}
                className="space-y-3"
              >
                <DeclarationOption
                  value="micro_foncier"
                  title="Micro-foncier"
                  description="Loyers annuels ≤ 15 000 €, abattement forfaitaire de 30 %. Les écritures sont générées à titre informatif (préparation 2044), non intégrées au FEC."
                />
                <DeclarationOption
                  value="reel"
                  title="Régime réel (SCI IR au réel)"
                  description="Comptabilité de trésorerie. Déclaration 2044 détaillée. Export FEC disponible."
                />
                <DeclarationOption
                  value="is_comptable"
                  title="Impôt sur les sociétés"
                  description="Comptabilité commerciale complète pour SCI IS, SARL, etc. Bilan, compte de résultat, liasse fiscale."
                />
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Historical backfill */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Historique</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2 text-sm">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-muted-foreground">
                  L'import historique rejoue les événements passés (loyers,
                  paiements, dépôts, dépenses) pour générer les écritures
                  comptables correspondantes. L'opération est idempotente : elle
                  peut être relancée sans créer de doublons.
                </p>
              </div>
              <Button
                variant="outline"
                disabled={!settings.accountingEnabled}
                onClick={() => {
                  toast({
                    title: "Import historique",
                    description:
                      "L'import doit être lancé depuis la ligne de commande :\nnpx tsx scripts/backfill-accounting-entries.ts --entity=" +
                      (entityId ?? "<uuid>"),
                  });
                }}
              >
                Lancer l'import historique
              </Button>
              {!settings.accountingEnabled && (
                <p className="text-xs text-muted-foreground">
                  Activez d'abord la comptabilité automatique pour lancer
                  l'import.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function DeclarationOption({
  value,
  title,
  description,
}: {
  value: DeclarationMode;
  title: string;
  description: string;
}) {
  return (
    <label
      htmlFor={`decl-${value}`}
      className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
    >
      <RadioGroupItem id={`decl-${value}`} value={value} className="mt-1" />
      <div className="space-y-1">
        <div className="text-sm font-medium">{title}</div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </label>
  );
}
