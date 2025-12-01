"use client";
// @ts-nocheck

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useTickets } from "@/lib/hooks/use-tickets";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Search, 
  Wrench, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquare,
  ArrowRight,
  Calendar,
  Building2,
  User,
  PauseCircle
} from "lucide-react";
import { TicketsListSkeleton } from "@/components/skeletons/tickets-list-skeleton";
import { cn } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 100, damping: 15 },
  },
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  open: { label: "Ouvert", color: "bg-blue-100 text-blue-800", icon: AlertCircle },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-800", icon: Wrench },
  paused: { label: "En pause", color: "bg-gray-100 text-gray-800", icon: PauseCircle },
  resolved: { label: "Résolu", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  closed: { label: "Fermé", color: "bg-slate-100 text-slate-800", icon: CheckCircle2 },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  basse: { label: "Basse", color: "bg-slate-100 text-slate-600" },
  normale: { label: "Normale", color: "bg-blue-100 text-blue-600" },
  haute: { label: "Haute", color: "bg-orange-100 text-orange-600" },
  urgente: { label: "Urgente", color: "bg-red-100 text-red-600" },
};

export default function OwnerTicketsPage() {
  const { data: tickets = [], isLoading, error } = useTickets();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const filteredTickets = tickets.filter((ticket: any) => {
    const matchesSearch =
      !searchQuery ||
      ticket.titre?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || ticket.statut === statusFilter;
    const matchesPriority = priorityFilter === "all" || ticket.priorite === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter((t: any) => t.statut === "open").length,
    inProgress: tickets.filter((t: any) => t.statut === "in_progress").length,
    resolved: tickets.filter((t: any) => t.statut === "resolved" || t.statut === "closed").length,
  };

  if (isLoading) {
    return (
      <ProtectedRoute allowedRoles={["owner"]}>
        <div className="container mx-auto py-8">
          <TicketsListSkeleton />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen"
      >
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
          >
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent">
                Tickets
              </h1>
              <p className="text-muted-foreground mt-1">
                Gérez les demandes d&apos;intervention et de maintenance
              </p>
            </div>
            <Button
              asChild
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              <Link href="/app/owner/tickets/new">
                <Plus className="mr-2 h-4 w-4" />
                Nouveau ticket
              </Link>
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <Wrench className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ouverts</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.open}</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">En cours</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.inProgress}</p>
                  </div>
                  <Clock className="h-8 w-8 text-amber-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Résolus</p>
                    <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Filters */}
          <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-4 mb-6">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par titre ou description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/80 backdrop-blur-sm"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-white/80 backdrop-blur-sm">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="open">Ouvert</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="paused">En pause</SelectItem>
                <SelectItem value="resolved">Résolu</SelectItem>
                <SelectItem value="closed">Fermé</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="bg-white/80 backdrop-blur-sm">
                <SelectValue placeholder="Priorité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les priorités</SelectItem>
                <SelectItem value="basse">Basse</SelectItem>
                <SelectItem value="normale">Normale</SelectItem>
                <SelectItem value="haute">Haute</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </motion.div>

          {/* Tickets List */}
          <AnimatePresence mode="wait">
            {filteredTickets.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <Card className="bg-white/80 backdrop-blur-sm">
                  <CardContent className="py-16 text-center">
                    <Wrench className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Aucun ticket</h3>
                    <p className="text-muted-foreground mb-6">
                      {tickets.length === 0
                        ? "Vous n'avez pas encore de tickets."
                        : "Aucun ticket ne correspond à vos critères."}
                    </p>
                    {tickets.length === 0 && (
                      <Button asChild>
                        <Link href="/app/owner/tickets/new">
                          <Plus className="mr-2 h-4 w-4" />
                          Créer un ticket
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="tickets"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-4"
              >
                {filteredTickets.map((ticket: any, index: number) => {
                  const status = statusConfig[ticket.statut] || statusConfig.open;
                  const StatusIcon = status.icon;
                  const priority = priorityConfig[ticket.priorite] || priorityConfig.normale;

                  return (
                    <motion.div key={ticket.id} variants={itemVariants}>
                      <Card className="bg-white/80 backdrop-blur-sm hover:bg-white transition-colors cursor-pointer group">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={cn(status.color, "flex items-center gap-1")}>
                                  <StatusIcon className="h-3 w-3" />
                                  {status.label}
                                </Badge>
                                <Badge className={priority.color}>
                                  {priority.label}
                                </Badge>
                              </div>
                              <h3 className="font-semibold text-lg group-hover:text-blue-600 transition-colors truncate">
                                {ticket.titre || "Sans titre"}
                              </h3>
                              <p className="text-muted-foreground text-sm line-clamp-2 mt-1">
                                {ticket.description || "Pas de description"}
                              </p>
                              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                                {ticket.property && (
                                  <div className="flex items-center gap-1">
                                    <Building2 className="h-4 w-4" />
                                    <span className="truncate max-w-[200px]">
                                      {ticket.property.adresse_complete}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {new Date(ticket.created_at).toLocaleDateString("fr-FR")}
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/app/owner/tickets/${ticket.id}`}>
                                <ArrowRight className="h-5 w-5" />
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </ProtectedRoute>
  );
}

