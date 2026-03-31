"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CreditCard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/**
 * Banner displayed on the owner dashboard when Stripe Connect is not configured.
 * Dismissible per session via localStorage.
 */
export function StripeConnectBanner() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("talok-stripe-banner-dismissed") === "true") {
      setDismissed(true);
      return;
    }

    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

      const { data: connectAccount } = await supabase
        .from("stripe_connect_accounts")
        .select("id, charges_enabled")
        .eq("profile_id", profile.id)
        .maybeSingle();

      // Show banner if no Stripe Connect account or charges not enabled
      if (!connectAccount || !connectAccount.charges_enabled) {
        setShow(true);
      }
    });
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
