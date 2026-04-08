"use client";

import { useState, useEffect } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useCoproSites } from "@/lib/hooks/use-copro-lots";
import { formatCents } from "@/lib/utils/format-cents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  CheckCircle2,
  XCircle,
  ArrowRight,
  Lock,
  FileText,
  Calculator,
  Users,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/hooks/use-auth";

// -- Types -------------------------------------------------------------------

interface ChecklistItem {
  id: string;
  label: string;
  status: "ok" | "error" | "warning";
  detail?: string;
}

interface RepartitionLine {
  lot_number: string;
  owner_name: string;
  tantiemes: number;
  tantiemes_total: number;
  charges_cents: number;
  provisions_cents: number;
  balance_cents: number;
}

interface CloseVerification {
  checklist: ChecklistItem[];
  repartition: RepartitionLine[];
  result_cents: number;
  rounding_adjustment_cents: number;
  annexes: AnnexePreview[];
}

interface AnnexePreview {
  number: number;
  title: string;
  content_summary: string;
}

const STEP_LABELS = [
  "Verification",
  "Repartition",
  "Resultat",
  "Annexes",
  "Confirmation",
] as const;

const STEP_ICONS = [
  ClipboardCheck,
  Users,
  Calculator,
  FileText,
  Lock,
] as const;

export default function CoproCloseClient() {
  return (
    <PlanGate feature="copro_module" mode="blur">
      <CoproCloseContent />
    </PlanGate>
  );
}

