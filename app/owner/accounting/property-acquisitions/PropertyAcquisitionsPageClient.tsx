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
  /** % du total */
  percent: number;
  /** % du bâti (constant pour les composants amortissables) */
  percentBati?: number;
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
  gros_oeuvre: "Gros œuvre (structure)",
  facade: "Façade, étanchéité, couverture",
  installations_generales: "Installations (élec, plomb, CVC)",
  agencements: "Agencements intérieurs",
  equipements: "Équipements (cuisine, sanitaires)",
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
 * Décomposition standard PCG bailleur, miroir de `decomposeProperty` côté
 * serveur. Le terrain est calculé EN PREMIER (% du total), puis les 5
 * composants amortissables sont calculés sur le bâti avec des % FIXES
 * (50/10/20/10/10 du bâti).
 */
const STANDARD_BATI_COMPONENTS = [
  { component: "gros_oeuvre", percentBati: 50, durationYears: 50 },
  { component: "facade", percentBati: 10, durationYears: 25 },
  { component: "installations_generales", percentBati: 20, durationYears: 20 },
  { component: "agencements", percentBati: 10, durationYears: 15 },
  { component: "equipements", percentBati: 10, durationYears: 10 },
];

function decomposePreview(
  totalCents: number,
  terrainPct: number,
): ComponentResult[] {
  const terrainCents = Math.round((totalCents * terrainPct) / 100);
  const batiCents = totalCents - terrainCents;
  const out: ComponentResult[] = [
    {
      component: "terrain",
      percent: terrainPct,
      percentBati: undefined,
      durationYears: 0,
      amountCents: terrainCents,
    },
  ];
  let allocated = 0;
  for (let i = 0; i < STANDARD_BATI_COMPONENTS.length; i++) {
    const c = STANDARD_BATI_COMPONENTS[i];
    const isLast = i === STANDARD_BATI_COMPONENTS.length - 1;
    const amountCents = isLast
      ? batiCents - allocated
      : Math.round((batiCents * c.percentBati) / 100);
    allocated += amountCents;
    const pctOfTotal =
      totalCents > 0
        ? Math.round((amountCents / totalCents) * 10000) / 100
        : 0;
    out.push({
      component: c.component,
      percent: pctOfTotal,
      percentBati: c.percentBati,
      durationYears: c.durationYears,
      amountCents,
    });
  }
  return out;
}

