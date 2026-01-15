"use client";

/**
 * Subscription Manager Dialog - Popup complet de gestion des abonnements
 * SOTA Décembre 2025
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  DollarSign,
  TrendingUp,
  CreditCard,
  Search,
  MoreVertical,
  Crown,
  Gift,
  Ban,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  BarChart3,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

// ============================================
// TYPES
// ============================================

interface SubscriptionManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSearch?: string;
}

// ============================================
// STATS CARDS (Compact version)
// ============================================

function StatsCardsCompact({ stats, loading }: { stats: SubscriptionStats | null; loading: boolean }) {
  const cards = [
    { title: "Utilisateurs", value: stats?.total_users || 0, icon: Users, color: "text-blue-400" },
    { title: "Payants", value: stats?.paying_users || 0, icon: CreditCard, color: "text-emerald-400" },
    { title: "MRR", value: formatPrice(stats?.mrr || 0), icon: DollarSign, color: "text-violet-400" },
    { title: "ARR", value: formatPrice(stats?.arr || 0), icon: TrendingUp, color: "text-amber-400" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-slate-800/50 rounded-lg p-3 border border-slate-700"
        >
          {loading ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <div className="flex items-center gap-3">
              <card.icon className={cn("w-5 h-5", card.color)} />
              <div>
                <p className="text-xs text-slate-400">{card.title}</p>
                <p className="text-lg font-bold text-white">{card.value}</p>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================
// DISTRIBUTION CHART (Compact)
// ============================================

function DistributionChartCompact({ data, loading }: { data: PlanDistribution[]; loading: boolean }) {
  const colors: Record<string, string> = {
    starter: "bg-slate-500",
    confort: "bg-violet-500",
    pro: "bg-amber-500",
    enterprise: "bg-emerald-500",
  };

  if (loading) {
    return <Skeleton className="h-24 w-full" />;
  }

  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
      <h4 className="text-sm font-medium text-slate-300 mb-3">Répartition par plan</h4>
      <div className="h-6 rounded-full overflow-hidden flex mb-3">
        {data.map((item) => (
          <div
            key={item.plan_slug}
            className={cn("transition-all", colors[item.plan_slug])}
            style={{ width: `${item.percentage}%` }}
            title={`${item.plan_name}: ${item.count} (${item.percentage}%)`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        {data.map((item) => (
          <div key={item.plan_slug} className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full", colors[item.plan_slug])} />
            <span className="text-slate-400">{item.plan_name}: {item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// ACTION MODAL (nested)
// ============================================

interface ActionModalProps {
  open: boolean;
  onClose: () => void;
  user: AdminSubscriptionOverview | null;
  action: "override" | "gift" | "suspend" | "unsuspend" | null;
  onSuccess: () => void;
}

function ActionModal({ open, onClose, user, action, onSuccess }: ActionModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [targetPlan, setTargetPlan] = useState<PlanSlug>("confort");
  const [giftDays, setGiftDays] = useState(30);
  const [reason, setReason] = useState("");
  const [notifyUser, setNotifyUser] = useState(true);

  const handleSubmit = async () => {
    if (!user || !action) return;
    if (!reason.trim()) {
      toast({ title: "Erreur", description: "Veuillez fournir une raison", variant: "destructive" });
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

      if (action === "override") body.target_plan = targetPlan;
      else if (action === "gift") body.days = giftDays;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");

      toast({ title: "Succès", description: "Action effectuée avec succès" });
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
      toast({ title: "Erreur", description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<string, string> = {
    override: "Changer le plan",
    gift: "Offrir des jours",
    suspend: "Suspendre le compte",
    unsuspend: "Réactiver le compte",
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle>{action ? titles[action] : ""}</DialogTitle>
          <DialogDescription>
            {user && `Pour: ${user.prenom} ${user.nom} (${user.email})`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {action === "override" && (
            <div className="space-y-2">
              <Label>Nouveau plan</Label>
              <Select value={targetPlan} onValueChange={(v) => setTargetPlan(v as PlanSlug)}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["starter", "confort", "pro", "enterprise"] as PlanSlug[]).map((slug) => (
                    <SelectItem key={slug} value={slug}>{PLANS[slug].name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {action === "gift" && (
            <div className="space-y-2">
              <Label>Nombre de jours</Label>
              <Input
                type="number"
                value={giftDays}
                onChange={(e) => setGiftDays(parseInt(e.target.value))}
                min={1}
                max={365}
                className="bg-slate-800 border-slate-700"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Raison (obligatoire)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Expliquez la raison..."
              className="bg-slate-800 border-slate-700"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Notifier par email</Label>
            <Switch checked={notifyUser} onCheckedChange={setNotifyUser} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !reason.trim()}
            className={action === "suspend" ? "bg-red-600 hover:bg-red-500" : "bg-violet-600 hover:bg-violet-500"}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// MAIN DIALOG
// ============================================

export function SubscriptionManagerDialog({ 
  open, 
  onOpenChange, 
  initialSearch = "" 
}: SubscriptionManagerDialogProps) {
  const { toast } = useToast();
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [distribution, setDistribution] = useState<PlanDistribution[]>([]);
  const [users, setUsers] = useState<AdminSubscriptionOverview[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState(initialSearch);
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Action modal
  const [selectedUser, setSelectedUser] = useState<AdminSubscriptionOverview | null>(null);
  const [actionType, setActionType] = useState<"override" | "gift" | "suspend" | "unsuspend" | null>(null);

  // Tab
  const [activeTab, setActiveTab] = useState<"overview" | "users">("users");

  // Update search when initialSearch changes
  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
      setActiveTab("users");
    }
  }, [initialSearch]);

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
    if (open) {
      const init = async () => {
        setLoading(true);
        await Promise.all([fetchStats(), fetchUsers()]);
        setLoading(false);
      };
      init();
    }
  }, [open, fetchStats, fetchUsers]);

  useEffect(() => {
    if (open && !loading) {
      fetchUsers();
    }
  }, [page, planFilter, statusFilter, open, loading, fetchUsers]);

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

  const handleRefresh = () => {
    fetchStats();
    fetchUsers();
    toast({ title: "Actualisé", description: "Données mises à jour" });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent hideClose className="bg-slate-900 border-slate-700 max-w-5xl max-h-[90vh] p-0 overflow-hidden" aria-describedby={undefined}>
          {/* DialogTitle requis pour l'accessibilité (screen readers) */}
          <DialogTitle className="sr-only">Gestion des abonnements</DialogTitle>
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-gradient-to-r from-violet-600/10 to-indigo-600/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Gestion des abonnements</h2>
                <p className="text-sm text-slate-400">Gérez les plans et abonnements utilisateurs</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleRefresh} className="text-slate-400 hover:text-white" aria-label="Actualiser">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-white" aria-label="Fermer">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "overview" | "users")} className="flex-1">
            <div className="px-6 pt-4">
              <TabsList className="bg-slate-800/50">
                <TabsTrigger value="overview" className="data-[state=active]:bg-violet-600">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Vue d'ensemble
                </TabsTrigger>
                <TabsTrigger value="users" className="data-[state=active]:bg-violet-600">
                  <UserCog className="w-4 h-4 mr-2" />
                  Utilisateurs
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="h-[calc(90vh-180px)]">
              {/* Overview Tab */}
              <TabsContent value="overview" className="p-6 space-y-6 mt-0">
                <StatsCardsCompact stats={stats} loading={loading} />
                <DistributionChartCompact data={distribution} loading={loading} />
                
                {/* Quick actions */}
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <h4 className="text-sm font-medium text-slate-300 mb-3">Actions rapides</h4>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setActiveTab("users")}>
                      <Users className="w-4 h-4 mr-2" />
                      Voir tous les utilisateurs
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setSearch(""); setStatusFilter("past_due"); setActiveTab("users"); }}>
                      <Ban className="w-4 h-4 mr-2" />
                      Impayés ({users.filter(u => u.status === "past_due").length})
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Users Tab */}
              <TabsContent value="users" className="p-6 space-y-4 mt-0">
                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                  <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Rechercher email, nom..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 bg-slate-800 border-slate-700"
                      />
                    </div>
                  </form>

                  <Select value={planFilter} onValueChange={setPlanFilter}>
                    <SelectTrigger className="w-[130px] bg-slate-800 border-slate-700">
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="confort">Confort</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[130px] bg-slate-800 border-slate-700">
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
                <div className="bg-slate-800/30 rounded-lg border border-slate-700 overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow className="border-slate-700 hover:bg-transparent">
                        <TableHead className="text-slate-400">Utilisateur</TableHead>
                        <TableHead className="text-slate-400">Plan</TableHead>
                        <TableHead className="text-slate-400">Statut</TableHead>
                        <TableHead className="text-slate-400">Biens</TableHead>
                        <TableHead className="text-slate-400">MRR</TableHead>
                        <TableHead className="text-right text-slate-400">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableLoading ? (
                        Array(5).fill(0).map((_, i) => (
                          <TableRow key={i} className="border-slate-700/50">
                            <TableCell colSpan={6}><Skeleton className="h-12 w-full" /></TableCell>
                          </TableRow>
                        ))
                      ) : users.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                            Aucun utilisateur trouvé
                          </TableCell>
                        </TableRow>
                      ) : (
                        users.map((user) => (
                          <TableRow key={user.user_id} className="border-slate-700/50 hover:bg-slate-800/50">
                            <TableCell>
                              <div>
                                <div className="font-medium text-white">{user.prenom} {user.nom}</div>
                                <div className="text-sm text-slate-400">{user.email}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn(
                                user.plan_slug === "starter" && "bg-slate-500/20 text-slate-400",
                                user.plan_slug === "confort" && "bg-violet-500/20 text-violet-400",
                                user.plan_slug === "pro" && "bg-amber-500/20 text-amber-400",
                                user.plan_slug === "enterprise" && "bg-emerald-500/20 text-emerald-400"
                              )}>
                                {user.plan_name}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn(
                                user.status === "active" && "bg-emerald-500/20 text-emerald-400",
                                user.status === "trialing" && "bg-violet-500/20 text-violet-400",
                                user.status === "canceled" && "bg-slate-500/20 text-slate-400",
                                user.status === "past_due" && "bg-red-500/20 text-red-400",
                                user.status === "suspended" && "bg-red-500/20 text-red-400"
                              )}>
                                {user.status === "active" ? "Actif" :
                                 user.status === "trialing" ? "Essai" :
                                 user.status === "canceled" ? "Annulé" :
                                 user.status === "past_due" ? "Impayé" :
                                 user.status === "suspended" ? "Suspendu" : user.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-slate-300">
                                {user.properties_count}/{user.max_properties === -1 ? "∞" : user.max_properties}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-white font-medium">{formatPrice(user.mrr_contribution)}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator className="bg-slate-700" />
                                  <DropdownMenuItem onClick={() => openAction(user, "override")}>
                                    <Crown className="w-4 h-4 mr-2" />Changer le plan
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openAction(user, "gift")}>
                                    <Gift className="w-4 h-4 mr-2" />Offrir des jours
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-slate-700" />
                                  {user.status === "suspended" ? (
                                    <DropdownMenuItem onClick={() => openAction(user, "unsuspend")}>
                                      <RefreshCw className="w-4 h-4 mr-2" />Réactiver
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => openAction(user, "suspend")} className="text-red-400">
                                      <Ban className="w-4 h-4 mr-2" />Suspendre
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
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-sm text-slate-400">
                      Page {page} sur {totalPages} ({totalUsers} utilisateurs)
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Nested Action Modal */}
      <ActionModal
        open={!!actionType}
        onClose={() => { setActionType(null); setSelectedUser(null); }}
        user={selectedUser}
        action={actionType}
        onSuccess={() => { fetchStats(); fetchUsers(); }}
      />
    </>
  );
}

// ============================================
// HOOK for easy usage
// ============================================

export function useSubscriptionManager() {
  const [open, setOpen] = useState(false);
  const [initialSearch, setInitialSearch] = useState("");

  const openManager = (search?: string) => {
    if (search) setInitialSearch(search);
    setOpen(true);
  };

  const closeManager = () => {
    setOpen(false);
    setInitialSearch("");
  };

  return {
    open,
    initialSearch,
    openManager,
    closeManager,
    setOpen,
  };
}

