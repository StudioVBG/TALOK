"use client";
// @ts-nocheck — TODO: remove once database.types.ts is regenerated

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PlanGate } from "@/components/subscription/plan-gate";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  Landmark,
  PiggyBank,
  Shield,
  Search,
  ArrowLeft,
  ArrowRight,
  Check,
  FileSpreadsheet,
  Loader2,
  Building2,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────

type AccountType = "exploitation" | "epargne" | "depot_garantie";

interface Institution {
  id: string;
  name: string;
  bic: string;
  logo: string;
  countries: string[];
}

const ACCOUNT_TYPES: {
  value: AccountType;
  label: string;
  number: string;
  icon: typeof Landmark;
  borderColor: string;
  bgColor: string;
  textColor: string;
}[] = [
  {
    value: "exploitation",
    label: "Compte exploitation",
    number: "512100",
    icon: Landmark,
    borderColor: "border-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    textColor: "text-green-600 dark:text-green-400",
  },
  {
    value: "epargne",
    label: "Compte epargne / fonds travaux",
    number: "512200",
    icon: PiggyBank,
    borderColor: "border-violet-500",
    bgColor: "bg-violet-50 dark:bg-violet-950/30",
    textColor: "text-violet-600 dark:text-violet-400",
  },
  {
    value: "depot_garantie",
    label: "Depot de garantie",
    number: "512300",
    icon: Shield,
    borderColor: "border-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    textColor: "text-orange-600 dark:text-orange-400",
  },
];

// ── Wrapper ─────────────────────────────────────────────────────────

export default function ConnectBankClient() {
  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <ConnectBankFlow />
    </PlanGate>
  );
}

// ── Flow ────────────────────────────────────────────────────────────

