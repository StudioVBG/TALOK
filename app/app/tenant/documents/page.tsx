"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDocuments } from "@/lib/hooks/use-documents";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  FileText,
  Search,
  Calendar,
  Eye,
  FileCheck,
  Receipt,
  FileSignature,
  Shield,
  FolderOpen,
  Download,
  Filter,
  CheckCircle2,
  Info,
  Loader2,
  User,
  Sparkles
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentUploadModal } from "@/components/documents/DocumentUploadModal";
import { useTenantData } from "../_data/TenantDataProvider";
import { DocumentDownloadButton } from "@/components/documents/DocumentDownloadButton";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

// Configuration SOTA pour les types de documents
const DOCUMENT_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  bail: { label: "Bail de location", icon: FileSignature, color: "text-blue-600", bgColor: "bg-blue-50" },
  quittance: { label: "Quittance de loyer", icon: Receipt, color: "text-emerald-600", bgColor: "bg-emerald-50" },
  attestation_assurance: { label: "Assurance Habitation", icon: Shield, color: "text-indigo-600", bgColor: "bg-indigo-50" },
  EDL_entree: { label: "État des lieux d'entrée", icon: FileCheck, color: "text-amber-600", bgColor: "bg-amber-50" },
  EDL_sortie: { label: "État des lieux de sortie", icon: FileCheck, color: "text-orange-600", bgColor: "bg-orange-50" },
  facture: { label: "Facture", icon: FileText, color: "text-slate-600", bgColor: "bg-slate-50" },
  cni: { label: "Pièce d'identité", icon: User, color: "text-purple-600", bgColor: "bg-purple-50" },
  autre: { label: "Document", icon: FileText, color: "text-slate-400", bgColor: "bg-slate-100" },
};

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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default function TenantDocumentsPage() {
  const { data: documents = [], isLoading } = useDocuments();
  const { dashboard } = useTenantData();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const leaseId = dashboard?.lease?.id;
  const propertyId = dashboard?.lease?.property_id;

  // Intelligence de détection de type améliorée
  const detectType = (doc: any) => {
    const title = (doc.title || "").toLowerCase();
    const type = doc.type;

    if (type === 'quittance' || title.includes('quittance')) return 'quittance';
    if (type === 'bail' || title.includes('bail')) return 'bail';
    if (type === 'attestation_assurance' || title.includes('assurance')) return 'attestation_assurance';
    if (type === 'EDL_entree' || title.includes('entree')) return 'EDL_entree';
    if (type === 'EDL_sortie' || title.includes('sortie')) return 'EDL_sortie';
    if (type === 'facture' || title.includes('facture')) return 'facture';
    if (type === 'cni' || title.includes('identité') || title.includes('cni')) return 'cni';
    return type || 'autre';
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc: any) => {
      const type = detectType(doc);
      const matchesSearch =
        !searchQuery ||
        (doc.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        DOCUMENT_CONFIG[type]?.label.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "all" || type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [documents, searchQuery, typeFilter]);

  if (isLoading) return <DocumentsSkeleton />;

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        
        {/* Header SOTA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200">
                <FolderOpen className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mon Coffre-fort</h1>
            </div>
            <p className="text-slate-500 text-lg">
              Tous vos documents officiels et quittances sécurisés.
            </p>
          </div>
          <DocumentUploadModal leaseId={leaseId} propertyId={propertyId} />
        </div>

        {/* Barre de Recherche et Filtres */}
        <GlassCard className="p-4 border-slate-200 bg-white/50 backdrop-blur-md sticky top-4 z-20 shadow-lg">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Rechercher un contrat, une quittance..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/80 border-slate-200 h-11 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-56 h-11 bg-white/80 border-slate-200">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-400" />
                    <SelectValue placeholder="Catégorie" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les documents</SelectItem>
                  <SelectItem value="bail">Baux</SelectItem>
                  <SelectItem value="quittance">Quittances</SelectItem>
                  <SelectItem value="attestation_assurance">Assurance</SelectItem>
                  <SelectItem value="EDL_entree">États des lieux</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </GlassCard>

        {/* Liste des Documents - Bento Grid Style */}
        {filteredDocuments.length === 0 ? (
          <div className="py-24 text-center">
            <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="h-10 w-10 text-slate-200" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Aucun document trouvé</h3>
            <p className="text-slate-500">Essayez de modifier vos filtres ou effectuez une nouvelle recherche.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filteredDocuments.map((doc: any) => {
                const type = detectType(doc);
                const config = DOCUMENT_CONFIG[type] || DOCUMENT_CONFIG.autre;
                const Icon = config.icon;

                return (
                  <motion.div 
                    key={doc.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  >
                    <GlassCard className="group hover:shadow-2xl hover:border-indigo-200 transition-all duration-300 border-slate-200 bg-white h-full flex flex-col p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className={cn("p-3 rounded-2xl shadow-sm transition-transform group-hover:scale-110", config.bgColor)}>
                          <Icon className={cn("h-6 w-6", config.color)} />
                        </div>
                        <Badge variant="outline" className="bg-slate-50 text-[10px] uppercase tracking-wider font-bold">
                          {config.label}
                        </Badge>
                      </div>

                      <div className="flex-1 mb-6">
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
                          {doc.title || config.label}
                        </h3>
                        <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(doc.created_at).toLocaleDateString("fr-FR", { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                          {doc.metadata?.file_size && (
                            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded uppercase font-medium">
                              {(doc.metadata.file_size / 1024 / 1024).toFixed(2)} Mo
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4 border-t border-slate-100">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex-1 h-10 hover:bg-indigo-50 hover:text-indigo-600 font-semibold"
                          asChild
                        >
                          <a href={`/api/documents/${doc.id}/download`} target="_blank">
                            <Eye className="h-4 w-4 mr-2" /> Voir
                          </a>
                        </Button>
                        <DocumentDownloadButton 
                          type={
                            type === 'quittance' ? 'receipt' : 
                            type === 'bail' ? 'lease' : 
                            (type === 'EDL_entree' || type === 'EDL_sortie') ? 'edl' : 
                            'other'
                          }
                          documentId={doc.id}
                          leaseId={doc.lease_id}
                          edlId={doc.metadata?.edl_id}
                          variant="outline"
                          className="flex-1 h-10 hover:border-indigo-300 font-semibold shadow-sm"
                          label="Télécharger"
                        />
                      </div>
                    </GlassCard>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Section Infos Protection (SOTA Hint) */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="mt-12 p-6 rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white relative overflow-hidden"
        >
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                <Shield className="h-8 w-8 text-indigo-400" />
              </div>
              <div>
                <h4 className="text-xl font-bold">Sécurité de vos données</h4>
                <p className="text-slate-400 text-sm max-w-md">
                  Tous vos documents sont chiffrés et stockés conformément aux normes RGPD. Seuls vous et votre bailleur y avez accès.
                </p>
              </div>
            </div>
            <Button variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md h-11 px-6">
              En savoir plus sur la protection
            </Button>
          </div>
          <Sparkles className="absolute -right-4 -bottom-4 h-32 w-32 text-white/5 rotate-12" />
        </motion.div>

      </div>
    </PageTransition>
  );
}
