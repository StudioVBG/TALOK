/**
 * PropertyAnnouncementTab - Tab "Annonce & expérience locataire"
 * Cards avec toutes les infos d'annonce + complétion
 */

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  FileText,
  Bed,
  Lock,
  Clock,
  Map,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Globe,
  Info,
} from "lucide-react";
import type { Property, Room, Photo } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";
import { ModeLocationModal } from "./mode-location-modal";
import { useRooms } from "@/lib/hooks/use-rooms";
import { usePhotos } from "@/lib/hooks/use-photos";

interface PropertyAnnouncementTabProps {
  property: Property;
  onPropertyUpdate: (updates: Partial<Property>) => Promise<void>;
}

export function PropertyAnnouncementTab({
  property,
  onPropertyUpdate,
}: PropertyAnnouncementTabProps) {
  const { toast } = useToast();
  const [modeLocation, setModeLocation] = useState<string>(
    (property as any).mode_location || "longue_duree"
  );
  const [isUpdatingMode, setIsUpdatingMode] = useState(false);
  const [leaseModalOpen, setLeaseModalOpen] = useState(false);
  const [leaseInfo, setLeaseInfo] = useState<any>(null);

  // Utiliser React Query pour les photos et rooms
  const { data: photos = [], isLoading: photosLoading } = usePhotos(property.id);
  const { data: rooms = [], isLoading: roomsLoading } = useRooms(property.id);
  
  const loading = photosLoading || roomsLoading;

  // Calcul du score de complétion avec les vraies données
  const completionScore = calculateCompletionScore(property, photos, rooms);
  const completionChecks = getCompletionChecks(property, photos, rooms);

  const handleModeLocationChange = async (newMode: string) => {
    if (newMode === modeLocation) return;

    setIsUpdatingMode(true);
    try {
      await onPropertyUpdate({ mode_location: newMode } as any);
      setModeLocation(newMode);
      toast({
        title: "Succès",
        description: "Le mode de location a été mis à jour.",
      });
    } catch (error: unknown) {
      // Vérifier si c'est l'erreur active_lease_blocking
      // L'erreur peut venir de différentes structures selon le client API
      const errorMessage = error?.message || "";
      const errorData = error?.data || error?.response?.data || error;
      
      if (
        errorData?.error === "active_lease_blocking" ||
        errorMessage.includes("active_lease_blocking") ||
        errorData?.globalErrors?.some((e: string) => e.includes("bail actif"))
      ) {
        setLeaseInfo(errorData?.lease || null);
        setLeaseModalOpen(true);
      } else {
        toast({
          title: "Erreur",
          description: errorData?.globalErrors?.[0] || errorMessage || "Impossible de mettre à jour le mode de location.",
          variant: "destructive",
        });
      }
      // Revenir à l'ancienne valeur
      setModeLocation((property as any).mode_location || "longue_duree");
    } finally {
      setIsUpdatingMode(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Score de complétion */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Complétion de l'annonce
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Score global</span>
              <span className="font-bold text-lg">{completionScore}%</span>
            </div>
            <Progress value={completionScore} className="h-2" />
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              Calcul du score en cours...
            </div>
          ) : (
            <div className="space-y-2">
              {completionChecks.map((check) => (
                <div key={check.id} className="flex items-center gap-2 text-sm">
                  {check.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className={check.completed ? "text-foreground" : "text-muted-foreground"}>
                    {check.label}
                  </span>
                  {check.weight && check.weight < 1 && (
                    <Badge variant="outline" className="ml-auto text-xs">
                      {check.weight < 0.5 ? "Optionnel" : "Recommandé"}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mode de location */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Mode de location
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-900 dark:text-blue-200">
              Le mode de location détermine si le bien est destiné à une location longue durée ou courte durée.
              Vous ne pouvez pas changer ce mode s'il existe un bail actif sur ce bien.
            </p>
          </div>
          <RadioGroup
            value={modeLocation}
            onValueChange={handleModeLocationChange}
            disabled={isUpdatingMode}
            className="space-y-3"
          >
            <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50">
              <RadioGroupItem value="longue_duree" id="longue_duree" />
              <Label htmlFor="longue_duree" className="flex-1 cursor-pointer">
                <div className="font-medium">Location longue durée</div>
                <div className="text-sm text-muted-foreground">
                  Baux classiques (3 ans, renouvelables), location principale
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50">
              <RadioGroupItem value="courte_duree" id="courte_duree" />
              <Label htmlFor="courte_duree" className="flex-1 cursor-pointer">
                <div className="font-medium">Location courte durée</div>
                <div className="text-sm text-muted-foreground">
                  Location saisonnière, meublée de tourisme, locations temporaires
                </div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Cards d'annonce */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identité de l'annonce */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Identité de l'annonce
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Titre</label>
              <p className="font-semibold mt-1">
                {(property as any).titre_annonce || property.adresse_complete || "Sans titre"}
              </p>
            </div>
            {(property as any).tagline && (
              <div>
                <label className="text-sm text-muted-foreground">Tagline</label>
                <p className="mt-1">{(property as any).tagline}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Description
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(property as any).description_logement && (
              <div>
                <label className="text-sm text-muted-foreground">Logement</label>
                <p className="mt-1 text-sm">{(property as any).description_logement}</p>
              </div>
            )}
            {(property as any).description_acces_voyageurs && (
              <div>
                <label className="text-sm text-muted-foreground">Accès voyageurs</label>
                <p className="mt-1 text-sm">{(property as any).description_acces_voyageurs}</p>
              </div>
            )}
            {(property as any).description_a_savoir && (
              <div>
                <label className="text-sm text-muted-foreground">À savoir</label>
                <p className="mt-1 text-sm">{(property as any).description_a_savoir}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Séjour & accès */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Séjour & accès
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(property as any).checkin_from && (
              <div>
                <label className="text-sm text-muted-foreground">Arrivée</label>
                <p className="mt-1">
                  {(property as any).checkin_from} - {(property as any).checkin_to}
                </p>
              </div>
            )}
            {(property as any).checkout_time && (
              <div>
                <label className="text-sm text-muted-foreground">Départ</label>
                <p className="mt-1">{(property as any).checkout_time}</p>
              </div>
            )}
            {(property as any).mode_acces && (
              <div>
                <label className="text-sm text-muted-foreground">Mode d'accès</label>
                <p className="mt-1">{(property as any).mode_acces}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sécurité */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Sécurité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(property as any).detecteur_fumee && (
              <Badge variant="outline" className="w-full justify-start">
                <CheckCircle2 className="h-3 w-3 mr-2" />
                Détecteur de fumée
              </Badge>
            )}
            {(property as any).detecteur_co && (
              <Badge variant="outline" className="w-full justify-start">
                <CheckCircle2 className="h-3 w-3 mr-2" />
                Détecteur de CO
              </Badge>
            )}
            {(property as any).extincteur && (
              <Badge variant="outline" className="w-full justify-start">
                <CheckCircle2 className="h-3 w-3 mr-2" />
                Extincteur
              </Badge>
            )}
            {(property as any).trousse_secours && (
              <Badge variant="outline" className="w-full justify-start">
                <CheckCircle2 className="h-3 w-3 mr-2" />
                Trousse de secours
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Quartier & environnement */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5 text-primary" />
              Quartier & environnement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(property as any).description_quartier && (
              <div>
                <label className="text-sm text-muted-foreground">Description du quartier</label>
                <p className="mt-1 text-sm">{(property as any).description_quartier}</p>
              </div>
            )}
            {(property as any).points_forts_quartier &&
              Array.isArray((property as any).points_forts_quartier) &&
              (property as any).points_forts_quartier.length > 0 && (
                <div>
                  <label className="text-sm text-muted-foreground">Points forts</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(property as any).points_forts_quartier.map((point: string, index: number) => (
                      <Badge key={index} variant="secondary">
                        {point}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      </div>

      {/* Modal pour l'erreur active_lease_blocking */}
      <ModeLocationModal
        open={leaseModalOpen}
        onOpenChange={setLeaseModalOpen}
        lease={leaseInfo}
        propertyId={property.id}
      />
    </div>
  );
}

function calculateCompletionScore(property: Property, photos: Photo[] = [], rooms: Room[] = []): number {
  let score = 0;
  let total = 0;
  const propertyData = property as any;

  // Titre d'annonce (obligatoire)
  total++;
  if (propertyData.titre_annonce?.trim()) score++;

  // Tagline (optionnel mais recommandé)
  total += 0.5;
  if (propertyData.tagline?.trim()) score += 0.5;

  // Description logement (obligatoire)
  total++;
  if (propertyData.description_logement?.trim()) score++;

  // Description accès voyageurs (optionnel)
  total += 0.5;
  if (propertyData.description_acces_voyageurs?.trim()) score += 0.5;

  // Description à savoir (optionnel)
  total += 0.5;
  if (propertyData.description_a_savoir?.trim()) score += 0.5;

  // Photos (minimum 3, idéal 5+)
  total++;
  const photoCount = photos.length;
  if (photoCount >= 5) {
    score += 1; // Parfait
  } else if (photoCount >= 3) {
    score += 0.7; // Minimum atteint
  } else if (photoCount >= 1) {
    score += 0.3; // Partiel
  }

  // Photo principale
  total += 0.5;
  if (photos.some((p) => p.is_main)) score += 0.5;

  // Couchages par chambre (pour habitation)
  const isHabitation = ["appartement", "maison", "studio", "colocation"].includes(property.type);
  if (isHabitation) {
    total++;
    const bedrooms = rooms.filter((r) => r.type_piece === "chambre");
    if (bedrooms.length > 0) {
      // Vérifier si au moins une chambre a des couchages
      // Note: Pour l'instant, on vérifie juste qu'il y a des chambres
      // TODO: Vérifier les beds réels quand l'API sera disponible
      score += 0.5; // Partiel car on ne vérifie pas encore les beds
    }
  }

  // Séjour & accès (pour courte durée)
  if (propertyData.mode_location === "courte_duree") {
    total += 0.5;
    if (propertyData.checkin_from && propertyData.checkin_to) score += 0.5;
    
    total += 0.5;
    if (propertyData.checkout_time) score += 0.5;
    
    total += 0.5;
    if (propertyData.mode_acces) score += 0.5;
  }

  // Règlement intérieur
  total += 0.5;
  if (propertyData.regles_animaux || propertyData.regles_fumeur || propertyData.regles_fetes) {
    score += 0.5;
  }

  // Sécurité
  total += 0.5;
  if (propertyData.detecteur_fumee || propertyData.detecteur_co || propertyData.extincteur) {
    score += 0.5;
  }

  // Quartier (recommandé)
  total++;
  if (propertyData.description_quartier?.trim()) {
    score += 0.7; // Description présente
    if (propertyData.points_forts_quartier && Array.isArray(propertyData.points_forts_quartier) && propertyData.points_forts_quartier.length > 0) {
      score += 0.3; // Points forts ajoutés
    }
  }

  return Math.round((score / total) * 100);
}

function getCompletionChecks(
  property: Property,
  photos: Photo[] = [],
  rooms: Room[] = []
): Array<{ id: string; label: string; completed: boolean; weight?: number }> {
  const propertyData = property as any;
  const photoCount = photos.length;
  const bedrooms = rooms.filter((r) => r.type_piece === "chambre");
  const isHabitation = ["appartement", "maison", "studio", "colocation"].includes(property.type);

  const checks: Array<{ id: string; label: string; completed: boolean; weight?: number }> = [
    {
      id: "titre_annonce",
      label: "Titre d'annonce",
      completed: !!propertyData.titre_annonce?.trim(),
      weight: 1,
    },
    {
      id: "tagline",
      label: "Tagline / accroche",
      completed: !!propertyData.tagline?.trim(),
      weight: 0.5,
    },
    {
      id: "description_logement",
      label: "Description du logement",
      completed: !!propertyData.description_logement?.trim(),
      weight: 1,
    },
    {
      id: "description_acces",
      label: "Description accès voyageurs",
      completed: !!propertyData.description_acces_voyageurs?.trim(),
      weight: 0.5,
    },
    {
      id: "photos_min",
      label: `Au moins 3 photos (${photoCount} actuellement)`,
      completed: photoCount >= 3,
      weight: 1,
    },
    {
      id: "photo_principale",
      label: "Photo principale définie",
      completed: photos.some((p) => p.is_main),
      weight: 0.5,
    },
  ];

  if (isHabitation) {
    checks.push({
      id: "couchages",
      label: bedrooms.length > 0 
        ? `Couchages par chambre (${bedrooms.length} chambre(s))`
        : "Couchages par chambre",
      completed: bedrooms.length > 0, // TODO: Vérifier les beds réels
      weight: 1,
    });
  }

  if (propertyData.mode_location === "courte_duree") {
    checks.push(
      {
        id: "checkin",
        label: "Horaires d'arrivée",
        completed: !!(propertyData.checkin_from && propertyData.checkin_to),
        weight: 0.5,
      },
      {
        id: "checkout",
        label: "Horaire de départ",
        completed: !!propertyData.checkout_time,
        weight: 0.5,
      },
      {
        id: "mode_acces",
        label: "Mode d'accès",
        completed: !!propertyData.mode_acces,
        weight: 0.5,
      }
    );
  }

  checks.push(
    {
      id: "reglement",
      label: "Règlement intérieur",
      completed: !!(propertyData.regles_animaux || propertyData.regles_fumeur || propertyData.regles_fetes),
      weight: 0.5,
    },
    {
      id: "securite",
      label: "Équipements de sécurité",
      completed: !!(propertyData.detecteur_fumee || propertyData.detecteur_co || propertyData.extincteur),
      weight: 0.5,
    },
    {
      id: "quartier",
      label: "Description du quartier",
      completed: !!propertyData.description_quartier?.trim(),
      weight: 1,
    },
    {
      id: "points_forts",
      label: "Points forts du quartier",
      completed: !!(propertyData.points_forts_quartier && 
        Array.isArray(propertyData.points_forts_quartier) && 
        propertyData.points_forts_quartier.length > 0),
      weight: 0.3,
    }
  );

  return checks;
}

