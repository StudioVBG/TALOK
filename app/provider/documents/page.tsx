"use client";

/**
 * Page Documents Prestataire - SOTA 2026
 * 
 * Vue unifiée de tous les documents du prestataire :
 * - Documents de conformité (RC Pro, décennale, KBIS...)
 * - Devis générés
 * - Factures émises
 * - Documents de missions
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FolderOpen,
  Search,
  Filter,
  Shield,
  FileText,
  Receipt,
  FileSignature,
  Calendar,
  Download,
  Eye,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Briefcase,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
type DocumentCategory = "all" | "compliance" | "quotes" | "invoices" | "missions";

interface ProviderDocument {
  id: string;
  type: string;
  title: string;
  category: DocumentCategory;
  status: "verified" | "pending" | "rejected" | "expired" | "draft" | "sent" | "paid";
  created_at: string;
  expiration_date?: string;
  amount?: number;
  related_mission?: string;
  storage_path?: string;
}

// Configuration des catégories
const CATEGORY_CONFIG: Record<DocumentCategory, { 
  label: string; 
  icon: React.ElementType; 
  color: string;
  bgColor: string;
}> = {
  all: { 
    label: "Tous", 
    icon: FolderOpen, 
    color: "text-slate-600", 
    bgColor: "bg-slate-100" 
  },
  compliance: { 
    label: "Conformité", 
    icon: Shield, 
    color: "text-orange-600", 
    bgColor: "bg-orange-100" 
  },
  quotes: { 
    label: "Devis", 
    icon: FileSignature, 
    color: "text-blue-600", 
    bgColor: "bg-blue-100" 
  },
  invoices: { 
    label: "Factures", 
    icon: Receipt, 
    color: "text-emerald-600", 
    bgColor: "bg-emerald-100" 
  },
  missions: { 
    label: "Missions", 
    icon: Briefcase, 
    color: "text-purple-600", 
    bgColor: "bg-purple-100" 
  },
};

// Configuration des statuts
const STATUS_CONFIG: Record<string, { 
  label: string; 
  color: string; 
  icon: React.ElementType 
}> = {
  verified: { label: "Vérifié", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700", icon: Clock },
  rejected: { label: "Rejeté", color: "bg-red-100 text-red-700", icon: AlertTriangle },
  expired: { label: "Expiré", color: "bg-gray-100 text-gray-700", icon: AlertTriangle },
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700", icon: FileText },
  sent: { label: "Envoyé", color: "bg-blue-100 text-blue-700", icon: FileSignature },
  paid: { label: "Payé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
};

// Hook pour récupérer tous les documents du prestataire
function useProviderDocuments() {
  return useQuery({
    queryKey: ["provider-documents"],
    queryFn: async () => {
      // Fetch documents de conformité
      const complianceRes = await fetch("/api/provider/compliance/status");
      const complianceData = complianceRes.ok ? await complianceRes.json() : { documents: [] };
      
      // Fetch devis
      const quotesRes = await fetch("/api/provider/quotes");
      const quotesData = quotesRes.ok ? await quotesRes.json() : [];
      
      // Fetch factures
      const invoicesRes = await fetch("/api/provider/invoices");
      const invoicesData = invoicesRes.ok ? await invoicesRes.json() : [];
      
      // Transformer en format unifié
      const documents: ProviderDocument[] = [
        // Documents de conformité
        ...(complianceData.documents || []).map((doc: any) => ({
          id: doc.id,
          type: doc.document_type,
          title: doc.original_filename || doc.document_type,
          category: "compliance" as DocumentCategory,
          status: doc.verification_status,
          created_at: doc.created_at,
          expiration_date: doc.expiration_date,
          storage_path: doc.storage_path,
        })),
        // Devis
        ...(Array.isArray(quotesData) ? quotesData : []).map((quote: any) => ({
          id: quote.id,
          type: "quote",
          title: `Devis #${quote.reference || quote.id.slice(0, 8)}`,
          category: "quotes" as DocumentCategory,
          status: quote.status === "accepted" ? "verified" : quote.status === "pending" ? "pending" : "draft",
          created_at: quote.created_at,
          amount: quote.total_amount,
          related_mission: quote.ticket?.titre,
        })),
        // Factures
        ...(Array.isArray(invoicesData) ? invoicesData : []).map((invoice: any) => ({
          id: invoice.id,
          type: "invoice",
          title: `Facture #${invoice.reference || invoice.id.slice(0, 8)}`,
          category: "invoices" as DocumentCategory,
          status: invoice.status === "paid" ? "paid" : invoice.status === "sent" ? "sent" : "draft",
          created_at: invoice.created_at,
          amount: invoice.total_amount,
          related_mission: invoice.work_order?.ticket?.titre,
        })),
      ];
      
      return {
        documents,
        compliance: complianceData,
      };
    },
    staleTime: 30000,
  });
}

// Composant Skeleton
function DocumentsSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-11 w-40" />
      </div>
      <Skeleton className="h-14 w-full" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

// Composant Document Card
function DocumentCard({ doc }: { doc: ProviderDocument }) {
  const category = CATEGORY_CONFIG[doc.category];
  const status = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
  const CategoryIcon = category.icon;
  const StatusIcon = status.icon;

  const isExpiringSoon = doc.expiration_date && 
    new Date(doc.expiration_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
    new Date(doc.expiration_date) > new Date();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 100, damping: 15 }}
    >
      <GlassCard className="group hover:shadow-xl hover:border-orange-200 transition-all duration-300 border-slate-200 bg-white h-full flex flex-col p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className={cn("p-3 rounded-2xl shadow-sm transition-transform group-hover:scale-110", category.bgColor)}>
            <CategoryIcon className={cn("h-6 w-6", category.color)} />
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={cn(status.color, "gap-1 text-[10px]")}>
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </Badge>
            {isExpiringSoon && (
              <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">
                Expire bientôt
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 mb-4">
          <h3 className="text-lg font-bold text-slate-900 group-hover:text-orange-600 transition-colors line-clamp-2">
            {doc.title}
          </h3>
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(doc.created_at).toLocaleDateString("fr-FR", { 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric' 
              })}
            </div>
          </div>
          {doc.amount && (
            <p className="mt-2 text-lg font-semibold text-emerald-600">
              {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(doc.amount)}
            </p>
          )}
          {doc.related_mission && (
            <p className="mt-1 text-xs text-muted-foreground truncate">
              Mission: {doc.related_mission}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-slate-100">
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex-1 h-10 hover:bg-orange-50 hover:text-orange-600 font-semibold"
            aria-label={`Voir le document ${doc.title}`}
          >
            <Eye className="h-4 w-4 mr-2" /> 
            Voir
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            className="flex-1 h-10 hover:border-orange-300 font-semibold"
            aria-label={`Télécharger ${doc.title}`}
          >
            <Download className="h-4 w-4 mr-2" /> 
            Télécharger
          </Button>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// Composant Principal
export default function ProviderDocumentsPage() {
  const { data, isLoading, error } = useProviderDocuments();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Filtrage des documents
  const filteredDocuments = useMemo(() => {
    if (!data?.documents) return [];
    
    return data.documents.filter((doc) => {
      // Filtre par recherche
      const matchesSearch = !searchQuery || 
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.type.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Filtre par catégorie
      const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;
      
      // Filtre par statut
      const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
      
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [data?.documents, searchQuery, categoryFilter, statusFilter]);

  // Stats par catégorie
  const stats = useMemo(() => {
    if (!data?.documents) return { all: 0, compliance: 0, quotes: 0, invoices: 0, missions: 0 };
    
    return data.documents.reduce((acc, doc) => {
      acc.all++;
      acc[doc.category]++;
      return acc;
    }, { all: 0, compliance: 0, quotes: 0, invoices: 0, missions: 0 } as Record<DocumentCategory, number>);
  }, [data?.documents]);

  if (isLoading) return <DocumentsSkeleton />;

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        
        {/* Header SOTA 2026 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-600 rounded-lg shadow-lg shadow-orange-200">
                <FolderOpen className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Mes Documents
              </h1>
            </div>
            <p className="text-slate-500 text-lg">
              Tous vos documents professionnels au même endroit
            </p>
          </div>
          <Button 
            asChild 
            className="shadow-lg shadow-orange-200 bg-orange-600 hover:bg-orange-700"
          >
            <Link href="/provider/compliance">
              <Shield className="h-4 w-4 mr-2" />
              Documents légaux
              <ExternalLink className="h-3 w-3 ml-2" />
            </Link>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {(Object.entries(CATEGORY_CONFIG) as [DocumentCategory, typeof CATEGORY_CONFIG[DocumentCategory]][]).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <button
                key={key}
                onClick={() => setCategoryFilter(key)}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all duration-200 text-left",
                  categoryFilter === key 
                    ? "border-orange-400 bg-orange-50 shadow-md" 
                    : "border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/50"
                )}
                aria-label={`Filtrer par ${config.label}`}
                aria-pressed={categoryFilter === key}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", config.bgColor)}>
                    <Icon className={cn("h-5 w-5", config.color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{stats[key]}</p>
                    <p className="text-xs text-muted-foreground">{config.label}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Barre de recherche et filtres */}
        <GlassCard className="p-4 border-slate-200 bg-white/50 backdrop-blur-md sticky top-4 z-20 shadow-lg">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Rechercher un document..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/80 border-slate-200 h-11 focus:ring-2 focus:ring-orange-500"
                aria-label="Rechercher dans les documents"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48 h-11 bg-white/80 border-slate-200" aria-label="Filtrer par statut">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <SelectValue placeholder="Statut" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="verified">Vérifiés</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="draft">Brouillons</SelectItem>
                <SelectItem value="sent">Envoyés</SelectItem>
                <SelectItem value="paid">Payés</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </GlassCard>

        {/* Liste des documents */}
        {filteredDocuments.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Aucun document trouvé"
            description={
              searchQuery || categoryFilter !== "all" || statusFilter !== "all"
                ? "Essayez de modifier vos filtres ou effectuez une nouvelle recherche."
                : "Vos documents apparaîtront ici une fois créés."
            }
            action={
              categoryFilter === "compliance" || stats.compliance === 0
                ? {
                    label: "Compléter mon dossier",
                    href: "/provider/compliance",
                  }
                : undefined
            }
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filteredDocuments.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Info Section SOTA */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="mt-12 p-6 rounded-3xl bg-gradient-to-br from-slate-900 to-orange-950 text-white relative overflow-hidden"
        >
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                <Shield className="h-8 w-8 text-orange-400" />
              </div>
              <div>
                <h4 className="text-xl font-bold">Documents de conformité</h4>
                <p className="text-slate-400 text-sm max-w-md">
                  Gardez vos documents légaux à jour pour recevoir des missions. 
                  RC Pro, décennale, KBIS sont obligatoires.
                </p>
              </div>
            </div>
            <Button 
              asChild 
              variant="secondary" 
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md h-11 px-6"
            >
              <Link href="/provider/compliance">
                Gérer mes documents légaux
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
          <Building2 className="absolute -right-4 -bottom-4 h-32 w-32 text-white/5 rotate-12" />
        </motion.div>

      </div>
    </PageTransition>
  );
}

