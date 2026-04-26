"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { PlanGate } from "@/components/subscription/plan-gate";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { useEntityStore } from "@/stores/useEntityStore";
import { formatCents } from "@/lib/utils/format-cents";
import { Loader2, Building2, Calculator, AlertCircle } from "lucide-react";

interface Property {
  id: string;
  adresse_complete?: string | null;
  adresse?: string | null;
  type_bien?: string | null;
  surface_loi_carrez?: number | null;
  legal_entity_id?: string | null;
}

interface PropertiesResponse {
  data?: Property[] | { properties?: Property[] };
  properties?: Property[];
}

interface ComponentResult {
  component: string;
  percent: number;
  durationYears: number;
  amountCents: number;
}

interface AcquisitionResponse {
  success: boolean;
  data?: { entryId: string; components: ComponentResult[] };
  error?: string;
  existingEntryId?: string;
}

const COMPONENT_LABELS: Record<string, string> = {
  terrain: "Terrain",
  gros_oeuvre: "Gros œuvre",
  facade: "Façade & étanchéité",
  installations_generales: "Installations générales",
  agencements: "Agencements",
  equipements: "Équipements",
};

const COMPONENT_ACCOUNTS: Record<string, string> = {
  terrain: "211000",
  gros_oeuvre: "213100",
  facade: "213200",
  installations_generales: "213300",
  agencements: "214100",
  equipements: "215100",
};

/**
 * Décomposition standard recalculée côté client pour la preview avant
 * soumission. La logique miroir de `decomposeProperty` côté serveur.
 */
function decomposePreview(
  totalCents: number,
  terrainPct: number,
): ComponentResult[] {
  const standard = [
    { component: "terrain", percent: terrainPct, durationYears: 0 },
    { component: "gros_oeuvre", percent: 40, durationYears: 50 },
    { component: "facade", percent: 10, durationYears: 25 },
    { component: "installations_generales", percent: 15, durationYears: 25 },
    { component: "agencements", percent: 10, durationYears: 15 },
    { component: "equipements", percent: 10, durationYears: 10 },
  ];
  const nonTerrainTotal = standard
    .filter((c) => c.component !== "terrain")
    .reduce((s, c) => s + c.percent, 0);
  const remainingPct = 100 - terrainPct;
  const scaleFactor = remainingPct / nonTerrainTotal;
  const out: ComponentResult[] = [];
  let allocated = 0;
  for (let i = 0; i < standard.length; i++) {
    const c = standard[i];
    const pct = c.component === "terrain" ? terrainPct : c.percent * scaleFactor;
    const isLast = i === standard.length - 1;
    const amountCents = isLast
      ? totalCents - allocated
      : Math.round((totalCents * pct) / 100);
    allocated += amountCents;
    out.push({
      component: c.component,
      percent: Math.round(pct * 100) / 100,
      durationYears: c.durationYears,
      amountCents,
    });
  }
  return out;
}

export default function PropertyAcquisitionsPageClient() {
  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <Content />
    </PlanGate>
  );
}

