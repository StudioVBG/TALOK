"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Plus,
  Search,
  Filter,
  FileText,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Building2,
  Calendar,
  Percent,
  CheckCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Données de démonstration
const mockMandates = [
  {
    id: "1",
    owner: { name: "Jean Dupont", email: "jean.dupont@email.com" },
    type: "gestion",
    numeroMandat: "MAN-2024-001",
    dateDebut: "2024-01-15",
    dateFin: null,
    biensCount: 3,
    commission: 7,
    status: "active",
    loyersMensuel: 3200,
  },
  {
    id: "2",
    owner: { name: "Marie Martin", email: "marie.martin@email.com" },
    type: "gestion",
    numeroMandat: "MAN-2024-002",
    dateDebut: "2024-03-01",
    dateFin: null,
    biensCount: 5,
    commission: 6.5,
    status: "active",
    loyersMensuel: 5800,
  },
  {
    id: "3",
    owner: { name: "SCI Les Oliviers", email: "contact@sci-oliviers.fr" },
    type: "gestion",
    numeroMandat: "MAN-2024-003",
    dateDebut: "2024-06-01",
    dateFin: null,
    biensCount: 8,
    commission: 6,
    status: "pending_signature",
    loyersMensuel: 9500,
  },
  {
    id: "4",
    owner: { name: "Pierre Lefebvre", email: "p.lefebvre@gmail.com" },
    type: "location",
    numeroMandat: "MAN-2024-004",
    dateDebut: "2024-09-15",
    dateFin: "2025-09-15",
    biensCount: 2,
    commission: 8,
    status: "active",
    loyersMensuel: 1800,
  },
  {
    id: "5",
    owner: { name: "Sophie Bernard", email: "s.bernard@outlook.com" },
    type: "gestion",
    numeroMandat: "MAN-2024-005",
    dateDebut: "2024-11-01",
    dateFin: null,
    biensCount: 1,
    commission: 8,
    status: "draft",
    loyersMensuel: 950,
  },
];

const statusConfig = {
  active: { label: "Actif", color: "border-emerald-500 text-emerald-600 bg-emerald-50" },
  pending_signature: { label: "En attente signature", color: "border-amber-500 text-amber-600 bg-amber-50" },
  draft: { label: "Brouillon", color: "border-slate-500 text-slate-600 bg-slate-50" },
  suspended: { label: "Suspendu", color: "border-orange-500 text-orange-600 bg-orange-50" },
  terminated: { label: "Terminé", color: "border-red-500 text-red-600 bg-red-50" },
};

const typeConfig = {
  gestion: { label: "Gestion locative", icon: Building2 },
  location: { label: "Mise en location", icon: FileText },
  vente: { label: "Vente", icon: FileText },
  syndic: { label: "Syndic", icon: Building2 },
};

export default function MandatesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredMandates = mockMandates.filter((mandate) => {
    const matchesSearch =
      mandate.owner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mandate.numeroMandat.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || mandate.status === statusFilter;
    const matchesType = typeFilter === "all" || mandate.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const stats = {
    total: mockMandates.length,
    active: mockMandates.filter((m) => m.status === "active").length,
    pending: mockMandates.filter((m) => m.status === "pending_signature").length,
    totalCommission: mockMandates
      .filter((m) => m.status === "active")
      .reduce((sum, m) => sum + (m.loyersMensuel * m.commission) / 100, 0),
  };

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
            Mandats de gestion
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos mandats avec les propriétaires
          </p>
        </div>
        <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700" asChild>
          <Link href="/agency/mandates/new">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau mandat
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total mandats</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Mandats actifs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">En attente</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <Percent className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalCommission.toFixed(0)}€</p>
              <p className="text-xs text-muted-foreground">Commissions/mois</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un propriétaire ou numéro de mandat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="pending_signature">En attente</SelectItem>
                <SelectItem value="draft">Brouillons</SelectItem>
                <SelectItem value="terminated">Terminés</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="gestion">Gestion locative</SelectItem>
                <SelectItem value="location">Mise en location</SelectItem>
                <SelectItem value="vente">Vente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Mandates List */}
      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Propriétaire</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">N° Mandat</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Type</th>
                  <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">Biens</th>
                  <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">Commission</th>
                  <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">Loyers/mois</th>
                  <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                  <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMandates.map((mandate) => {
                  const status = statusConfig[mandate.status as keyof typeof statusConfig];
                  const type = typeConfig[mandate.type as keyof typeof typeConfig];
                  const TypeIcon = type?.icon || FileText;

                  return (
                    <tr
                      key={mandate.id}
                      className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                            {mandate.owner.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium">{mandate.owner.name}</p>
                            <p className="text-xs text-muted-foreground">{mandate.owner.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                          {mandate.numeroMandat}
                        </code>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <TypeIcon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{type?.label}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="font-medium">{mandate.biensCount}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="font-semibold text-indigo-600">{mandate.commission}%</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="font-semibold">{mandate.loyersMensuel.toLocaleString("fr-FR")}€</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <Badge variant="outline" className={cn("text-xs", status.color)}>
                          {status.label}
                        </Badge>
                      </td>
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
                              Voir le détail
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Résilier
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

          {filteredMandates.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Aucun mandat trouvé</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

