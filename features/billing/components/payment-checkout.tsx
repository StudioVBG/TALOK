"use client";

import { useState } from "react";
import { useStripe, useElements, PaymentElement, Elements } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CreditCard, CheckCircle, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PaymentCheckoutProps {
  invoiceId: string;
  amount: number;
  description?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function CheckoutForm({ invoiceId, amount, description, onSuccess, onCancel }: PaymentCheckoutProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setPaymentStatus("processing");

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/tenant/payments?success=true&invoice=${invoiceId}`,
        },
        redirect: "if_required",
      });

      if (error) {
        setPaymentStatus("error");
        toast({
          title: "Erreur de paiement",
          description: error.message,
          variant: "destructive",
        });
      } else if (paymentIntent?.status === "succeeded") {
        setPaymentStatus("success");
        toast({
          title: "Paiement réussi !",
          description: "Votre paiement a été traité avec succès.",
        });
        onSuccess?.();
      }
    } catch (err: any) {
      setPaymentStatus("error");
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
    <form onSubmit={handleSubmit}>
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Paiement sécurisé
          </CardTitle>
          <CardDescription>
            {description || `Montant à payer : ${amount.toFixed(2)}€`}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <AnimatePresence mode="wait">
            {paymentStatus === "success" ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-8"
              >
                <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                <p className="text-lg font-semibold text-green-600">Paiement réussi !</p>
                <p className="text-sm text-muted-foreground">Votre quittance sera disponible sous peu.</p>
              </motion.div>
            ) : paymentStatus === "error" ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-8"
              >
                <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
                <p className="text-lg font-semibold text-red-600">Paiement échoué</p>
                <p className="text-sm text-muted-foreground">Veuillez réessayer ou utiliser un autre moyen de paiement.</p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <PaymentElement 
                  options={{
                    layout: "tabs",
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
        
        <CardFooter className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1"
          >
            Annuler
          </Button>
          
          {paymentStatus !== "success" && (
            <Button
              type="submit"
              disabled={!stripe || isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Traitement...
                </>
              ) : (
                `Payer ${amount.toFixed(2)}€`
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </form>
  );
}

export function PaymentCheckout(props: PaymentCheckoutProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Créer le Payment Intent au chargement
  useState(() => {
    async function createIntent() {
      try {
        const response = await fetch("/api/payments/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceId: props.invoiceId,
            amount: props.amount,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Erreur lors de la création du paiement");
        }

        const { clientSecret } = await response.json();
        setClientSecret(clientSecret);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    createIntent();
  });

  if (isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex flex-col items-center py-8">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <p className="text-red-600">{error}</p>
          <Button onClick={props.onCancel} className="mt-4">
            Retour
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!clientSecret) {
    return null;
  }

  const stripePromise = getStripe();

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#2563eb",
            borderRadius: "8px",
          },
        },
      }}
    >
      <CheckoutForm {...props} />
    </Elements>
  );
}