function CoproCloseContent() {
  const { profile } = useAuth();
  const { data: sites } = useCoproSites();
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const activeSiteId = selectedSiteId || sites?.[0]?.id || "";
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [closed, setClosed] = useState(false);

  const { data: verification, isLoading } = useQuery({
    queryKey: ["syndic", "close", "verification", activeSiteId],
    queryFn: async (): Promise<CloseVerification | null> => {
      if (!activeSiteId) return null;
      try {
        return await apiClient.get<CloseVerification>(
          `/syndic/close/verify?site_id=${activeSiteId}`
        );
      } catch {
        return null;
      }
    },
    enabled: !!profile && !!activeSiteId,
    staleTime: 60 * 1000,
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post(`/syndic/close/confirm`, {
        site_id: activeSiteId,
      });
    },
    onSuccess: () => {
      setClosed(true);
      queryClient.invalidateQueries({ queryKey: ["syndic"] });
      queryClient.invalidateQueries({ queryKey: ["copro"] });
    },
  });

  const canProceed = (currentStep: number): boolean => {
    if (!verification) return false;
    if (currentStep === 0) {
      return verification.checklist.every((item) => item.status !== "error");
    }
    return true;
  };

  const nextStep = () => {
    if (step < 4) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

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
              Cloture d&apos;exercice
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Assistant de cloture en 5 etapes
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

      {/* Stepper */}
      <div className="flex items-center justify-between px-2">
        {STEP_LABELS.map((label, idx) => {
          const Icon = STEP_ICONS[idx];
          const isActive = idx === step;
          const isCompleted = idx < step;
          const isClosedStep = closed && idx === 4;

          return (
            <div key={label} className="flex items-center">
              <button
                type="button"
                onClick={() => !closed && idx <= step && setStep(idx)}
                disabled={closed || idx > step}
                className={`flex flex-col items-center gap-1 transition-all ${
                  isActive
                    ? "text-cyan-600 dark:text-cyan-400"
                    : isCompleted || isClosedStep
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    isActive
                      ? "border-cyan-600 bg-cyan-50 dark:border-cyan-400 dark:bg-cyan-900/30"
                      : isCompleted || isClosedStep
                        ? "border-emerald-600 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-900/30"
                        : "border-border bg-muted"
                  }`}
                >
                  {isCompleted || isClosedStep ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span className="text-[10px] sm:text-xs font-medium hidden sm:block">
                  {label}
                </span>
              </button>
              {idx < 4 && (
                <div
                  className={`w-8 sm:w-16 lg:w-24 h-0.5 mx-1 transition-all ${
                    isCompleted
                      ? "bg-emerald-500"
                      : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {isLoading ? (
        <Card>
          <CardContent className="py-16">
            <div className="space-y-4 animate-pulse max-w-md mx-auto">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 bg-muted rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : closed ? (
        <CloseSuccess />
      ) : (
        <>
          {step === 0 && (
            <Step1Checklist items={verification?.checklist ?? []} />
          )}
          {step === 1 && (
            <Step2Repartition lines={verification?.repartition ?? []} />
          )}
          {step === 2 && (
            <Step3Result
              resultCents={verification?.result_cents ?? 0}
              roundingCents={verification?.rounding_adjustment_cents ?? 0}
            />
          )}
          {step === 3 && (
            <Step4Annexes annexes={verification?.annexes ?? []} />
          )}
          {step === 4 && (
            <Step5Confirm
              onConfirm={() => closeMutation.mutate()}
              isClosing={closeMutation.isPending}
            />
          )}

          {/* Navigation */}
          {!closed && (
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={step === 0}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Precedent
              </Button>
              {step < 4 && (
                <Button
                  onClick={nextStep}
                  disabled={!canProceed(step)}
                  className="bg-cyan-600 hover:bg-cyan-700"
                >
                  Suivant
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// -- Step 1: Checklist --------------------------------------------------------

function Step1Checklist({ items }: { items: ChecklistItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Verification pre-cloture
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucune donnee de verification disponible
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 py-2 px-3 rounded-lg bg-muted/50"
              >
                {item.status === "ok" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : item.status === "warning" ? (
                  <XCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {item.label}
                  </p>
                  {item.detail && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.detail}
                    </p>
                  )}
                </div>
                <Badge
                  className={`border-0 shrink-0 ${
                    item.status === "ok"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                      : item.status === "warning"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                  }`}
                >
                  {item.status === "ok"
                    ? "OK"
                    : item.status === "warning"
                      ? "Attention"
                      : "Erreur"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// -- Step 2: Repartition ------------------------------------------------------

function Step2Repartition({ lines }: { lines: RepartitionLine[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Repartition des charges par coproprietaire
        </CardTitle>
      </CardHeader>
      <CardContent>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucune donnee de repartition
          </p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:-mx-6">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                    Lot
                  </th>
                  <th className="text-left py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                    Nom
                  </th>
                  <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                    Tantiemes
                  </th>
                  <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                    Charges
                  </th>
                  <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                    Provisions
                  </th>
                  <th className="text-right py-2 px-4 sm:px-6 text-muted-foreground font-medium">
                    Solde
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr
                    key={line.lot_number}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-3 px-4 sm:px-6 font-medium text-foreground">
                      {line.lot_number}
                    </td>
                    <td className="py-3 px-4 sm:px-6 text-foreground">
                      {line.owner_name}
                    </td>
                    <td className="py-3 px-4 sm:px-6 text-right text-muted-foreground">
                      {line.tantiemes}/{line.tantiemes_total}
                    </td>
                    <td className="py-3 px-4 sm:px-6 text-right text-foreground">
                      {formatCents(line.charges_cents)}
                    </td>
                    <td className="py-3 px-4 sm:px-6 text-right text-foreground">
                      {formatCents(line.provisions_cents)}
                    </td>
                    <td
                      className={`py-3 px-4 sm:px-6 text-right font-medium ${
                        line.balance_cents > 0
                          ? "text-red-600 dark:text-red-400"
                          : line.balance_cents < 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-foreground"
                      }`}
                    >
                      {formatCents(line.balance_cents)}
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

// -- Step 3: Result -----------------------------------------------------------

function Step3Result({
  resultCents,
  roundingCents,
}: {
  resultCents: number;
  roundingCents: number;
}) {
  const adjustedResult = resultCents + roundingCents;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Verification du resultat</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center py-8 space-y-4">
          <div
            className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
              adjustedResult === 0
                ? "bg-emerald-100 dark:bg-emerald-900/40"
                : "bg-red-100 dark:bg-red-900/40"
            }`}
          >
            {adjustedResult === 0 ? (
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            ) : (
              <XCircle className="w-10 h-10 text-red-500" />
            )}
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Resultat de l&apos;exercice
            </p>
            <p
              className={`text-4xl font-bold ${
                adjustedResult === 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCents(resultCents)}
            </p>
          </div>

          {roundingCents !== 0 && (
            <div className="bg-muted/50 rounded-lg p-4 max-w-sm mx-auto">
              <p className="text-sm text-muted-foreground">
                Ajustement d&apos;arrondi automatique
              </p>
              <p className="text-lg font-semibold text-foreground mt-1">
                {formatCents(roundingCents)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Resultat apres ajustement :{" "}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCents(adjustedResult)}
                </span>
              </p>
            </div>
          )}

          {adjustedResult === 0 && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              Le resultat est equilibre. Vous pouvez continuer.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// -- Step 4: Annexes ----------------------------------------------------------

function Step4Annexes({ annexes }: { annexes: AnnexePreview[] }) {
  const defaultAnnexes: AnnexePreview[] =
    annexes.length > 0
      ? annexes
      : [
          {
            number: 1,
            title: "Etat financier",
            content_summary: "Bilan de l'exercice",
          },
          {
            number: 2,
            title: "Compte de gestion general",
            content_summary: "Charges et produits",
          },
          {
            number: 3,
            title: "Compte de gestion par categorie",
            content_summary: "Detail par poste",
          },
          {
            number: 4,
            title: "Etat des dettes et creances",
            content_summary: "Fournisseurs et coproprietaires",
          },
          {
            number: 5,
            title: "Annexe travaux article 14-2",
            content_summary: "Fonds de travaux obligatoire",
          },
        ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Apercu des 5 annexes reglementaires
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="1">
          <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
            {defaultAnnexes.map((annexe) => (
              <TabsTrigger
                key={annexe.number}
                value={String(annexe.number)}
                className="text-xs"
              >
                Annexe {annexe.number}
              </TabsTrigger>
            ))}
          </TabsList>
          {defaultAnnexes.map((annexe) => (
            <TabsContent
              key={annexe.number}
              value={String(annexe.number)}
              className="mt-4"
            >
              <div className="bg-muted/50 rounded-lg p-6 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                </div>
                <h4 className="font-semibold text-foreground">
                  Annexe {annexe.number} : {annexe.title}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {annexe.content_summary}
                </p>
                <Badge className="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400 border-0">
                  Apercu disponible apres cloture
                </Badge>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

// -- Step 5: Confirm ----------------------------------------------------------

function Step5Confirm({
  onConfirm,
  isClosing,
}: {
  onConfirm: () => void;
  isClosing: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-12 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
          <Lock className="w-7 h-7 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">
            Confirmer la cloture
          </h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Cette action est irreversible. L&apos;exercice sera cloture et les
            annexes seront generees. Les ecritures ne pourront plus etre
            modifiees.
          </p>
        </div>
        <Button
          onClick={onConfirm}
          loading={isClosing}
          size="lg"
          className="bg-cyan-600 hover:bg-cyan-700"
        >
          <Lock className="w-4 h-4 mr-2" />
          Cloturer l&apos;exercice
        </Button>
      </CardContent>
    </Card>
  );
}

// -- Close Success Animation --------------------------------------------------

function CloseSuccess() {
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowCheck(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Card>
      <CardContent className="py-16 text-center space-y-6">
        <div
          className={`w-24 h-24 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center transition-all duration-700 ${
            showCheck ? "scale-100 opacity-100" : "scale-50 opacity-0"
          }`}
        >
          <CheckCircle2
            className={`w-12 h-12 text-emerald-500 transition-all duration-500 delay-300 ${
              showCheck ? "scale-100" : "scale-0"
            }`}
          />
        </div>
        <div
          className={`transition-all duration-500 delay-500 ${
            showCheck
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
        >
          <h3 className="text-2xl font-bold text-foreground">
            Exercice cloture avec succes
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            Les 5 annexes reglementaires ont ete generees et sont disponibles
            dans les documents.
          </p>
        </div>
        <div
          className={`flex gap-3 justify-center transition-all duration-500 delay-700 ${
            showCheck
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
        >
          <Button variant="outline" asChild>
            <Link href="/syndic/accounting">
              Retour au tableau de bord
            </Link>
          </Button>
          <Button className="bg-cyan-600 hover:bg-cyan-700" asChild>
            <Link href="/syndic/accounting/budget">
              <Sparkles className="w-4 h-4 mr-2" />
              Nouveau budget
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
