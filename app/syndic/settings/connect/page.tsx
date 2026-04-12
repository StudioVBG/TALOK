"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  Building2,
  CreditCard,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";

interface CoproSite {
  id: string;
  name: string;
  city: string;
  entity_id: string | null;
}

interface ConnectStatus {
  siteId: string;
  entityId: string | null;
  hasAccount: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  bankLast4?: string;
  loading: boolean;
}

export default function SyndicConnectSettingsPage() {
  const { toast } = useToast();
  const [sites, setSites] = useState<CoproSite[]>([]);
  const [connectStatuses, setConnectStatuses] = useState<Map<string, ConnectStatus>>(new Map());
  const [loadingSites, setLoadingSites] = useState(true);
  const [onboardingEntityId, setOnboardingEntityId] = useState<string | null>(null);

  // Charger les sites du syndic
  useEffect(() => {
    async function loadSites() {
      try {
        const res = await fetch("/api/copro/sites", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const siteList = (data.sites || data || []).map((s: any) => ({
          id: s.id,
          name: s.name || "Copropriété sans nom",
          city: s.city || "",
          entity_id: s.legal_entity_id || s.entity_id || null,
        }));
        setSites(siteList);
      } catch {
        // silently fail
      } finally {
        setLoadingSites(false);
      }
    }
    loadSites();
  }, []);

  // Charger le statut Connect pour chaque entité
  const loadConnectStatus = useCallback(
    async (site: CoproSite) => {
      const key = site.entity_id || "personal";
      setConnectStatuses((prev) => {
        const next = new Map(prev);
        next.set(key, {
          siteId: site.id,
          entityId: site.entity_id,
          hasAccount: false,
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
          loading: true,
        });
        return next;
      });

      try {
        const params = site.entity_id ? `?entityId=${site.entity_id}` : "";
        const res = await fetch(`/api/stripe/connect${params}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();

        setConnectStatuses((prev) => {
          const next = new Map(prev);
          next.set(key, {
            siteId: site.id,
            entityId: site.entity_id,
            hasAccount: data.has_account || false,
            chargesEnabled: data.account?.charges_enabled || false,
            payoutsEnabled: data.account?.payouts_enabled || false,
            detailsSubmitted: data.account?.details_submitted || false,
            bankLast4: data.account?.bank_account_last4 || undefined,
            loading: false,
          });
          return next;
        });
      } catch {
        setConnectStatuses((prev) => {
          const next = new Map(prev);
          const existing = next.get(key);
          if (existing) next.set(key, { ...existing, loading: false });
          return next;
        });
      }
    },
    []
  );

  useEffect(() => {
    if (sites.length > 0) {
      // Dédupliquer par entity_id (plusieurs sites peuvent partager une entité)
      const seen = new Set<string>();
      for (const site of sites) {
        const key = site.entity_id || "personal";
        if (!seen.has(key)) {
          seen.add(key);
          loadConnectStatus(site);
        }
      }
    }
  }, [sites, loadConnectStatus]);

  const handleOnboard = async (entityId: string | null) => {
    setOnboardingEntityId(entityId);
    try {
      const res = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId }),
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de la configuration");
      }

      const data = await res.json();
      if (data.onboarding_url) {
        window.location.href = data.onboarding_url;
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de configurer le compte",
        variant: "destructive",
      });
      setOnboardingEntityId(null);
    }
  };

  const handleDashboard = async (entityId: string | null) => {
    try {
      const res = await fetch("/api/stripe/connect/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId }),
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }

      const data = await res.json();
      if (data.dashboard_url) {
        window.open(data.dashboard_url, "_blank");
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'ouvrir le tableau de bord",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: ConnectStatus) => {
    if (status.loading) return <Skeleton className="h-5 w-20" />;
    if (!status.hasAccount) {
      return <Badge variant="outline" className="text-slate-400 border-slate-700">Non connecté</Badge>;
    }
    if (status.chargesEnabled && status.payoutsEnabled) {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Connecté</Badge>;
    }
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">En cours</Badge>;
  };

  return (
    <ProtectedRoute allowedRoles={["syndic", "admin"]}>
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Comptes bancaires</h1>
          <p className="text-muted-foreground mt-1">
            Configurez un compte bancaire par copropriété pour recevoir les appels de fonds.
          </p>
        </div>

        <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-4 mb-6 text-sm text-blue-200 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            <strong>Obligation légale :</strong> chaque copropriété doit disposer d'un compte bancaire
            séparé au nom du syndicat des copropriétaires (loi ALUR, art. 18 loi du 10 juillet 1965).
          </p>
        </div>

        {loadingSites ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Card key={i} className="bg-card border-border">
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32 mt-1" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : sites.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-8 text-center text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Aucune copropriété trouvée. Créez un site depuis l'onboarding syndic.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sites.map((site) => {
              const key = site.entity_id || "personal";
              const status = connectStatuses.get(key);
              const isOnboarding = onboardingEntityId === site.entity_id;
              const isConnected = status?.chargesEnabled && status?.payoutsEnabled;
              const isPending = status?.hasAccount && !isConnected;

              return (
                <Card key={site.id} className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{site.name}</span>
                        </CardTitle>
                        {site.city && (
                          <CardDescription className="mt-0.5">{site.city}</CardDescription>
                        )}
                      </div>
                      {status && getStatusBadge(status)}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {status?.loading ? (
                      <Skeleton className="h-9 w-full" />
                    ) : isConnected ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1.5 text-emerald-500">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Paiements activés</span>
                          </div>
                          {status?.bankLast4 && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <CreditCard className="h-3.5 w-3.5" />
                              <span>•••• {status.bankLast4}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDashboard(site.entity_id)}
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            Tableau de bord
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadConnectStatus(site)}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : isPending ? (
                      <div className="space-y-3">
                        <p className="text-sm text-amber-400">
                          La configuration du compte n'est pas terminée. Complétez l'onboarding.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => handleOnboard(site.entity_id)}
                          disabled={isOnboarding}
                          className="bg-gradient-to-r from-blue-500 to-blue-600"
                        >
                          {isOnboarding ? (
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          ) : (
                            <CreditCard className="h-4 w-4 mr-1.5" />
                          )}
                          Reprendre la configuration
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleOnboard(site.entity_id)}
                        disabled={isOnboarding}
                        className="bg-gradient-to-r from-blue-500 to-blue-600"
                      >
                        {isOnboarding ? (
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <CreditCard className="h-4 w-4 mr-1.5" />
                        )}
                        Connecter un compte bancaire
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
