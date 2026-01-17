/**
 * PropertyManagementTab - Tab "Gestion & contrat"
 * Affiche baux, locataires, loyers, documents, montants éditables
 */

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Users, Receipt, Euro, Edit, Save, X } from "lucide-react";
import type { Property } from "@/lib/types";
import { formatCurrency } from "@/lib/helpers/format";
import { useToast } from "@/components/ui/use-toast";
import { LeasesList } from "@/features/leases/components/leases-list";
import { DocumentGalleryManager } from "@/features/documents/components/document-gallery-manager";

interface PropertyManagementTabProps {
  property: Property;
  onPropertyUpdate: (updates: Partial<Property>) => Promise<void>;
}

export function PropertyManagementTab({ property, onPropertyUpdate }: PropertyManagementTabProps) {
  const { toast } = useToast();
  const [isEditingAmounts, setIsEditingAmounts] = useState(false);
  const [editedAmounts, setEditedAmounts] = useState({
    loyer_hc: property.loyer_hc ?? property.loyer_base ?? 0,
    charges_mensuelles: property.charges_mensuelles ?? 0,
    depot_garantie: property.depot_garantie ?? 0,
  });

  const handleSaveAmounts = async () => {
    try {
      await onPropertyUpdate(editedAmounts);
      setIsEditingAmounts(false);
      toast({
        title: "Succès",
        description: "Les montants ont été mis à jour.",
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de mettre à jour les montants.",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditedAmounts({
      loyer_hc: property.loyer_hc ?? property.loyer_base ?? 0,
      charges_mensuelles: property.charges_mensuelles ?? 0,
      depot_garantie: property.depot_garantie ?? 0,
    });
    setIsEditingAmounts(false);
  };

  return (
    <div className="space-y-6">
      {/* Montants éditables */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Euro className="h-5 w-5 text-primary" />
              Montants de location
            </CardTitle>
            {!isEditingAmounts ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditingAmounts(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                  <X className="h-4 w-4 mr-2" />
                  Annuler
                </Button>
                <Button size="sm" onClick={handleSaveAmounts}>
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditingAmounts ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loyer_hc">Loyer HC (€)</Label>
                <Input
                  id="loyer_hc"
                  type="number"
                  value={editedAmounts.loyer_hc}
                  onChange={(e) =>
                    setEditedAmounts({ ...editedAmounts, loyer_hc: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="charges_mensuelles">Charges mensuelles (€)</Label>
                <Input
                  id="charges_mensuelles"
                  type="number"
                  value={editedAmounts.charges_mensuelles}
                  onChange={(e) =>
                    setEditedAmounts({ ...editedAmounts, charges_mensuelles: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="depot_garantie">Dépôt de garantie (€)</Label>
                <Input
                  id="depot_garantie"
                  type="number"
                  value={editedAmounts.depot_garantie}
                  onChange={(e) =>
                    setEditedAmounts({ ...editedAmounts, depot_garantie: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Loyer HC</p>
                <p className="text-2xl font-bold">{formatCurrency(property.loyer_hc ?? property.loyer_base ?? 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Charges mensuelles</p>
                <p className="text-2xl font-bold">{formatCurrency(property.charges_mensuelles ?? 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Dépôt de garantie</p>
                <p className="text-2xl font-bold">{formatCurrency(property.depot_garantie ?? 0)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sous-tabs pour baux, locataires, documents */}
      <Tabs defaultValue="leases" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leases">
            <FileText className="h-4 w-4 mr-2" />
            Baux
          </TabsTrigger>
          <TabsTrigger value="tenants">
            <Users className="h-4 w-4 mr-2" />
            Locataires
          </TabsTrigger>
          <TabsTrigger value="documents">
            <Receipt className="h-4 w-4 mr-2" />
            Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leases">
          <LeasesList propertyId={property.id} />
        </TabsContent>

        <TabsContent value="tenants">
          <Card>
            <CardHeader>
              <CardTitle>Locataires</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Liste des locataires à implémenter</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <DocumentGalleryManager propertyId={property.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

