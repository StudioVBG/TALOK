"use client";

/**
 * P2-6: Clauses personnalisables pour le bail
 *
 * Permet au bailleur d'ajouter/retirer des clauses optionnelles
 * et de saisir des clauses personnalisées en texte libre.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

// Clauses optionnelles prédéfinies par type de bail
const OPTIONAL_CLAUSES: Record<string, { id: string; label: string; text: string; category: string }[]> = {
  habitation: [
    {
      id: "animaux",
      label: "Animaux de compagnie",
      text: "Le locataire est autorisé à détenir des animaux de compagnie dans le logement, à condition que ceux-ci ne causent pas de nuisances aux voisins ni de dégradations au bien loué.",
      category: "Usage",
    },
    {
      id: "sous_location",
      label: "Interdiction de sous-location",
      text: "Le locataire s'interdit de sous-louer le logement en tout ou partie, même à titre gratuit, sans l'accord préalable et écrit du bailleur, conformément à l'article 8 de la loi du 6 juillet 1989.",
      category: "Usage",
    },
    {
      id: "travaux_locataire",
      label: "Travaux par le locataire",
      text: "Le locataire pourra effectuer des travaux d'aménagement à ses frais, sous réserve de l'accord écrit préalable du bailleur. À la sortie, le bailleur pourra demander la remise en état ou conserver les améliorations sans indemnité.",
      category: "Travaux",
    },
    {
      id: "entretien_jardin",
      label: "Entretien des espaces verts",
      text: "Le locataire s'engage à entretenir régulièrement le jardin, les plantations et les espaces verts privatifs mis à sa disposition.",
      category: "Entretien",
    },
    {
      id: "assurance",
      label: "Justificatif d'assurance annuel",
      text: "Le locataire s'engage à fournir au bailleur une attestation d'assurance habitation à chaque date anniversaire du bail. À défaut de production dans un délai d'un mois suivant la demande, le bailleur pourra souscrire une assurance pour le compte du locataire (Art. 7g loi 89-462).",
      category: "Assurance",
    },
    {
      id: "visites",
      label: "Droit de visite pour relocation",
      text: "En cas de congé donné par l'une ou l'autre des parties, le locataire permettra la visite du logement par des candidats à la location, 2 heures par jour ouvrable, à des horaires fixés d'un commun accord.",
      category: "Usage",
    },
  ],
  commercial: [
    {
      id: "destination",
      label: "Clause de destination",
      text: "Les locaux sont destinés exclusivement à l'exercice de l'activité suivante : [à préciser]. Toute modification de destination devra faire l'objet d'un accord préalable du bailleur.",
      category: "Usage",
    },
    {
      id: "non_concurrence",
      label: "Clause de non-concurrence",
      text: "Le bailleur s'engage à ne pas louer d'autres locaux dans le même immeuble ou centre commercial à un locataire exerçant une activité concurrente directe.",
      category: "Commercial",
    },
  ],
};

interface CustomClause {
  id: string;
  text: string;
  isCustom: boolean;
}

interface CustomClausesProps {
  typeBail: string;
  value: CustomClause[];
  onChange: (clauses: CustomClause[]) => void;
}

export function CustomClauses({ typeBail, value, onChange }: CustomClausesProps) {
  const [newClauseText, setNewClauseText] = useState("");

  // Determine available predefined clauses based on bail type
  const isCommercial = ["commercial_3_6_9", "commercial_derogatoire", "location_gerance"].includes(typeBail);
  const predefinedClauses = isCommercial
    ? [...(OPTIONAL_CLAUSES.commercial || []), ...(OPTIONAL_CLAUSES.habitation || [])]
    : OPTIONAL_CLAUSES.habitation || [];

  const isClauseEnabled = (clauseId: string) => value.some((c) => c.id === clauseId);

  const toggleClause = (clause: typeof predefinedClauses[0]) => {
    if (isClauseEnabled(clause.id)) {
      onChange(value.filter((c) => c.id !== clause.id));
    } else {
      onChange([...value, { id: clause.id, text: clause.text, isCustom: false }]);
    }
  };

  const addCustomClause = () => {
    if (!newClauseText.trim()) return;
    const id = `custom_${Date.now()}`;
    onChange([...value, { id, text: newClauseText.trim(), isCustom: true }]);
    setNewClauseText("");
  };

  const removeClause = (id: string) => {
    onChange(value.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Predefined clauses */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Clauses optionnelles</Label>
        {predefinedClauses.map((clause) => (
          <Card key={clause.id} className={isClauseEnabled(clause.id) ? "border-primary/50" : ""}>
            <CardContent className="py-3 px-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{clause.label}</span>
                    <span className="text-[10px] text-muted-foreground px-1.5 py-0 rounded bg-muted">
                      {clause.category}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{clause.text}</p>
                </div>
                <Switch
                  checked={isClauseEnabled(clause.id)}
                  onCheckedChange={() => toggleClause(clause)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Custom clauses */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Clauses personnalisées</Label>

        {value.filter((c) => c.isCustom).map((clause) => (
          <Card key={clause.id}>
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-3">
                <p className="text-sm flex-1">{clause.text}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeClause(clause.id)}
                  className="text-red-500 hover:text-red-700 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="space-y-2">
          <Textarea
            placeholder="Saisir une clause personnalisée..."
            value={newClauseText}
            onChange={(e) => setNewClauseText(e.target.value)}
            rows={3}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={addCustomClause}
            disabled={!newClauseText.trim()}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Ajouter cette clause
          </Button>
        </div>
      </div>
    </div>
  );
}
