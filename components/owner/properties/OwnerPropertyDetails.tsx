"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import type { OwnerProperty } from "@/lib/owner/types";
import { cn } from "@/lib/utils";

interface OwnerPropertyDetailsProps {
  property: OwnerProperty;
}

const DPE_CLASSES = {
  A: { label: "A", color: "bg-green-500" },
  B: { label: "B", color: "bg-green-400" },
  C: { label: "C", color: "bg-yellow-400" },
  D: { label: "D", color: "bg-yellow-500" },
  E: { label: "E", color: "bg-orange-500" },
  F: { label: "F", color: "bg-red-500" },
  G: { label: "G", color: "bg-red-600" },
};

const CHAUFFAGE_TYPES: Record<string, string> = {
  individuel: "Individuel",
  collectif: "Collectif",
  electrique: "Électrique",
  gaz: "Gaz",
  fioul: "Fioul",
  bois: "Bois",
  pompe_a_chaleur: "Pompe à chaleur",
};

const CLIM_TYPES: Record<string, string> = {
  oui: "Oui",
  non: "Non",
  reversible: "Réversible",
  split: "Split",
  gainable: "Gainable",
};

export function OwnerPropertyDetails({ property }: OwnerPropertyDetailsProps) {
  const hasDPE = property.dpe_classe_energie || property.dpe_classe_climat;
  const hasEquipments = property.has_balcon || property.has_terrasse || property.has_jardin || property.has_cave;
  const hasTechnicalInfo = property.chauffage_type || property.clim_presence || property.eau_chaude_type;

  return (
    <div className="space-y-6">
      {/* DPE & Diagnostics */}
      {hasDPE && (
        <Card>
          <CardHeader>
            <CardTitle>DPE & Diagnostics</CardTitle>
            <CardDescription>Diagnostic de performance énergétique</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {property.dpe_classe_energie && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Classe énergétique</p>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-12 h-12 rounded flex items-center justify-center text-white font-bold",
                      DPE_CLASSES[property.dpe_classe_energie as keyof typeof DPE_CLASSES]?.color || "bg-gray-500"
                    )}>
                      {property.dpe_classe_energie}
                    </div>
                    {property.dpe_consommation && (
                      <div>
                        <p className="text-sm font-medium">{property.dpe_consommation} kWh/m²/an</p>
                        <p className="text-xs text-muted-foreground">Consommation</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {property.dpe_classe_climat && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Émissions GES</p>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-12 h-12 rounded flex items-center justify-center text-white font-bold",
                      DPE_CLASSES[property.dpe_classe_climat as keyof typeof DPE_CLASSES]?.color || "bg-gray-500"
                    )}>
                      {property.dpe_classe_climat}
                    </div>
                    {property.dpe_emissions && (
                      <div>
                        <p className="text-sm font-medium">{property.dpe_emissions} kg CO₂/m²/an</p>
                        <p className="text-xs text-muted-foreground">Émissions</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Équipements */}
      {hasEquipments && (
        <Card>
          <CardHeader>
            <CardTitle>Équipements</CardTitle>
            <CardDescription>Équipements disponibles dans le bien</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {property.has_balcon && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm">Balcon</span>
                </div>
              )}
              {property.has_terrasse && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm">Terrasse</span>
                </div>
              )}
              {property.has_jardin && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm">Jardin</span>
                </div>
              )}
              {property.has_cave && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm">Cave</span>
                </div>
              )}
              {property.ascenseur && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm">Ascenseur</span>
                </div>
              )}
            </div>
            
            {property.equipments && property.equipments.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Autres équipements</p>
                <div className="flex flex-wrap gap-2">
                  {property.equipments.map((eq, index) => (
                    <Badge key={index} variant="secondary">{eq}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Informations techniques */}
      {hasTechnicalInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Informations techniques</CardTitle>
            <CardDescription>Chauffage, climatisation, eau chaude</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {property.chauffage_type && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Chauffage</p>
                <p className="text-sm font-medium">
                  {CHAUFFAGE_TYPES[property.chauffage_type] || property.chauffage_type}
                  {property.chauffage_energie && ` - ${property.chauffage_energie}`}
                </p>
              </div>
            )}
            
            {property.clim_presence && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Climatisation</p>
                <p className="text-sm font-medium">
                  {CLIM_TYPES[property.clim_presence] || property.clim_presence}
                  {property.clim_type && ` (${property.clim_type})`}
                </p>
              </div>
            )}
            
            {property.eau_chaude_type && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Eau chaude</p>
                <p className="text-sm font-medium">{property.eau_chaude_type}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Permis de louer */}
      {property.permis_louer_requis !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle>Permis de louer</CardTitle>
            <CardDescription>Conformité locative</CardDescription>
          </CardHeader>
          <CardContent>
            {property.permis_louer_requis ? (
              <div className="space-y-2">
                {property.permis_louer_numero ? (
                  <>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium">Permis obtenu</span>
                    </div>
                    <div className="pl-7 space-y-1">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Numéro :</span> {property.permis_louer_numero}
                      </p>
                      {property.permis_louer_date && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Date :</span>{" "}
                          {new Date(property.permis_louer_date).toLocaleDateString("fr-FR")}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <span className="text-sm">Permis requis mais non renseigné</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Non requis pour ce type de bien</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Parking */}
      {(property.parking_type || property.parking_numero) && (
        <Card>
          <CardHeader>
            <CardTitle>Parking</CardTitle>
            <CardDescription>Informations sur le stationnement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {property.parking_type && (
              <p className="text-sm">
                <span className="text-muted-foreground">Type :</span> {property.parking_type}
              </p>
            )}
            {property.parking_numero && (
              <p className="text-sm">
                <span className="text-muted-foreground">Numéro :</span> {property.parking_numero}
              </p>
            )}
            {property.parking_niveau && (
              <p className="text-sm">
                <span className="text-muted-foreground">Niveau :</span> {property.parking_niveau}
              </p>
            )}
            {property.parking_gabarit && (
              <p className="text-sm">
                <span className="text-muted-foreground">Gabarit :</span> {property.parking_gabarit}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Local commercial */}
      {(property.local_type || property.local_surface_totale) && (
        <Card>
          <CardHeader>
            <CardTitle>Local commercial</CardTitle>
            <CardDescription>Caractéristiques du local</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {property.local_type && (
              <p className="text-sm">
                <span className="text-muted-foreground">Type :</span> {property.local_type}
              </p>
            )}
            {property.local_surface_totale && (
              <p className="text-sm">
                <span className="text-muted-foreground">Surface totale :</span> {property.local_surface_totale} m²
              </p>
            )}
            <div className="flex flex-wrap gap-4 mt-4">
              {property.local_has_vitrine && (
                <Badge variant="secondary">Vitrine</Badge>
              )}
              {property.local_access_pmr && (
                <Badge variant="secondary">Accès PMR</Badge>
              )}
              {property.local_clim && (
                <Badge variant="secondary">Climatisation</Badge>
              )}
              {property.local_fibre && (
                <Badge variant="secondary">Fibre</Badge>
              )}
              {property.local_alarme && (
                <Badge variant="secondary">Alarme</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

