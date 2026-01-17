"use client";

import { useState, useEffect, useCallback } from "react";
import { useStripe, useElements, PaymentElement, Elements } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ShieldCheck, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dictionnaire de traduction des erreurs Stripe en français
 */
const STRIPE_ERROR_TRANSLATIONS: Record<string, string> = {
  // Erreurs de carte
  "Your card number is incomplete.": "Le numéro de carte est incomplet.",
  "Your card number is invalid.": "Le numéro de carte est invalide.",
  "Your card's expiration date is incomplete.": "La date d'expiration est incomplète.",
  "Your card's expiration date is in the past.": "La date d'expiration est dépassée.",
  "Your card's security code is incomplete.": "Le code de sécurité est incomplet.",
  "Your card's security code is invalid.": "Le code de sécurité est invalide.",
  "Your card was declined.": "Votre carte a été refusée.",
  "Your card has insufficient funds.": "Fonds insuffisants sur votre carte.",
  "Your card has expired.": "Votre carte a expiré.",
  "Your card's security code is incorrect.": "Le code de sécurité est incorrect.",
  "An error occurred while processing your card.": "Une erreur est survenue lors du traitement.",

  // Erreurs SEPA
  "Your IBAN is incomplete.": "L'IBAN est incomplet.",
  "Your IBAN is invalid.": "L'IBAN est invalide.",
  "The IBAN you entered is invalid.": "L'IBAN saisi est invalide.",
  "This account cannot be used for SEPA payments.": "Ce compte ne peut pas être utilisé pour les paiements SEPA.",

  // Erreurs génériques
  "Something went wrong.": "Une erreur est survenue.",
  "Please try again.": "Veuillez réessayer.",
  "Network error": "Erreur réseau, veuillez vérifier votre connexion.",
  "Request timed out": "La requête a expiré, veuillez réessayer.",
};

/**
 * Traduit une erreur Stripe en français
 */
function translateStripeError(message: string): string {
  // Recherche exacte
  if (STRIPE_ERROR_TRANSLATIONS[message]) {
    return STRIPE_ERROR_TRANSLATIONS[message];
  }

  // Recherche partielle
  for (const [en, fr] of Object.entries(STRIPE_ERROR_TRANSLATIONS)) {
    if (message.toLowerCase().includes(en.toLowerCase())) {
      return fr;
    }
  }

  // Message par défaut si pas de traduction
  return message;
}

interface PaymentMethodSetupProps {
  onSuccess: (paymentMethodId: string) => void;
  onCancel?: () => void;
  /** Types de paiement autorisés */
  allowedTypes?: ("card" | "sepa_debit")[];
}

/**
 * Skeleton loader pour le formulaire Stripe
 */
function PaymentFormSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Tabs skeleton */}
      <div className="flex gap-2 mb-4">
        <div className="h-10 w-24 bg-slate-200 rounded-lg" />
        <div className="h-10 w-24 bg-slate-100 rounded-lg" />
      </div>

      {/* Card number */}
      <div className="space-y-2">
        <div className="h-4 w-28 bg-slate-200 rounded" />
        <div className="h-12 bg-slate-100 rounded-xl border border-slate-200" />
      </div>

      {/* Expiry & CVC */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="h-4 w-20 bg-slate-200 rounded" />
          <div className="h-12 bg-slate-100 rounded-xl border border-slate-200" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-16 bg-slate-200 rounded" />
          <div className="h-12 bg-slate-100 rounded-xl border border-slate-200" />
        </div>
      </div>

      {/* Button skeleton */}
      <div className="h-11 bg-blue-200 rounded-lg mt-6" />
    </div>
  );
}

