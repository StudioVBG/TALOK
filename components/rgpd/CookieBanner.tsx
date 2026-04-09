"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Cookie, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const COOKIE_CONSENT_KEY = "talok_cookie_consent";
const COOKIE_CONSENT_VERSION = "1.0";

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  version: string;
  timestamp: string;
}

function getStoredPreferences(): CookiePreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storePreferences(prefs: CookiePreferences) {
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(prefs));
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const stored = getStoredPreferences();
    if (!stored) {
      setVisible(true);
    }
  }, []);

  const savePreferences = useCallback(
    (acceptAnalytics: boolean) => {
      const prefs: CookiePreferences = {
        necessary: true,
        analytics: acceptAnalytics,
        version: COOKIE_CONSENT_VERSION,
        timestamp: new Date().toISOString(),
      };
      storePreferences(prefs);
      setVisible(false);

      // Sync with server if user is authenticated
      fetch("/api/rgpd/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consent_type: "cookies_analytics",
          granted: acceptAnalytics,
          version: COOKIE_CONSENT_VERSION,
        }),
      }).catch(() => {
        // Silently fail - consent is saved locally
      });

      // Enable/disable PostHog based on consent
      if (typeof window !== "undefined" && (window as any).posthog) {
        if (acceptAnalytics) {
          (window as any).posthog.opt_in_capturing();
        } else {
          (window as any).posthog.opt_out_capturing();
        }
      }
    },
    []
  );

  const acceptAll = () => savePreferences(true);
  const acceptNecessaryOnly = () => savePreferences(false);
  const saveCustom = () => savePreferences(analytics);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[60] p-4 sm:p-6"
      role="dialog"
      aria-label="Gestion des cookies"
    >
      <Card className="mx-auto max-w-2xl p-4 sm:p-6 shadow-xl border-border bg-card">
        <div className="flex items-start gap-3">
          <div className="shrink-0 p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <Cookie className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Nous respectons votre vie privee</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Nous utilisons des cookies essentiels au fonctionnement du site et, avec votre
              accord, des cookies d&apos;analyse pour ameliorer votre experience.{" "}
              <Link
                href="/legal/cookies"
                className="underline hover:text-foreground transition-colors"
              >
                Politique de cookies
              </Link>
            </p>

            {showDetails && (
              <div className="mt-4 space-y-3 border-t pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Cookies essentiels</p>
                    <p className="text-xs text-muted-foreground">
                      Necessaires au fonctionnement (session, securite)
                    </p>
                  </div>
                  <Switch checked disabled aria-label="Cookies essentiels (toujours actifs)" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Cookies d&apos;analyse</p>
                    <p className="text-xs text-muted-foreground">
                      Nous aident a comprendre l&apos;utilisation du site (PostHog) — 13 mois max
                    </p>
                  </div>
                  <Switch
                    checked={analytics}
                    onCheckedChange={setAnalytics}
                    aria-label="Cookies d'analyse"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-4">
              {showDetails ? (
                <Button size="sm" onClick={saveCustom}>
                  Enregistrer mes choix
                </Button>
              ) : (
                <>
                  <Button size="sm" onClick={acceptAll}>
                    Tout accepter
                  </Button>
                  <Button size="sm" variant="outline" onClick={acceptNecessaryOnly}>
                    Necessaires uniquement
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowDetails(true)}
                    className="gap-1.5"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Personnaliser
                  </Button>
                </>
              )}
            </div>
          </div>
          <button
            onClick={acceptNecessaryOnly}
            className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
            aria-label="Fermer la banniere cookies"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </Card>
    </div>
  );
}
