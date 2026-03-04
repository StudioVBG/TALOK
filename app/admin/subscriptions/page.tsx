"use client";

/**
 * Admin - Gestion des abonnements
 * Dashboard complet avec stats, liste des utilisateurs et actions
 */

import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  action: "override" | "gift" | "suspend" | "unsuspend" | null;
  onSuccess: () => void;
}

function AdminActionModal({ open, onClose, user, action, onSuccess }: ActionModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [targetPlan, setTargetPlan] = useState<PlanSlug>("confort");
  const [giftDays, setGiftDays] = useState(30);
  const [reason, setReason] = useState("");
  const [notifyUser, setNotifyUser] = useState(true);

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
      const endpoint = `/api/admin/subscriptions/${action}`;
      const body: Record<string, unknown> = {
        user_id: user.user_id,
        reason,
        notify_user: notifyUser,
      };

      if (action === "override") {
        body.target_plan = targetPlan;
      } else if (action === "gift") {
        body.days = giftDays;
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
                  {(["starter", "confort", "pro", "enterprise"] as PlanSlug[]).map((slug) => (
                    <SelectItem key={slug} value={slug}>
                      {PLANS[slug].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {action === "gift" && (
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
          )}

          <div className="space-y-2">
            <Label className="text-foreground">Raison (obligatoire)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Expliquez la raison de cette action..."
              className="bg-background border-input"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-foreground">Notifier l&apos;utilisateur par email</Label>
            <Switch checked={notifyUser} onCheckedChange={setNotifyUser} />
          </div>
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
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [distribution, setDistribution] = useState<PlanDistribution[]>([]);
  const [users, setUsers] = useState<AdminSubscriptionOverview[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Action modal
  const [selectedUser, setSelectedUser] = useState<AdminSubscriptionOverview | null>(null);
  const [actionType, setActionType] = useState<"override" | "gift" | "suspend" | "unsuspend" | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/subscriptions/stats");
      const data = await res.json();
      setStats(data.stats);
      setDistribution(data.distribution || []);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setTableLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
      });

      if (search) params.set("search", search);
      if (planFilter !== "all") params.set("plan", planFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/admin/subscriptions/list?${params}`);
      const data = await res.json();
      setUsers(data.users || []);
      setTotalUsers(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setTableLoading(false);
    }
  }, [page, search, planFilter, statusFilter]);

  useEffect(() => {
    const init = async () => {
      await fetchStats();
      await fetchUsers();
      setLoading(false);
    };
    init();
  }, [fetchStats, fetchUsers]);

  useEffect(() => {
    if (!loading) {
      fetchUsers();
    }
  }, [page, planFilter, statusFilter, loading, fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const openAction = (user: AdminSubscriptionOverview, action: "override" | "gift" | "suspend" | "unsuspend") => {
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
        <Button variant="outline" onClick={() => { fetchStats(); fetchUsers(); }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

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
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="confort">Confort</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
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
                    <SelectItem value="canceled">Annulé</SelectItem>
                    <SelectItem value="past_due">Impayé</SelectItem>
                    <SelectItem value="suspended">Suspendu</SelectItem>
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
                                user.plan_slug === "starter" && "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
                                user.plan_slug === "confort" && "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400",
                                user.plan_slug === "pro" && "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
                                user.plan_slug === "enterprise" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
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
                                user.status === "canceled" && "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
                                user.status === "past_due" && "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
                                user.status === "suspended" && "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
                              )}
                            >
                              {user.status === "active"
                                ? "Actif"
                                : user.status === "trialing"
                                ? "Essai"
                                : user.status === "canceled"
                                ? "Annulé"
                                : user.status === "past_due"
                                ? "Impayé"
                                : user.status === "suspended"
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
                                <DropdownMenuSeparator className="bg-border" />
                                {user.status === "suspended" ? (
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