function SetupForm({ onSuccess, onCancel }: PaymentMethodSetupProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isElementReady, setIsElementReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/tenant/onboarding/payments?success=true`,
        },
        redirect: "if_required",
      });

      if (error) {
        toast({
          title: "Erreur de paiement",
          description: translateStripeError(error instanceof Error ? error.message : "Une erreur est survenue"),
          variant: "destructive",
        });
      } else if (setupIntent?.status === "succeeded") {
        toast({
          title: "Moyen de paiement enregistré",
          description: "Votre moyen de paiement a été vérifié et enregistré avec succès.",
        });
        if (setupIntent.payment_method) {
          onSuccess(setupIntent.payment_method as string);
        }
      }
    } catch (err: any) {
      // Gestion des erreurs réseau
      const isNetworkError = err.message?.includes("network") || err.message?.includes("fetch");
      toast({
        title: isNetworkError ? "Erreur réseau" : "Erreur",
        description: translateStripeError(err.message || "Une erreur est survenue"),
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border rounded-xl bg-slate-50/50 relative min-h-[200px]">
        {/* Skeleton pendant le chargement du PaymentElement */}
        {!isElementReady && (
          <div className="absolute inset-4">
            <PaymentFormSkeleton />
          </div>
        )}

        <div className={cn(!isElementReady && "opacity-0 h-0 overflow-hidden")}>
          <PaymentElement
            onReady={() => setIsElementReady(true)}
            options={{
              layout: "tabs",
              wallets: {
                applePay: "auto",
                googlePay: "auto",
              },
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">
          <ShieldCheck className="w-3 h-3" />
          Paiement sécurisé via Stripe
        </div>
        
        <div className="flex gap-3">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1"
            >
              Annuler
            </Button>
          )}
          
          <Button
            type="submit"
            disabled={!stripe || isProcessing}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Vérification...
              </>
            ) : (
              "Enregistrer le moyen de paiement"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function PaymentMethodSetup(props: PaymentMethodSetupProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const initSetup = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/payments/setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Impossible d'initialiser le tunnel sécurisé");
      }

      const { clientSecret } = await response.json();
      setClientSecret(clientSecret);
    } catch (err: any) {
      // Retry automatique sur erreur réseau (max 3 fois)
      const isNetworkError =
        err.message?.includes("fetch") ||
        err.message?.includes("network") ||
        err.name === "TypeError";

      if (isNetworkError && retryCount < 3) {
        setRetryCount((c) => c + 1);
        // Backoff exponentiel: 1s, 2s, 4s
        setTimeout(() => initSetup(), Math.pow(2, retryCount) * 1000);
        return;
      }

      setError(translateStripeError(err.message));
    } finally {
      setIsLoading(false);
    }
  }, [retryCount]);

  useEffect(() => {
    initSetup();
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 border rounded-xl bg-slate-50/50">
        <div className="flex flex-col items-center justify-center py-4 space-y-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">
              {retryCount > 0
                ? `Nouvelle tentative (${retryCount}/3)...`
                : "Initialisation du tunnel sécurisé..."}
            </p>
            <p className="text-xs text-slate-400 mt-1">Connexion chiffrée avec Stripe</p>
          </div>
        </div>
        <PaymentFormSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center border-2 border-dashed border-red-200 rounded-2xl bg-red-50/50">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <p className="text-red-700 font-medium mb-2">Impossible de charger le formulaire</p>
        <p className="text-sm text-red-600/80 mb-4">{error}</p>
        <Button
          onClick={() => {
            setRetryCount(0);
            initSetup();
          }}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Réessayer
        </Button>
      </div>
    );
  }

  if (!clientSecret) return null;

  return (
    <Elements
      stripe={getStripe()}
      options={{
        clientSecret,
        locale: "fr", // Interface Stripe en français
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#2563eb",
            borderRadius: "12px",
            fontFamily: "Inter, system-ui, sans-serif",
          },
          rules: {
            ".Label": {
              color: "#374151",
              fontWeight: "500",
              fontSize: "14px",
            },
            ".Input": {
              borderColor: "#e5e7eb",
              boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
            },
            ".Input:focus": {
              borderColor: "#2563eb",
              boxShadow: "0 0 0 3px rgba(37, 99, 235, 0.1)",
            },
            ".Tab": {
              borderColor: "#e5e7eb",
              borderRadius: "8px",
            },
            ".Tab--selected": {
              borderColor: "#2563eb",
              backgroundColor: "#eff6ff",
            },
            ".Error": {
              color: "#dc2626",
              fontSize: "13px",
            },
          },
        },
      }}
    >
      <SetupForm {...props} />
    </Elements>
  );
}

