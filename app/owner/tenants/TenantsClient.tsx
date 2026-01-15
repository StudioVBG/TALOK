"use client";
// @ts-nocheck

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Search,
  Star,
  MessageSquare,
  FileText,
  History,
  Phone,
  Mail,
  Home,
  Calendar,
  Euro,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  MoreHorizontal,
  Filter,
  ArrowUpDown,
  Building2,
  Clock,
  Wallet,
} from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { cn } from "@/lib/utils";

interface TenantWithDetails {
  id: string;
  profile_id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  avatar_url: string | null;
  lease_id: string;
  lease_status: string;
  lease_start: string;
  lease_end: string | null;
  lease_type: string;
  loyer: number;
  charges: number;
  property_id: string;
  property_address: string;
  property_city: string;
  property_type: string;
  payments_on_time: number;
  payments_late: number;
  payments_total: number;
  current_balance: number;
  last_payment_date: string | null;
  tenant_score: number;
}

interface TenantsClientProps {
  tenants: TenantWithDetails[];
}

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

// Composant Score Étoiles
function TenantScoreStars({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "h-4 w-4",
            star <= score
              ? "fill-amber-400 text-amber-400"
              : "fill-slate-200 text-slate-200"
          )}
        />
      ))}
    </div>
  );
}

// Composant Badge Statut Bail
function LeaseStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    active: { label: "Actif", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    pending_signature: { label: "Signature en cours", className: "bg-amber-100 text-amber-700 border-amber-200" },
    pending_owner_signature: { label: "Signature propriétaire", className: "bg-blue-100 text-blue-700 border-blue-200" },
    terminated: { label: "Terminé", className: "bg-slate-100 text-slate-600 border-slate-200" },
  };

  const { label, className } = config[status] || { label: status, className: "bg-slate-100 text-slate-600" };

  return (
    <Badge variant="outline" className={cn("font-medium", className)}>
      {label}
    </Badge>
  );
}

