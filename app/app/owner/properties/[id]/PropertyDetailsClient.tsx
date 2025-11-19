"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Trash2, Home, BedDouble, Ruler, Layers, Car, Store, Warehouse } from "lucide-react";
import { formatCurrency } from "@/lib/helpers/format";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useMutationWithToast } from "@/lib/hooks/use-mutation-with-toast";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import type { PropertyDetails } from "../../_data/fetchPropertyDetails";

interface PropertyDetailsClientProps {
  details: PropertyDetails;
  propertyId: string;
}

export function PropertyDetailsClient({ details, propertyId }: PropertyDetailsClientProps) {
  const router = useRouter();
  const { profile } = useAuth();
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { property, leases = [] } = details;
  const activeLease = leases.find((l: any) => l.statut === "active");
  const allLeases = leases;

  // Mutation avec toast pour la suppression
  const deleteProperty = useMutationWithToast({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/properties/${id}`);
    },
    successMessage: "Bien supprimé avec succès",
    errorMessage: "Impossible de supprimer le bien. Veuillez réessayer.",
    invalidateQueries: ["properties"],
    // Pas besoin d'optimisticUpdate complexe car on redirige
    onSuccess: () => {
      router.push("/app/owner/properties");
    },
  });

  const handleDelete = () => {
    if (propertyId) {
      deleteProperty.mutate(propertyId);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      appartement: "Appartement",
      maison: "Maison",
      colocation: "Colocation",
      saisonnier: "Saisonnier",
      commercial: "Local commercial",
      bureau: "Bureau",
      parking: "Parking",
    };
    return labels[type || ""] || type;
  };

  const getPropertyIcon = (type: string) => {
    switch (type) {
      case "parking":
      case "box":
        return Car;
      case "commercial":
      case "bureau":
      case "local_commercial":
        return Store;
      case "entrepot":
        return Warehouse;
      case "maison":
        return Home;
      default:
        return Home; // Default to Home for simplicity in details view or Building2
    }
  };

  const PropertyIcon = getPropertyIcon(property?.type || "appartement");

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Button asChild variant="ghost" className="mb-4 pl-0 hover:pl-2 transition-all">
          <Link href="/app/owner/properties">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la liste
          </Link>
        </Button>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <PropertyIcon className="h-6 w-6 text-slate-600" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900">
                {property?.adresse_complete || "Sans adresse"}
              </h1>
            </div>
            
            <div className="flex items-center gap-3 mt-3 ml-1">
              <Badge variant="secondary" className="text-sm font-normal">
                {getTypeLabel(property?.type || "")}
              </Badge>
              
              {property?.surface > 0 && (
                <span className="flex items-center text-sm text-muted-foreground">
                  <Ruler className="mr-1 h-4 w-4" />
                  {property.surface} m²
                </span>
              )}
              
              {property?.nb_pieces > 0 && (
                <span className="flex items-center text-sm text-muted-foreground">
                  <Home className="mr-1 h-4 w-4" />
                  {property.nb_pieces} p.
                </span>
              )}

               {property?.nb_chambres > 0 && (
                <span className="flex items-center text-sm text-muted-foreground">
                  <BedDouble className="mr-1 h-4 w-4" />
                  {property.nb_chambres} ch.
                </span>
              )}

              {property?.etage !== null && property?.etage !== undefined && (
                 <span className="flex items-center text-sm text-muted-foreground">
                  <Layers className="mr-1 h-4 w-4" />
                  Étage {property.etage}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            {!activeLease ? (
              <Button asChild className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm">
                <Link href={`/leases/new?propertyId=${propertyId}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer un bail
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href={`/app/owner/contracts/${activeLease.id}`}>
                  Gérer le bail
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(true)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="w-full justify-start h-auto p-1 bg-slate-100/50 backdrop-blur-sm">
          <TabsTrigger value="overview" className="px-4 py-2">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="leases" className="px-4 py-2">Baux & occupation</TabsTrigger>
          <TabsTrigger value="tenants" className="px-4 py-2">Locataires</TabsTrigger>
          <TabsTrigger value="financials" className="px-4 py-2">Finances</TabsTrigger>
          <TabsTrigger value="technical" className="px-4 py-2">Technique & Docs</TabsTrigger>
        </TabsList>

        {/* Vue d'ensemble */}
        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2 space-y-6">
                {/* Carte Bail Actif */}
                <Card>
                <CardHeader>
                    <CardTitle>Occupation actuelle</CardTitle>
                </CardHeader>
                <CardContent>
                    {activeLease ? (
                    <div className="flex items-center justify-between p-4 bg-green-50/50 border border-green-100 rounded-lg">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Badge className="bg-green-600 hover:bg-green-700">Loué</Badge>
                                <span className="font-medium text-green-900">Bail {activeLease.type_bail}</span>
                            </div>
                            <p className="text-sm text-green-700">
                                {activeLease.tenants && activeLease.tenants.length > 0 
                                    ? activeLease.tenants.map((t: any) => `${t.prenom} ${t.nom}`).join(", ")
                                    : "Locataire inconnu"}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-bold text-slate-900">
                                {formatCurrency(
                                Number(activeLease.loyer || 0) +
                                    Number(activeLease.charges || 0)
                                )}
                            </p>
                            <p className="text-xs text-muted-foreground">CC / mois</p>
                        </div>
                    </div>
                    ) : (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground mb-4">Ce bien est actuellement vacant</p>
                        <Button asChild variant="secondary">
                        <Link href={`/leases/new?property_id=${propertyId}`}>
                            Trouver un locataire
                        </Link>
                        </Button>
                    </div>
                    )}
                </CardContent>
                </Card>

                {/* Derniers tickets */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Derniers tickets</CardTitle>
                        <Button variant="ghost" size="sm" asChild>
                            <Link href={`/app/owner/tickets?property_id=${propertyId}`}>Tout voir</Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                         {details.tickets && details.tickets.length > 0 ? (
                             <div className="space-y-4">
                                 {details.tickets.map((ticket: any) => (
                                     <div key={ticket.id} className="flex items-center justify-between border-b last:border-0 pb-4 last:pb-0">
                                         <div>
                                             <p className="font-medium">{ticket.titre}</p>
                                             <p className="text-sm text-muted-foreground line-clamp-1">{ticket.description}</p>
                                         </div>
                                         <Badge variant={ticket.statut === 'open' ? 'destructive' : 'secondary'}>
                                             {ticket.statut}
                                         </Badge>
                                     </div>
                                 ))}
                             </div>
                         ) : (
                             <p className="text-sm text-muted-foreground text-center py-4">Aucun ticket en cours</p>
                         )}
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6">
                {/* KPI Financier Rapide */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Rentabilité (estimée)</CardTitle>
                    </CardHeader>
                    <CardContent>
                         <div className="text-3xl font-bold text-blue-600">-- %</div>
                         <p className="text-xs text-muted-foreground mt-1">Brut annuel</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                         <CardTitle className="text-base">Dernières factures</CardTitle>
                    </CardHeader>
                    <CardContent>
                         {details.invoices && details.invoices.length > 0 ? (
                             <div className="space-y-3">
                                 {details.invoices.map((invoice: any) => (
                                     <div key={invoice.id} className="flex justify-between items-center text-sm">
                                         <span>{invoice.periode}</span>
                                         <span className="font-medium">{formatCurrency(invoice.montant_total)}</span>
                                     </div>
                                 ))}
                             </div>
                         ) : (
                             <p className="text-sm text-muted-foreground">Aucune facture récente</p>
                         )}
                         <Button variant="link" className="w-full mt-2 h-auto p-0" asChild>
                             <Link href={`/app/owner/money?property_id=${propertyId}`}>Voir la comptabilité</Link>
                         </Button>
                    </CardContent>
                </Card>
            </div>
          </div>
        </TabsContent>

        {/* Baux & occupation */}
        <TabsContent value="leases">
          <Card>
            <CardHeader>
              <CardTitle>Historique des baux</CardTitle>
            </CardHeader>
            <CardContent>
              {allLeases.length > 0 ? (
                <div className="space-y-4">
                  {allLeases.map((lease: any) => (
                    <div
                      key={lease.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">
                            Bail {lease.type_bail || "non spécifié"}
                            </p>
                             <Badge variant="outline">{lease.statut}</Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground">
                          Du {new Date(lease.date_debut).toLocaleDateString("fr-FR")}
                          {lease.date_fin &&
                            ` au ${new Date(lease.date_fin).toLocaleDateString("fr-FR")}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/app/owner/contracts/${lease.id}`}>
                            Voir
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    Aucun bail enregistré pour ce logement
                  </p>
                  <Button asChild>
                    <Link href={`/leases/new?property_id=${propertyId}`}>
                      Créer un bail
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Autres onglets (simplifiés pour l'instant) */}
        <TabsContent value="tenants">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Gestion des locataires à venir</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="financials">
             <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Analyses financières détaillées à venir</p>
               <Button asChild variant="outline" className="mt-4">
                  <Link href={`/app/owner/money?property_id=${propertyId}`}>
                    Voir les transactions
                  </Link>
                </Button>
            </CardContent>
          </Card>
        </TabsContent>

         <TabsContent value="technical">
             <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Documents et diagnostics</p>
               <Button asChild variant="outline" className="mt-4">
                  <Link href={`/app/owner/documents?property_id=${propertyId}`}>
                    Gérer les documents
                  </Link>
                </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de confirmation pour la suppression */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Supprimer ce bien ?"
        description={`Cette action est irréversible. Le bien "${property?.adresse_complete || "sans adresse"}" et toutes ses données associées (baux, documents, factures) seront définitivement supprimés.`}
        onConfirm={handleDelete}
        variant="destructive"
        loading={deleteProperty.isPending}
        confirmText="Supprimer définitivement"
        cancelText="Annuler"
      />
    </div>
  );
}

