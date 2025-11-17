"use client";

import { useEffect, useState } from "react";
import { ExecutiveSummary } from "@/features/properties/components/executive-summary";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { RefreshCcw } from "lucide-react";

interface SharePayload {
  property: Record<string, any>;
  share: {
    expiresAt: string;
    token: string;
    shareUrl: string;
    pdfUrl?: string;
  };
}

export default function PropertySharePage({ params }: { params: { token: string } }) {
  return <PropertyShareContent token={params.token} />;
}

function PropertyShareContent({ token }: { token: string }) {
  const [data, setData] = useState<SharePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShare = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/properties/share/${token}`, { cache: "no-store" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Impossible de récupérer le logement.");
      }
      const payload = (await res.json()) as SharePayload;
      setData(payload);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchShare();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center text-white/70">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
        <p className="mt-4 text-sm">Chargement du dossier...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-center text-white">
        <p className="text-lg font-semibold">Lien indisponible</p>
        <p className="mt-2 text-sm text-white/70">{error}</p>
        <Button className="mt-6" variant="outline" onClick={fetchShare}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Réessayer
        </Button>
      </div>
    );
  }

  const expiryLabel = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(data.share.expiresAt));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black px-4 py-10 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Mode lecture sécurisé</p>
              <h1 className="mt-2 text-3xl font-semibold">Aperçu du logement</h1>
              <p className="text-sm text-white/70">
                Lien valide jusqu’au <span className="font-medium text-white">{expiryLabel}</span>
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm text-white/70">
                <Link href="/" className="underline underline-offset-4">
                  Plateforme GL Home
                </Link>
                <span>•</span>
                <Button variant="ghost" className="px-0 text-white hover:bg-transparent" onClick={fetchShare}>
                  <RefreshCcw className="mr-1 h-4 w-4" />
                  Actualiser les données
                </Button>
              </div>
            </div>
            {data.share.pdfUrl && (
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => window.open(data.share.pdfUrl, "_blank")}
              >
                Télécharger le PDF
              </Button>
            )}
          </div>
        </div>
        <ExecutiveSummary data={data.property} parkingDetails={data.property.parking_details} rooms={[]} />
      </div>
    </div>
  );
}


