"use client";

import { useMemo } from "react";
import { CreditCard, Building2, Banknote, Clock, Check, X, Zap, Shield, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface PaymentMethod {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  fees: string;
  feeDetails?: string;
  processingTime: string;
  automatic: boolean;
  recommended?: boolean;
  available: boolean;
  pros: string[];
  cons: string[];
}

interface PaymentMethodComparisonProps {
  /** Montant du loyer en euros */
  rentAmount?: number;
  /** ID de la méthode actuellement sélectionnée */
  selectedMethod?: string;
  /** Callback lors de la sélection d'une méthode */
  onSelect?: (methodId: string) => void;
  /** Mode compact (sans pros/cons) */
  compact?: boolean;
  /** Afficher uniquement les méthodes disponibles */
  showOnlyAvailable?: boolean;
  /** Plan de l'utilisateur (affecte les frais) */
  planSlug?: string;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "sepa_sdd",
    name: "Prélèvement SEPA",
    icon: <Building2 className="w-5 h-5" />,
    description: "Prélèvement automatique sur votre compte bancaire",
    fees: "0,50€",
    feeDetails: "Frais fixes par transaction",
    processingTime: "3-5 jours",
    automatic: true,
    recommended: true,
    available: true,
    pros: [
      "Frais les plus bas",
      "Paiement automatique",
      "Pas besoin de carte",
    ],
    cons: [
      "Délai de traitement",
      "Configuration initiale",
    ],
  },
  {
    id: "carte_wallet",
    name: "Carte Bancaire",
    icon: <CreditCard className="w-5 h-5" />,
    description: "CB, Visa, Mastercard, Apple Pay, Google Pay",
    fees: "2,2%",
    feeDetails: "Exemple: 17,60€ pour un loyer de 800€",
    processingTime: "Instantané",
    automatic: true,
    recommended: false,
    available: true,
    pros: [
      "Paiement instantané",
      "Apple Pay / Google Pay",
      "Facilité d'utilisation",
    ],
    cons: [
      "Frais plus élevés",
      "Limite de carte possible",
    ],
  },
  {
    id: "virement_sct",
    name: "Virement Bancaire",
    icon: <Banknote className="w-5 h-5" />,
    description: "Virement manuel depuis votre banque",
    fees: "Gratuit",
    feeDetails: "Aucun frais de transaction",
    processingTime: "1-2 jours",
    automatic: false,
    available: true,
    pros: [
      "Aucun frais",
      "Depuis n'importe quelle banque",
    ],
    cons: [
      "Action manuelle chaque mois",
      "Risque d'oubli",
    ],
  },
  {
    id: "virement_inst",
    name: "Virement Instantané",
    icon: <Zap className="w-5 h-5" />,
    description: "Virement immédiat (banques compatibles)",
    fees: "Variable",
    feeDetails: "Selon votre banque (souvent gratuit)",
    processingTime: "10 secondes",
    automatic: false,
    available: true,
    pros: [
      "Ultra rapide",
      "Souvent gratuit",
    ],
    cons: [
      "Pas toutes les banques",
      "Action manuelle",
    ],
  },
];

/**
 * Composant de comparaison des moyens de paiement
 * Aide l'utilisateur à choisir le mode de paiement le plus adapté
 */
