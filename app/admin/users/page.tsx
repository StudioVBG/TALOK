"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  useAdminUsers,
  useSuspendUser,
} from "@/lib/hooks/use-admin-queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  RefreshCw,
  MoreVertical,
  Eye,
  Ban,
  UserCheck,
  Users,
  ChevronLeft,
  ChevronRight,
  Shield,
  Loader2,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/helpers/format";
import {
  getRoleColor,
  getRoleLabel,
  ROLE_OPTIONS,
} from "@/lib/helpers/role-labels";
import { useToast } from "@/components/ui/use-toast";

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Ban/suspend dialog
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banTarget, setBanTarget] = useState<{
    userId: string;
    name: string;
    suspended: boolean;
  } | null>(null);
  const [banReason, setBanReason] = useState("");

  const { data, isLoading, isFetching, refetch } = useAdminUsers({
    search: debouncedSearch,
    role: roleFilter,
    status: statusFilter,
    page,
    per_page: perPage,
  });

  const suspendMutation = useSuspendUser();

  const users = data?.users || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / perPage);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(search);
    setPage(1);
  };

  const handleBan = async () => {
    if (!banTarget) return;
    try {
      await suspendMutation.mutateAsync({
        userId: banTarget.userId,
        suspended: !banTarget.suspended,
        reason: banReason,
      });
      toast({
        title: banTarget.suspended ? "Compte reactve" : "Compte suspendu",
        description: `Le compte de ${banTarget.name} a ete ${banTarget.suspended ? "reactive" : "suspendu"}.`,
      });
      setBanDialogOpen(false);
      setBanTarget(null);
      setBanReason("");
      refetch();
    } catch {
      toast({
        title: "Erreur",
        description: "L'action a echoue",
        variant: "destructive",
      });
    }
  };

  const handleImpersonate = async (userId: string) => {
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_user_id: userId }),
      });
      if (!res.ok) throw new Error("Echec");
      toast({
        title: "Impersonation activee",
        description: "Vous etes connecte en tant que cet utilisateur.",
      });
      window.location.href = "/dashboard";
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'impersonifier cet utilisateur",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold">Utilisateurs</h1>
          <p className="text-muted-foreground">
            Gestion des comptes utilisateurs de la plateforme
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </motion.div>

      {/* Stats rapides — statut + total */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 p-4 text-center">
          <Users className="mx-auto mb-2 h-5 w-5 text-blue-600" />
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-4 text-center">
          <UserCheck className="mx-auto mb-2 h-5 w-5 text-emerald-600" />
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {users.filter((u) => !u.suspended).length}
          </p>
          <p className="text-xs text-muted-foreground">Actifs (page)</p>
        </div>
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 p-4 text-center">
          <Ban className="mx-auto mb-2 h-5 w-5 text-red-600" />
          <p className="text-2xl font-bold text-red-700 dark:text-red-400">
            {users.filter((u) => u.suspended).length}
          </p>
          <p className="text-xs text-muted-foreground">Suspendus (page)</p>
        </div>
      </div>

      {/* Répartition par type de compte (sur la page courante) */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { key: "owner", label: "Propriétaires", icon: Users, color: "blue" },
          { key: "tenant", label: "Locataires", icon: Users, color: "emerald" },
          { key: "provider", label: "Prestataires", icon: Users, color: "amber" },
          { key: "agency", label: "Agences", icon: Users, color: "indigo" },
          { key: "syndic", label: "Syndics", icon: Users, color: "teal" },
          { key: "__other", label: "Autres", icon: Shield, color: "slate" },
        ].map((kpi) => {
          const KNOWN = ["owner", "tenant", "provider", "agency", "syndic"];
          const count =
            kpi.key === "__other"
              ? users.filter((u) => !KNOWN.includes(u.role)).length
              : users.filter((u) => u.role === kpi.key).length;
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.key}
              className={cn(
                "rounded-xl p-4 text-center",
                kpi.color === "blue" && "bg-blue-50 dark:bg-blue-500/10",
                kpi.color === "emerald" && "bg-emerald-50 dark:bg-emerald-500/10",
                kpi.color === "amber" && "bg-amber-50 dark:bg-amber-500/10",
                kpi.color === "indigo" && "bg-indigo-50 dark:bg-indigo-500/10",
                kpi.color === "teal" && "bg-teal-50 dark:bg-teal-500/10",
                kpi.color === "slate" && "bg-slate-50 dark:bg-slate-500/10",
              )}
            >
              <Icon
                className={cn(
                  "mx-auto mb-2 h-5 w-5",
                  kpi.color === "blue" && "text-blue-600",
                  kpi.color === "emerald" && "text-emerald-600",
                  kpi.color === "amber" && "text-amber-600",
                  kpi.color === "indigo" && "text-indigo-600",
                  kpi.color === "teal" && "text-teal-600",
                  kpi.color === "slate" && "text-slate-600",
                )}
              />
              <p
                className={cn(
                  "text-2xl font-bold",
                  kpi.color === "blue" && "text-blue-700 dark:text-blue-400",
                  kpi.color === "emerald" && "text-emerald-700 dark:text-emerald-400",
                  kpi.color === "amber" && "text-amber-700 dark:text-amber-400",
                  kpi.color === "indigo" && "text-indigo-700 dark:text-indigo-400",
                  kpi.color === "teal" && "text-teal-700 dark:text-teal-400",
                  kpi.color === "slate" && "text-slate-700 dark:text-slate-400",
                )}
              >
                {count}
              </p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filtres + Tableau */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Liste des utilisateurs</CardTitle>
          <CardDescription>
            {total} utilisateur{total > 1 ? "s" : ""} au total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filtres */}
          <div className="flex flex-wrap gap-4 mb-6">
            <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </form>

            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="suspended">Suspendus</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Inscription</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || isFetching ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-12 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      Aucun utilisateur trouve
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {user.prenom || ""} {user.nom || ""}
                            {!user.prenom && !user.nom && <span className="text-muted-foreground italic">Sans nom</span>}
                          </div>
                          <div className="text-sm text-muted-foreground">{user.email || "—"}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(getRoleColor(user.role))}>
                          {getRoleLabel(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.suspended ? (
                          <Badge variant="destructive">Suspendu</Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                            Actif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateShort(user.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/users/${user.id}`}>
                                <Eye className="w-4 h-4 mr-2" />
                                Voir le detail
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleImpersonate(user.user_id)}
                            >
                              <LogIn className="w-4 h-4 mr-2" />
                              Impersonifier
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setBanTarget({
                                  userId: user.user_id,
                                  name: `${user.prenom || ""} ${user.nom || ""}`.trim() || user.email || "Utilisateur",
                                  suspended: !!user.suspended,
                                });
                                setBanDialogOpen(true);
                              }}
                              className={user.suspended ? "text-emerald-600" : "text-red-600"}
                            >
                              {user.suspended ? (
                                <>
                                  <UserCheck className="w-4 h-4 mr-2" />
                                  Reactiver
                                </>
                              ) : (
                                <>
                                  <Ban className="w-4 h-4 mr-2" />
                                  Suspendre
                                </>
                              )}
                            </DropdownMenuItem>
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
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {page} sur {totalPages} ({total} utilisateurs)
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

      {/* Ban/Suspend Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {banTarget?.suspended ? "Reactiver le compte" : "Suspendre le compte"}
            </DialogTitle>
            <DialogDescription>
              {banTarget && (
                <>
                  {banTarget.suspended
                    ? `Reactiver le compte de ${banTarget.name} ?`
                    : `Suspendre le compte de ${banTarget.name} ? L'utilisateur ne pourra plus se connecter.`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Raison (obligatoire)..."
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBanDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleBan}
              disabled={!banReason.trim() || suspendMutation.isPending}
              className={banTarget?.suspended ? "" : "bg-red-600 hover:bg-red-500 text-white"}
            >
              {suspendMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : banTarget?.suspended ? (
                "Reactiver"
              ) : (
                "Suspendre"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
