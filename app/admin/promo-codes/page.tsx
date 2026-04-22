"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Tag,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Power,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { PLANS, type PlanSlug } from "@/lib/subscriptions/plans";

interface PromoCode {
  id: string;
  code: string;
  name: string | null;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  applicable_plans: string[] | null;
  eligible_territories: string[] | null;
  min_billing_cycle: "monthly" | "yearly" | null;
  first_subscription_only: boolean;
  max_uses: number | null;
  uses_count: number;
  max_uses_per_user: number;
  valid_from: string;
  valid_until: string | null;
  stripe_coupon_id: string | null;
  stripe_promotion_code_id: string | null;
  is_active: boolean;
  created_at: string;
}

const ALL_PLAN_SLUGS: PlanSlug[] = [
  "gratuit",
  "starter",
  "confort",
  "pro",
  "enterprise_s",
  "enterprise_m",
  "enterprise_l",
  "enterprise_xl",
];

const ALL_TERRITORIES = [
  { slug: "metropole", label: "Métropole" },
  { slug: "martinique", label: "Martinique" },
  { slug: "guadeloupe", label: "Guadeloupe" },
  { slug: "reunion", label: "La Réunion" },
  { slug: "guyane", label: "Guyane" },
  { slug: "mayotte", label: "Mayotte" },
] as const;

type TerritorySlug = (typeof ALL_TERRITORIES)[number]["slug"];

export default function AdminPromoCodesPage() {
  return <AdminPromoCodesPageContent />;
}

function AdminPromoCodesPageContent() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "promo-codes"],
    queryFn: async () => {
      const res = await fetch("/api/admin/promo-codes");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erreur chargement codes promo");
      }
      return res.json();
    },
  });

  const codes: PromoCode[] = data?.codes || [];

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await fetch(`/api/admin/promo-codes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: active }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erreur mise à jour");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "promo-codes"] });
    },
    onError: (e: Error) => {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/promo-codes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erreur suppression");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "promo-codes"] });
      toast({ title: "Code supprimé" });
    },
    onError: (e: Error) => {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    },
  });

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Tag className="w-6 h-6" /> Codes promo
          </h1>
          <p className="text-muted-foreground">
            Gérez les codes de réduction appliqués au checkout.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Actualiser
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nouveau code
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="flex-1">{(error as Error).message}</p>
        </div>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Codes actifs et archivés</CardTitle>
          <CardDescription>
            {isLoading
              ? "Chargement..."
              : `${codes.length} code${codes.length > 1 ? "s" : ""} au total`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isLoading && codes.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">
              Aucun code promo. Créez-en un pour offrir une remise au checkout.
            </p>
          )}
          {codes.map((c) => {
            const expired = c.valid_until && new Date(c.valid_until) < new Date();
            const exhausted = c.max_uses && c.uses_count >= c.max_uses;
            const unusable = expired || exhausted || !c.is_active;
            const planLabel =
              !c.applicable_plans || c.applicable_plans.length === 0
                ? "Tous les plans"
                : c.applicable_plans
                    .map((slug) => PLANS[slug as PlanSlug]?.name || slug)
                    .join(", ");
            const territoryLabel =
              !c.eligible_territories || c.eligible_territories.length === 0
                ? "Tous les territoires"
                : c.eligible_territories
                    .map(
                      (slug) =>
                        ALL_TERRITORIES.find((t) => t.slug === slug)?.label || slug
                    )
                    .join(", ");
            return (
              <div
                key={c.id}
                className={cn(
                  "rounded-lg border p-4 flex flex-col gap-3",
                  unusable
                    ? "border-border/50 bg-muted/30 opacity-75"
                    : "border-border bg-background"
                )}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => copyCode(c.code)}
                        className="font-mono font-bold text-lg text-foreground hover:underline inline-flex items-center gap-1"
                        title="Copier le code"
                      >
                        {c.code}
                        {copiedCode === c.code ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3 opacity-60" />
                        )}
                      </button>
                      <Badge variant="outline">
                        {c.discount_type === "percent"
                          ? `-${c.discount_value}%`
                          : `-${(c.discount_value / 100).toFixed(2)}€`}
                      </Badge>
                      {c.is_active ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                          Actif
                        </Badge>
                      ) : (
                        <Badge variant="outline">Archivé</Badge>
                      )}
                      {expired && (
                        <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                          Expiré
                        </Badge>
                      )}
                      {exhausted && (
                        <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                          Quota atteint
                        </Badge>
                      )}
                      {c.first_subscription_only && (
                        <Badge variant="outline">Nouveaux abonnés uniquement</Badge>
                      )}
                    </div>
                    {c.name && (
                      <p className="font-medium text-foreground mt-1">{c.name}</p>
                    )}
                    {c.description && (
                      <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Plans : {planLabel}
                      {c.min_billing_cycle && ` · ${c.min_billing_cycle === "yearly" ? "Annuel uniquement" : "Mensuel ou annuel"}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Territoires : {territoryLabel}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Usages : {c.uses_count}
                      {c.max_uses ? ` / ${c.max_uses}` : " (illimité)"}
                      {" · "}
                      {c.max_uses_per_user} max par utilisateur
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Valide du {new Date(c.valid_from).toLocaleDateString("fr-FR")}
                      {c.valid_until
                        ? ` au ${new Date(c.valid_until).toLocaleDateString("fr-FR")}`
                        : " (sans fin)"}
                    </p>
                    {c.stripe_promotion_code_id && (
                      <p className="text-xs text-muted-foreground/70 mt-1 font-mono">
                        Stripe : {c.stripe_promotion_code_id}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        toggleActive.mutate({ id: c.id, active: !c.is_active })
                      }
                      disabled={toggleActive.isPending}
                    >
                      <Power className="w-3 h-3 mr-1" />
                      {c.is_active ? "Désactiver" : "Activer"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (
                          confirm(
                            `Supprimer définitivement le code "${c.code}" ? L'historique des usages sera perdu.`
                          )
                        ) {
                          remove.mutate(c.id);
                        }
                      }}
                      disabled={remove.isPending}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <CreatePromoDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["admin", "promo-codes"] })}
      />
    </div>
  );
}

function CreatePromoDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("10");
  const [applicablePlans, setApplicablePlans] = useState<string[]>([]);
  const [eligibleTerritories, setEligibleTerritories] = useState<TerritorySlug[]>([]);
  const [minBillingCycle, setMinBillingCycle] = useState<"any" | "yearly">("any");
  const [firstSubOnly, setFirstSubOnly] = useState(false);
  const [maxUses, setMaxUses] = useState("");
  const [maxUsesPerUser, setMaxUsesPerUser] = useState("1");
  const [validUntil, setValidUntil] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCode("");
    setName("");
    setDescription("");
    setDiscountType("percent");
    setDiscountValue("10");
    setApplicablePlans([]);
    setEligibleTerritories([]);
    setMinBillingCycle("any");
    setFirstSubOnly(false);
    setMaxUses("");
    setMaxUsesPerUser("1");
    setValidUntil("");
  };

  const togglePlan = (slug: string) => {
    setApplicablePlans((prev) =>
      prev.includes(slug) ? prev.filter((p) => p !== slug) : [...prev, slug]
    );
  };

  const toggleTerritory = (slug: TerritorySlug) => {
    setEligibleTerritories((prev) =>
      prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug]
    );
  };

  const submit = async () => {
    const valNumber = parseFloat(discountValue);
    if (!code.trim() || !discountValue || isNaN(valNumber) || valNumber <= 0) {
      toast({ title: "Code et remise valide requis", variant: "destructive" });
      return;
    }
    if (discountType === "percent" && valNumber > 100) {
      toast({ title: "Maximum 100 % en pourcentage", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name: name || null,
          description: description || null,
          discount_type: discountType,
          // Fixed amount is stored in cents server-side
          discount_value: discountType === "fixed" ? Math.round(valNumber * 100) : valNumber,
          applicable_plans: applicablePlans,
          eligible_territories: eligibleTerritories,
          min_billing_cycle: minBillingCycle === "any" ? null : "yearly",
          first_subscription_only: firstSubOnly,
          max_uses: maxUses ? parseInt(maxUses, 10) : null,
          max_uses_per_user: parseInt(maxUsesPerUser, 10) || 1,
          valid_until: validUntil ? new Date(validUntil).toISOString() : null,
          is_active: true,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Erreur création");
      }
      toast({ title: "Code créé" });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau code promo</DialogTitle>
          <DialogDescription>
            Ce code sera applicable au moment du checkout des plans sélectionnés.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="pc-code">Code *</Label>
            <Input
              id="pc-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="BIENVENUE2026"
              className="font-mono uppercase"
              maxLength={40}
            />
          </div>
          <div>
            <Label htmlFor="pc-name">Nom (interne)</Label>
            <Input
              id="pc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Campagne newsletter avril"
              maxLength={120}
            />
          </div>
          <div>
            <Label htmlFor="pc-desc">Description (interne)</Label>
            <Textarea
              id="pc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Campagne..."
              rows={2}
              maxLength={500}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type de remise</Label>
              <Select value={discountType} onValueChange={(v) => setDiscountType(v as "percent" | "fixed")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Pourcentage (%)</SelectItem>
                  <SelectItem value="fixed">Montant fixe (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pc-val">
                Valeur {discountType === "percent" ? "(%)" : "(€)"} *
              </Label>
              <Input
                id="pc-val"
                type="number"
                step={discountType === "percent" ? "1" : "0.01"}
                min="0"
                max={discountType === "percent" ? "100" : undefined}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Plans éligibles (vide = tous)</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {ALL_PLAN_SLUGS.map((slug) => (
                <button
                  key={slug}
                  type="button"
                  onClick={() => togglePlan(slug)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition",
                    applicablePlans.includes(slug)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  )}
                >
                  {PLANS[slug].name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Territoires éligibles (vide = tous)</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {ALL_TERRITORIES.map(({ slug, label }) => (
                <button
                  key={slug}
                  type="button"
                  onClick={() => toggleTerritory(slug)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition",
                    eligibleTerritories.includes(slug)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cycle de facturation</Label>
              <Select value={minBillingCycle} onValueChange={(v) => setMinBillingCycle(v as "any" | "yearly")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Mensuel et annuel</SelectItem>
                  <SelectItem value="yearly">Annuel uniquement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pc-valid-until">Date d&apos;expiration</Label>
              <Input
                id="pc-valid-until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pc-max">Usages max (vide = illimité)</Label>
              <Input
                id="pc-max"
                type="number"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Ex: 100"
              />
            </div>
            <div>
              <Label htmlFor="pc-max-user">Max par utilisateur</Label>
              <Input
                id="pc-max-user"
                type="number"
                min="1"
                value={maxUsesPerUser}
                onChange={(e) => setMaxUsesPerUser(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="pc-first" className="cursor-pointer">
              Réservé aux nouveaux abonnés
            </Label>
            <Switch id="pc-first" checked={firstSubOnly} onCheckedChange={setFirstSubOnly} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
