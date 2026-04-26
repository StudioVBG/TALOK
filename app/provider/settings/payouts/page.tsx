"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Banknote,
  Shield,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";

interface ConnectAccountResponse {
  has_account: boolean;
  account: null | {
    id: string;
    stripe_account_id: string;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted: boolean;
    onboarding_completed: boolean;
    requirements_currently_due: string[];
    requirements_past_due: string[];
    requirements_disabled_reason: string | null;
    bank_account_last4: string | null;
    bank_account_bank_name: string | null;
  };
}

export default function ProviderPayoutsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ConnectAccountResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccount = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/stripe/connect");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erreur lors du chargement");
      }
      const json: ConnectAccountResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  const startOnboarding = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erreur lors de l'onboarding");
      }
      const body = await res.json();
      const url: string | undefined = body.onboarding_url || body.url;
      if (!url) {
        throw new Error("URL d'onboarding manquante");
      }
      window.location.href = url;
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-3xl py-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const account = data?.account ?? null;
  const isComplete = Boolean(
    account?.charges_enabled && account?.payouts_enabled
  );
  const hasRequirements =
    (account?.requirements_currently_due?.length ?? 0) > 0 ||
    (account?.requirements_past_due?.length ?? 0) > 0;

  return (
    <div className="container mx-auto max-w-3xl py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/provider/settings">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Paramètres
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Banknote className="h-6 w-6 text-primary" />
          Compte de paiement
        </h1>
        <p className="text-muted-foreground mt-1">
          Configurez votre compte bancaire pour recevoir vos paiements
          d'intervention via Stripe.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Statut du compte */}
      {!account ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              Aucun compte configuré
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pour recevoir vos paiements quand un propriétaire vous règle une
              intervention, vous devez créer un compte Stripe et fournir vos
              informations bancaires (KYC). Cela prend 5 à 10 minutes.
            </p>
            <ul className="text-sm space-y-2 list-disc list-inside text-muted-foreground">
              <li>Vérification d'identité (CNI ou passeport)</li>
              <li>RIB ou IBAN pour recevoir les virements</li>
              <li>Informations entreprise (SIRET) si vous êtes en société</li>
            </ul>
            <Button
              onClick={startOnboarding}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Démarrer l'onboarding
            </Button>
          </CardContent>
        </Card>
      ) : isComplete ? (
        <Card className="border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="h-5 w-5" />
              Compte actif
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-emerald-800/80 dark:text-emerald-200/80">
              Votre compte Stripe est configuré. Vous recevrez automatiquement
              les paiements d'intervention sur votre compte bancaire après
              chaque libération de fonds.
            </p>
            {account.bank_account_last4 && (
              <div className="text-sm text-foreground/80 bg-background/60 rounded-md p-3 border">
                Compte bancaire :{" "}
                <span className="font-medium">
                  {account.bank_account_bank_name || "Banque"} ••••{" "}
                  {account.bank_account_last4}
                </span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={startOnboarding}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Mettre à jour mes informations
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5" />
              Onboarding incomplet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-amber-800/80 dark:text-amber-200/80">
              Votre compte Stripe a été créé mais l'onboarding n'est pas
              terminé. Tant que ce n'est pas fait, vous ne pouvez pas recevoir
              de paiements.
            </p>

            {account.requirements_disabled_reason && (
              <div className="text-sm bg-background/60 rounded-md p-3 border border-amber-300/50">
                <strong>Raison du blocage :</strong>{" "}
                {account.requirements_disabled_reason}
              </div>
            )}

            {hasRequirements && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  Informations à fournir :
                </p>
                <ul className="text-xs space-y-1 list-disc list-inside text-amber-800/70 dark:text-amber-200/70">
                  {(account.requirements_past_due ?? []).map((r) => (
                    <li key={r} className="text-red-700 dark:text-red-300">
                      <strong>En retard :</strong> {r}
                    </li>
                  ))}
                  {(account.requirements_currently_due ?? []).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            <Button onClick={startOnboarding} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Reprendre l'onboarding
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Info commission */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Frais et commission</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Sur chaque paiement d'intervention reçu via Talok, les frais
            suivants sont déduits :
          </p>
          <ul className="space-y-1 list-disc list-inside">
            <li>
              <strong>Frais Stripe</strong> : 1.4% + 0.25 € (incompressibles)
            </li>
            <li>
              <strong>Commission Talok</strong> : 1.0% + 0.50 €
            </li>
          </ul>
          <p className="text-xs">
            Les paiements sont versés sur votre compte bancaire sous 2 à 7 jours
            ouvrés après la libération des fonds (au démarrage des travaux pour
            l'acompte, après validation pour le solde).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
