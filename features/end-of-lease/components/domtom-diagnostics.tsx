/**
 * Composant Diagnostics DOM-TOM
 * Diagnostics spécifiques aux départements et territoires d'outre-mer
 *
 * Réglementations applicables:
 * - Diagnostic termites: Arrêtés préfectoraux DOM-TOM
 * - Risques naturels: Plan de Prévention des Risques Naturels (PPRN)
 * - Normes parasismiques: Eurocode 8 / PS-92
 * - Normes paracycloniques: Eurocode 1 partie 1-4
 */

"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Bug,
  Wind,
  Mountain,
  Waves,
  Flame,
  CloudRain,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Calendar,
  MapPin,
  Shield,
  Info,
  Upload,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

export interface TermitesDiagnostic {
  date_realisation: string;
  date_validite: string;
  diagnostiqueur_nom: string;
  diagnostiqueur_certification?: string;
  presence_termites: boolean;
  zones_infestees?: string[];
  traitement_realise?: boolean;
  date_traitement?: string;
  type_traitement?: string;
  departement: string;
  document_url?: string;
}

export interface RisquesNaturelsDomtom {
  date_realisation: string;
  // Cyclones
  zone_cyclonique?: "forte" | "moyenne" | "faible";
  construction_paracyclonique?: boolean;
  // Séismes
  zone_sismique?: "3" | "4" | "5";
  norme_parasismique?: boolean;
  // Volcanisme
  zone_volcanique?: boolean;
  proximite_volcan_actif?: boolean;
  // Tsunami
  zone_tsunami?: boolean;
  // Mouvements de terrain
  zone_mouvement_terrain?: boolean;
  type_mouvement?: "glissement" | "eboulement" | "affaissement";
  // Inondations
  zone_inondation?: boolean;
  niveau_risque_inondation?: "fort" | "moyen" | "faible";
  document_url?: string;
}

export interface DomtomDiagnosticsData {
  termites?: TermitesDiagnostic;
  risques_naturels?: RisquesNaturelsDomtom;
}

interface DomtomDiagnosticsProps {
  propertyId: string;
  departement: string;
  initialData?: DomtomDiagnosticsData;
  onSave?: (data: DomtomDiagnosticsData) => Promise<void>;
  readOnly?: boolean;
}

// ============================================
// CONSTANTES
// ============================================

const DOMTOM_DEPARTEMENTS = {
  "971": { name: "Guadeloupe", risques: ["cyclone", "seisme", "tsunami", "volcan"] },
  "972": { name: "Martinique", risques: ["cyclone", "seisme", "tsunami", "volcan"] },
  "973": { name: "Guyane", risques: ["inondation", "mouvement_terrain"] },
  "974": { name: "La Réunion", risques: ["cyclone", "seisme", "volcan", "inondation"] },
  "976": { name: "Mayotte", risques: ["cyclone", "seisme", "tsunami"] },
} as const;

const ZONES_CYCLONIQUES = {
  forte: { label: "Zone à risque fort", color: "destructive", description: "Exposition directe aux cyclones majeurs" },
  moyenne: { label: "Zone à risque moyen", color: "warning", description: "Exposition aux tempêtes tropicales et cyclones modérés" },
  faible: { label: "Zone à risque faible", color: "secondary", description: "Exposition limitée aux phénomènes cycloniques" },
} as const;

const ZONES_SISMIQUES_DOMTOM = {
  "3": { label: "Zone 3 - Modérée", color: "warning", description: "Aléa sismique modéré" },
  "4": { label: "Zone 4 - Moyenne", color: "warning", description: "Aléa sismique moyen" },
  "5": { label: "Zone 5 - Forte", color: "destructive", description: "Aléa sismique fort (Antilles)" },
} as const;

const NIVEAUX_INONDATION = {
  fort: { label: "Risque fort", color: "destructive" },
  moyen: { label: "Risque moyen", color: "warning" },
  faible: { label: "Risque faible", color: "secondary" },
} as const;