function Content() {
  const { profile } = useAuth();
  const { activeEntityId } = useEntityStore();
  const entityId =
    activeEntityId ??
    (profile as { default_entity_id?: string | null } | null)?.default_entity_id ??
    undefined;

  const propertiesQuery = useQuery({
    queryKey: ["properties", "list-for-acquisition"],
    queryFn: async (): Promise<Property[]> => {
      const res = await apiClient.get<PropertiesResponse | Property[]>(
        "/properties",
      );
      if (Array.isArray(res)) return res;
      const data = (res as PropertiesResponse).data;
      if (Array.isArray(data)) return data;
      if (data && typeof data === "object" && Array.isArray((data as any).properties)) {
        return (data as any).properties;
      }
      if ((res as PropertiesResponse).properties) {
        return (res as PropertiesResponse).properties as Property[];
      }
      return [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Filtre sur les biens de l'entité active uniquement (si entityId connu)
  const filteredProperties = useMemo(() => {
    const all = propertiesQuery.data ?? [];
    if (!entityId) return all;
    return all.filter((p) => !p.legal_entity_id || p.legal_entity_id === entityId);
  }, [propertiesQuery.data, entityId]);

  const [propertyId, setPropertyId] = useState("");
  const today = new Date().toISOString().split("T")[0];
  const [acquisitionDate, setAcquisitionDate] = useState(today);
  const [totalEuros, setTotalEuros] = useState("");
  const [loanEuros, setLoanEuros] = useState("");
  const [terrainPct, setTerrainPct] = useState("15");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    entryId: string;
    components: ComponentResult[];
  } | null>(null);

  // Live preview de la décomposition
  const preview = useMemo(() => {
    const totalCents = Math.round(parseFloat(totalEuros.replace(",", ".")) * 100);
    const pct = parseFloat(terrainPct.replace(",", ".")) || 15;
    if (!Number.isFinite(totalCents) || totalCents <= 0) return null;
    if (pct < 0 || pct > 50) return null;
    return decomposePreview(totalCents, pct);
  }, [totalEuros, terrainPct]);

  const totalCentsParsed = preview
    ? preview.reduce((s, c) => s + c.amountCents, 0)
    : 0;
  const loanCentsParsed = Math.round(
    parseFloat(loanEuros.replace(",", ".") || "0") * 100,
  );
  const apportCents = Math.max(0, totalCentsParsed - loanCentsParsed);

  const createMutation = useMutation({
    mutationFn: async () => {
      const totalCents = Math.round(
        parseFloat(totalEuros.replace(",", ".")) * 100,
      );
      const loanCents = loanEuros
        ? Math.round(parseFloat(loanEuros.replace(",", ".")) * 100)
        : 0;
      const pct = terrainPct ? parseFloat(terrainPct.replace(",", ".")) : 15;

      return apiClient.post<AcquisitionResponse>(
        "/accounting/property-acquisitions",
        {
          property_id: propertyId,
          total_cents: totalCents,
          loan_cents: loanCents,
          acquisition_date: acquisitionDate,
          terrain_pct: pct,
        },
      );
    },
    onSuccess: (res: AcquisitionResponse) => {
      if (res.success && res.data) {
        setSuccess(res.data);
        setError(null);
      } else {
        setError(res.error ?? "Échec de la comptabilisation");
        setSuccess(null);
      }
    },
    onError: (err: Error) => {
      setError(err.message ?? "Erreur réseau");
      setSuccess(null);
    },
  });

  const canSubmit =
    propertyId &&
    acquisitionDate &&
    totalEuros &&
    Number.isFinite(totalCentsParsed) &&
    totalCentsParsed > 0 &&
    loanCentsParsed >= 0 &&
    loanCentsParsed <= totalCentsParsed;

  if (!entityId) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Sélectionnez une entité comptable.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
          Acquisition immobilière
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Comptabilise l'achat d'un bien : décomposition automatique en
          composants (terrain + 5 axes amortissables) selon le PCG bailleur,
          avec ventilation emprunt / apport.
        </p>
      </div>

      {success ? (
        <SuccessPanel
          entryId={success.entryId}
          components={success.components}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              createMutation.mutate();
            }}
            className="bg-card rounded-xl border border-border p-4 space-y-3"
          >
            <h2 className="text-sm font-semibold text-foreground">
              Détails de l'acquisition
            </h2>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Bien à comptabiliser
              </span>
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
                disabled={propertiesQuery.isLoading}
              >
                <option value="">
                  {propertiesQuery.isLoading
                    ? "Chargement…"
                    : "Sélectionner un bien"}
                </option>
                {filteredProperties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.adresse_complete ?? p.adresse ?? `Bien ${p.id.slice(0, 8)}`}
                  </option>
                ))}
              </select>
              {!propertiesQuery.isLoading && filteredProperties.length === 0 && (
                <span className="text-[11px] text-amber-600">
                  Aucun bien trouvé. Crée un bien dans « Mes biens » d'abord.
                </span>
              )}
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Date d'acquisition
              </span>
              <input
                type="date"
                value={acquisitionDate}
                onChange={(e) => setAcquisitionDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Prix total (€)
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={totalEuros}
                  onChange={(e) => setTotalEuros(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="250000"
                  required
                />
                <span className="text-[11px] text-muted-foreground">
                  Frais de notaire inclus si capitalisés.
                </span>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  % terrain (non amortissable)
                </span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="50"
                  value={terrainPct}
                  onChange={(e) => setTerrainPct(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <span className="text-[11px] text-muted-foreground">
                  Défaut 15% (ajustable selon la situation : urbain dense
                  20-25%, rural 5-10%).
                </span>
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Portion empruntée (€)
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={loanEuros}
                onChange={(e) => setLoanEuros(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="200000"
              />
              <span className="text-[11px] text-muted-foreground">
                Le reste sera ventilé en apport (compte 512100 banque).
                Mettez 0 si achat 100% comptant.
              </span>
            </label>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit || createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Comptabiliser l'acquisition
            </button>
          </form>

          {/* Preview */}
          <PreviewPanel
            preview={preview}
            loanCents={loanCentsParsed}
            apportCents={apportCents}
            totalCents={totalCentsParsed}
          />
        </div>
      )}
    </div>
  );
}

function PreviewPanel({
  preview,
  loanCents,
  apportCents,
  totalCents,
}: {
  preview: ComponentResult[] | null;
  loanCents: number;
  apportCents: number;
  totalCents: number;
}) {
  if (!preview) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
        <Calculator className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        Saisis le prix total pour voir la décomposition prévue.
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <h2 className="text-sm font-semibold text-foreground">
        Aperçu de l'écriture comptable
      </h2>

      <div className="space-y-1.5 text-xs">
        <p className="font-medium text-muted-foreground">Débits (immobilisations)</p>
        {preview.map((c) => (
          <div
            key={c.component}
            className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2.5 py-1.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                {COMPONENT_ACCOUNTS[c.component] ?? "218000"}
              </span>
              <span className="text-foreground truncate">
                {COMPONENT_LABELS[c.component] ?? c.component}
              </span>
              <span className="text-[11px] text-muted-foreground shrink-0">
                ({c.percent}%
                {c.durationYears > 0 ? ` · ${c.durationYears} ans` : " · non amort."})
              </span>
            </div>
            <span className="font-medium text-foreground whitespace-nowrap">
              D {formatCents(c.amountCents)}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-1.5 text-xs">
        <p className="font-medium text-muted-foreground">Crédits (financement)</p>
        {loanCents > 0 && (
          <div className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">164000</span>
              <span className="text-foreground">Emprunt immobilier</span>
            </div>
            <span className="font-medium text-foreground">
              C {formatCents(loanCents)}
            </span>
          </div>
        )}
        {apportCents > 0 && (
          <div className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">512100</span>
              <span className="text-foreground">Apport (banque)</span>
            </div>
            <span className="font-medium text-foreground">
              C {formatCents(apportCents)}
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-2 flex items-center justify-between text-xs font-medium">
        <span className="text-muted-foreground">Total équilibre</span>
        <span
          className={
            loanCents + apportCents === totalCents
              ? "text-emerald-600"
              : "text-rose-600"
          }
        >
          D {formatCents(totalCents)} = C {formatCents(loanCents + apportCents)}
        </span>
      </div>
    </div>
  );
}

function SuccessPanel({
  entryId,
  components,
}: {
  entryId: string;
  components: ComponentResult[];
}) {
  return (
    <div className="bg-card rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-3">
      <div className="flex items-center gap-2 text-emerald-600">
        <Building2 className="w-5 h-5" />
        <h2 className="text-base font-semibold">Acquisition comptabilisée</h2>
      </div>
      <p className="text-sm text-foreground">
        L'écriture composée a été créée dans le journal OD avec la
        décomposition suivante :
      </p>
      <ul className="text-xs space-y-1 font-mono text-muted-foreground">
        {components.map((c) => (
          <li key={c.component}>
            <span className="text-foreground">
              {COMPONENT_ACCOUNTS[c.component] ?? "218000"}
            </span>{" "}
            {COMPONENT_LABELS[c.component] ?? c.component} —{" "}
            {formatCents(c.amountCents)}
            {c.durationYears > 0 && (
              <span className="ml-2">→ amortissable sur {c.durationYears} ans</span>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        <Link
          href={`/owner/accounting/entries/${entryId}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs hover:bg-muted/50"
        >
          Voir l'écriture
        </Link>
        <Link
          href="/owner/accounting/amortization"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs hover:bg-muted/50"
        >
          Configurer les amortissements
        </Link>
      </div>
    </div>
  );
}