export function PaymentMethodComparison({
  rentAmount,
  selectedMethod,
  onSelect,
  compact = false,
  showOnlyAvailable = true,
  planSlug,
}: PaymentMethodComparisonProps) {
  const methods = useMemo(() => {
    let filtered = PAYMENT_METHODS;
    if (showOnlyAvailable) {
      filtered = filtered.filter((m) => m.available);
    }
    return filtered;
  }, [showOnlyAvailable]);

  // Calculer les frais réels si un montant est fourni
  const calculateFees = (method: PaymentMethod) => {
    if (!rentAmount) return null;

    switch (method.id) {
      case "sepa_sdd":
        return 0.5;
      case "carte_wallet":
        return Math.round(rentAmount * 0.022 * 100) / 100;
      default:
        return 0;
    }
  };

  if (compact) {
    return (
      <div className="grid gap-2">
        {methods.map((method) => {
          const fees = calculateFees(method);
          const isSelected = selectedMethod === method.id;

          return (
            <button
              key={method.id}
              onClick={() => onSelect?.(method.id)}
              disabled={!method.available}
              className={cn(
                "flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-transparent bg-slate-50 hover:bg-slate-100",
                !method.available && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    isSelected ? "bg-primary/10 text-primary" : "bg-slate-200 text-slate-600"
                  )}
                >
                  {method.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{method.name}</span>
                    {method.recommended && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Recommandé
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {method.automatic ? "Automatique" : "Manuel"} · {method.processingTime}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={cn(
                    "font-bold text-sm",
                    method.fees === "Gratuit" ? "text-emerald-600" : "text-slate-700"
                  )}
                >
                  {method.fees}
                </span>
                {fees !== null && fees > 0 && (
                  <p className="text-[10px] text-muted-foreground">{fees.toFixed(2)}€/mois</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Info className="w-4 h-4" />
          Comparer les moyens de paiement
        </div>

        {/* Cards Grid */}
        <div className="grid gap-3 md:grid-cols-2">
          {methods.map((method) => {
            const fees = calculateFees(method);
            const isSelected = selectedMethod === method.id;

            return (
              <div
                key={method.id}
                onClick={() => method.available && onSelect?.(method.id)}
                className={cn(
                  "relative p-4 rounded-2xl border-2 transition-all cursor-pointer",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-slate-200 hover:border-slate-300 bg-white",
                  !method.available && "opacity-50 cursor-not-allowed"
                )}
              >
                {/* Recommended Badge */}
                {method.recommended && (
                  <div className="absolute -top-2 right-4">
                    <Badge className="bg-emerald-500 text-white text-[10px]">
                      Meilleur choix
                    </Badge>
                  </div>
                )}

                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        isSelected ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {method.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{method.name}</h3>
                      <p className="text-xs text-muted-foreground">{method.description}</p>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 rounded-lg bg-slate-50">
                        <p
                          className={cn(
                            "font-bold text-sm",
                            method.fees === "Gratuit" ? "text-emerald-600" : "text-slate-800"
                          )}
                        >
                          {method.fees}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Frais</p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{method.feeDetails}</p>
                    </TooltipContent>
                  </Tooltip>

                  <div className="p-2 rounded-lg bg-slate-50">
                    <p className="font-bold text-sm text-slate-800">{method.processingTime}</p>
                    <p className="text-[10px] text-muted-foreground">Délai</p>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50">
                    <p className="font-bold text-sm">
                      {method.automatic ? (
                        <span className="text-blue-600">Auto</span>
                      ) : (
                        <span className="text-amber-600">Manuel</span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Mode</p>
                  </div>
                </div>

                {/* Real fees calculation */}
                {fees !== null && rentAmount && (
                  <div className="text-center py-2 px-3 rounded-lg bg-slate-50 mb-3">
                    <p className="text-xs text-muted-foreground">
                      Pour un loyer de <strong>{rentAmount}€</strong>:{" "}
                      <span
                        className={cn(
                          "font-bold",
                          fees === 0 ? "text-emerald-600" : "text-slate-800"
                        )}
                      >
                        {fees === 0 ? "0€ de frais" : `${fees.toFixed(2)}€/mois de frais`}
                      </span>
                    </p>
                  </div>
                )}

                {/* Pros & Cons */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    {method.pros.slice(0, 2).map((pro, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-emerald-700">
                        <Check className="w-3 h-3 flex-shrink-0" />
                        <span>{pro}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    {method.cons.slice(0, 2).map((con, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-slate-500">
                        <X className="w-3 h-3 flex-shrink-0" />
                        <span>{con}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-4 right-4">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer tip */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
          <Shield className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            <strong>Conseil:</strong> Le prélèvement SEPA est le mode le plus économique et évite
            les oublis. Les frais sont déduits du montant reçu par le propriétaire, vous payez
            toujours le même loyer.
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default PaymentMethodComparison;