const TYPES_MOUVEMENT = {
  glissement: "Glissement de terrain",
  eboulement: "Éboulement rocheux",
  affaissement: "Affaissement / Effondrement",
} as const;

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export function DomtomDiagnostics({
  propertyId,
  departement,
  initialData,
  onSave,
  readOnly = false,
}: DomtomDiagnosticsProps) {
  const [data, setData] = useState<DomtomDiagnosticsData>(initialData || {});
  const [activeTab, setActiveTab] = useState("termites");
  const [isSaving, setIsSaving] = useState(false);

  const deptInfo = DOMTOM_DEPARTEMENTS[departement as keyof typeof DOMTOM_DEPARTEMENTS];
  const isDomtom = !!deptInfo;

  // Handler pour mise à jour termites
  const updateTermites = (field: keyof TermitesDiagnostic, value: any) => {
    setData((prev) => ({
      ...prev,
      termites: {
        ...prev.termites,
        [field]: value,
        departement: departement,
      } as TermitesDiagnostic,
    }));
  };

  // Handler pour mise à jour risques naturels
  const updateRisques = (field: keyof RisquesNaturelsDomtom, value: any) => {
    setData((prev) => ({
      ...prev,
      risques_naturels: {
        ...prev.risques_naturels,
        [field]: value,
      } as RisquesNaturelsDomtom,
    }));
  };

  // Calcul de la validité du diagnostic termites (6 mois)
  const isTermitesValid = () => {
    if (!data.termites?.date_validite) return false;
    return new Date(data.termites.date_validite) > new Date();
  };

  // Sauvegarde
  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(data);
    } finally {
      setIsSaving(false);
    }
  };

  // Afficher un avertissement si pas en DOM-TOM
  if (!isDomtom) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Diagnostics DOM-TOM</AlertTitle>
        <AlertDescription>
          Ce bien n'est pas situé dans un département d'outre-mer. Les diagnostics
          DOM-TOM spécifiques (termites tropicaux, cyclones, etc.) ne sont pas
          applicables.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec infos département */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Diagnostics DOM-TOM</CardTitle>
                <CardDescription>
                  {deptInfo.name} ({departement}) - Diagnostics obligatoires spécifiques
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-sm">
              {deptInfo.risques.length} risques identifiés
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {deptInfo.risques.includes("cyclone") && (
              <Badge variant="secondary" className="gap-1">
                <Wind className="h-3 w-3" /> Cyclones
              </Badge>
            )}
            {deptInfo.risques.includes("seisme") && (
              <Badge variant="secondary" className="gap-1">
                <Mountain className="h-3 w-3" /> Séismes
              </Badge>
            )}
            {deptInfo.risques.includes("tsunami") && (
              <Badge variant="secondary" className="gap-1">
                <Waves className="h-3 w-3" /> Tsunami
              </Badge>
            )}
            {deptInfo.risques.includes("volcan") && (
              <Badge variant="secondary" className="gap-1">
                <Flame className="h-3 w-3" /> Volcanisme
              </Badge>
            )}
            {deptInfo.risques.includes("inondation") && (
              <Badge variant="secondary" className="gap-1">
                <CloudRain className="h-3 w-3" /> Inondations
              </Badge>
            )}
            {deptInfo.risques.includes("mouvement_terrain") && (
              <Badge variant="secondary" className="gap-1">
                <Mountain className="h-3 w-3" /> Mouvements de terrain
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Onglets diagnostics */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="termites" className="gap-2">
            <Bug className="h-4 w-4" />
            Termites
          </TabsTrigger>
          <TabsTrigger value="risques" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Risques naturels
          </TabsTrigger>
        </TabsList>

        {/* === Onglet Termites === */}
        <TabsContent value="termites" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Diagnostic Termites
              </CardTitle>
              <CardDescription>
                Obligatoire en DOM-TOM - Validité 6 mois (Arrêté préfectoral)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Alerte validité */}
              {data.termites?.date_validite && (
                <Alert variant={isTermitesValid() ? "default" : "destructive"}>
                  {isTermitesValid() ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {isTermitesValid() ? "Diagnostic valide" : "Diagnostic expiré"}
                  </AlertTitle>
                  <AlertDescription>
                    {isTermitesValid()
                      ? `Valide jusqu'au ${new Date(data.termites.date_validite).toLocaleDateString("fr-FR")}`
                      : "Un nouveau diagnostic termites est nécessaire avant la signature du bail"}
                  </AlertDescription>
                </Alert>
              )}

              {/* Informations diagnostiqueur */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Diagnostiqueur</Label>
                  <Input
                    value={data.termites?.diagnostiqueur_nom || ""}
                    onChange={(e) => updateTermites("diagnostiqueur_nom", e.target.value)}
                    placeholder="Nom du diagnostiqueur certifié"
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>N° certification</Label>
                  <Input
                    value={data.termites?.diagnostiqueur_certification || ""}
                    onChange={(e) => updateTermites("diagnostiqueur_certification", e.target.value)}
                    placeholder="Numéro de certification"
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Date de réalisation</Label>
                  <Input
                    type="date"
                    value={data.termites?.date_realisation || ""}
                    onChange={(e) => {
                      updateTermites("date_realisation", e.target.value);
                      // Calcul automatique validité (+6 mois)
                      if (e.target.value) {
                        const validite = new Date(e.target.value);
                        validite.setMonth(validite.getMonth() + 6);
                        updateTermites("date_validite", validite.toISOString().split("T")[0]);
                      }
                    }}
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date de validité</Label>
                  <Input
                    type="date"
                    value={data.termites?.date_validite || ""}
                    onChange={(e) => updateTermites("date_validite", e.target.value)}
                    disabled={readOnly}
                  />
                </div>
              </div>

              <Separator />

              {/* Résultats */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Présence de termites</Label>
                    <p className="text-sm text-muted-foreground">
                      Des traces d'infestation ont-elles été détectées ?
                    </p>
                  </div>
                  <Switch
                    checked={data.termites?.presence_termites || false}
                    onCheckedChange={(checked) => updateTermites("presence_termites", checked)}
                    disabled={readOnly}
                  />
                </div>

                {data.termites?.presence_termites && (
                  <div className="space-y-4 p-4 bg-destructive/10 rounded-lg">
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Infestation détectée</AlertTitle>
                      <AlertDescription>
                        Un traitement est obligatoire. Le locataire doit être informé
                        avant signature du bail.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <Label>Zones infestées</Label>
                      <Textarea
                        value={data.termites?.zones_infestees?.join("\n") || ""}
                        onChange={(e) =>
                          updateTermites(
                            "zones_infestees",
                            e.target.value.split("\n").filter(Boolean)
                          )
                        }
                        placeholder="Une zone par ligne (ex: Charpente, Menuiseries...)"
                        disabled={readOnly}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Traitement réalisé</Label>
                        <p className="text-sm text-muted-foreground">
                          Un traitement anti-termites a-t-il été effectué ?
                        </p>
                      </div>
                      <Switch
                        checked={data.termites?.traitement_realise || false}
                        onCheckedChange={(checked) =>
                          updateTermites("traitement_realise", checked)
                        }
                        disabled={readOnly}
                      />
                    </div>

                    {data.termites?.traitement_realise && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Date du traitement</Label>
                          <Input
                            type="date"
                            value={data.termites?.date_traitement || ""}
                            onChange={(e) =>
                              updateTermites("date_traitement", e.target.value)
                            }
                            disabled={readOnly}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Type de traitement</Label>
                          <Input
                            value={data.termites?.type_traitement || ""}
                            onChange={(e) =>
                              updateTermites("type_traitement", e.target.value)
                            }
                            placeholder="Ex: Traitement par injection"
                            disabled={readOnly}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Document */}
              <div className="space-y-2">
                <Label>Document diagnostic</Label>
                <div className="flex gap-2">
                  <Input
                    value={data.termites?.document_url || ""}
                    onChange={(e) => updateTermites("document_url", e.target.value)}
                    placeholder="URL du document"
                    disabled={readOnly}
                  />
                  {!readOnly && (
                    <Button variant="outline" size="icon">
                      <Upload className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Onglet Risques Naturels === */}
        <TabsContent value="risques" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Risques Naturels Spécifiques
              </CardTitle>
              <CardDescription>
                Information obligatoire - État des Risques et Pollutions (ERP) DOM-TOM
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Date de réalisation */}
              <div className="space-y-2">
                <Label>Date de l'état des risques</Label>
                <Input
                  type="date"
                  value={data.risques_naturels?.date_realisation || ""}
                  onChange={(e) => updateRisques("date_realisation", e.target.value)}
                  disabled={readOnly}
                />
              </div>

              <Separator />

              {/* Risque cyclonique */}
              {deptInfo.risques.includes("cyclone") && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Wind className="h-5 w-5 text-blue-500" />
                    <h4 className="font-medium">Risque Cyclonique</h4>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Zone cyclonique</Label>
                      <Select
                        value={data.risques_naturels?.zone_cyclonique || ""}
                        onValueChange={(value) =>
                          updateRisques("zone_cyclonique", value as "forte" | "moyenne" | "faible")
                        }
                        disabled={readOnly}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner la zone" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ZONES_CYCLONIQUES).map(([key, info]) => (
                            <SelectItem key={key} value={key}>
                              {info.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {data.risques_naturels?.zone_cyclonique && (
                        <p className="text-sm text-muted-foreground">
                          {ZONES_CYCLONIQUES[data.risques_naturels.zone_cyclonique].description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-0.5">
                        <Label>Construction paracyclonique</Label>
                        <p className="text-sm text-muted-foreground">
                          Conforme aux normes Eurocode 1
                        </p>
                      </div>
                      <Switch
                        checked={data.risques_naturels?.construction_paracyclonique || false}
                        onCheckedChange={(checked) =>
                          updateRisques("construction_paracyclonique", checked)
                        }
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Risque sismique */}
              {deptInfo.risques.includes("seisme") && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Mountain className="h-5 w-5 text-orange-500" />
                      <h4 className="font-medium">Risque Sismique</h4>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Zone sismique</Label>
                        <Select
                          value={data.risques_naturels?.zone_sismique || ""}
                          onValueChange={(value) =>
                            updateRisques("zone_sismique", value as "3" | "4" | "5")
                          }
                          disabled={readOnly}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner la zone" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ZONES_SISMIQUES_DOMTOM).map(([key, info]) => (
                              <SelectItem key={key} value={key}>
                                {info.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {data.risques_naturels?.zone_sismique && (
                          <p className="text-sm text-muted-foreground">
                            {ZONES_SISMIQUES_DOMTOM[data.risques_naturels.zone_sismique].description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                          <Label>Norme parasismique</Label>
                          <p className="text-sm text-muted-foreground">
                            Conforme aux normes Eurocode 8
                          </p>
                        </div>
                        <Switch
                          checked={data.risques_naturels?.norme_parasismique || false}
                          onCheckedChange={(checked) =>
                            updateRisques("norme_parasismique", checked)
                          }
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Risque volcanique */}
              {deptInfo.risques.includes("volcan") && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Flame className="h-5 w-5 text-red-500" />
                      <h4 className="font-medium">Risque Volcanique</h4>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                          <Label>Zone volcanique</Label>
                          <p className="text-sm text-muted-foreground">
                            Situé dans une zone d'activité volcanique
                          </p>
                        </div>
                        <Switch
                          checked={data.risques_naturels?.zone_volcanique || false}
                          onCheckedChange={(checked) =>
                            updateRisques("zone_volcanique", checked)
                          }
                          disabled={readOnly}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                          <Label>Proximité volcan actif</Label>
                          <p className="text-sm text-muted-foreground">
                            À moins de 10 km d'un volcan actif
                          </p>
                        </div>
                        <Switch
                          checked={data.risques_naturels?.proximite_volcan_actif || false}
                          onCheckedChange={(checked) =>
                            updateRisques("proximite_volcan_actif", checked)
                          }
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Risque tsunami */}
              {deptInfo.risques.includes("tsunami") && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Waves className="h-5 w-5 text-cyan-500" />
                      <h4 className="font-medium">Risque Tsunami</h4>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-0.5">
                        <Label>Zone à risque tsunami</Label>
                        <p className="text-sm text-muted-foreground">
                          Situé en zone littorale exposée aux tsunamis
                        </p>
                      </div>
                      <Switch
                        checked={data.risques_naturels?.zone_tsunami || false}
                        onCheckedChange={(checked) => updateRisques("zone_tsunami", checked)}
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Risque inondation */}
              {deptInfo.risques.includes("inondation") && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <CloudRain className="h-5 w-5 text-blue-600" />
                      <h4 className="font-medium">Risque Inondation Tropicale</h4>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                          <Label>Zone inondable</Label>
                          <p className="text-sm text-muted-foreground">
                            Situé en zone inondable identifiée
                          </p>
                        </div>
                        <Switch
                          checked={data.risques_naturels?.zone_inondation || false}
                          onCheckedChange={(checked) =>
                            updateRisques("zone_inondation", checked)
                          }
                          disabled={readOnly}
                        />
                      </div>
                      {data.risques_naturels?.zone_inondation && (
                        <div className="space-y-2">
                          <Label>Niveau de risque</Label>
                          <Select
                            value={data.risques_naturels?.niveau_risque_inondation || ""}
                            onValueChange={(value) =>
                              updateRisques(
                                "niveau_risque_inondation",
                                value as "fort" | "moyen" | "faible"
                              )
                            }
                            disabled={readOnly}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Niveau de risque" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(NIVEAUX_INONDATION).map(([key, info]) => (
                                <SelectItem key={key} value={key}>
                                  {info.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Risque mouvement de terrain */}
              {deptInfo.risques.includes("mouvement_terrain") && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Mountain className="h-5 w-5 text-amber-600" />
                      <h4 className="font-medium">Mouvements de Terrain</h4>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                          <Label>Zone à risque</Label>
                          <p className="text-sm text-muted-foreground">
                            Situé en zone de mouvements de terrain
                          </p>
                        </div>
                        <Switch
                          checked={data.risques_naturels?.zone_mouvement_terrain || false}
                          onCheckedChange={(checked) =>
                            updateRisques("zone_mouvement_terrain", checked)
                          }
                          disabled={readOnly}
                        />
                      </div>
                      {data.risques_naturels?.zone_mouvement_terrain && (
                        <div className="space-y-2">
                          <Label>Type de mouvement</Label>
                          <Select
                            value={data.risques_naturels?.type_mouvement || ""}
                            onValueChange={(value) =>
                              updateRisques(
                                "type_mouvement",
                                value as "glissement" | "eboulement" | "affaissement"
                              )
                            }
                            disabled={readOnly}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Type de mouvement" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(TYPES_MOUVEMENT).map(([key, label]) => (
                                <SelectItem key={key} value={key}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Document */}
              <div className="space-y-2">
                <Label>Document ERP</Label>
                <div className="flex gap-2">
                  <Input
                    value={data.risques_naturels?.document_url || ""}
                    onChange={(e) => updateRisques("document_url", e.target.value)}
                    placeholder="URL du document ERP"
                    disabled={readOnly}
                  />
                  {!readOnly && (
                    <Button variant="outline" size="icon">
                      <Upload className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bouton sauvegarde */}
      {!readOnly && onSave && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            <Shield className="h-4 w-4" />
            {isSaving ? "Enregistrement..." : "Enregistrer les diagnostics"}
          </Button>
        </div>
      )}

      {/* Résumé des risques */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Résumé pour le bail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>
              <strong>Département :</strong> {deptInfo.name} ({departement})
            </p>
            {data.termites && (
              <p>
                <strong>Termites :</strong>{" "}
                {data.termites.presence_termites
                  ? "Présence détectée - Traitement requis"
                  : "Absence de termites"}
                {data.termites.date_validite && (
                  <span className="text-muted-foreground">
                    {" "}
                    (valide jusqu'au{" "}
                    {new Date(data.termites.date_validite).toLocaleDateString("fr-FR")})
                  </span>
                )}
              </p>
            )}
            {data.risques_naturels?.zone_cyclonique && (
              <p>
                <strong>Zone cyclonique :</strong>{" "}
                {ZONES_CYCLONIQUES[data.risques_naturels.zone_cyclonique].label}
                {data.risques_naturels.construction_paracyclonique && " (construction paracyclonique)"}
              </p>
            )}
            {data.risques_naturels?.zone_sismique && (
              <p>
                <strong>Zone sismique :</strong>{" "}
                {ZONES_SISMIQUES_DOMTOM[data.risques_naturels.zone_sismique].label}
                {data.risques_naturels.norme_parasismique && " (norme parasismique)"}
              </p>
            )}
            {data.risques_naturels?.zone_volcanique && (
              <p>
                <strong>Risque volcanique :</strong> Oui
                {data.risques_naturels.proximite_volcan_actif && " (proximité volcan actif)"}
              </p>
            )}
            {data.risques_naturels?.zone_tsunami && (
              <p>
                <strong>Risque tsunami :</strong> Zone exposée
              </p>
            )}
            {data.risques_naturels?.zone_inondation && (
              <p>
                <strong>Risque inondation :</strong>{" "}
                {data.risques_naturels.niveau_risque_inondation
                  ? NIVEAUX_INONDATION[data.risques_naturels.niveau_risque_inondation].label
                  : "Zone inondable"}
              </p>
            )}
            {data.risques_naturels?.zone_mouvement_terrain && (
              <p>
                <strong>Mouvement de terrain :</strong>{" "}
                {data.risques_naturels.type_mouvement
                  ? TYPES_MOUVEMENT[data.risques_naturels.type_mouvement]
                  : "Zone à risque"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default DomtomDiagnostics;
