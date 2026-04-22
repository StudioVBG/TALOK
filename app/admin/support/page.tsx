"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  useSupportTickets,
  useUpdateSupportTicket,
} from "@/lib/hooks/use-admin-queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  MoreVertical,
  Ticket,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Inbox,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/helpers/format";
import { useToast } from "@/components/ui/use-toast";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Ticket }> = {
  open: { label: "Ouvert", color: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400", icon: Inbox },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400", icon: Clock },
  waiting: { label: "En attente", color: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400", icon: Clock },
  resolved: { label: "Resolu", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400", icon: CheckCircle2 },
  closed: { label: "Ferme", color: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400", icon: XCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Bas", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  normal: { label: "Normal", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  high: { label: "Haut", color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
};

export default function AdminSupportPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 20;

  const [detailTicket, setDetailTicket] = useState<Record<string, unknown> | null>(null);

  const { data, isLoading, isFetching, refetch } = useSupportTickets({
    status: statusFilter,
    priority: priorityFilter,
    page,
    per_page: perPage,
  });

  const updateMutation = useUpdateSupportTicket();

  const tickets = (data?.tickets || []) as Array<Record<string, unknown>>;
  const total = data?.total || 0;
  const stats = data?.stats || { total: 0, open: 0, in_progress: 0, waiting: 0, resolved: 0, closed: 0, urgent: 0, high: 0 };
  const totalPages = Math.ceil(total / perPage);

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      await updateMutation.mutateAsync({ id: ticketId, status: newStatus });
      toast({ title: "Ticket mis a jour" });
      refetch();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handlePriorityChange = async (ticketId: string, newPriority: string) => {
    try {
      await updateMutation.mutateAsync({ id: ticketId, priority: newPriority });
      toast({ title: "Priorite mise a jour" });
      refetch();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
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
          <h1 className="text-2xl font-bold">Support</h1>
          <p className="text-muted-foreground">Gestion des tickets de support utilisateurs</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 p-4 text-center">
          <Inbox className="mx-auto mb-1 h-5 w-5 text-blue-600" />
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.open}</p>
          <p className="text-xs text-muted-foreground">Ouverts</p>
        </div>
        <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-4 text-center">
          <Clock className="mx-auto mb-1 h-5 w-5 text-amber-600" />
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.in_progress}</p>
          <p className="text-xs text-muted-foreground">En cours</p>
        </div>
        <div className="rounded-xl bg-purple-50 dark:bg-purple-500/10 p-4 text-center">
          <Clock className="mx-auto mb-1 h-5 w-5 text-purple-600" />
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{stats.waiting}</p>
          <p className="text-xs text-muted-foreground">En attente</p>
        </div>
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-4 text-center">
          <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-emerald-600" />
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{stats.resolved}</p>
          <p className="text-xs text-muted-foreground">Resolus</p>
        </div>
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 p-4 text-center">
          <Flame className="mx-auto mb-1 h-5 w-5 text-red-600" />
          <p className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.urgent}</p>
          <p className="text-xs text-muted-foreground">Urgents</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-500/10 p-4 text-center">
          <Ticket className="mx-auto mb-1 h-5 w-5 text-slate-600" />
          <p className="text-2xl font-bold text-slate-700 dark:text-slate-400">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
      </div>

      {/* Filtres + Tableau */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Tickets</CardTitle>
          <CardDescription>{total} ticket{total > 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="open">Ouverts</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="waiting">En attente</SelectItem>
                <SelectItem value="resolved">Resolus</SelectItem>
                <SelectItem value="closed">Fermes</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Priorite" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes priorites</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">Haut</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Bas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sujet</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Priorite</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || isFetching ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}><Skeleton className="h-12 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : tickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <Ticket className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      Aucun ticket trouve
                    </TableCell>
                  </TableRow>
                ) : (
                  tickets.map((ticket) => {
                    const statusConf = STATUS_CONFIG[ticket.status as string] || STATUS_CONFIG.open;
                    const priorityConf = PRIORITY_CONFIG[ticket.priority as string] || PRIORITY_CONFIG.normal;
                    const user = ticket.user as Record<string, unknown> | null;

                    return (
                      <TableRow key={ticket.id as string}>
                        <TableCell>
                          <button
                            onClick={() => setDetailTicket(ticket)}
                            className="text-left hover:underline"
                          >
                            <div className="font-medium text-sm max-w-[250px] truncate">
                              {ticket.subject as string}
                            </div>
                            <div className="text-xs text-muted-foreground max-w-[250px] truncate">
                              {ticket.category as string || "general"}
                            </div>
                          </button>
                        </TableCell>
                        <TableCell>
                          {user ? (
                            <Link
                              href={`/admin/people/${user.id as string}`}
                              className="block hover:underline"
                              title="Voir la fiche utilisateur"
                            >
                              <div className="text-sm font-medium">
                                {(user.prenom as string) || ""} {(user.nom as string) || ""}
                              </div>
                              <div className="text-xs text-muted-foreground">{(user.email as string) || ""}</div>
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", priorityConf.color)}>
                            {ticket.priority === "urgent" && <AlertTriangle className="w-3 h-3 mr-1" />}
                            {priorityConf.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", statusConf.color)}>
                            {statusConf.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateShort(ticket.created_at as string)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Changer le statut</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {Object.entries(STATUS_CONFIG).map(([key, conf]) => (
                                <DropdownMenuItem
                                  key={key}
                                  onClick={() => handleStatusChange(ticket.id as string, key)}
                                  disabled={ticket.status === key}
                                >
                                  <conf.icon className="w-4 h-4 mr-2" />
                                  {conf.label}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel>Priorite</DropdownMenuLabel>
                              {Object.entries(PRIORITY_CONFIG).map(([key, conf]) => (
                                <DropdownMenuItem
                                  key={key}
                                  onClick={() => handlePriorityChange(ticket.id as string, key)}
                                  disabled={ticket.priority === key}
                                >
                                  {conf.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {page} sur {totalPages} ({total} tickets)
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
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailTicket} onOpenChange={() => setDetailTicket(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailTicket?.subject as string}</DialogTitle>
            <DialogDescription>
              Cree le {detailTicket ? formatDateShort(detailTicket.created_at as string) : ""}
              {" — "}Categorie: {(detailTicket?.category as string) || "general"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Badge className={cn(STATUS_CONFIG[(detailTicket?.status as string) || "open"]?.color)}>
                {STATUS_CONFIG[(detailTicket?.status as string) || "open"]?.label}
              </Badge>
              <Badge className={cn(PRIORITY_CONFIG[(detailTicket?.priority as string) || "normal"]?.color)}>
                {PRIORITY_CONFIG[(detailTicket?.priority as string) || "normal"]?.label}
              </Badge>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-sm whitespace-pre-wrap">
              {detailTicket?.description as string}
            </div>
            {detailTicket?.user && (
              <div className="text-sm text-muted-foreground">
                <p>
                  De: {((detailTicket.user as Record<string, unknown>).prenom as string) || ""}{" "}
                  {((detailTicket.user as Record<string, unknown>).nom as string) || ""}{" "}
                  ({((detailTicket.user as Record<string, unknown>).email as string) || ""})
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-wrap gap-2">
            {detailTicket?.status !== "resolved" && (
              <Button
                onClick={() => {
                  handleStatusChange(detailTicket?.id as string, "resolved");
                  setDetailTicket(null);
                }}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Marquer resolu
                  </>
                )}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setDetailTicket(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
