"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  FolderOpen,
  FileText,
  Download,
  Eye,
  Upload,
  Filter,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Données de démonstration
const mockDocuments = [
  {
    id: "1",
    name: "Mandat de gestion - Jean Dupont.pdf",
    type: "mandat",
    owner: "Jean Dupont",
    size: "2.4 MB",
    date: "15/01/2024",
  },
  {
    id: "2",
    name: "Bail - Sophie Bernard.pdf",
    type: "bail",
    owner: "Jean Dupont",
    size: "1.8 MB",
    date: "01/03/2024",
  },
  {
    id: "3",
    name: "EDL Entrée - 15 Rue Victor Hugo.pdf",
    type: "edl",
    owner: "Jean Dupont",
    size: "5.2 MB",
    date: "01/03/2024",
  },
  {
    id: "4",
    name: "Mandat de gestion - Marie Martin.pdf",
    type: "mandat",
    owner: "Marie Martin",
    size: "2.1 MB",
    date: "01/03/2024",
  },
  {
    id: "5",
    name: "Quittance Novembre 2024 - Sophie Bernard.pdf",
    type: "quittance",
    owner: "Jean Dupont",
    size: "156 KB",
    date: "01/12/2024",
  },
  {
    id: "6",
    name: "Facture Commission - Décembre 2024.pdf",
    type: "facture",
    owner: "Tous",
    size: "245 KB",
    date: "05/12/2024",
  },
];

const typeConfig = {
  mandat: { label: "Mandat", color: "border-indigo-500 text-indigo-600 bg-indigo-50" },
  bail: { label: "Bail", color: "border-purple-500 text-purple-600 bg-purple-50" },
  edl: { label: "EDL", color: "border-sky-500 text-sky-600 bg-sky-50" },
  quittance: { label: "Quittance", color: "border-emerald-500 text-emerald-600 bg-emerald-50" },
  facture: { label: "Facture", color: "border-amber-500 text-amber-600 bg-amber-50" },
};

export default function AgencyDocumentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredDocuments = mockDocuments.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.owner.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || doc.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Documents
          </h1>
          <p className="text-muted-foreground mt-1">
            Tous les documents de l'agence
          </p>
        </div>
        <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700">
          <Upload className="w-4 h-4 mr-2" />
          Importer
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {Object.entries(typeConfig).map(([type, config]) => {
          const count = mockDocuments.filter((d) => d.type === type).length;
          return (
            <Card key={type} className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <Badge variant="outline" className={cn("text-xs mb-2", config.color)}>
                  {config.label}
                </Badge>
                <p className="text-2xl font-bold">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un document..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="mandat">Mandats</SelectItem>
                <SelectItem value="bail">Baux</SelectItem>
                <SelectItem value="edl">États des lieux</SelectItem>
                <SelectItem value="quittance">Quittances</SelectItem>
                <SelectItem value="facture">Factures</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Document</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Type</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Propriétaire</th>
                  <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">Taille</th>
                  <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((doc) => {
                  const type = typeConfig[doc.type as keyof typeof typeConfig];
                  return (
                    <tr
                      key={doc.id}
                      className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                            <FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                          </div>
                          <span className="font-medium text-sm">{doc.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant="outline" className={cn("text-xs", type.color)}>
                          {type.label}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">{doc.owner}</td>
                      <td className="py-4 px-4 text-right text-sm text-muted-foreground">{doc.size}</td>
                      <td className="py-4 px-4 text-right text-sm text-muted-foreground">{doc.date}</td>
                      <td className="py-4 px-4 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" />
                              Aperçu
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="w-4 h-4 mr-2" />
                              Télécharger
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredDocuments.length === 0 && (
            <div className="text-center py-12">
              <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Aucun document trouvé</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

