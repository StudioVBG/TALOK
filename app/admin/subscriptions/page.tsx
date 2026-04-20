"use client";

/**
 * Admin - Gestion des abonnements
 * Dashboard complet avec stats, liste des utilisateurs et actions
 */

import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminKeys } from "@/lib/hooks/use-admin-queries";
import { motion } from "framer-motion";
import {
  PLANS,
  formatPrice,
  type PlanSlug,
} from "@/lib/subscriptions/plans";
import type {
  SubscriptionStats,
  PlanDistribution,
  AdminSubscriptionOverview,
} from "@/lib/subscriptions/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Users,
  DollarSign,
  TrendingUp,
  CreditCard,
  Search,
  Filter,
  MoreVertical,
  Crown,
  Gift,
  Ban,
  RefreshCw,
  Eye,
  Mail,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { exportCSV } from "@/lib/utils/export-csv";
import { useToast } from "@/components/ui/use-toast";

// ============================================
// STATS CARDS
// ============================================

function StatsCards({ stats, loading }: { stats: SubscriptionStats | null; loading: boolean }) {
  const cards = [
    {
      title: "Utilisateurs totaux",
      value: stats?.total_users || 0,
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-500/20",
    },
    {
      title: "Utilisateurs payants",
      value: stats?.paying_users || 0,
      icon: CreditCard,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-500/20",
    },
    {
      title: "MRR",
      value: formatPrice((stats?.mrr || 0)),
      icon: DollarSign,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-100 dark:bg-violet-500/20",
    },
    {
      title: "ARR",
      value: formatPrice((stats?.arr || 0)),
      icon: TrendingUp,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{card.title}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{card.value}</p>
                  </div>
                  <div className={cn("p-3 rounded-lg", card.bg)}>
                    <card.icon className={cn("w-5 h-5", card.color)} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

// ============================================
// DISTRIBUTION CHART
// ============================================

function DistributionChart({ data, loading }: { data: PlanDistribution[]; loading: boolean }) {
  const colors: Record<string, string> = {
    starter: "bg-slate-500",
    confort: "bg-violet-500",
    pro: "bg-amber-500",
    enterprise: "bg-emerald-500",
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-full" />
          <div className="mt-4 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">Répartition par plan</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Bar */}
        <div className="h-8 rounded-full overflow-hidden flex bg-muted">
          {data.map((item) => (
            <div
              key={item.plan_slug}
              className={cn("transition-all", colors[item.plan_slug])}
              style={{ width: `${item.percentage}%` }}
              title={`${item.plan_name}: ${item.count} (${item.percentage}%)`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 space-y-2">
          {data.map((item) => (
            <div key={item.plan_slug} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full", colors[item.plan_slug])} />
                <span className="text-foreground">{item.plan_name}</span>
              </div>
              <span className="text-muted-foreground font-medium">
                {item.count} ({item.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// ADMIN ACTION MODAL
// ============================================

interface ActionModalProps {
  open: boolean;
  onClose: () => void;
  user: AdminSubscriptionOverview | null;
  action: "override" | "gift" | "suspend" | "unsuspend" | "refund" | null;
  onSuccess: () => void;
}

function AdminActionModal({ open, onClose, user, action, onSuccess }: ActionModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [targetPlan, setTargetPlan] = useState<PlanSlug>("confort");
  const [giftDays, setGiftDays] = useState(30);
  const [giftPlan, setGiftPlan] = useState<PlanSlug | "">("");
  const [reason, setReason] = useState("");
  const [notifyUser, setNotifyUser] = useState(true);
  // Refund-specific state
  const [refundPaymentIntent, setRefundPaymentIntent] = useState("");
  const [refundAmountEuros, setRefundAmountEuros] = useState("");
  const [refundReason, setRefundReason] = useState<"" | "duplicate" | "fraudulent" | "requested_by_customer">("requested_by_customer");

  const handleSubmit = async () => {
    if (!user || !action) return;
    if (!reason.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez fournir une raison",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let endpoint = `/api/admin/subscriptions/${action}`;
      let body: Record<string, unknown> = {
        user_id: user.user_id,
        reason,
        notify_user: notifyUser,
      };

      if (action === "override") {
        body.target_plan = targetPlan;
      } else if (action === "gift") {
        body.days = giftDays;
        if (giftPlan) {
          body.plan_slug = giftPlan;
        }
      } else if (action === "refund") {
        if (!refundPaymentIntent.trim()) {
          toast({
            title: "Erreur",
            description: "ID de paiement Stripe requis (pi_... ou ch_...)",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        const pid = refundPaymentIntent.trim();
        body = {
          user_id: user.user_id,
          admin_note: reason,
          ...(pid.startsWith("ch_") ? { charge_id: pid } : { payment_intent_id: pid }),
          ...(refundAmountEuros ? { amount: Math.round(parseFloat(refundAmountEuros) * 100) } : {}),
          ...(refundReason ? { reason: refundReason } : {}),
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur");
      }

      toast({
        title: "Action effectuée",
        description: "L'action a été appliquée avec succès.",
      });

      onSuccess();
      onClose();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (action) {
      case "override":
        return "Changer le plan";
      case "gift":
        return "Offrir des jours";
      case "suspend":
        return "Suspendre le compte";
      case "unsuspend":
        return "Réactiver le compte";
      case "refund":
        return "Rembourser un paiement";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">{getTitle()}</DialogTitle>
          <DialogDescription>
            {user && (
              <>
                Pour: {user.prenom} {user.nom} ({user.email})
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {action === "override" && (
            <div className="space-y-2">
              <Label className="text-foreground">Nouveau plan</Label>
              <Select value={targetPlan} onValueChange={(v) => setTargetPlan(v as PlanSlug)}>
                <SelectTrigger className="bg-background border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["gratuit", "starter", "confort", "pro", "enterprise_s", "enterprise_m", "enterprise_l", "enterprise_xl"] as PlanSlug[]).map((slug) => (
                    <SelectItem key={slug} value={slug}>
                      {PLANS[slug].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {action === "refund" && (
            <>
              <div className="space-y-2">
                <Label className="text-foreground">
                  ID de paiement Stripe <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={refundPaymentIntent}
                  onChange={(e) => setRefundPaymentIntent(e.target.value)}
                  placeholder="pi_... ou ch_..."
                  className="bg-background border-input font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Copiez l&apos;ID depuis le dashboard Stripe ou la facture.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">
                  Montant (€) — laisser vide pour rembourser la totalité
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={refundAmountEuros}
                  onChange={(e) => setRefundAmountEuros(e.target.value)}
                  placeholder="Ex: 35.00"
                  className="bg-background border-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Motif Stripe</Label>
                <Select value={refundReason} onValueChange={(v) => setRefundReason(v as typeof refundReason)}>
                  <SelectTrigger className="bg-background border-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="requested_by_customer">Demande client</SelectItem>
                    <SelectItem value="duplicate">Paiement en double</SelectItem>
                    <SelectItem value="fraudulent">Fraude</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {action === "gift" && (
            <>
              <div className="space-y-2">
                <Label className="text-foreground">Nombre de jours</Label>
                <Input
                  type="number"
                  value={giftDays}
                  onChange={(e) => setGiftDays(parseInt(e.target.value))}
                  min={1}
                  max={365}
                  className="bg-background border-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Plan (optionnel — change le forfait pendant l&apos;essai)</Label>
                <Select value={giftPlan} onValueChange={(v) => setGiftPlan(v as PlanSlug | "")}>
                  <SelectTrigger className="bg-background border-input">
                    <SelectValue placeholder="Garder le plan actuel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Garder le plan actuel</SelectItem>
                    {(["starter", "confort", "pro", "enterprise_s", "enterprise_m", "enterprise_l", "enterprise_xl"] as PlanSlug[]).map((slug) => (
                      <SelectItem key={slug} value={slug}>
                        {PLANS[slug].name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label className="text-foreground">
              {action === "refund" ? "Note interne (obligatoire)" : "Raison (obligatoire)"}
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                action === "refund"
                  ? "Note interne pour l'audit (ex: ticket #1234, erreur facturation...)"
                  : "Expliquez la raison de cette action..."
              }
              className="bg-background border-input"
            />
          </div>

          {action !== "refund" && (
            <div className="flex items-center justify-between">
              <Label className="text-foreground">Notifier l&apos;utilisateur par email</Label>
              <Switch checked={notifyUser} onCheckedChange={setNotifyUser} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !reason.trim()}
            className={
              action === "suspend"
                ? "bg-red-600 hover:bg-red-500 text-white"
                : "bg-violet-600 hover:bg-violet-500 text-white"
            }
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Confirmer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function AdminSubscriptionsPage() {
  const { toast } = useToast();
  // Filters
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Action modal
  const [selectedUser, setSelectedUser] = useState<AdminSubscriptionOverview | null>(null);
  const [actionType, setActionType] = useState<"override" | "gift" | "suspend" | "unsuspend" | null>(null);

  // Stats query
  const { data: statsData, error: statsError, refetch: refetchStats } = useQuery({
    queryKey: adminKeys.subscriptionStats(),
    queryFn: async () => {
      const res = await fetch("/api/admin/subscriptions/stats");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erreur ${res.status} lors du chargement des statistiques`);
      }
      return res.json();
    },
    staleTime: 60_000,
    retry: 1,
  });

  const stats: SubscriptionStats | null = statsData?.stats || null;
  const distribution: PlanDistribution[] = statsData?.distribution || [];

  // Users list query
  const usersQueryParams = new URLSearchParams({
    page: page.toString(),
    per_page: perPage.toString(),
  });
  if (search) usersQueryParams.set("search", search);
  if (planFilter !== "all") usersQueryParams.set("plan", planFilter);
  if (statusFilter !== "all") usersQueryParams.set("status", statusFilter);

  const { data: usersData, isLoading: loading, isFetching: tableLoading, error: usersError, refetch: fetchUsers } = useQuery({
    queryKey: [...adminKeys.subscriptions(Object.fromEntries(usersQueryParams))],
    queryFn: async () => {
      const res = await fetch(`/api/admin/subscriptions/list?${usersQueryParams}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erreur ${res.status} lors du chargement de la liste`);
      }
      return res.json();
    },
    staleTime: 30_000,
    retry: 1,
  });

  const users: AdminSubscriptionOverview[] = usersData?.users || [];
  const totalUsers = usersData?.total || 0;

  const fetchStats = useCallback(() => refetchStats(), [refetchStats]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const openAction = (user: AdminSubscriptionOverview, action: "override" | "gift" | "suspend" | "unsuspend" | "refund") => {
    setSelectedUser(user);
    setActionType(action);
  };

  const totalPages = Math.ceil(totalUsers / perPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Abonnements</h1>
          <p className="text-muted-foreground">Gérez les abonnements de vos utilisateurs</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportCSV(
                users.map((u) => ({
                  utilisateur: `${u.prenom || ""} ${u.nom || ""}`.trim() || u.email,
                  email: u.email,
                  plan: u.plan_name,
                  statut: u.status,
                  trial_end: u.trial_end?.split("T")[0] || "",
                  periode_fin: u.current_period_end?.split("T")[0] || "",
                  stripe_subscription: u.stripe_subscription_id || "",
                  mrr: u.mrr_contribution || 0,
                })),
                "abonnements",
                {
                  utilisateur: "Utilisateur",
                  email: "Email",
                  plan: "Plan",
                  statut: "Statut",
                  trial_end: "Fin essai",
                  periode_fin: "Fin periode",
                  stripe_subscription: "Stripe Sub ID",
                  mrr: "MRR (centimes)",
                }
              )
            }
            disabled={users.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Exporter CSV
          </Button>
          <Button variant="outline" onClick={() => { fetchStats(); fetchUsers(); }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {(statsError || usersError) && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Impossible de charger les abonnements</p>
            <p className="text-red-500/80 dark:text-red-400/80 mt-1">
              {(statsError as Error | null)?.message || (usersError as Error | null)?.message}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchStats();
              fetchUsers();
            }}
          >
            Réessayer
          </Button>
        </div>
      )}

      {/* Stats */}
      <StatsCards stats={stats} loading={loading} />

      {/* Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Utilisateurs</CardTitle>
              <CardDescription>
                Liste complète des abonnements
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-4 mb-6">
                <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un email, nom..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 bg-background border-input"
                    />
                  </div>
                </form>

                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="w-[150px] bg-background border-input">
                    <SelectValue placeholder="Plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les plans</SelectItem>
                    <SelectItem value="gratuit">Gratuit</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="confort">Confort</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise_s">Enterprise S</SelectItem>
                    <SelectItem value="enterprise_m">Enterprise M</SelectItem>
                    <SelectItem value="enterprise_l">Enterprise L</SelectItem>
                    <SelectItem value="enterprise_xl">Enterprise XL</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px] bg-background border-input">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="trialing">Essai</SelectItem>
                    <SelectItem value="incomplete">En attente</SelectItem>
                    <SelectItem value="canceled">Annulé</SelectItem>
                    <SelectItem value="past_due">Impayé</SelectItem>
                    <SelectItem value="paused">Suspendu</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-muted-foreground">Utilisateur</TableHead>
                      <TableHead className="text-muted-foreground">Plan</TableHead>
                      <TableHead className="text-muted-foreground">Statut</TableHead>
                      <TableHead className="text-muted-foreground">Biens</TableHead>
                      <TableHead className="text-muted-foreground">MRR</TableHead>
                      <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableLoading ? (
                      Array(5)
                        .fill(0)
                        .map((_, i) => (
                          <TableRow key={i} className="border-border">
                            <TableCell colSpan={6}>
                              <Skeleton className="h-12 w-full" />
                            </TableCell>
                          </TableRow>
                        ))
                    ) : users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                          Aucun utilisateur trouvé
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.user_id} className="border-border">
                          <TableCell>
                            <div>
                              <div className="font-medium text-foreground">
                                {user.prenom} {user.nom}
                              </div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                user.plan_slug === "gratuit" && "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
                                user.plan_slug === "starter" && "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
                                user.plan_slug === "confort" && "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400",
                                user.plan_slug === "pro" && "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
                                user.plan_slug?.startsWith("enterprise") && "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                              )}
                            >
                              {user.plan_name}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                user.status === "active" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
                                user.status === "trialing" && "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400",
                                user.status === "incomplete" && "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
                                user.status === "canceled" && "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
                                user.status === "past_due" && "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
                                user.status === "paused" && "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
                              )}
                            >
                              {user.status === "active"
                                ? "Actif"
                                : user.status === "trialing"
                                ? "Essai"
                                : user.status === "incomplete"
                                ? "En attente"
                                : user.status === "canceled"
                                ? "Annulé"
                                : user.status === "past_due"
                                ? "Impayé"
                                : user.status === "paused"
                                ? "Suspendu"
                                : user.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-foreground">
                              {user.properties_count}/{user.max_properties === -1 ? "∞" : user.max_properties}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-foreground font-medium">
                              {formatPrice(user.mrr_contribution)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-popover border-border">
                                <DropdownMenuLabel className="text-foreground">Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-border" />
                                <DropdownMenuItem onClick={() => openAction(user, "override")} className="text-foreground cursor-pointer">
                                  <Crown className="w-4 h-4 mr-2" />
                                  Changer le plan
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openAction(user, "gift")} className="text-foreground cursor-pointer">
                                  <Gift className="w-4 h-4 mr-2" />
                                  Offrir des jours
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openAction(user, "refund")} className="text-foreground cursor-pointer">
                                  <DollarSign className="w-4 h-4 mr-2" />
                                  Rembourser un paiement
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-border" />
                                {user.status === "paused" ? (
                                  <DropdownMenuItem onClick={() => openAction(user, "unsuspend")} className="text-foreground cursor-pointer">
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Réactiver
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => openAction(user, "suspend")}
                                    className="text-red-600 dark:text-red-400 cursor-pointer"
                                  >
                                    <Ban className="w-4 h-4 mr-2" />
                                    Suspendre
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Page {page} sur {totalPages} ({totalUsers} utilisateurs)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DistributionChart data={distribution} loading={loading} />
      </div>

      {/* Action Modal */}
      <AdminActionModal
        open={!!actionType}
        onClose={() => {
          setActionType(null);
          setSelectedUser(null);
        }}
        user={selectedUser}
        action={actionType}
        onSuccess={() => {
          fetchStats();
          fetchUsers();
        }}
      />
    </div>
  );
}

