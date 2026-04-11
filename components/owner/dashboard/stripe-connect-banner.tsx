"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CreditCard, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Banner displayed on the owner dashboard when Stripe Connect is not configured.
 * Dismissible per session via localStorage.
 *
 * Historical note: this component used to query `profiles` and
 * `stripe_connect_accounts` directly from the browser with the anon
 * Supabase client. That triggered RLS 42P17 recursion on `profiles` in
 * production, which was visible as two of the "4x GET Supabase 500"
 * errors on the owner dashboard. We now hit a dedicated server route
 * (`/api/owner/stripe-connect-status`) that uses the service client.
 */
export function StripeConnectBanner() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("talok-stripe-banner-dismissed") === "true") {
      setDismissed(true);
      return;
    }

    let aborted = false;
    (async () => {
      try {
        const res = await fetch("/api/owner/stripe-connect-status", {
          method: "GET",
          credentials: "include",
        });
        if (!res.ok || aborted) return;
        const data = (await res.json()) as {
          configured?: boolean;
        };
        if (!aborted && data.configured === false) {
          setShow(true);
        }
      } catch (err) {
        // Cosmetic banner — never crash the dashboard on failure.
        console.error(
          "[StripeConnectBanner] Failed to load status:",
          err,
        );
      }
    })();

    return () => {
      aborted = true;
    };
  }, []);

  if (!show || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("talok-stripe-banner-dismissed", "true");
  };

  return (
    <div className="relative flex items-center gap-3 rounded-xl border border-amber-200/50 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-950/30">
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
          Encaissement en ligne non configuré
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
          Vos locataires ne pourront pas payer en ligne tant que votre compte bancaire n'est pas connecté.
        </p>
      </div>
      <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-100 dark:hover:bg-amber-900/50">
        <Link href="/owner/money?tab=banque">
          <CreditCard className="mr-1.5 h-3.5 w-3.5" />
          Configurer
        </Link>
      </Button>
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-amber-400 hover:text-amber-600 dark:hover:text-amber-200"
        aria-label="Fermer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
