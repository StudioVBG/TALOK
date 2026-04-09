"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  EyeOff,
  Users,
  Calendar,
  MapPin,
  ExternalLink,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/lib/helpers/format";
import type { PropertyListingWithProperty } from "@/lib/types/candidatures";
import { BAIL_TYPE_LABELS } from "@/lib/types/candidatures";

interface ListingCardProps {
  listing: PropertyListingWithProperty & { applications_count: number };
  onPublishToggle?: (id: string) => void;
  publishLoading?: boolean;
}

export function ListingCard({ listing, onPublishToggle, publishLoading }: ListingCardProps) {
  const rent = listing.rent_amount_cents / 100;
  const charges = listing.charges_cents / 100;
  const property = listing.property;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      {/* Image header */}
      <div className="relative h-40 bg-muted">
        {property.cover_url ? (
          <img
            src={property.cover_url}
            alt={listing.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <MapPin className="h-8 w-8" />
          </div>
        )}
        {/* Badge publié/brouillon */}
        <div className="absolute left-3 top-3">
          {listing.is_published ? (
            <Badge className="bg-emerald-500 text-white">Publiée</Badge>
          ) : (
            <Badge variant="secondary">Brouillon</Badge>
          )}
        </div>
        {/* Menu actions */}
        <div className="absolute right-3 top-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="secondary" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/owner/listings/${listing.id}/applications`}>
                  <Users className="mr-2 h-4 w-4" />
                  Voir les candidatures
                </Link>
              </DropdownMenuItem>
              {listing.is_published && (
                <DropdownMenuItem asChild>
                  <Link href={`/annonce/${listing.public_url_token}`} target="_blank">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Voir la page publique
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onPublishToggle?.(listing.id)}
                disabled={publishLoading}
              >
                {listing.is_published ? (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Dépublier
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Publier
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CardHeader className="pb-2">
        <Link
          href={`/owner/listings/${listing.id}/applications`}
          className="text-lg font-semibold hover:text-primary transition-colors line-clamp-1"
        >
          {listing.title}
        </Link>
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {property.adresse_complete}, {property.ville}
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Prix et type */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xl font-bold text-foreground">
              {formatCurrency(rent)}
            </span>
            <span className="text-sm text-muted-foreground">/mois</span>
            {charges > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">
                + {formatCurrency(charges)} charges
              </span>
            )}
          </div>
          <Badge variant="outline">{BAIL_TYPE_LABELS[listing.bail_type]}</Badge>
        </div>

        {/* Infos */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            Dispo {new Date(listing.available_from).toLocaleDateString("fr-FR")}
          </div>
          {property.surface && <span>{property.surface} m²</span>}
          {property.nb_pieces && <span>{property.nb_pieces} p.</span>}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-1.5 text-sm">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-medium">{listing.applications_count}</span>
            <span className="text-muted-foreground">candidature{listing.applications_count !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Eye className="h-4 w-4" />
            {listing.views_count} vue{listing.views_count !== 1 ? "s" : ""}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