function eurosToCents(input: string): number {
  if (!input) return 0;
  const v = parseFloat(input.replace(",", "."));
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100);
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
      if (data && typeof data === "object" && Array.isArray((data as { properties?: Property[] }).properties)) {
        return (data as { properties: Property[] }).properties;
      }
      if ((res as PropertiesResponse).properties) {
        return (res as PropertiesResponse).properties as Property[];
      }
      return [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredProperties = useMemo(() => {
    const all = propertiesQuery.data ?? [];
    if (!entityId) return all;
    return all.filter((p) => !p.legal_entity_id || p.legal_entity_id === entityId);
  }, [propertiesQuery.data, entityId]);

  const [propertyId, setPropertyId] = useState("");
  const today = new Date().toISOString().split("T")[0];
  const [acquisitionDate, setAcquisitionDate] = useState(today);
  const [priceEuros, setPriceEuros] = useState("");
  const [terrainPct, setTerrainPct] = useState("15");
  const [notaryEuros, setNotaryEuros] = useState("");
  const [notaryMode, setNotaryMode] = useState<"capitalize" | "expense">(
    "capitalize",
  );
  const [bankFeesEuros, setBankFeesEuros] = useState("");
  const [interestEuros, setInterestEuros] = useState("");
  const [loanEuros, setLoanEuros] = useState("");
  const [apportAccount, setApportAccount] = useState<"512100" | "455000">(
    "512100",
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    entryId: string;
    components: ComponentResult[];
  } | null>(null);

  // Centimes parsés
  const priceCents = eurosToCents(priceEuros);
  const notaryCents = eurosToCents(notaryEuros);
  const bankFeesCents = eurosToCents(bankFeesEuros);
  const interestCents = eurosToCents(interestEuros);
  const loanCents = eurosToCents(loanEuros);
  const terrainPctParsed = parseFloat(terrainPct.replace(",", ".")) || 15;

  // Si frais notaire capitalisés → ajoutés à l'immobilisation
  // Sinon → restent en charges 622600
  const immobilisationCents =
    notaryMode === "capitalize" ? priceCents + notaryCents : priceCents;
  const notaryExpenseCents = notaryMode === "expense" ? notaryCents : 0;

  // Total à financer (cash out) = immo + toutes les charges d'acquisition
  const totalCashOutCents =
    immobilisationCents + notaryExpenseCents + bankFeesCents + interestCents;

  const apportCents = Math.max(0, totalCashOutCents - loanCents);

  // Décomposition preview (uniquement sur la base immobilisable)
  const preview = useMemo(() => {
    if (immobilisationCents <= 0) return null;
    if (terrainPctParsed < 0 || terrainPctParsed > 50) return null;
    return decomposePreview(immobilisationCents, terrainPctParsed);
  }, [immobilisationCents, terrainPctParsed]);

  const createMutation = useMutation({
    mutationFn: async () =>
      apiClient.post<AcquisitionResponse>(
        "/accounting/property-acquisitions",
        {
          property_id: propertyId,
          total_cents: immobilisationCents,
          loan_cents: loanCents,
          acquisition_date: acquisitionDate,
          terrain_pct: terrainPctParsed,
          notary_fees_expense_cents: notaryExpenseCents,
          bank_fees_cents: bankFeesCents,
          intercalary_interest_cents: interestCents,
          apport_account: apportAccount,
        },
      ),
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
    priceCents > 0 &&
    loanCents >= 0 &&
    loanCents <= totalCashOutCents &&
    terrainPctParsed >= 0 &&
    terrainPctParsed <= 50;

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
          Comptabilise l&apos;achat d&apos;un bien : décomposition automatique en
          composants (terrain + 5 axes amortissables) selon le PCG bailleur,
          avec frais d&apos;acquisition (notaire, banque, intérêts) et
          ventilation emprunt / apport.
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
            className="bg-card rounded-xl border border-border p-4 space-y-4"
          >
            <h2 className="text-sm font-semibold text-foreground">
              Détails de l&apos;acquisition
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
                  Aucun bien trouvé. Crée un bien dans « Mes biens » d&apos;abord.
                </span>
              )}
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Date d&apos;acquisition
              </span>
              <input
                type="date"
                value={acquisitionDate}
                onChange={(e) => setAcquisitionDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </label>

            {/* --- Bloc immobilisation --- */}
            <fieldset className="space-y-3 border border-border rounded-lg p-3">
              <legend className="text-[11px] font-medium text-muted-foreground px-1">
                Bien immobilier (à immobiliser)
              </legend>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Prix d&apos;achat HT (€)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={priceEuros}
                    onChange={(e) => setPriceEuros(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder="250000"
                    required
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    % terrain (non amortissable)
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    value={terrainPct}
                    onChange={(e) => setTerrainPct(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Défaut 15%. Urbain dense 20-25%, rural 5-10%.
                  </span>
                </label>
              </div>
            </fieldset>

            {/* --- Bloc frais d'acquisition --- */}
            <fieldset className="space-y-3 border border-border rounded-lg p-3">
              <legend className="text-[11px] font-medium text-muted-foreground px-1">
                Frais d&apos;acquisition
              </legend>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Frais de notaire (€)
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={notaryEuros}
                  onChange={(e) => setNotaryEuros(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="20000"
                />
                <div className="flex gap-3 mt-1">
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="notaryMode"
                      value="capitalize"
                      checked={notaryMode === "capitalize"}
                      onChange={() => setNotaryMode("capitalize")}
                    />
                    <span>Capitaliser (immobilisation)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="notaryMode"
                      value="expense"
                      checked={notaryMode === "expense"}
                      onChange={() => setNotaryMode("expense")}
                    />
                    <span>En charges (622600)</span>
                  </label>
                </div>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Frais bancaires : dossier, garantie, commission (€)
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={bankFeesEuros}
                  onChange={(e) => setBankFeesEuros(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="1500"
                />
                <span className="text-[11px] text-muted-foreground">
                  Comptabilisés en charges (627000).
                </span>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Intérêts intercalaires (€)
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={interestEuros}
                  onChange={(e) => setInterestEuros(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="0"
                />
                <span className="text-[11px] text-muted-foreground">
                  Comptabilisés en charges financières (661000).
                </span>
              </label>
            </fieldset>

            {/* --- Bloc financement --- */}
            <fieldset className="space-y-3 border border-border rounded-lg p-3">
              <legend className="text-[11px] font-medium text-muted-foreground px-1">
                Financement
              </legend>

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
                  Crédité au compte 164000. 0 si achat 100% comptant.
                </span>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Compte d&apos;apport
                </span>
                <select
                  value={apportAccount}
                  onChange={(e) =>
                    setApportAccount(e.target.value as "512100" | "455000")
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="512100">512100 — Banque (compte courant)</option>
                  <option value="455000">455000 — Compte courant associé (CCA)</option>
                </select>
                <span className="text-[11px] text-muted-foreground">
                  Le reste après emprunt sera crédité sur ce compte.
                </span>
              </label>
            </fieldset>

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
              Comptabiliser l&apos;acquisition
            </button>
          </form>

          {/* Preview */}
          <PreviewPanel
            preview={preview}
            immobilisationCents={immobilisationCents}
            notaryExpenseCents={notaryExpenseCents}
            bankFeesCents={bankFeesCents}
            interestCents={interestCents}
            loanCents={loanCents}
            apportCents={apportCents}
            apportAccount={apportAccount}
            totalCashOutCents={totalCashOutCents}
          />
        </div>
      )}
    </div>
  );
}

function PreviewPanel({
  preview,
  immobilisationCents,
  notaryExpenseCents,
  bankFeesCents,
  interestCents,
  loanCents,
  apportCents,
  apportAccount,
  totalCashOutCents,
}: {
  preview: ComponentResult[] | null;
  immobilisationCents: number;
  notaryExpenseCents: number;
  bankFeesCents: number;
  interestCents: number;
  loanCents: number;
  apportCents: number;
  apportAccount: "512100" | "455000";
  totalCashOutCents: number;
}) {
  if (!preview) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
        <Calculator className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        Saisis le prix d&apos;achat pour voir la décomposition prévue.
      </div>
    );
  }

  const totalDebits =
    immobilisationCents + notaryExpenseCents + bankFeesCents + interestCents;
  const totalCredits = loanCents + apportCents;
  const balanced = totalDebits === totalCredits;

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <h2 className="text-sm font-semibold text-foreground">
        Aperçu de l&apos;écriture comptable
      </h2>

      <div className="space-y-1.5 text-xs">
        <p className="font-medium text-muted-foreground">
          Débits — Immobilisations (classe 2)
        </p>
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
                ({c.percentBati !== undefined
                  ? `${c.percentBati}% du bâti`
                  : `${c.percent}% du total`}
                {c.durationYears > 0
                  ? ` · ${c.durationYears} ans`
                  : " · non amort."})
              </span>
            </div>
            <span className="font-medium text-foreground whitespace-nowrap">
              D {formatCents(c.amountCents)}
            </span>
          </div>
        ))}
      </div>

      {(notaryExpenseCents > 0 || bankFeesCents > 0 || interestCents > 0) && (
        <div className="space-y-1.5 text-xs">
          <p className="font-medium text-muted-foreground">
            Débits — Charges d&apos;acquisition (classe 6)
          </p>
          {notaryExpenseCents > 0 && (
            <ExpenseLine
              account="622600"
              label="Honoraires notaire"
              amount={notaryExpenseCents}
            />
          )}
          {bankFeesCents > 0 && (
            <ExpenseLine
              account="627000"
              label="Frais bancaires (dossier, garantie)"
              amount={bankFeesCents}
            />
          )}
          {interestCents > 0 && (
            <ExpenseLine
              account="661000"
              label="Intérêts intercalaires"
              amount={interestCents}
            />
          )}
        </div>
      )}

      <div className="space-y-1.5 text-xs">
        <p className="font-medium text-muted-foreground">
          Crédits — Financement
        </p>
        {loanCents > 0 && (
          <div className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">
                164000
              </span>
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
              <span className="font-mono text-[11px] text-muted-foreground">
                {apportAccount}
              </span>
              <span className="text-foreground">
                {apportAccount === "455000" ? "Apport via CCA" : "Apport (banque)"}
              </span>
            </div>
            <span className="font-medium text-foreground">
              C {formatCents(apportCents)}
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-2 space-y-1">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Coût total d&apos;acquisition</span>
          <span className="font-medium text-foreground">
            {formatCents(totalCashOutCents)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-muted-foreground">Équilibre</span>
          <span
            className={balanced ? "text-emerald-600" : "text-rose-600"}
          >
            D {formatCents(totalDebits)} {balanced ? "=" : "≠"} C{" "}
            {formatCents(totalCredits)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ExpenseLine({
  account,
  label,
  amount,
}: {
  account: string;
  label: string;
  amount: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2.5 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-[11px] text-muted-foreground shrink-0">
          {account}
        </span>
        <span className="text-foreground truncate">{label}</span>
      </div>
      <span className="font-medium text-foreground whitespace-nowrap">
        D {formatCents(amount)}
      </span>
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
        L&apos;écriture composée a été créée dans le journal OD avec la
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
          Voir l&apos;écriture
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
