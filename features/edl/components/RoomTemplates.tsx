"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export type RoomType =
  | "entree"
  | "salon"
  | "sejour"
  | "cuisine"
  | "chambre"
  | "salle_de_bain"
  | "wc"
  | "couloir"
  | "buanderie"
  | "cave"
  | "parking"
  | "balcon"
  | "terrasse"
  | "jardin"
  | "garage"
  | "autre";

export interface RoomTemplate {
  room_name: string;
  room_type: RoomType;
}

const ROOM_TEMPLATES: Record<string, RoomTemplate[]> = {
  studio: [
    { room_name: "Pièce principale", room_type: "salon" },
    { room_name: "Kitchenette", room_type: "cuisine" },
    { room_name: "Salle de bain", room_type: "salle_de_bain" },
    { room_name: "WC", room_type: "wc" },
    { room_name: "Entrée", room_type: "entree" },
  ],
  appartement: [
    { room_name: "Entrée", room_type: "entree" },
    { room_name: "Salon / Séjour", room_type: "salon" },
    { room_name: "Cuisine", room_type: "cuisine" },
    { room_name: "Chambre 1", room_type: "chambre" },
    { room_name: "Salle de bain", room_type: "salle_de_bain" },
    { room_name: "WC", room_type: "wc" },
    { room_name: "Couloir", room_type: "couloir" },
  ],
  maison: [
    { room_name: "Entrée", room_type: "entree" },
    { room_name: "Salon", room_type: "salon" },
    { room_name: "Séjour", room_type: "sejour" },
    { room_name: "Cuisine", room_type: "cuisine" },
    { room_name: "Chambre 1", room_type: "chambre" },
    { room_name: "Chambre 2", room_type: "chambre" },
    { room_name: "Salle de bain", room_type: "salle_de_bain" },
    { room_name: "WC", room_type: "wc" },
    { room_name: "Garage", room_type: "garage" },
    { room_name: "Jardin", room_type: "jardin" },
  ],
  colocation: [
    { room_name: "Parties communes", room_type: "salon" },
    { room_name: "Cuisine", room_type: "cuisine" },
    { room_name: "Salon", room_type: "salon" },
    { room_name: "Salle de bain", room_type: "salle_de_bain" },
    { room_name: "WC", room_type: "wc" },
    { room_name: "Chambre 1", room_type: "chambre" },
    { room_name: "Chambre 2", room_type: "chambre" },
  ],
};

/** Standard elements per room type */
const ROOM_ELEMENTS: Record<string, string[]> = {
  entree: ["Mur", "Sol", "Plafond", "Porte d'entrée", "Interrupteur", "Prise"],
  salon: ["Mur", "Sol", "Plafond", "Fenêtre", "Prise", "Interrupteur", "Radiateur"],
  sejour: ["Mur", "Sol", "Plafond", "Fenêtre", "Prise", "Interrupteur", "Radiateur"],
  cuisine: ["Mur", "Sol", "Plafond", "Fenêtre", "Évier", "Robinet", "Prise", "Interrupteur", "Placard"],
  chambre: ["Mur", "Sol", "Plafond", "Fenêtre", "Porte", "Prise", "Interrupteur", "Radiateur", "Placard"],
  salle_de_bain: ["Mur", "Sol", "Plafond", "Fenêtre", "Baignoire", "Douche", "Lavabo", "Robinet", "Prise", "Interrupteur"],
  wc: ["Mur", "Sol", "Plafond", "WC", "Interrupteur"],
  couloir: ["Mur", "Sol", "Plafond", "Interrupteur", "Prise"],
  buanderie: ["Mur", "Sol", "Plafond", "Prise", "Robinet"],
  cave: ["Mur", "Sol", "Porte"],
  parking: ["Sol", "Porte"],
  balcon: ["Sol", "Garde-corps"],
  terrasse: ["Sol", "Garde-corps"],
  jardin: ["Clôture", "Portail"],
  garage: ["Mur", "Sol", "Porte de garage", "Prise"],
  autre: ["Mur", "Sol", "Plafond"],
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  studio: "Studio",
  appartement: "Appartement",
  maison: "Maison",
  colocation: "Colocation",
};

interface RoomTemplatesProps {
  onSelectTemplate: (rooms: RoomTemplate[]) => void;
  onAddRoom: (room: RoomTemplate) => void;
}

export function RoomTemplates({ onSelectTemplate, onAddRoom }: RoomTemplatesProps) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground mb-2">
          Modèle de pièces par type de bien
        </h4>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PROPERTY_TYPE_LABELS).map(([key, label]) => (
            <Button
              key={key}
              variant="outline"
              size="sm"
              onClick={() => onSelectTemplate(ROOM_TEMPLATES[key])}
              className="border-dashed"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-muted-foreground mb-2">
          Ajouter une pièce
        </h4>
        <div className="flex flex-wrap gap-2">
          {[
            { name: "Chambre", type: "chambre" as RoomType },
            { name: "Salle de bain", type: "salle_de_bain" as RoomType },
            { name: "Balcon", type: "balcon" as RoomType },
            { name: "Terrasse", type: "terrasse" as RoomType },
            { name: "Cave", type: "cave" as RoomType },
            { name: "Garage", type: "garage" as RoomType },
            { name: "Autre", type: "autre" as RoomType },
          ].map(({ name, type }) => (
            <Button
              key={type}
              variant="ghost"
              size="sm"
              onClick={() => onAddRoom({ room_name: name, room_type: type })}
              className="gap-1 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              {name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function getDefaultElements(roomType: string): string[] {
  return ROOM_ELEMENTS[roomType] || ROOM_ELEMENTS.autre;
}

export function getRoomTemplatesForType(propertyType: string): RoomTemplate[] {
  return ROOM_TEMPLATES[propertyType] || ROOM_TEMPLATES.appartement;
}

export { ROOM_TEMPLATES, ROOM_ELEMENTS };
