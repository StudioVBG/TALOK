"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
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
  FileText,
  Search,
  Download,
  Eye,
  Calendar,
  Building2,
  Filter,
  Loader2,
  File,
  FileImage,
  FileSpreadsheet,
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

interface Document {
  id: string;
  name: string;
  type: "pv" | "reglement" | "contrat" | "facture" | "autre";
  site_name?: string;
  created_at: string;
  size?: string;
  file_type: "pdf" | "image" | "spreadsheet" | "other";
}

const typeConfig = {
  pv: { label: "PV d'assemblée", color: "bg-blue-100 text-blue-700" },
  reglement: { label: "Règlement", color: "bg-purple-100 text-purple-700" },
  contrat: { label: "Contrat", color: "bg-green-100 text-green-700" },
  facture: { label: "Facture", color: "bg-amber-100 text-amber-700" },
  autre: { label: "Autre", color: "bg-slate-100 text-slate-700" },
};

const fileIcons = {
  pdf: FileText,
  image: FileImage,
  spreadsheet: FileSpreadsheet,
  other: File,
};

export default function CoproDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchDocuments() {
      try {
        // Simulation - en production, appeler l'API
        const mockDocuments: Document[] = [
          {
            id: "1",
            name: "PV AG 2024",
            type: "pv",
            site_name: "Résidence Les Jardins",
            created_at: "2024-03-15",
            size: "2.4 MB",
            file_type: "pdf",
          },
          {
            id: "2",
            name: "Règlement de copropriété",
            type: "reglement",
            site_name: "Résidence Les Jardins",
            created_at: "2020-06-01",
            size: "5.1 MB",
            file_type: "pdf",
          },
          {
            id: "3",
            name: "Contrat entretien ascenseur",
            type: "contrat",
            site_name: "Résidence Les Jardins",
            created_at: "2024-01-10",
            size: "1.2 MB",
            file_type: "pdf",
          },
          {
            id: "4",
            name: "Facture travaux toiture",
            type: "facture",
            site_name: "Résidence Les Jardins",
            created_at: "2024-09-20",
            size: "890 KB",
            file_type: "pdf",
          },
        ];
        setDocuments(mockDocuments);
      } catch (error) {
        console.error("Erreur chargement documents:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchDocuments();
  }, []);

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      !searchQuery ||
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.site_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || doc.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const stats = {
    total: documents.length,
    pv: documents.filter((d) => d.type === "pv").length,
    reglement: documents.filter((d) => d.type === "reglement").length,
    contrat: documents.filter((d) => d.type === "contrat").length,
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
            Documents
          </h1>
          <p className="text-muted-foreground mt-1">
            Accédez aux documents de votre copropriété
          </p>
        </div>
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
              <FileText className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">PV</p>
                <p className="text-2xl font-bold text-blue-600">{stats.pv}</p>
              </div>
              <File className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Règlements</p>
                <p className="text-2xl font-bold text-purple-600">{stats.reglement}</p>
              </div>
              <FileText className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Contrats</p>
                <p className="text-2xl font-bold text-green-600">{stats.contrat}</p>
              </div>
              <FileSpreadsheet className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/80 backdrop-blur-sm"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px] bg-white/80 backdrop-blur-sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="pv">PV d'assemblée</SelectItem>
            <SelectItem value="reglement">Règlement</SelectItem>
            <SelectItem value="contrat">Contrat</SelectItem>
            <SelectItem value="facture">Facture</SelectItem>
            <SelectItem value="autre">Autre</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="py-16 text-center">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun document</h3>
              <p className="text-muted-foreground">
                {documents.length === 0
                  ? "Aucun document n'est encore disponible."
                  : "Aucun document ne correspond à vos critères."}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} className="space-y-3">
          {filteredDocuments.map((doc) => {
            const type = typeConfig[doc.type] || typeConfig.autre;
            const FileIcon = fileIcons[doc.file_type] || fileIcons.other;

            return (
              <motion.div key={doc.id} variants={itemVariants}>
                <Card className="bg-white/80 backdrop-blur-sm hover:bg-white hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                        <FileIcon className="h-6 w-6 text-indigo-600" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{doc.name}</h3>
                          <Badge className={type.color}>{type.label}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {doc.site_name && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {doc.site_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(doc.created_at), "dd/MM/yyyy", { locale: fr })}
                          </span>
                          {doc.size && <span>{doc.size}</span>}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
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

