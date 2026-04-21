"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Loader2,
  Send,
  Star,
  MapPin,
  ShieldCheck,
  Info,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface Provider {
  id: string;
  profile_id: string | null;
  company_name: string;
  contact_name: string | null;
  city: string | null;
  postal_code: string | null;
  department: string | null;
  avg_rating: number | null;
  total_reviews: number | null;
  total_interventions: number | null;
  is_verified: boolean;
  trade_categories: string[] | null;
}

interface Props {
  category: string;
  categoryLabel: string;
}

export default function TenantServiceBookingClient({ category, categoryLabel }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    preferred_date: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingProviders(true);
      try {
        const res = await fetch(`/api/tenant/providers?category=${category}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          toast({
            title: "Accès refusé",
            description: data?.error || "Impossible de charger les prestataires.",
            variant: "destructive",
          });
          setProviders([]);
          return;
        }
        setProviders(data.providers || []);
        setRequiresApproval(Boolean(data.requires_owner_approval));
      } finally {
        if (!cancelled) setLoadingProviders(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category, toast]);

  const handleBook = async () => {
    if (!selectedProvider) return;
    if (!form.title || form.title.length < 3) {
      toast({
        title: "Objet requis",
        description: "Décrivez brièvement l'intervention souhaitée.",
        variant: "destructive",
      });
      return;
    }
    if (!form.description || form.description.length < 10) {
      toast({
        title: "Description trop courte",
        description: "Donnez un minimum de contexte au prestataire.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/tenant/services/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: selectedProvider.id,
          category,
          title: form.title,
          description: form.description,
          preferred_date: form.preferred_date || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Réservation impossible");
      }

      toast({
        title: data.requires_owner_approval ? "Demande envoyée" : "Réservation confirmée",
        description: data.requires_owner_approval
          ? "Votre propriétaire doit valider avant que le prestataire intervienne."
          : `Le prestataire a été notifié. Référence : ${data.ticket_reference ?? ""}`,
      });
      router.push("/tenant/requests");
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Réservation impossible",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <Link
        href="/tenant/services"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Retour aux services
      </Link>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {categoryLabel}
        </h1>
        <p className="text-muted-foreground">
          Choisissez un prestataire, puis décrivez votre besoin.
        </p>
      </div>

      {requiresApproval && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Votre propriétaire valide chaque réservation avant l'intervention.
          </p>
        </div>
      )}

      {loadingProviders ? (
        <Card>
          <CardContent className="p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : providers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              Aucun prestataire disponible pour cette catégorie dans votre zone.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map((p) => {
            const selected = selectedProvider?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProvider(p)}
                className={cn(
                  "text-left rounded-2xl border-2 p-5 transition-all bg-card",
                  selected
                    ? "border-indigo-600 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30"
                    : "border-border hover:border-indigo-200"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-foreground">
                    {p.company_name}
                  </h3>
                  {p.is_verified && (
                    <Badge variant="outline" className="gap-1 text-[10px] border-emerald-200 text-emerald-600">
                      <ShieldCheck className="h-3 w-3" />
                      Vérifié
                    </Badge>
                  )}
                </div>
                {p.contact_name && (
                  <p className="text-sm text-muted-foreground">{p.contact_name}</p>
                )}
                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                  {p.avg_rating != null && (
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {Number(p.avg_rating).toFixed(1)}
                      {p.total_reviews ? ` (${p.total_reviews})` : ""}
                    </span>
                  )}
                  {p.city && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {p.city}
                    </span>
                  )}
                  {p.total_interventions != null && p.total_interventions > 0 && (
                    <span>{p.total_interventions} interventions</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedProvider && (
        <Card className="border border-indigo-200 dark:border-indigo-900">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">
              Décrivez votre besoin à {selectedProvider.company_name}
            </h2>

            <div className="space-y-2">
              <Label htmlFor="title">Objet</Label>
              <Input
                id="title"
                placeholder="Ex : Tonte de la pelouse du jardin"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Surface approximative, accès, contraintes d'horaires..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="min-h-[120px]"
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred_date">Date souhaitée (optionnel)</Label>
              <Input
                id="preferred_date"
                type="date"
                value={form.preferred_date}
                onChange={(e) => setForm({ ...form, preferred_date: e.target.value })}
              />
            </div>

            <Button
              onClick={handleBook}
              disabled={submitting}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 font-bold"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {requiresApproval
                    ? "Envoyer pour validation"
                    : "Confirmer la réservation"}
                  <Send className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
