"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageTransition } from "@/components/ui/page-transition";
import { ConsentManager } from "@/components/rgpd/ConsentManager";
import { DataExportButton } from "@/components/rgpd/DataExportButton";
import { DeleteAccountModal } from "@/components/rgpd/DeleteAccountModal";
import { Skeleton } from "@/components/ui/skeleton";

interface ConsentItem {
  type: string;
  label: string;
  description: string;
  required: boolean;
  granted: boolean;
  version: string;
  grantedAt: string | null;
}

function buildConsentsFromData(data: any): ConsentItem[] {
  const c = data?.consents;
  return [
    {
      type: "cgu",
      label: "Conditions generales d'utilisation",
      description: "Necessaires pour utiliser Talok",
      required: true,
      granted: c?.terms_accepted ?? true,
      version: c?.terms_version ?? "1.0",
      grantedAt: c?.terms_accepted_at ?? null,
    },
    {
      type: "privacy_policy",
      label: "Politique de confidentialite",
      description: "Traitement de vos donnees personnelles",
      required: true,
      granted: c?.privacy_accepted ?? true,
      version: c?.privacy_version ?? "1.0",
      grantedAt: c?.privacy_accepted_at ?? null,
    },
    {
      type: "cookies_analytics",
      label: "Cookies d'analyse",
      description: "Nous aident a ameliorer le service (PostHog) — conservation 13 mois",
      required: false,
      granted: c?.cookies_analytics ?? false,
      version: "1.0",
      grantedAt: c?.updated_at ?? null,
    },
    {
      type: "marketing",
      label: "Communications marketing",
      description: "Recevoir des informations sur les nouveautes et offres Talok",
      required: false,
      granted: c?.cookies_ads ?? false,
      version: "1.0",
      grantedAt: c?.updated_at ?? null,
    },
  ];
}

export default function PrivacySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [consents, setConsents] = useState<ConsentItem[]>([]);
  const [lastExportDate, setLastExportDate] = useState<string | null>(null);

  const loadConsents = async () => {
    try {
      const res = await fetch("/api/rgpd/consent");
      if (res.ok) {
        const data = await res.json();
        setConsents(buildConsentsFromData(data));
        setLastExportDate(data.last_export_date);
      }
    } catch {
      // Use defaults
      setConsents(buildConsentsFromData(null));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConsents();
  }, []);

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/owner/settings">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-6 w-6 text-blue-600" />
              Vie privee & donnees personnelles
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Gerez vos consentements, exportez ou supprimez vos donnees (RGPD)
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-36 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Consent manager */}
            <ConsentManager consents={consents} onUpdate={loadConsents} />

            {/* Data export */}
            <DataExportButton lastExportDate={lastExportDate} />

            {/* Delete account */}
            <DeleteAccountModal />

            {/* Legal links & DPO */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Informations legales</CardTitle>
                    <CardDescription>
                      Documents juridiques et contact DPO
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/legal/privacy"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Politique de confidentialite
                  </Link>
                  <Link
                    href="/legal/cookies"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Politique de cookies
                  </Link>
                  <Link
                    href="/legal/cgu"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Conditions generales d&apos;utilisation
                  </Link>
                  <a
                    href="mailto:dpo@talok.fr"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Contacter le DPO (dpo@talok.fr)
                  </a>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Conformement au RGPD, vous disposez d&apos;un droit d&apos;acces, de rectification,
                  de portabilite et de suppression de vos donnees. Pour toute demande, contactez
                  notre Delegue a la Protection des Donnees a{" "}
                  <a href="mailto:dpo@talok.fr" className="underline">
                    dpo@talok.fr
                  </a>
                  .
                </p>
              </CardContent>
            </Card>

            {/* Retention periods */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Durees de conservation</CardTitle>
                <CardDescription>
                  Combien de temps vos donnees sont conservees
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Compte actif</span>
                    <span>Tant que le compte est actif</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Compte supprime</span>
                    <span>Anonymise immediatement</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Documents de bail</span>
                    <span>5 ans apres fin de bail</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Factures & quittances</span>
                    <span>10 ans (obligation comptable)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Candidatures refusees</span>
                    <span>6 mois</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Logs de connexion</span>
                    <span>1 an</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Cookies d&apos;analyse</span>
                    <span>13 mois (CNIL)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