// Composant Carte Locataire
function TenantCard({ tenant }: { tenant: TenantWithDetails }) {
  const initials = `${tenant.prenom?.[0] || ""}${tenant.nom?.[0] || ""}`.toUpperCase();
  const fullName = `${tenant.prenom} ${tenant.nom}`.trim() || "Locataire";
  
  const leaseDuration = () => {
    const start = new Date(tenant.lease_start);
    const now = new Date();
    const months = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (months < 12) return `${months} mois`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    return remainingMonths > 0 ? `${years} an${years > 1 ? 's' : ''} ${remainingMonths} mois` : `${years} an${years > 1 ? 's' : ''}`;
  };

  const paymentRate = tenant.payments_total > 0 
    ? Math.round((tenant.payments_on_time / tenant.payments_total) * 100)
    : 100;

  return (
    <motion.div variants={itemVariants}>
      <Card className="group hover:shadow-xl transition-all duration-300 hover:scale-[1.01] border-slate-200/60 bg-white/80 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          {/* Header avec gradient */}
          <div className="relative h-20 bg-gradient-to-br from-slate-800 via-slate-700 to-indigo-800">
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
            <div className="absolute -bottom-8 left-6">
              <Avatar className="h-16 w-16 border-4 border-white shadow-lg">
                <AvatarImage src={tenant.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-lg font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="absolute top-3 right-3">
              <TenantScoreStars score={tenant.tenant_score} />
            </div>
          </div>

          {/* Contenu principal */}
          <div className="pt-10 px-6 pb-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{fullName}</h3>
                <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <Home className="h-3.5 w-3.5" />
                  {tenant.property_address}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href={`/owner/tenants/${tenant.profile_id}`}>
                      <Users className="h-4 w-4 mr-2" />
                      Voir le profil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/owner/leases/${tenant.lease_id}`}>
                      <FileText className="h-4 w-4 mr-2" />
                      Voir le bail
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/owner/messages?tenant=${tenant.profile_id}`}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Envoyer un message
                    </Link>
                  </DropdownMenuItem>
                  {tenant.telephone && (
                    <DropdownMenuItem asChild>
                      <a href={`tel:${tenant.telephone}`}>
                        <Phone className="h-4 w-4 mr-2" />
                        Appeler
                      </a>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <a href={`mailto:${tenant.email}`}>
                      <Mail className="h-4 w-4 mr-2" />
                      Envoyer un email
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <LeaseStatusBadge status={tenant.lease_status} />
              <Badge variant="outline" className="bg-slate-50">
                <Calendar className="h-3 w-3 mr-1" />
                {leaseDuration()}
              </Badge>
            </div>

            {/* Métriques */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-slate-50">
                <p className="text-xs text-slate-500 mb-0.5">Loyer mensuel</p>
                <p className="text-lg font-bold text-slate-900">
                  {formatCurrency(tenant.loyer + tenant.charges)}
                </p>
              </div>
              <div className={cn(
                "p-3 rounded-lg",
                tenant.current_balance > 0 ? "bg-red-50" : "bg-emerald-50"
              )}>
                <p className="text-xs text-slate-500 mb-0.5">Solde</p>
                <p className={cn(
                  "text-lg font-bold",
                  tenant.current_balance > 0 ? "text-red-600" : "text-emerald-600"
                )}>
                  {tenant.current_balance > 0 
                    ? `-${formatCurrency(tenant.current_balance)}`
                    : "À jour"
                  }
                </p>
              </div>
            </div>

            {/* Barre de paiements */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Paiements à l'heure</span>
                <span className={cn(
                  "font-semibold",
                  paymentRate >= 90 ? "text-emerald-600" :
                  paymentRate >= 70 ? "text-amber-600" : "text-red-600"
                )}>
                  {paymentRate}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    paymentRate >= 90 ? "bg-emerald-500" :
                    paymentRate >= 70 ? "bg-amber-500" : "bg-red-500"
                  )}
                  style={{ width: `${paymentRate}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">
                {tenant.payments_on_time} à l'heure • {tenant.payments_late} en retard sur {tenant.payments_total} paiements
              </p>
            </div>
          </div>

          {/* Footer avec actions rapides */}
          <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              {tenant.last_payment_date 
                ? `Dernier paiement: ${formatDateShort(tenant.last_payment_date)}`
                : "Aucun paiement enregistré"
              }
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" asChild className="h-8">
                <Link href={`/owner/messages?tenant=${tenant.profile_id}`}>
                  <MessageSquare className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className="h-8">
                <Link href={`/owner/tenants/${tenant.profile_id}`}>
                  Détails
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function TenantsClient({ tenants }: TenantsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");

  // Filtrage
  const filteredTenants = tenants
    .filter((tenant) => {
      // Recherche
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = `${tenant.prenom} ${tenant.nom}`.toLowerCase().includes(query);
        const matchesAddress = tenant.property_address.toLowerCase().includes(query);
        const matchesEmail = tenant.email.toLowerCase().includes(query);
        if (!matchesName && !matchesAddress && !matchesEmail) return false;
      }
      
      // Filtre statut
      if (statusFilter === "active" && tenant.lease_status !== "active") return false;
      if (statusFilter === "pending" && !tenant.lease_status.includes("pending")) return false;
      if (statusFilter === "balance" && tenant.current_balance <= 0) return false;
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`);
        case "score":
          return b.tenant_score - a.tenant_score;
        case "balance":
          return b.current_balance - a.current_balance;
        case "rent":
          return (b.loyer + b.charges) - (a.loyer + a.charges);
        default:
          return 0;
      }
    });

  // Statistiques
  const stats = {
    total: tenants.length,
    active: tenants.filter(t => t.lease_status === "active").length,
    pending: tenants.filter(t => t.lease_status.includes("pending")).length,
    withBalance: tenants.filter(t => t.current_balance > 0).length,
    totalBalance: tenants.reduce((sum, t) => sum + t.current_balance, 0),
    avgScore: tenants.length > 0 
      ? Math.round(tenants.reduce((sum, t) => sum + t.tenant_score, 0) / tenants.length * 10) / 10
      : 0,
    totalMonthlyRent: tenants.filter(t => t.lease_status === "active").reduce((sum, t) => sum + t.loyer + t.charges, 0),
  };

  if (tenants.length === 0) {
    return (
      <PageTransition>
        <div className="p-6 max-w-7xl mx-auto">
          <EmptyState
            icon={Users}
            title="Aucun locataire"
            description="Vos locataires apparaîtront ici une fois qu'un bail sera signé."
            action={{
              label: "Créer un bail",
              href: "/owner/leases/new",
            }}
          />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="p-6 max-w-7xl mx-auto space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Mes Locataires
            </h1>
            <p className="text-slate-500 mt-1">
              Gérez vos {stats.total} locataire{stats.total > 1 ? 's' : ''} et suivez leurs paiements
            </p>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-100">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.active}</p>
                <p className="text-xs text-slate-500">Locataires actifs</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100">
                <Euro className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalMonthlyRent)}</p>
                <p className="text-xs text-slate-500">Revenus mensuels</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className={cn("p-4", stats.totalBalance > 0 && "border-red-200 bg-red-50/50")}>
            <div className="flex items-center gap-3">
              <div className={cn("p-2.5 rounded-xl", stats.totalBalance > 0 ? "bg-red-100" : "bg-emerald-100")}>
                <Wallet className={cn("h-5 w-5", stats.totalBalance > 0 ? "text-red-600" : "text-emerald-600")} />
              </div>
              <div>
                <p className={cn("text-2xl font-bold", stats.totalBalance > 0 ? "text-red-600" : "text-emerald-600")}>
                  {stats.totalBalance > 0 ? formatCurrency(stats.totalBalance) : "0 €"}
                </p>
                <p className="text-xs text-slate-500">
                  {stats.withBalance > 0 ? `${stats.withBalance} impayé(s)` : "Aucun impayé"}
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-100">
                <Star className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.avgScore}/5</p>
                <p className="text-xs text-slate-500">Score moyen</p>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Filtres */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Rechercher par nom, adresse, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-white">
              <Filter className="h-4 w-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Baux actifs</SelectItem>
              <SelectItem value="pending">Signature en cours</SelectItem>
              <SelectItem value="balance">Avec solde dû</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[180px] bg-white">
              <ArrowUpDown className="h-4 w-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Trier par" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nom</SelectItem>
              <SelectItem value="score">Score</SelectItem>
              <SelectItem value="balance">Solde dû</SelectItem>
              <SelectItem value="rent">Loyer</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Liste des locataires */}
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
        >
          <AnimatePresence mode="popLayout">
            {filteredTenants.map((tenant) => (
              <TenantCard key={tenant.id} tenant={tenant} />
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Message si aucun résultat */}
        {filteredTenants.length === 0 && tenants.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card className="p-6 sm:p-8 md:p-12 text-center">
              <Search className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Aucun résultat</h3>
              <p className="text-slate-500 mb-4">
                Aucun locataire ne correspond à vos critères de recherche.
              </p>
              <Button variant="outline" onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}>
                Réinitialiser les filtres
              </Button>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </PageTransition>
  );
}

