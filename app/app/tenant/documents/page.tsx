"use client";
// @ts-nocheck

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useDocuments } from "@/lib/hooks/use-documents";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Download,
  Search,
  Calendar,
  Eye,
  FileCheck,
  Receipt,
  FileSignature,
  Shield,
  Folder,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const documentTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  bail: { label: "Bail", icon: FileSignature, color: "bg-blue-100 text-blue-800" },
  quittance: { label: "Quittance", icon: Receipt, color: "bg-green-100 text-green-800" },
  attestation_assurance: { label: "Attestation assurance", icon: Shield, color: "bg-purple-100 text-purple-800" },
  EDL_entree: { label: "EDL Entrée", icon: FileCheck, color: "bg-amber-100 text-amber-800" },
  EDL_sortie: { label: "EDL Sortie", icon: FileCheck, color: "bg-orange-100 text-orange-800" },
  facture: { label: "Facture", icon: Receipt, color: "bg-slate-100 text-slate-800" },
  autre: { label: "Autre", icon: FileText, color: "bg-gray-100 text-gray-800" },
};

function DocumentsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function TenantDocumentsPage() {
  const { data: documents = [], isLoading, error } = useDocuments();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredDocuments = documents.filter((doc: any) => {
    const matchesSearch =
      !searchQuery ||
      doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.type?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || doc.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Grouper par type pour les stats
  const stats = {
    total: documents.length,
    bail: documents.filter((d: any) => d.type === "bail").length,
    quittances: documents.filter((d: any) => d.type === "quittance").length,
    autres: documents.filter((d: any) => !["bail", "quittance"].includes(d.type)).length,
  };

  if (isLoading) {
    return <DocumentsSkeleton />;
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-6 space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold tracking-tight">Mes documents</h1>
        <p className="text-muted-foreground">
          Accédez à tous vos documents liés à votre location
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Folder className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Bail</p>
                <p className="text-2xl font-bold text-blue-600">{stats.bail}</p>
              </div>
              <FileSignature className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Quittances</p>
                <p className="text-2xl font-bold text-green-600">{stats.quittances}</p>
              </div>
              <Receipt className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Autres</p>
                <p className="text-2xl font-bold">{stats.autres}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Type de document" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="bail">Bail</SelectItem>
            <SelectItem value="quittance">Quittance</SelectItem>
            <SelectItem value="attestation_assurance">Attestation assurance</SelectItem>
            <SelectItem value="EDL_entree">EDL Entrée</SelectItem>
            <SelectItem value="EDL_sortie">EDL Sortie</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun document</h3>
              <p className="text-muted-foreground">
                {documents.length === 0
                  ? "Vous n'avez pas encore de documents."
                  : "Aucun document ne correspond à votre recherche."}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {filteredDocuments.map((doc: any) => {
            const config = documentTypeConfig[doc.type] || documentTypeConfig.autre;
            const Icon = config.icon;

            return (
              <motion.div key={doc.id} variants={itemVariants}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${config.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate group-hover:text-blue-600 transition-colors">
                          {doc.title || config.label}
                        </h3>
                        <Badge variant="outline" className="mt-1">
                          {config.label}
                        </Badge>
                        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(doc.created_at).toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Eye className="h-4 w-4 mr-1" />
                        Voir
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Download className="h-4 w-4 mr-1" />
                        Télécharger
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

