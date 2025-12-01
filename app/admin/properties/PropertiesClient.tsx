"use client";
// @ts-nocheck

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { Search, Eye, Building2 } from "lucide-react";
import { formatDateShort } from "@/lib/helpers/format";

interface PropertiesClientProps {
  initialData: {
    properties: any[];
    total: number;
  };
}

export function PropertiesClient({ initialData }: PropertiesClientProps) {
  const [search, setSearch] = useState("");
  const [properties] = useState(initialData.properties);

  const filteredProperties = useMemo(() => {
    if (!properties) return [];
    return properties.filter((p: any) =>
      (p.adresse_complete?.toLowerCase().includes(search.toLowerCase()) ||
       p.ville?.toLowerCase().includes(search.toLowerCase()) ||
       p.owner?.nom?.toLowerCase().includes(search.toLowerCase()))
    );
  }, [properties, search]);

  const getStatusBadge = (status: string) => {
    // Adaptation des statuts selon le modèle
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      draft: "outline",
      rented: "secondary",
      archived: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const columns = [
    {
      header: "Bien",
      cell: (property: any) => (
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium truncate max-w-[200px]" title={property.adresse_complete}>
              {property.adresse_complete}
            </span>
          </div>
          <div className="text-xs text-muted-foreground ml-6">
            {property.code_postal} {property.ville}
          </div>
        </div>
      )
    },
    {
      header: "Type",
      cell: (property: any) => <span className="capitalize">{property.type}</span>
    },
    {
      header: "Propriétaire",
      cell: (property: any) => property.owner ? (
        <div className="flex flex-col">
          <span className="text-sm">{property.owner.prenom} {property.owner.nom}</span>
          <span className="text-xs text-muted-foreground">{property.owner.email}</span>
        </div>
      ) : (
        <span className="text-muted-foreground italic">Inconnu</span>
      )
    },
    {
      header: "Statut",
      cell: (property: any) => getStatusBadge(property.statut || "draft")
    },
    {
      header: "Créé le",
      cell: (property: any) => formatDateShort(property.created_at)
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (property: any) => (
        <div className="flex justify-end">
          <Link href={`/admin/properties/${property.id}`}>
            <Button variant="ghost" size="sm">
              <Eye className="h-4 w-4 mr-1" />
              Voir
            </Button>
          </Link>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Parc Immobilier</h1>
        <p className="text-muted-foreground">
          Gestion de l'ensemble des biens de la plateforme
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Liste des biens</CardTitle>
              <CardDescription>
                {initialData.total} biens enregistrés
              </CardDescription>
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (adresse, ville, propriétaire)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveTable
            data={filteredProperties}
            columns={columns}
            keyExtractor={(property) => property.id}
            emptyMessage="Aucun bien trouvé"
          />
        </CardContent>
      </Card>
    </div>
  );
}

