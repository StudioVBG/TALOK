"use client";
// @ts-nocheck

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  Search,
  Filter,
  Eye,
  Mail,
  Phone,
  MapPin,
  Euro,
  Calendar,
  CheckCircle,
  AlertCircle,
  Shield,
  Building2,
  BadgeCheck,
  User,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";

interface Tenant {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  telephone?: string;
  avatar_url?: string;
  created_at: string;
  tenant_profile?: {
    situation_pro?: string;
    revenus_mensuels?: number;
    cni_verified_at?: string;
  };
  roommates?: Array<{
    lease?: {
      id: string;
      type_bail: string;
      loyer: number;
      statut: string;
      date_debut: string;
      property?: {
        adresse_complete: string;
        ville: string;
        owner?: {
          prenom: string;
          nom: string;
        };
      };
    };
  }>;
}

interface TenantsListClientProps {
  tenants: Tenant[];
}

// Animation variants
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

export function TenantsListClient({ tenants }: TenantsListClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [identityFilter, setIdentityFilter] = useState<string>("all");

  // Stats
  const stats = useMemo(() => {
    const total = tenants.length;
    const verified = tenants.filter(t => t.tenant_profile?.cni_verified_at).length;
    const withActiveLease = tenants.filter(t => 
      t.roommates?.some(r => r.lease?.statut === "active")
    ).length;

    return { total, verified, withActiveLease };
  }, [tenants]);

  // Filtrage
  const filteredTenants = useMemo(() => {
    let result = tenants;

    // Recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.nom?.toLowerCase().includes(query) ||
        t.prenom?.toLowerCase().includes(query) ||
        t.email?.toLowerCase().includes(query) ||
        t.telephone?.includes(query)
      );
    }

    // Filtre statut bail
    if (statusFilter !== "all") {
      result = result.filter(t => {
        const hasActiveLease = t.roommates?.some(r => r.lease?.statut === "active");
        if (statusFilter === "active") return hasActiveLease;
        if (statusFilter === "none") return !t.roommates?.length;
        return true;
      });
    }

    // Filtre identité
    if (identityFilter !== "all") {
      result = result.filter(t => {
        const isVerified = !!t.tenant_profile?.cni_verified_at;
        if (identityFilter === "verified") return isVerified;
        if (identityFilter === "pending") return !isVerified;
        return true;
      });
    }

    return result;
  }, [tenants, searchQuery, statusFilter, identityFilter]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            Locataires
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérer tous les locataires de la plateforme
          </p>
        </div>
        <Button className="gap-2">
          <FileText className="h-4 w-4" />
          Exporter
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total locataires</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Identité vérifiée</p>
                <p className="text-2xl font-bold">{stats.verified}</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-xl">
                <BadgeCheck className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avec bail actif</p>
                <p className="text-2xl font-bold">{stats.withActiveLease}</p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-xl">
                <Building2 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, email, téléphone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut bail" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">Bail actif</SelectItem>
                <SelectItem value="none">Sans bail</SelectItem>
              </SelectContent>
            </Select>
            <Select value={identityFilter} onValueChange={setIdentityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Identité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="verified">Vérifiée</SelectItem>
                <SelectItem value="pending">Non vérifiée</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Liste des locataires */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-3"
      >
        {filteredTenants.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun locataire trouvé</h3>
              <p className="text-muted-foreground">
                {searchQuery ? "Modifiez vos critères de recherche" : "Aucun locataire enregistré"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredTenants.map((tenant) => {
            const currentLease = tenant.roommates?.[0]?.lease;
            const isVerified = !!tenant.tenant_profile?.cni_verified_at;

            return (
              <motion.div key={tenant.id} variants={itemVariants}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <Avatar className="h-12 w-12 border-2 border-white shadow">
                        <AvatarImage src={tenant.avatar_url} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                          {tenant.prenom?.[0]}{tenant.nom?.[0]}
                        </AvatarFallback>
                      </Avatar>

                      {/* Infos principales */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900 dark:text-white">
                                {tenant.prenom} {tenant.nom}
                              </h3>
                              {isVerified && (
                                <BadgeCheck className="h-4 w-4 text-green-500" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {tenant.email}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {isVerified ? (
                              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                <Shield className="h-3 w-3 mr-1" />
                                Vérifié
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Non vérifié
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Détails */}
                        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                          {tenant.telephone && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {tenant.telephone}
                            </span>
                          )}
                          {tenant.tenant_profile?.revenus_mensuels && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Euro className="h-3 w-3" />
                              {formatCurrency(tenant.tenant_profile.revenus_mensuels)}/mois
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            Inscrit le {formatDateShort(tenant.created_at)}
                          </span>
                        </div>

                        {/* Bail en cours */}
                        {currentLease && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">
                                  {currentLease.property?.adresse_complete}, {currentLease.property?.ville}
                                </span>
                                <Badge variant={currentLease.statut === "active" ? "default" : "secondary"} className="text-xs">
                                  {currentLease.statut === "active" ? "Actif" : currentLease.statut}
                                </Badge>
                              </div>
                              <span className="text-sm font-medium text-primary">
                                {formatCurrency(currentLease.loyer)}/mois
                              </span>
                            </div>
                            {currentLease.property?.owner && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Propriétaire: {currentLease.property.owner.prenom} {currentLease.property.owner.nom}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="shrink-0">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/tenants/${tenant.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            Voir
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </motion.div>

      {/* Pagination info */}
      {filteredTenants.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Affichage de {filteredTenants.length} locataire{filteredTenants.length > 1 ? "s" : ""} sur {tenants.length}
        </p>
      )}
    </div>
  );
}

