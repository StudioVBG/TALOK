"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Home } from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { useProperties } from "@/lib/hooks";
import { useCreateListing } from "@/lib/hooks/queries/use-listings";
import { ListingEditor } from "@/features/candidatures/components/ListingEditor";
import { useToast } from "@/components/ui/use-toast";
import type { CreateListingInput } from "@/lib/validations/candidatures";

export default function NewListingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: properties = [], isLoading: propertiesLoading } = useProperties();
  const createListing = useCreateListing();

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");

  const handleSubmit = async (data: CreateListingInput) => {
    try {
      const listing = await createListing.mutateAsync(data);
      toast({
        title: "Annonce créée",
        description: "Vous pouvez maintenant la publier pour recevoir des candidatures.",
      });
      router.push(`/owner/listings/${listing.id}/applications`);
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de créer l'annonce",
        variant: "destructive",
      });
    }
  };

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <PageTransition>
        <div className="container mx-auto px-4 py-4 md:py-8 max-w-3xl">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link href="/owner/listings">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Retour aux annonces
            </Link>
          </Button>

          <h1 className="text-2xl md:text-3xl font-bold mb-6">Nouvelle annonce</h1>

          {/* Sélection du bien */}
          {!selectedPropertyId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Choisir un bien
                </CardTitle>
              </CardHeader>
              <CardContent>
                {propertiesLoading ? (
                  <div className="h-10 bg-muted rounded animate-pulse" />
                ) : properties.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground mb-3">
                      Vous devez d'abord ajouter un bien avant de créer une annonce.
                    </p>
                    <Button asChild>
                      <Link href="/owner/properties/new">Ajouter un bien</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label>Sélectionnez le bien à mettre en location</Label>
                    <Select onValueChange={setSelectedPropertyId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un bien..." />
                      </SelectTrigger>
                      <SelectContent>
                        {properties.map((property: any) => (
                          <SelectItem key={property.id} value={property.id}>
                            {property.adresse_complete || "Bien sans adresse"} — {property.ville}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Formulaire */}
          {selectedPropertyId && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedPropertyId("")}>
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                  Changer de bien
                </Button>
                <span className="text-sm text-muted-foreground">
                  {properties.find((p: any) => p.id === selectedPropertyId)?.adresse_complete}
                </span>
              </div>
              <ListingEditor
                propertyId={selectedPropertyId}
                onSubmit={handleSubmit}
                isLoading={createListing.isPending}
              />
            </div>
          )}
        </div>
      </PageTransition>
    </ProtectedRoute>
  );
}
