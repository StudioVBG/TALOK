"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Plus,
  Search,
  Euro,
  Calendar,
  Building2,
  User,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Loader2,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { PageTransition } from "@/components/ui/page-transition";

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

interface Quote {
  id: string;
  reference: string;
  title: string;
  description?: string;
  property_address?: string;
  owner_name?: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired" | "converted";
  created_at: string;
  valid_until: string;
  sent_at?: string;
  accepted_at?: string;
}

interface QuoteStats {
  total: number;
  draft: number;
  sent: number;
  accepted: number;
  rejected: number;
  total_accepted_amount: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700", icon: FileText },
  sent: { label: "Envoyé", color: "bg-blue-100 text-blue-700", icon: Send },
  viewed: { label: "Consulté", color: "bg-purple-100 text-purple-700", icon: Eye },
  accepted: { label: "Accepté", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  rejected: { label: "Refusé", color: "bg-red-100 text-red-700", icon: XCircle },
  expired: { label: "Expiré", color: "bg-amber-100 text-amber-700", icon: Clock },
  converted: { label: "Converti", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
};

export default function ProviderQuotesPage() {
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [stats, setStats] = useState<QuoteStats>({
    total: 0,
    draft: 0,
    sent: 0,
    accepted: 0,
    rejected: 0,
    total_accepted_amount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchQuotes();
  }, [statusFilter]);

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      
      const response = await fetch(`/api/provider/quotes?${params}`);
      
      if (!response.ok) {
        throw new Error("Erreur lors du chargement des devis");
      }
      
      const data = await response.json();
      setQuotes(data.quotes || []);
      setStats(data.stats || {
        total: 0,
        draft: 0,
        sent: 0,
        accepted: 0,
        rejected: 0,
        total_accepted_amount: 0,
      });
    } catch (error: unknown) {
      console.error("Erreur chargement devis:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger les devis",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredQuotes = quotes.filter((quote) => {
    const matchesSearch =
      !searchQuery ||
      quote.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.property_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.owner_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.title?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const isExpiringSoon = (validUntil: string) => {
    const expDate = new Date(validUntil);
    const today = new Date();
    const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays > 0;
  };

  const isExpired = (validUntil: string) => {
    return new Date(validUntil) < new Date();
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="p-6 space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="p-6 space-y-6"
      >
        {/* Header */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mes devis</h1>
            <p className="text-muted-foreground">
              Créez et gérez vos devis clients
            </p>
          </div>
          <Button asChild>
            <Link href="/provider/quotes/new">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau devis
            </Link>
          </Button>
        </motion.div>

        {/* Stats */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total devis</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <FileText className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">En attente</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
                </div>
                <Send className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Acceptés</p>
                  <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">CA potentiel</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {stats.total_accepted_amount.toLocaleString("fr-FR")} €
                  </p>
                </div>
                <Euro className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un devis..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="draft">Brouillons</SelectItem>
              <SelectItem value="sent">Envoyés</SelectItem>
              <SelectItem value="accepted">Acceptés</SelectItem>
              <SelectItem value="rejected">Refusés</SelectItem>
              <SelectItem value="expired">Expirés</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Quotes List */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-0">
              {filteredQuotes.length === 0 ? (
                <div className="text-center py-16">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucun devis</h3>
                  <p className="text-muted-foreground mb-6">
                    {quotes.length === 0
                      ? "Vous n'avez pas encore créé de devis."
                      : "Aucun devis ne correspond à vos critères."}
                  </p>
                  {quotes.length === 0 && (
                    <Button asChild>
                      <Link href="/provider/quotes/new">
                        <Plus className="mr-2 h-4 w-4" />
                        Créer un devis
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredQuotes.map((quote) => {
                    const status = statusConfig[quote.status] || statusConfig.draft;
                    const StatusIcon = status.icon;
                    const expired = isExpired(quote.valid_until);
                    const expiringSoon = isExpiringSoon(quote.valid_until);

                    return (
                      <motion.div
                        key={quote.id}
                        variants={itemVariants}
                        className="p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge className={cn(status.color, "flex items-center gap-1")}>
                                <StatusIcon className="h-3 w-3" />
                                {status.label}
                              </Badge>
                              <span className="text-sm text-muted-foreground font-mono">
                                {quote.reference}
                              </span>
                              {expiringSoon && !expired && quote.status === 'sent' && (
                                <Badge variant="outline" className="text-amber-600 border-amber-300">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Expire bientôt
                                </Badge>
                              )}
                            </div>
                            
                            <h3 className="font-semibold text-lg truncate">
                              {quote.title}
                            </h3>
                            
                            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                              {quote.property_address && (
                                <div className="flex items-center gap-1">
                                  <Building2 className="h-4 w-4" />
                                  <span className="truncate max-w-[200px]">{quote.property_address}</span>
                                </div>
                              )}
                              {quote.owner_name && (
                                <div className="flex items-center gap-1">
                                  <User className="h-4 w-4" />
                                  {quote.owner_name}
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                Valide jusqu'au {format(new Date(quote.valid_until), "dd/MM/yyyy", { locale: fr })}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-2xl font-bold text-orange-600">
                                {quote.total_amount?.toLocaleString("fr-FR") || "0"} €
                              </p>
                              <p className="text-xs text-muted-foreground">TTC</p>
                            </div>
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/provider/quotes/${quote.id}`}>
                                <ArrowRight className="h-5 w-5" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </PageTransition>
  );
}