function ConnectBankFlow() {
  const router = useRouter();
  const { profile } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [isManual, setIsManual] = useState(false);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [search, setSearch] = useState("");
  const [loadingInst, setLoadingInst] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [manualIban, setManualIban] = useState("");
  const [manualBic, setManualBic] = useState("");

  // Fetch institutions on step 2
  useEffect(() => {
    if (step === 2 && institutions.length === 0) {
      setLoadingInst(true);
      apiClient
        .get<{ data: { institutions: Institution[] } }>("/accounting/bank/institutions")
        .then((res) => {
          setInstitutions(res?.data?.institutions ?? []);
        })
        .catch(() => {
          // Fallback: empty list
        })
        .finally(() => setLoadingInst(false));
    }
  }, [step, institutions.length]);

  const filteredInstitutions = institutions.filter((inst) =>
    inst.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectType = (type: AccountType) => {
    setAccountType(type);
    setStep(2);
  };

  const handleSelectBank = (inst: Institution) => {
    setSelectedInstitution(inst);
    setIsManual(false);
    setStep(3);
  };

  const handleSelectManual = () => {
    setSelectedInstitution(null);
    setIsManual(true);
    setStep(3);
  };

  const handleSubmit = useCallback(async () => {
    if (!accountType || !(profile as any).default_entity_id) return;
    setSubmitting(true);
    try {
      if (isManual) {
        await apiClient.post("/accounting/bank/connections", {
          entityId: (profile as any).default_entity_id,
          provider: "manual",
          accountType,
          iban: manualIban.replace(/\s/g, ""),
          bic: manualBic.replace(/\s/g, ""),
        });
        router.push("/owner/accounting/bank");
      } else if (selectedInstitution) {
        const res = await apiClient.post<{ data: { authLink: string } }>(
          "/accounting/bank/connections",
          {
            entityId: (profile as any).default_entity_id,
            provider: "nordigen",
            institutionId: selectedInstitution.id,
            accountType,
          }
        );
        const authLink = res?.data?.authLink;
        if (authLink) {
          window.location.href = authLink;
        } else {
          router.push("/owner/accounting/bank");
        }
      }
    } catch {
      // Error handling via apiClient
    } finally {
      setSubmitting(false);
    }
  }, [accountType, isManual, manualIban, manualBic, selectedInstitution, profile, router]);

  const selectedTypeConfig = ACCOUNT_TYPES.find((t) => t.value === accountType);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (step === 1) router.push("/owner/accounting/bank");
            else setStep((s) => (s - 1) as 1 | 2 | 3);
          }}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
          Connecter un compte
        </h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`w-full h-1.5 rounded-full transition-colors ${
                s <= step ? "bg-[#2563EB]" : "bg-muted"
              }`}
            />
          </div>
        ))}
      </div>

      {/* Step 1: Account type */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Quel type de compte souhaitez-vous connecter ?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {ACCOUNT_TYPES.map((at) => {
              const Icon = at.icon;
              return (
                <button
                  key={at.value}
                  onClick={() => handleSelectType(at.value)}
                  className={`bg-card rounded-xl border-2 border-l-4 ${at.borderColor} border-border p-5 text-left hover:shadow-md transition-shadow space-y-3`}
                >
                  <div className={`w-10 h-10 rounded-lg ${at.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${at.textColor}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{at.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">Compte {at.number}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Bank selection */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selectionnez votre etablissement bancaire
          </p>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher une banque..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          {loadingInst ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto">
                {filteredInstitutions.map((inst) => (
                  <button
                    key={inst.id}
                    onClick={() => handleSelectBank(inst)}
                    className="bg-card rounded-xl border border-border p-4 text-center hover:shadow-md hover:border-[#2563EB] transition-all space-y-2"
                  >
                    {inst.logo ? (
                      <img
                        src={inst.logo}
                        alt={inst.name}
                        className="w-10 h-10 mx-auto rounded-lg object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <Building2 className="w-10 h-10 mx-auto text-muted-foreground" />
                    )}
                    <p className="text-xs font-medium text-foreground line-clamp-2">
                      {inst.name}
                    </p>
                  </button>
                ))}
              </div>

              {/* Manual import option */}
              <button
                onClick={handleSelectManual}
                className="w-full bg-card rounded-xl border border-dashed border-border p-4 flex items-center gap-3 hover:border-[#2563EB] transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">Import manuel (CSV)</p>
                  <p className="text-xs text-muted-foreground">
                    Saisissez les coordonnees de votre compte manuellement
                  </p>
                </div>
              </button>
            </>
          )}
        </div>
      )}

      {/* Step 3: Confirmation */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Recapitulatif</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {selectedTypeConfig && (
                  <>
                    <selectedTypeConfig.icon className={`w-5 h-5 ${selectedTypeConfig.textColor}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {selectedTypeConfig.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Compte {selectedTypeConfig.number}
                      </p>
                    </div>
                  </>
                )}
              </div>
              {!isManual && selectedInstitution && (
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  {selectedInstitution.logo ? (
                    <img
                      src={selectedInstitution.logo}
                      alt={selectedInstitution.name}
                      className="w-8 h-8 rounded-lg object-contain"
                    />
                  ) : (
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                  )}
                  <p className="text-sm font-medium text-foreground">
                    {selectedInstitution.name}
                  </p>
                </div>
              )}
              {isManual && (
                <div className="pt-2 border-t border-border flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Import manuel</p>
                </div>
              )}
            </div>
          </div>

          {/* Manual IBAN/BIC form */}
          {isManual && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">
                Coordonnees bancaires
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    IBAN
                  </label>
                  <input
                    type="text"
                    placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
                    value={manualIban}
                    onChange={(e) => setManualIban(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    BIC
                  </label>
                  <input
                    type="text"
                    placeholder="BNPAFRPP"
                    value={manualBic}
                    onChange={(e) => setManualBic(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || (isManual && !manualIban)}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1B2A6B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isManual ? (
              <>
                <Check className="w-4 h-4" />
                Enregistrer le compte
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                Se connecter a la banque
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
