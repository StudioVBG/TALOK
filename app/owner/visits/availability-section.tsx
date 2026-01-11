"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronDown, Loader2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AvailabilityEditor } from "@/components/visit-scheduling";

interface Property {
  id: string;
  adresse_complete: string;
  ville: string;
  code_postal: string;
  type: string;
}

async function fetchOwnerProperties(): Promise<Property[]> {
  const res = await fetch("/api/properties?owner=me");
  if (!res.ok) throw new Error("Erreur lors du chargement des propriétés");
  const data = await res.json();
  return data.properties || [];
}

export function OwnerAvailabilitySection() {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["owner-properties"],
    queryFn: fetchOwnerProperties,
  });

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (properties.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">Aucun bien</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Ajoutez un bien pour configurer vos disponibilités de visite.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Property Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Sélectionnez un bien
          </CardTitle>
          <CardDescription>
            Configurez les disponibilités pour chaque bien séparément
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedPropertyId || ""}
            onValueChange={(value) => setSelectedPropertyId(value)}
          >
            <SelectTrigger className="w-full md:w-[400px]">
              <SelectValue placeholder="Choisir un bien..." />
            </SelectTrigger>
            <SelectContent>
              {properties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{property.adresse_complete}</span>
                    <span className="text-xs text-muted-foreground">
                      {property.code_postal} {property.ville} • {property.type}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Availability Editor for Selected Property */}
      {selectedPropertyId && selectedProperty && (
        <AvailabilityEditor
          propertyId={selectedPropertyId}
          propertyAddress={`${selectedProperty.adresse_complete}, ${selectedProperty.ville}`}
        />
      )}

      {!selectedPropertyId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <ChevronDown className="h-8 w-8 mb-2 opacity-50" />
            <p>Sélectionnez un bien ci-dessus pour gérer ses disponibilités</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
