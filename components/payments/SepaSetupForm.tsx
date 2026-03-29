"use client";

/**
 * Formulaire de configuration de mandat SEPA
 *
 * Utilise @stripe/react-stripe-js avec IbanElement
 * pour collecter l'IBAN et confirmer le SetupIntent.
 *
 * Usage :
 *   <SepaSetupForm leaseId={leaseId} onSuccess={handleSuccess} />
 */

import { useState, useCallback } from "react";
import {
  Elements,
  IbanElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";

interface SepaSetupFormProps {
  leaseId?: string;
  onSuccess?: (paymentMethodId: string) => void;
  onCancel?: () => void;
}

const IBAN_ELEMENT_OPTIONS = {
  supportedCountries: ["SEPA"],
  placeholderCountry: "FR",
  style: {
    base: {
      color: "#1f2937",
      fontSize: "16px",
      fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
      "::placeholder": { color: "#9ca3af" },
    },
    invalid: {
      color: "#dc2626",
      iconColor: "#dc2626",
    },
  },
};

function SepaForm({ leaseId, onSuccess, onCancel }: SepaSetupFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [accountHolderName, setAccountHolderName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!stripe || !elements) return;

      const ibanElement = elements.getElement(IbanElement);
      if (!ibanElement) return;

      if (!accountHolderName.trim()) {
        setError("Veuillez saisir le nom du titulaire du compte.");
        return;
      }

      if (!email.trim()) {
        setError("Veuillez saisir votre adresse email.");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // 1. Créer le SetupIntent côté serveur
        const res = await fetch("/api/tenant/setup-sepa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leaseId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Erreur lors de la configuration SEPA");
        }

        const { clientSecret } = await res.json();

        // 2. Confirmer le SetupIntent avec l'IBAN
        const { error: stripeError, setupIntent } =
          await stripe.confirmSepaDebitSetup(clientSecret, {
            payment_method: {
              sepa_debit: ibanElement,
              billing_details: {
                name: accountHolderName.trim(),
                email: email.trim(),
              },
            },
          });

        if (stripeError) {
          throw new Error(
            stripeError.message || "Erreur lors de la confirmation du mandat SEPA"
          );
        }

        if (
          setupIntent?.status === "succeeded" ||
          setupIntent?.status === "processing"
        ) {
          // 3. Enregistrer le moyen de paiement dans notre base
          const pmId =
            typeof setupIntent.payment_method === "string"
              ? setupIntent.payment_method
              : setupIntent.payment_method?.id;

          if (pmId) {
            await fetch("/api/tenant/payment-methods", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                stripe_payment_method_id: pmId,
                type: "sepa_debit",
                is_default: true,
              }),
            });
          }

          setSuccess(true);
          onSuccess?.(pmId || "");
        } else {
          throw new Error("Le mandat SEPA n'a pas pu être confirmé.");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Une erreur est survenue"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [stripe, elements, accountHolderName, email, leaseId, onSuccess]
  );

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="p-3 bg-green-100 rounded-full">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold">Mandat SEPA activé</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Votre mandat de prélèvement SEPA a été configuré avec succès. Vos
          prochains loyers seront prélevés automatiquement.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="sepa-holder-name">Titulaire du compte</Label>
        <Input
          id="sepa-holder-name"
          value={accountHolderName}
          onChange={(e) => setAccountHolderName(e.target.value)}
          placeholder="Jean Dupont"
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sepa-email">Email</Label>
        <Input
          id="sepa-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jean.dupont@email.com"
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label>IBAN</Label>
        <div className="border rounded-md px-3 py-3 bg-white">
          <IbanElement options={IBAN_ELEMENT_OPTIONS} />
        </div>
      </div>

      {/* Mention légale SEPA obligatoire */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        En fournissant votre IBAN et en confirmant ce paiement, vous autorisez
        Talok et Stripe, notre prestataire de paiement, à envoyer des
        instructions à votre banque pour débiter votre compte conformément à
        ces instructions. Vous bénéficiez d'un droit à remboursement par votre
        banque selon les conditions décrites dans la convention que vous avez
        passée avec elle. Toute demande de remboursement doit être présentée
        dans les 8 semaines suivant la date de débit de votre compte.
      </p>

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1"
          >
            Annuler
          </Button>
        )}
        <Button
          type="submit"
          disabled={isLoading || !stripe}
          className="flex-1 gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Configuration en cours...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              Activer le prélèvement SEPA
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export function SepaSetupForm(props: SepaSetupFormProps) {
  const stripePromise = getStripe();

  return (
    <Elements stripe={stripePromise}>
      <SepaForm {...props} />
    </Elements>
  );
}

export default SepaSetupForm;
