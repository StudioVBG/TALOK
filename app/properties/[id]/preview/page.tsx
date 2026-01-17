"use client";
// @ts-nocheck

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  propertiesService,
  type PropertyShareLink,
} from "@/features/properties/services/properties.service";
import type { Property } from "@/lib/types";
import { ExecutiveSummary } from "@/features/properties/components/executive-summary";
import {
  ArrowLeftCircle,
  Share2,
  ExternalLink,
  RefreshCcw,
  Trash2,
  Clipboard,
  FileDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PropertyPreviewPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "owner", "provider"]}>
      <PreviewContent />
    </ProtectedRoute>
  );
}

function PreviewContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareLinks, setShareLinks] = useState<PropertyShareLink[]>([]);
  const [shareLoading, setShareLoading] = useState(true);
  const [shareError, setShareError] = useState<string | null>(null);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);

  const headline = useMemo(() => {
    if (!property) return "Chargement…";
    const typeLabel = property.type.replace(/_/g, " ");
    return `${capitalize(typeLabel)} — ${property.adresse_complete}`;
  }, [property]);

  const subline = property ? `${property.code_postal} ${property.ville}` : "";

  const summaryData = property ?? {};

  const loadShareLinks = useCallback(
    async (id: string) => {
      try {
        setShareLoading(true);
        setShareError(null);
        const shares = await propertiesService.listShareLinks(id);
        setShareLinks(shares);
      } catch (error: unknown) {
        console.error("listShareLinks error", error);
        setShareError(error?.message ?? "Impossible de charger les liens.");
      } finally {
        setShareLoading(false);
      }
    },
    []
  );

  const fetchProperty = useCallback(
    async (id: string) => {
      try {
        setLoading(true);
        const data = await propertiesService.getPropertyById(id);
        setProperty(data);
        await loadShareLinks(id);
      } catch (error: unknown) {
        toast({
          title: "Impossible d'afficher le logement",
          description: error?.message ?? "Vérifiez que le logement existe toujours.",
          variant: "destructive",
        });
        router.push("/owner/properties");
      } finally {
        setLoading(false);
      }
    },
    [loadShareLinks, router, toast]
  );

  useEffect(() => {
    if (params.id) {
      void fetchProperty(params.id as string);
    }
  }, [params.id, fetchProperty]);



  const generateShareLink = async () => {
    if (!property) return;
    try {
      setSharing(true);
      const share = await propertiesService.createShareLink(property.id);
      setShareLinks((prev) => [share, ...prev]);
      await navigator.clipboard.writeText(share.shareUrl);
      toast({
        title: "Lien généré",
        description: "Le nouveau lien public a été copié dans le presse-papiers.",
      });
      await loadShareLinks(property.id);
    } catch (error: unknown) {
      console.error("generateShareLink error", error);
      toast({
        title: "Lien impossible à générer",
        description: error?.message ?? "Réessayez dans quelques minutes.",
        variant: "destructive",
      });
    } finally {
      setSharing(false);
    }
  };

  const activeShare = useMemo<PropertyShareLink | null>(() => {
    const now = Date.now();
    return (
      shareLinks.find(
        (share) => !share.revoked_at && new Date(share.expires_at).getTime() > now
      ) ?? null
    );
  }, [shareLinks]);

  const handleCopyActive = async () => {
    if (!activeShare) {
      toast({
        title: "Aucun lien actif",
        description: "Générez un nouveau lien ou réutilisez un lien existant.",
        variant: "destructive",
      });
      return;
    }
    try {
      setCopying(true);
      await navigator.clipboard.writeText(activeShare.shareUrl);
      toast({
        title: "Lien copié",
        description: "Partagez ce lien de lecture pour recueillir un avis.",
      });
    } catch {
      toast({
        title: "Copie impossible",
        description: "Copiez manuellement l'URL depuis la barre de navigation.",
        variant: "destructive",
      });
    } finally {
      setCopying(false);
    }
  };

  const handleRevoke = async (token: string) => {
    const reason = window.prompt("Raison de la révocation ?", "Lien obsolète");
    setRevokingToken(token);
    try {
      await propertiesService.revokeShareLink(token, reason || undefined);
      toast({
        title: "Lien révoqué",
        description: "Ce lien public n'est plus accessible.",
      });
      if (property) {
        await loadShareLinks(property.id);
      }
    } catch (error: unknown) {
      toast({
        title: "Révocation impossible",
        description: error?.message ?? "Réessayez dans quelques instants.",
        variant: "destructive",
      });
    } finally {
      setRevokingToken(null);
    }
  };

  const handleCopyLink = async (link: PropertyShareLink) => {
    try {
      await navigator.clipboard.writeText(link.shareUrl);
      toast({ title: "Lien copié", description: "Le lien est prêt à être partagé." });
    } catch {
      toast({
        title: "Copie impossible",
        description: "Copiez manuellement l'URL depuis le tableau.",
        variant: "destructive",
      });
    }
  };

  const goToDetail = () => {
    if (property) {
      router.push(`/properties/${property.id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center text-white/70">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-4 text-sm">Préparation du mode lecture…</p>
        </div>
      </div>
    );
  }

  if (!property) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/70 p-6 text-white shadow-2xl backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Mode lecture & partage</p>
            <h1 className="text-3xl font-semibold">{headline}</h1>
            <p className="text-sm text-white/70">{subline}</p>
            <p className="mt-1 text-xs text-white/50">
              Toutes les actions sont gelées : utilisez cette vue pour relire ou partager le dossier.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => router.push("/owner/properties")}
            >
              <ArrowLeftCircle className="mr-2 h-4 w-4" />
              Retour à la liste
            </Button>
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={goToDetail}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Ouvrir la fiche complète
            </Button>
            <Button
              className="bg-primary text-primary-foreground shadow-lg shadow-primary/40"
              onClick={handleCopyActive}
              disabled={copying || sharing}
            >
              <Share2 className="mr-2 h-4 w-4" />
              {copying ? "Copie..." : "Copier le lien actif"}
            </Button>
            <Button
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10"
              onClick={generateShareLink}
              disabled={sharing}
            >
              {sharing ? "Création..." : "Nouveau lien public"}
            </Button>
            <Button
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 disabled:opacity-50"
              onClick={() => activeShare && window.open(activeShare.pdfUrl, "_blank")}
              disabled={!activeShare}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={() => fetchProperty(property.id)}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Rafraîchir
            </Button>
          </div>
        </div>
        {activeShare ? (
          <p className="text-xs text-white/60">
            Lien actif jusqu’au {new Date(activeShare.expires_at).toLocaleString("fr-FR")} •{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => window.open(activeShare.shareUrl, "_blank")}
            >
              Ouvrir
            </button>
          </p>
        ) : (
          <p className="text-xs text-amber-200">Aucun lien public actif pour ce logement.</p>
        )}
      </div>

      <ExecutiveSummary
        data={summaryData}
        parkingDetails={property.parking_details}
        rooms={[]}
        actionSlot={
          <Button
            variant="outline"
            className="border-white/30 bg-transparent text-white hover:bg-white/10"
            onClick={goToDetail}
          >
            Compléter depuis la fiche logement
          </Button>
        }
      />

      <ShareLinksPanel
        shares={shareLinks}
        loading={shareLoading}
        error={shareError}
        onRefresh={() => {
          if (property) {
            void loadShareLinks(property.id);
          }
        }}
        onCopy={handleCopyLink}
        onRevoke={handleRevoke}
        revokingToken={revokingToken}
      />
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function ShareLinksPanel({
  shares,
  loading,
  error,
  onRefresh,
  onCopy,
  onRevoke,
  revokingToken,
}: {
  shares: PropertyShareLink[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onCopy: (share: PropertyShareLink) => void | Promise<void>;
  onRevoke: (token: string) => void | Promise<void>;
  revokingToken: string | null;
}) {
  const now = Date.now();
  const active = shares.filter(
    (share) => !share.revoked_at && new Date(share.expires_at).getTime() > now
  );
  const archived = shares.filter((share) => !active.includes(share));

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 text-white">
        <p className="text-sm text-white/70">Chargement des liens partagés...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-950/30 p-6 text-white">
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/80">{error}</p>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  const renderShareRow = (share: PropertyShareLink, isArchived = false) => {
    const status = share.revoked_at
      ? "Révoqué"
      : new Date(share.expires_at).getTime() < now
      ? "Expiré"
      : "Actif";
    const statusVariant =
      status === "Actif" ? "success" : status === "Expiré" ? "outline" : "destructive";

    return (
      <div
        key={share.id}
        className="grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/80 md:grid-cols-5"
      >
        <div className="md:col-span-2">
          <p className="font-medium text-white">{share.shareUrl}</p>
          <p className="text-xs text-white/60">
            Créé le {new Date(share.created_at).toLocaleString("fr-FR")}
          </p>
        </div>
        <div>
          <Badge variant={statusVariant as any}>{status}</Badge>
          <p className="text-xs text-white/60">
            Expire le {new Date(share.expires_at).toLocaleString("fr-FR")}
          </p>
        </div>
        <div>
          {share.revoked_at ? (
            <p className="text-xs text-white/60">
              Révoqué le {new Date(share.revoked_at).toLocaleString("fr-FR")}
            </p>
          ) : (
            <p className="text-xs text-white/60">Encore accessible</p>
          )}
          {share.revoke_reason && (
            <p className="text-xs text-amber-200">Motif: {share.revoke_reason}</p>
          )}
        </div>
        <div className="flex flex-wrap justify-start gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void onCopy(share);
            }}
            className="text-white"
          >
            <Clipboard className="mr-2 h-3.5 w-3.5" />
            Copier
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-white"
            onClick={() => window.open(share.pdfUrl, "_blank")}
          >
            <FileDown className="mr-2 h-3.5 w-3.5" />
            PDF
          </Button>
          {!isArchived && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                void onRevoke(share.token);
              }}
              disabled={revokingToken === share.token}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              {revokingToken === share.token ? "Révocation..." : "Révoquer"}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/70 p-6 text-white shadow-2xl backdrop-blur">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Historique des liens partagés</h2>
          <p className="text-sm text-white/70">
            Révoquez un lien à tout moment ou générez un nouveau lien sécurisé.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Actualiser
        </Button>
      </div>

      {active.length === 0 ? (
        <p className="text-sm text-white/60">Aucun lien actif pour le moment.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">Liens actifs</p>
          {active.map((share) => renderShareRow(share, false))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="space-y-3 pt-4">
          <p className="text-sm font-semibold text-white">Historique & corbeille</p>
          {archived.map((share) => renderShareRow(share, true))}
        </div>
      )}
    </div>
  );
}


