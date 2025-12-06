"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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
  Wrench,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  ArrowRight,
  Loader2,
  PauseCircle,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const statusConfig = {
  open: { label: "Ouvert", color: "bg-blue-100 text-blue-800", icon: AlertCircle },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-800", icon: Wrench },
  paused: { label: "En pause", color: "bg-gray-100 text-gray-800", icon: PauseCircle },
  resolved: { label: "Résolu", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  closed: { label: "Fermé", color: "bg-slate-100 text-slate-800", icon: CheckCircle2 },
};

const priorityConfig = {
  basse: { label: "Basse", color: "bg-slate-100 text-slate-600" },
  normale: { label: "Normale", color: "bg-blue-100 text-blue-600" },
  haute: { label: "Haute", color: "bg-orange-100 text-orange-600" },
  urgente: { label: "Urgente", color: "bg-red-100 text-red-600" },
};

interface Ticket {
  id: string;
  titre: string;
  description: string;
  statut: keyof typeof statusConfig;
  priorite: keyof typeof priorityConfig;
  site_name?: string;
  created_at: string;
  comments_count?: number;
}

export default function CoproTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchTickets() {
      try {
        // Simulation - en production, appeler l'API
        const mockTickets: Ticket[] = [
          {
            id: "1",
            titre: "Panne ascenseur",
            description: "L'ascenseur est en panne depuis ce matin",
            statut: "in_progress",
            priorite: "haute",
            site_name: "Résidence Les Jardins",
            created_at: "2024-11-20",
            comments_count: 3,
          },
          {
            id: "2",
            titre: "Fuite parking sous-sol",
            description: "Infiltration d'eau au niveau -2",
            statut: "open",
            priorite: "urgente",
            site_name: "Résidence Les Jardins",
            created_at: "2024-11-22",
            comments_count: 1,
          },
          {
            id: "3",
            titre: "Éclairage hall d'entrée",
            description: "Ampoule grillée dans le hall principal",
            statut: "resolved",
            priorite: "basse",
            site_name: "Résidence Les Jardins",
            created_at: "2024-11-15",
            comments_count: 2,
          },
        ];
        setTickets(mockTickets);
      } catch (error) {
        console.error("Erreur chargement tickets:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTickets();
  }, []);

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      !searchQuery ||
      ticket.titre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || ticket.statut === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.statut === "open").length,
    inProgress: tickets.filter((t) => t.statut === "in_progress").length,
    resolved: tickets.filter((t) => t.statut === "resolved" || t.statut === "closed").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-6"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 bg-clip-text text-transparent">
            Signalements
          </h1>
          <p className="text-muted-foreground mt-1">
            Suivez les incidents et demandes de votre copropriété
          </p>
        </div>
        <Button className="bg-gradient-to-r from-indigo-600 to-purple-600">
          <Plus className="mr-2 h-4 w-4" />
          Nouveau signalement
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
              <AlertCircle className="h-8 w-8 text-blue-500" />
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
              <Clock className="h-8 w-8 text-amber-500" />
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
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/80 backdrop-blur-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-white/80 backdrop-blur-sm">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="open">Ouvert</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="resolved">Résolu</SelectItem>
            <SelectItem value="closed">Fermé</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Tickets List */}
      {filteredTickets.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="py-16 text-center">
              <Wrench className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun signalement</h3>
              <p className="text-muted-foreground mb-6">
                {tickets.length === 0
                  ? "Aucun signalement n'a été créé."
                  : "Aucun résultat ne correspond à vos critères."}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} className="space-y-4">
          {filteredTickets.map((ticket) => {
            const status = statusConfig[ticket.statut] || statusConfig.open;
            const StatusIcon = status.icon;
            const priority = priorityConfig[ticket.priorite] || priorityConfig.normale;

            return (
              <motion.div key={ticket.id} variants={itemVariants}>
                <Card className="bg-white/80 backdrop-blur-sm hover:bg-white hover:shadow-md transition-all cursor-pointer group">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={cn(status.color, "flex items-center gap-1")}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                          <Badge className={priority.color}>{priority.label}</Badge>
                        </div>
                        <h3 className="font-semibold text-lg group-hover:text-indigo-600 transition-colors">
                          {ticket.titre}
                        </h3>
                        <p className="text-muted-foreground text-sm line-clamp-2 mt-1">
                          {ticket.description}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                          {ticket.site_name && (
                            <div className="flex items-center gap-1">
                              <Building2 className="h-4 w-4" />
                              {ticket.site_name}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(ticket.created_at), "dd/MM/yyyy", { locale: fr })}
                          </div>
                          {ticket.comments_count !== undefined && ticket.comments_count > 0 && (
                            <div className="flex items-center gap-1">
                              <MessageSquare className="h-4 w-4" />
                              {ticket.comments_count}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon">
                        <ArrowRight className="h-5 w-5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}

