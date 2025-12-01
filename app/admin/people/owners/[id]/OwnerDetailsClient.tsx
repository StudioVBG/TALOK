"use client";
// @ts-nocheck

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Mail, Phone, User } from "lucide-react";
import { formatDateShort } from "@/lib/helpers/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { AdminOwnerDetails } from "../../../_data/fetchAdminOwnerDetails";

interface OwnerDetailsClientProps {
  owner: AdminOwnerDetails;
}

export function OwnerDetailsClient({ owner }: OwnerDetailsClientProps) {
  const ownerName = `${owner.prenom || ""} ${owner.nom || ""}`.trim() || "Sans nom";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/people">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={owner.avatar_url || undefined} />
              <AvatarFallback>{owner.prenom?.[0]}{owner.nom?.[0]}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold">{ownerName}</h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Badge variant="outline" className="capitalize">
                  {owner.role}
                </Badge>
                <span>•</span>
                <span>Inscrit le {formatDateShort(owner.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
        <Button variant="outline">Modifier</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Colonne Gauche : Infos */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Coordonnées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{owner.email || "Non renseigné"}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{owner.telephone || "Non renseigné"}</span>
              </div>
              {owner.owner_profiles && (
                <div className="pt-4 border-t mt-4">
                  <p className="text-sm font-medium mb-2">Infos Professionnelles</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="capitalize">{owner.owner_profiles.type}</span>
                    </div>
                    {owner.owner_profiles.siret && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">SIRET</span>
                        <span>{owner.owner_profiles.siret}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Statistiques</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Biens</span>
                <span className="font-bold text-lg">{owner.stats.totalProperties}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Baux actifs</span>
                <span className="font-bold text-lg text-green-600">{owner.stats.activeLeases}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Colonne Droite : Propriétés */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Parc Immobilier ({owner.properties.length})</CardTitle>
              <CardDescription>Liste des biens gérés par ce propriétaire</CardDescription>
            </CardHeader>
            <CardContent>
              {owner.properties.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Home className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Aucun bien enregistré.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {owner.properties.map((property) => (
                    <Link key={property.id} href={`/admin/properties/${property.id}`}>
                      <div className="border rounded-lg p-4 hover:bg-slate-50 transition-colors cursor-pointer">
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant="secondary" className="capitalize">{property.type}</Badge>
                          <Badge variant="outline">{property.statut}</Badge>
                        </div>
                        <h4 className="font-medium line-clamp-1" title={property.adresse_complete}>
                          {property.adresse_complete}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {property.code_postal} {property.ville}
                        </p>
                        <div className="mt-3 text-sm flex gap-3 text-slate-500">
                          {property.surface && <span>{property.surface} m²</span>}
                          {property.nb_pieces && <span>{property.nb_pieces} p.</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

