"use client";

import { useState, useEffect } from "react";
import { useStripe, useElements, PaymentElement, Elements } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ShieldCheck, CreditCard, Banknote } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PaymentMethodSetupProps {
  onSuccess: (paymentMethodId: string) => void;
  onCancel?: () => void;
}

function SetupForm({ onSuccess, onCancel }: PaymentMethodSetupProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

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
          title: "Erreur",
          description: error.message,
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
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border rounded-xl bg-slate-50/50">
        <PaymentElement 
          options={{
            layout: "tabs",
            wallets: {
              applePay: "auto",
              googlePay: "auto",
            }
          }}
        />
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

  useEffect(() => {
    async function initSetup() {
      try {
        const response = await fetch("/api/payments/setup-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Impossible d'initialiser Stripe");
        }

        const { clientSecret } = await response.json();
        setClientSecret(clientSecret);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    initSetup();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500 animate-pulse">Initialisation du tunnel sécurisé...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center border-2 border-dashed border-red-100 rounded-2xl bg-red-50/30">
        <p className="text-red-600 font-medium mb-4">{error}</p>
        <Button onClick={() => window.location.reload()} variant="outline">
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
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#2563eb",
            borderRadius: "12px",
            fontFamily: "Inter, system-ui, sans-serif",
          },
        },
      }}
    >
      <SetupForm {...props} />
    </Elements>
  );
}

