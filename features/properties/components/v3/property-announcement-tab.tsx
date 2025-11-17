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
} from "lucide-react";
import type { Property } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";

interface PropertyAnnouncementTabProps {
  property: Property;
  onPropertyUpdate: (updates: Partial<Property>) => Promise<void>;
}

export function PropertyAnnouncementTab({
  property,
  onPropertyUpdate,
}: PropertyAnnouncementTabProps) {
  const { toast } = useToast();

  // Calcul du score de complétion (simplifié)
  const completionScore = calculateCompletionScore(property);
  const completionChecks = getCompletionChecks(property);

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {completionChecks.map((check) => (
              <div key={check.id} className="flex items-center gap-2 text-sm">
                {check.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                )}
                <span className={check.completed ? "" : "text-muted-foreground"}>
                  {check.label}
                </span>
              </div>
            ))}
          </div>
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
    </div>
  );
}

function calculateCompletionScore(property: Property): number {
  let score = 0;
  let total = 0;

  // Titre
  total++;
  if ((property as any).titre_annonce) score++;

  // Description logement
  total++;
  if ((property as any).description_logement) score++;

  // Photos (au moins 3)
  total++;
  // TODO: Vérifier le nombre réel de photos
  // if (photos.length >= 3) score++;

  // Couchages
  total++;
  // TODO: Vérifier les couchages par chambre
  // if (hasBeds) score++;

  // Quartier
  total++;
  if ((property as any).description_quartier) score++;

  return Math.round((score / total) * 100);
}

function getCompletionChecks(property: Property): Array<{ id: string; label: string; completed: boolean }> {
  return [
    {
      id: "titre_annonce",
      label: "Titre d'annonce",
      completed: !!(property as any).titre_annonce,
    },
    {
      id: "description_logement",
      label: "Description du logement",
      completed: !!(property as any).description_logement,
    },
    {
      id: "photos_min",
      label: "Au moins 3 photos",
      completed: false, // TODO: Vérifier le nombre réel
    },
    {
      id: "couchages",
      label: "Couchages par chambre",
      completed: false, // TODO: Vérifier les couchages
    },
    {
      id: "quartier",
      label: "Description du quartier",
      completed: !!(property as any).description_quartier,
    },
  ];
}

