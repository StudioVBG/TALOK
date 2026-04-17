"use client";

import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MapPin,
  Home,
  Ruler,
  DoorOpen,
  Calendar,
  Zap,
  Thermometer,
  Car,
  Mountain,
} from "lucide-react";
import { usePublicListing, useCreateApplication } from "@/lib/hooks/queries/use-candidatures";
import { PublicApplicationForm } from "@/features/candidatures/components/PublicApplicationForm";
import { BAIL_TYPE_LABELS } from "@/lib/types/candidatures";
import { formatCurrency } from "@/lib/helpers/format";
import type { CreateApplicationInput } from "@/lib/validations/candidatures";

export default function PublicListingPage() {
  const params = useParams();
  const token = params.token as string;

  const { data: listing, isLoading, error } = usePublicListing(token);
  const createApplication = useCreateApplication();

  const handleSubmitApplication = async (data: CreateApplicationInput) => {
    await createApplication.mutateAsync(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="animate-pulse space-y-6">
            <div className="h-64 bg-muted rounded-xl" />
            <div className="h-8 bg-muted rounded w-2/3" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
        <Card className="max-w-md mx-auto text-center">
          <CardContent className="py-12">
            <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Annonce introuvable</h2>
            <p className="text-muted-foreground">
              Cette annonce n'existe pas ou n'est plus disponible.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const property = listing.property as any;
  const rent = listing.rent_amount_cents / 100;
  const charges = listing.charges_cents / 100;
  const photos = (listing.photos || []) as any[];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4 py-6 md:py-12 max-w-4xl">
        {/* Photos */}
        {photos.length > 0 && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl overflow-hidden">
            {photos.slice(0, 4).map((photo: any, i: number) => (
              <div
                key={i}
                className={`relative ${i === 0 ? "md:row-span-2 h-64 md:h-full" : "h-40"}`}
              >
                <img
                  src={photo.url}
                  alt={photo.caption || `Photo ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {/* Cover image fallback */}
        {photos.length === 0 && property.cover_url && (
          <div className="mb-8 rounded-xl overflow-hidden">
            <img
              src={property.cover_url}
              alt={listing.title}
              className="w-full h-64 md:h-80 object-cover"
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-6">
            {/* Titre + prix */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  {listing.title}
                </h1>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(rent)}
                    <span className="text-sm font-normal text-muted-foreground">/mois</span>
                  </p>
                  {charges > 0 && (
                    <p className="text-sm text-muted-foreground">
                      + {formatCurrency(charges)} charges
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{property.adresse_complete}, {property.code_postal} {property.ville}</span>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="outline">{BAIL_TYPE_LABELS[listing.bail_type as keyof typeof BAIL_TYPE_LABELS] || listing.bail_type}</Badge>
                <Badge variant="secondary">{property.type}</Badge>
              </div>
            </div>

            {/* Caractéristiques */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Caractéristiques</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  {property.surface && (
                    <div className="flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-muted-foreground" />
                      <span>{property.surface} m²</span>
                    </div>
                  )}
                  {property.nb_pieces && (
                    <div className="flex items-center gap-2">
                      <DoorOpen className="h-4 w-4 text-muted-foreground" />
                      <span>{property.nb_pieces} pièce{property.nb_pieces > 1 ? "s" : ""}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Dispo {new Date(listing.available_from).toLocaleDateString("fr-FR")}</span>
                  </div>
                  {property.etage !== undefined && property.etage !== null && (
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {property.etage === 0 ? "RDC" : `${property.etage}e étage`}
                      </span>
                    </div>
                  )}
                  {property.dpe_classe_energie && (
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span>DPE : {property.dpe_classe_energie}</span>
                    </div>
                  )}
                  {property.chauffage_type && (
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-4 w-4 text-muted-foreground" />
                      <span>{property.chauffage_type}</span>
                    </div>
                  )}
                  {property.parking && (
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span>Parking</span>
                    </div>
                  )}
                  {(property.balcon || property.terrasse) && (
                    <div className="flex items-center gap-2">
                      <Mountain className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {property.balcon && "Balcon"}
                        {property.balcon && property.terrasse && " + "}
                        {property.terrasse && "Terrasse"}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            {listing.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {listing.description}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar: formulaire candidature */}
          <div>
            <div className="sticky top-6">
              <PublicApplicationForm
                listingId={listing.id}
                listingTitle={listing.title}
                onSubmit={handleSubmitApplication}
              />
            </div>
          </div>
        </div>

        {/* Footer RGPD */}
        <div className="mt-12 border-t pt-6 text-center text-xs text-muted-foreground">
          <p>
            Annonce publiée sur <strong>Talok</strong> — Plateforme de gestion locative.
          </p>
          <p className="mt-1">
            Les données personnelles sont traitées conformément au RGPD.
            Les dossiers des candidats non retenus sont supprimés sous 6 mois.
          </p>
        </div>
      </div>
    </div>
  );
}
