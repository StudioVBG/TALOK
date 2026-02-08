"use client";

/**
 * Page de détail d'une entité juridique
 * /owner/entities/[entityId]
 * SOTA 2026
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import {
  ArrowLeft,
  Pencil,
  Building2,
  FileText,
  Euro,
  Users,
  CreditCard,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { LegalEntity, LegalEntityWithStats } from "@/lib/types/legal-entity";
import {
  ENTITY_TYPE_LABELS,
  FISCAL_REGIME_LABELS,
  TVA_REGIME_LABELS,
  ENTITIES_REQUIRING_SIRET,
} from "@/lib/types/legal-entity";

// TVA Regime labels (not exported from types)
const TVA_LABELS: Record<string, string> = {
  franchise: "Franchise en base",
  reel_simplifie: "Réel simplifié",
  reel_normal: "Réel normal",
  mini_reel: "Mini-réel",
};

export default function EntityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const entityId = params.entityId as string;

  const [entity, setEntity] = useState<LegalEntityWithStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch entity
  const loadEntity = useCallback(async () => {
    try {
      const response = await fetch(`/api/owner/legal-entities/${entityId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "Entité non trouvée",
            description: "Cette entité juridique n'existe pas ou a été supprimée",
            variant: "destructive",
          });
          router.push("/owner/entities");
          return;
        }
        throw new Error("Erreur lors du chargement");
      }
      const data = await response.json();
      setEntity(data.entity);
    } catch (error) {
      console.error("Error loading entity:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les détails de l'entité",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [entityId, router, toast]);

  useEffect(() => {
    loadEntity();
  }, [loadEntity]);

  // Format currency
  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return "—";
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format date
  const formatDate = (date: string | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["owner"]}>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-64" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!entity) {
    return null;
  }

  const requiresSiret = ENTITIES_REQUIRING_SIRET.includes(entity.entity_type);

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <PageTransition>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/owner/entities">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  {entity.nom}
                </h1>
                <p className="text-muted-foreground">
                  {ENTITY_TYPE_LABELS[entity.entity_type]} · {FISCAL_REGIME_LABELS[entity.regime_fiscal]}
                </p>
              </div>
            </div>
            <Button onClick={() => router.push(`/owner/entities/${entityId}/edit`)} className="gap-2">
              <Pencil className="h-4 w-4" />
              Modifier
            </Button>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{entity.properties_count || 0}</p>
                    <p className="text-xs text-muted-foreground">Bien(s)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <FileText className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{entity.active_leases || 0}</p>
                    <p className="text-xs text-muted-foreground">Bail(aux) actif(s)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Euro className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatCurrency(entity.monthly_rent)}</p>
                    <p className="text-xs text-muted-foreground">Loyers/mois</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{entity.associates_count || 0}</p>
                    <p className="text-xs text-muted-foreground">Associé(s)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status indicators */}
          <div className="flex flex-wrap gap-2">
            {requiresSiret && (
              entity.siret ? (
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  SIRET Renseigné
                </Badge>
              ) : (
                <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  SIRET Manquant
                </Badge>
              )
            )}
            {entity.iban ? (
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                IBAN Configuré
              </Badge>
            ) : (
              <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                <AlertCircle className="h-3 w-3 mr-1" />
                IBAN Non configuré
              </Badge>
            )}
            {entity.is_active ? (
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                <AlertCircle className="h-3 w-3 mr-1" />
                Inactive
              </Badge>
            )}
          </div>

          {/* Tabs with details */}
          <Tabs defaultValue="general" className="space-y-4">
            <TabsList>
              <TabsTrigger value="general">Général</TabsTrigger>
              <TabsTrigger value="fiscal">Fiscalité</TabsTrigger>
              <TabsTrigger value="banking">Bancaire</TabsTrigger>
              <TabsTrigger value="associates">Associés</TabsTrigger>
              <TabsTrigger value="properties">Biens</TabsTrigger>
            </TabsList>

            {/* General tab */}
            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>Informations générales</CardTitle>
                  <CardDescription>Identité et immatriculation de l'entité</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Nom</p>
                      <p className="text-lg">{entity.nom}</p>
                    </div>
                    {entity.nom_commercial && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Nom commercial</p>
                        <p className="text-lg">{entity.nom_commercial}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Type d'entité</p>
                      <p className="text-lg">{ENTITY_TYPE_LABELS[entity.entity_type]}</p>
                    </div>
                    {entity.forme_juridique && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Forme juridique</p>
                        <p className="text-lg">{entity.forme_juridique}</p>
                      </div>
                    )}
                  </div>

                  {/* Immatriculation */}
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-4">Immatriculation</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      {entity.siren && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">SIREN</p>
                          <p className="text-lg font-mono">{entity.siren}</p>
                        </div>
                      )}
                      {entity.siret && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">SIRET</p>
                          <p className="text-lg font-mono">{entity.siret}</p>
                        </div>
                      )}
                      {entity.rcs_ville && entity.rcs_numero && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">RCS</p>
                          <p className="text-lg">{entity.rcs_numero} {entity.rcs_ville}</p>
                        </div>
                      )}
                      {entity.numero_tva && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">N° TVA</p>
                          <p className="text-lg font-mono">{entity.numero_tva}</p>
                        </div>
                      )}
                      {entity.code_ape && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Code APE</p>
                          <p className="text-lg font-mono">{entity.code_ape}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Address */}
                  {entity.adresse_siege && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-4 flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Adresse du siège
                      </h4>
                      <p className="text-lg">
                        {entity.adresse_siege}
                        {entity.complement_adresse && <><br />{entity.complement_adresse}</>}
                        <br />
                        {entity.code_postal_siege} {entity.ville_siege}
                        {entity.pays_siege && entity.pays_siege !== "France" && <><br />{entity.pays_siege}</>}
                      </p>
                    </div>
                  )}

                  {/* Capital */}
                  {entity.capital_social && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-4">Capital social</h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Montant</p>
                          <p className="text-lg">{formatCurrency(entity.capital_social)}</p>
                        </div>
                        {entity.nombre_parts && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Nombre de parts</p>
                            <p className="text-lg">{entity.nombre_parts.toLocaleString("fr-FR")}</p>
                          </div>
                        )}
                        {entity.valeur_nominale_part && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Valeur nominale</p>
                            <p className="text-lg">{formatCurrency(entity.valeur_nominale_part)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-4 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Dates importantes
                    </h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      {entity.date_creation && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Date de création</p>
                          <p className="text-lg">{formatDate(entity.date_creation)}</p>
                        </div>
                      )}
                      {entity.date_cloture_exercice && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Clôture exercice</p>
                          <p className="text-lg">{entity.date_cloture_exercice}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Créé le</p>
                        <p className="text-lg">{formatDate(entity.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Dernière modification</p>
                        <p className="text-lg">{formatDate(entity.updated_at)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Fiscal tab */}
            <TabsContent value="fiscal">
              <Card>
                <CardHeader>
                  <CardTitle>Fiscalité</CardTitle>
                  <CardDescription>Régime fiscal et TVA</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Régime fiscal</p>
                      <p className="text-lg">{FISCAL_REGIME_LABELS[entity.regime_fiscal]}</p>
                    </div>
                    {entity.date_option_fiscale && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Date d'option</p>
                        <p className="text-lg">{formatDate(entity.date_option_fiscale)}</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-4">TVA</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Assujetti TVA</p>
                        <p className="text-lg">{entity.tva_assujetti ? "Oui" : "Non"}</p>
                      </div>
                      {entity.tva_regime && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Régime TVA</p>
                          <p className="text-lg">{TVA_LABELS[entity.tva_regime] || entity.tva_regime}</p>
                        </div>
                      )}
                      {entity.tva_taux_defaut && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Taux par défaut</p>
                          <p className="text-lg">{entity.tva_taux_defaut}%</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Banking tab */}
            <TabsContent value="banking">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Coordonnées bancaires
                  </CardTitle>
                  <CardDescription>Compte bancaire pour les encaissements</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {entity.iban ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">IBAN</p>
                        <p className="text-lg font-mono">{entity.iban}</p>
                      </div>
                      {entity.bic && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">BIC</p>
                          <p className="text-lg font-mono">{entity.bic}</p>
                        </div>
                      )}
                      {entity.banque_nom && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Banque</p>
                          <p className="text-lg">{entity.banque_nom}</p>
                        </div>
                      )}
                      {entity.titulaire_compte && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Titulaire</p>
                          <p className="text-lg">{entity.titulaire_compte}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Aucune coordonnée bancaire configurée</p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => router.push(`/owner/entities/${entityId}/edit?tab=banking`)}
                      >
                        Ajouter un IBAN
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Associates tab */}
            <TabsContent value="associates">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Associés
                  </CardTitle>
                  <CardDescription>Liste des associés de l'entité</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Gestion des associés à venir</p>
                    <p className="text-sm">Cette fonctionnalité sera disponible prochainement</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Properties tab */}
            <TabsContent value="properties">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Biens associés
                  </CardTitle>
                  <CardDescription>Biens immobiliers détenus par cette entité</CardDescription>
                </CardHeader>
                <CardContent>
                  {entity.properties_count && entity.properties_count > 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        {entity.properties_count} bien(s) associé(s) à cette entité
                      </p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => router.push(`/owner/properties?entity=${entityId}`)}
                      >
                        Voir les biens
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Aucun bien associé à cette entité</p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => router.push("/owner/properties/new")}
                      >
                        Ajouter un bien
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Notes */}
          {entity.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{entity.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </PageTransition>
    </ProtectedRoute>
  );
}
