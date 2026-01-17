"use client";

import { useState, useEffect, useMemo } from "react";
import { useStripe, useElements, PaymentElement, Elements } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CreditCard, CheckCircle, AlertCircle, Info, Receipt } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PaymentCheckoutProps {
  invoiceId: string;
  amount: number;
  description?: string;
  /** Si true, affiche le détail des frais au locataire */
  showFees?: boolean;
  /** Frais CB en pourcentage (ex: 2.2 pour 2.2%) - par défaut 0 car le locataire ne paie pas les frais */
  feePercentage?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * Composant d'affichage des frais de paiement pour le locataire
 */
function PaymentFeesBreakdown({ amount, feePercentage = 0 }: { amount: number; feePercentage?: number }) {
  const fees = useMemo(() => {
    const feeAmount = feePercentage > 0 ? Math.round(amount * feePercentage) / 100 : 0;
    return {
      base: amount,
      fees: feeAmount,
      total: amount + feeAmount,
    };
  }, [amount, feePercentage]);

  if (feePercentage === 0) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 mb-4 border border-emerald-200 dark:border-emerald-800">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
          <Receipt className="h-4 w-4" />
          <span className="text-sm font-medium">Aucun frais de paiement</span>
        </div>
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
          Vous payez exactement le montant de votre loyer, sans frais supplémentaires.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 mb-4 border">
      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Loyer</span>
          <span>{fees.base.toFixed(2)}€</span>
        </div>
        <div className="flex justify-between items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-foreground flex items-center gap-1 cursor-help">
                  Frais de paiement
                  <Info className="h-3 w-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Frais de traitement par carte bancaire ({feePercentage}%)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-amber-600">+{fees.fees.toFixed(2)}€</span>
        </div>
        <Separator />
        <div className="flex justify-between items-center font-semibold">
          <span>Total à payer</span>
          <span className="text-primary">{fees.total.toFixed(2)}€</span>
        </div>
      </div>
    </div>
  );
}

function CheckoutForm({ invoiceId, amount, description, showFees = true, feePercentage = 0, onSuccess, onCancel }: PaymentCheckoutProps) {
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
          description: error instanceof Error ? error.message : "Une erreur est survenue",
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
          {/* Affichage transparent des frais */}
          {showFees && paymentStatus === "idle" && (
            <PaymentFeesBreakdown amount={amount} feePercentage={feePercentage} />
          )}

          <AnimatePresence mode="wait">
            {paymentStatus === "success" ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="flex flex-col items-center py-8"
              >
                {/* Cercle animé avec checkmark */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                  className="relative"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-green-400 via-emerald-500 to-green-400 opacity-20 blur-xl"
                    style={{ width: 80, height: 80 }}
                  />
                  <div className="relative w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
                    <motion.div
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                    >
                      <CheckCircle className="h-10 w-10 text-white" strokeWidth={2.5} />
                    </motion.div>
                  </div>
                </motion.div>

                {/* Texte animé */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-center mt-6"
                >
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    Paiement réussi !
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Votre quittance sera disponible sous peu.
                  </p>
                </motion.div>

                {/* Badge de confirmation */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-4"
                >
                  <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 px-4 py-1">
                    <Receipt className="h-3.5 w-3.5 mr-1.5" />
                    Confirmation envoyée par email
                  </Badge>
                </motion.div>
              </motion.div>
            ) : paymentStatus === "error" ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-8"
              >
                {/* Icône d'erreur animée */}
                <motion.div
                  animate={{ x: [-2, 2, -2, 2, 0] }}
                  transition={{ duration: 0.4 }}
                  className="w-20 h-20 bg-gradient-to-br from-red-400 to-rose-600 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30"
                >
                  <AlertCircle className="h-10 w-10 text-white" strokeWidth={2.5} />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-center mt-6"
                >
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">Paiement échoué</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-[280px]">
                    Veuillez vérifier vos informations ou utiliser un autre moyen de paiement.
                  </p>
                </motion.div>

                {/* Bouton réessayer */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="mt-4"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaymentStatus("idle")}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    Réessayer
                  </Button>
                </motion.div>
              </motion.div>
            ) : paymentStatus === "processing" ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center py-8"
              >
                {/* Loader animé */}
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-4">Traitement en cours...</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Ne fermez pas cette fenêtre</p>
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
  useEffect(() => {
    let isMounted = true;

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
        if (isMounted) {
          setClientSecret(clientSecret);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    createIntent();

    return () => {
      isMounted = false;
    };
  }, [props.invoiceId, props.amount]);

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
        locale: "fr", // Interface Stripe en français
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#2563eb",
            borderRadius: "8px",
            fontFamily: "system-ui, -apple-system, sans-serif",
          },
          rules: {
            ".Label": {
              color: "#374151",
              fontWeight: "500",
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
              boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
            },
            ".Tab--selected": {
              borderColor: "#2563eb",
              color: "#2563eb",
            },
          },
        },
      }}
    >
      <CheckoutForm {...props} />
    </Elements>
  );
}

