"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, FileText, Plus, Calendar, Euro, ArrowRight } from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { cn } from "@/lib/utils";
import { useOwnerData } from "../_data/OwnerDataProvider";

export function ContractsClient() {
  const searchParams = useSearchParams();
  const propertyIdFilter = searchParams.get("property_id");
  const filterParam = searchParams.get("filter");

  // Utiliser les données du Context
  const { contracts: allContracts, properties: propertiesData } = useOwnerData();
  
  const leases = allContracts || [];
  const properties = propertiesData?.properties || [];

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>(
    filterParam === "pending_signature" ? "pending_signature" : "all"
  );

  // Filtrer les baux
  let filteredLeases = leases;

  // Pré-filtrage par property_id si présent dans l'URL
  if (propertyIdFilter) {
    filteredLeases = filteredLeases.filter((lease: any) => lease.property_id === propertyIdFilter);
  }

  if (searchQuery) {
    filteredLeases = filteredLeases.filter((lease: any) => {
      const property = properties.find((p: any) => p.id === lease.property_id);
      return property?.adresse_complete?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }

  if (typeFilter !== "all") {
    filteredLeases = filteredLeases.filter((l: any) => l.type_bail === typeFilter);
  }

  if (statusFilter !== "all") {
    if (statusFilter === "pending_signature") {
      filteredLeases = filteredLeases.filter((l: any) => l.statut === "pending_signature");
    } else if (statusFilter === "active") {
      filteredLeases = filteredLeases.filter((l: any) => l.statut === "active");
    } else if (statusFilter === "terminated") {
      filteredLeases = filteredLeases.filter((l: any) => l.statut === "terminated");
    }
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      nu: "Habitation (nu)",
      meuble: "Habitation (meublé)",
      colocation: "Colocation",
      saisonnier: "Saisonnier",
      commercial: "Commercial",
      pro: "Professionnel",
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      pending_signature: "secondary",
      terminated: "outline",
      draft: "outline",
    };
    const labels: Record<string, string> = {
      active: "En cours",
      pending_signature: "En attente de signature",
      terminated: "Terminé",
      draft: "Brouillon",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header avec animation */}
        <div className="flex items-center justify-between mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent">
              Baux & locataires
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Gérez vos contrats et vos locataires
            </p>
          </div>
          <Button asChild className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <Link href="/leases/new">
              <Plus className="mr-2 h-4 w-4" />
              Créer un bail
            </Link>
          </Button>
        </div>

        {/* Onglets */}
        <Tabs defaultValue="leases" className="space-y-6">
          <TabsList>
            <TabsTrigger value="leases">Baux & contrats</TabsTrigger>
            <TabsTrigger value="tenants">Locataires & garants</TabsTrigger>
          </TabsList>

          {/* Baux & contrats */}
          <TabsContent value="leases">
            {/* Filtres */}
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par adresse..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Type bail" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="nu">Habitation (nu)</SelectItem>
                  <SelectItem value="meuble">Habitation (meublé)</SelectItem>
                  <SelectItem value="colocation">Colocation</SelectItem>
                  <SelectItem value="saisonnier">Saisonnier</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="pro">Professionnel</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="active">En cours</SelectItem>
                  <SelectItem value="pending_signature">En attente</SelectItem>
                  <SelectItem value="terminated">Terminé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Liste des baux */}
            {filteredLeases.length === 0 ? (
              <EmptyStateLeases />
            ) : (
              <div className="space-y-4">
                {filteredLeases.map((lease: any, index: number) => {
                  const property = properties.find((p: any) => p.id === lease.property_id);
                  return (
                    <Card
                      key={lease.id}
                      className={cn(
                        "hover:shadow-xl transition-all duration-300 hover:scale-[1.01] cursor-pointer group",
                        "animate-in fade-in slide-in-from-left-4"
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                              <span className="font-medium">
                                Bail {lease.type_bail ? getTypeLabel(lease.type_bail) : "N/A"}
                              </span>
                              {getStatusBadge(lease.statut)}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {property?.adresse_complete || "Bien non trouvé"}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>
                                  Du {formatDateShort(lease.date_debut)}
                                  {lease.date_fin && ` au ${formatDateShort(lease.date_fin)}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Euro className="h-4 w-4" />
                                <span>
                                  {formatCurrency(
                                    Number(lease.loyer || 0) +
                                      Number(lease.charges_forfaitaires || 0)
                                  )}
                                  /mois
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 group-hover:bg-slate-900 group-hover:text-white"
                            >
                              <Link href={`/app/owner/contracts/${lease.id}`}>
                                Voir
                                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Locataires & garants */}
          <TabsContent value="tenants">
            <Card>
              <CardHeader>
                <CardTitle>Locataires & garants</CardTitle>
                <CardDescription>
                  Liste de toutes les personnes liées à vos baux
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  La liste des locataires et garants sera disponible ici.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/app/owner/contracts">
                    Voir les baux pour plus de détails
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EmptyStateLeases() {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          Vous n'avez pas encore de bail
        </h2>
        <p className="text-muted-foreground mb-6">
          Créez d'abord un bien, puis cliquez sur "Créer un bail" depuis la fiche du bien.
        </p>
        <div className="flex gap-2 justify-center">
          <Button asChild variant="outline">
            <Link href="/app/owner/properties">Voir mes biens</Link>
          </Button>
          <Button asChild>
            <Link href="/leases/new">
              <Plus className="mr-2 h-4 w-4" />
              Créer un bail
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

