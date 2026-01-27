"use client";

/**
 * Inventaire mobilier pour bail meublé - Décret n°2015-981
 * GAP-002: Inventaire du mobilier pour logement meublé
 *
 * Éléments obligatoires selon l'Article 25-4 de la loi du 6 juillet 1989 :
 * - Literie comprenant couette ou couverture
 * - Dispositif d'occultation des fenêtres dans les pièces destinées à être utilisées comme chambre
 * - Plaques de cuisson
 * - Four ou four à micro-ondes
 * - Réfrigérateur et congélateur ou réfrigérateur avec compartiment congélateur
 * - Vaisselle et ustensiles de cuisine
 * - Table et sièges
 * - Étagères de rangement
 * - Luminaires
 * - Matériel d'entretien ménager adapté au logement
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bed,
  Blinds,
  Flame,
  Microwave,
  Refrigerator,
  UtensilsCrossed,
  Table,
  BookMarked,
  Lightbulb,
  Trash2,
  Check,
  X,
  Plus,
  Camera,
  Info,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ==================== TYPES ====================

export type FurnitureCondition = "neuf" | "bon_etat" | "usage" | "mauvais_etat";

export interface MandatoryFurnitureItem {
  id: string;
  key: keyof MandatoryFurnitureChecklist;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  present: boolean;
  quantity: number;
  condition: FurnitureCondition;
  notes?: string;
  photoUrl?: string;
}

export interface MandatoryFurnitureChecklist {
  literie_couette_couverture: boolean;
  volets_rideaux_chambres: boolean;
  plaques_cuisson: boolean;
  four_ou_micro_ondes: boolean;
  refrigerateur_congelateur: boolean;
  vaisselle_ustensiles: boolean;
  table_sieges: boolean;
  rangements: boolean;
  luminaires: boolean;
  materiel_entretien: boolean;
}

export interface AdditionalFurnitureItem {
  id: string;
  designation: string;
  quantity: number;
  condition: FurnitureCondition;
  room?: string;
  notes?: string;
  photoUrl?: string;
}

export interface FurnitureInventoryData {
  mandatory: MandatoryFurnitureItem[];
  additional: AdditionalFurnitureItem[];
  completedAt?: string;
  signedByOwner?: boolean;
  signedByTenant?: boolean;
}

interface FurnitureInventoryProps {
  data: FurnitureInventoryData;
  edlType: "entree" | "sortie";
  entryInventory?: FurnitureInventoryData;
  onUpdateMandatory: (item: MandatoryFurnitureItem) => Promise<void>;
  onAddAdditional: (item: Omit<AdditionalFurnitureItem, "id">) => Promise<AdditionalFurnitureItem>;
  onUpdateAdditional: (item: AdditionalFurnitureItem) => Promise<void>;
  onDeleteAdditional: (id: string) => Promise<void>;
  onTakePhoto?: (itemId: string, type: "mandatory" | "additional") => void;
  onComplete: () => Promise<void>;
  className?: string;
}

// ==================== DONNÉES INITIALES ====================

export const MANDATORY_ITEMS_CONFIG: Array<{
  key: keyof MandatoryFurnitureChecklist;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: "literie_couette_couverture",
    label: "Literie (couette/couverture)",
    description: "Lit équipé avec couette ou couverture",
    icon: Bed,
  },
  {
    key: "volets_rideaux_chambres",
    label: "Volets/Rideaux chambres",
    description: "Dispositif d'occultation dans les chambres",
    icon: Blinds,
  },
  {
    key: "plaques_cuisson",
    label: "Plaques de cuisson",
    description: "Plaques de cuisson (gaz, électrique ou induction)",
    icon: Flame,
  },
  {
    key: "four_ou_micro_ondes",
    label: "Four ou micro-ondes",
    description: "Four traditionnel ou four à micro-ondes",
    icon: Microwave,
  },
  {
    key: "refrigerateur_congelateur",
    label: "Réfrigérateur/Congélateur",
    description: "Réfrigérateur avec compartiment congélateur ou séparé",
    icon: Refrigerator,
  },
  {
    key: "vaisselle_ustensiles",
    label: "Vaisselle et ustensiles",
    description: "Vaisselle et ustensiles de cuisine nécessaires à la prise de repas",
    icon: UtensilsCrossed,
  },
  {
    key: "table_sieges",
    label: "Table et sièges",
    description: "Table et sièges en nombre suffisant",
    icon: Table,
  },
  {
    key: "rangements",
    label: "Rangements",
    description: "Étagères de rangement",
    icon: BookMarked,
  },
  {
    key: "luminaires",
    label: "Luminaires",
    description: "Luminaires fonctionnels dans chaque pièce",
    icon: Lightbulb,
  },
  {
    key: "materiel_entretien",
    label: "Matériel d'entretien",
    description: "Matériel d'entretien ménager adapté (aspirateur, balai...)",
    icon: Trash2,
  },
];

const CONDITION_LABELS: Record<FurnitureCondition, { label: string; color: string }> = {
  neuf: { label: "Neuf", color: "text-green-600 bg-green-50" },
  bon_etat: { label: "Bon état", color: "text-blue-600 bg-blue-50" },
  usage: { label: "Usagé", color: "text-amber-600 bg-amber-50" },
  mauvais_etat: { label: "Mauvais état", color: "text-red-600 bg-red-50" },
};

// ==================== COMPOSANTS ====================

function ConditionBadge({ condition }: { condition: FurnitureCondition }) {
  const config = CONDITION_LABELS[condition];
  return (
    <Badge variant="outline" className={cn("text-xs", config.color)}>
      {config.label}
    </Badge>
  );
}

function MandatoryItemCard({
  item,
  entryItem,
  isExit,
  onUpdate,
  onTakePhoto,
}: {
  item: MandatoryFurnitureItem;
  entryItem?: MandatoryFurnitureItem;
  isExit: boolean;
  onUpdate: (item: MandatoryFurnitureItem) => Promise<void>;
  onTakePhoto?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const Icon = item.icon;

  const hasConditionDegraded = entryItem &&
    item.present &&
    entryItem.present &&
    getConditionLevel(item.condition) > getConditionLevel(entryItem.condition);

  const handleTogglePresent = async () => {
    setIsUpdating(true);
    try {
      await onUpdate({ ...item, present: !item.present });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateCondition = async (condition: FurnitureCondition) => {
    setIsUpdating(true);
    try {
      await onUpdate({ ...item, condition });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateQuantity = async (quantity: number) => {
    setIsUpdating(true);
    try {
      await onUpdate({ ...item, quantity: Math.max(0, quantity) });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateNotes = async (notes: string) => {
    setIsUpdating(true);
    try {
      await onUpdate({ ...item, notes });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className={cn(
        "transition-all",
        item.present ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30",
        hasConditionDegraded && "ring-2 ring-amber-400"
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                item.present ? "bg-green-100" : "bg-red-100"
              )}>
                <Icon className={cn(
                  "h-5 w-5",
                  item.present ? "text-green-600" : "text-red-600"
                )} />
              </div>
              <div>
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  {item.label}
                  {hasConditionDegraded && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>État dégradé depuis l&apos;entrée</p>
                          <p className="text-xs text-muted-foreground">
                            Entrée: {CONDITION_LABELS[entryItem!.condition].label} →
                            Sortie: {CONDITION_LABELS[item.condition].label}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  {item.description}
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {item.present && <ConditionBadge condition={item.condition} />}
              <Button
                variant={item.present ? "default" : "outline"}
                size="sm"
                onClick={handleTogglePresent}
                disabled={isUpdating}
                className={cn(
                  "gap-1",
                  item.present
                    ? "bg-green-500 hover:bg-green-600"
                    : "text-red-600 border-red-300 hover:bg-red-50"
                )}
              >
                {item.present ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                {item.present ? "Présent" : "Absent"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full mt-1">
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Réduire
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Détails
              </>
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-4 space-y-4">
            {item.present && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Quantité
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleUpdateQuantity(item.quantity - 1)}
                        disabled={item.quantity <= 1 || isUpdating}
                      >
                        -
                      </Button>
                      <span className="w-8 text-center font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleUpdateQuantity(item.quantity + 1)}
                        disabled={isUpdating}
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      État
                    </label>
                    <Select
                      value={item.condition}
                      onValueChange={(v) => handleUpdateCondition(v as FurnitureCondition)}
                      disabled={isUpdating}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CONDITION_LABELS).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Observations
                  </label>
                  <Textarea
                    value={item.notes || ""}
                    onChange={(e) => handleUpdateNotes(e.target.value)}
                    placeholder="Ajouter des observations..."
                    className="mt-1"
                    rows={2}
                    disabled={isUpdating}
                  />
                </div>

                {onTakePhoto && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onTakePhoto}
                    className="gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    {item.photoUrl ? "Changer la photo" : "Ajouter une photo"}
                  </Button>
                )}

                {item.photoUrl && (
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden border">
                    <img
                      src={item.photoUrl}
                      alt={item.label}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {isExit && entryItem && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      État à l&apos;entrée
                    </p>
                    <div className="flex items-center gap-2">
                      <ConditionBadge condition={entryItem.condition} />
                      <span className="text-xs text-muted-foreground">
                        Quantité: {entryItem.quantity}
                      </span>
                    </div>
                    {entryItem.notes && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {entryItem.notes}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {!item.present && (
              <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Élément obligatoire manquant</span>
                </div>
                <p className="text-xs mt-1 text-red-600">
                  Selon le décret 2015-981, cet élément est obligatoire pour un bail meublé.
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function AdditionalItemRow({
  item,
  onUpdate,
  onDelete,
}: {
  item: AdditionalFurnitureItem;
  onUpdate: (item: AdditionalFurnitureItem) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedItem, setEditedItem] = useState(item);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSave = async () => {
    setIsUpdating(true);
    try {
      await onUpdate(editedItem);
      setIsEditing(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsUpdating(true);
    try {
      await onDelete();
    } finally {
      setIsUpdating(false);
    }
  };

  if (isEditing) {
    return (
      <tr className="bg-blue-50">
        <td className="p-2">
          <Input
            value={editedItem.designation}
            onChange={(e) => setEditedItem({ ...editedItem, designation: e.target.value })}
            placeholder="Désignation"
            className="h-8"
          />
        </td>
        <td className="p-2">
          <Input
            type="number"
            value={editedItem.quantity}
            onChange={(e) => setEditedItem({ ...editedItem, quantity: parseInt(e.target.value) || 1 })}
            min={1}
            className="h-8 w-16"
          />
        </td>
        <td className="p-2">
          <Select
            value={editedItem.condition}
            onValueChange={(v) => setEditedItem({ ...editedItem, condition: v as FurnitureCondition })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CONDITION_LABELS).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
        <td className="p-2">
          <Input
            value={editedItem.room || ""}
            onChange={(e) => setEditedItem({ ...editedItem, room: e.target.value })}
            placeholder="Pièce"
            className="h-8"
          />
        </td>
        <td className="p-2">
          <div className="flex gap-1">
            <Button size="sm" variant="default" onClick={handleSave} disabled={isUpdating}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={isUpdating}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="p-2 font-medium">{item.designation}</td>
      <td className="p-2 text-center">{item.quantity}</td>
      <td className="p-2">
        <ConditionBadge condition={item.condition} />
      </td>
      <td className="p-2 text-muted-foreground">{item.room || "-"}</td>
      <td className="p-2">
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
            Modifier
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isUpdating}>
            <Trash2 className="h-3 w-3 text-red-500" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ==================== UTILITAIRES ====================

function getConditionLevel(condition: FurnitureCondition): number {
  const levels: Record<FurnitureCondition, number> = {
    neuf: 0,
    bon_etat: 1,
    usage: 2,
    mauvais_etat: 3,
  };
  return levels[condition];
}

// ==================== COMPOSANT PRINCIPAL ====================

export function FurnitureInventory({
  data,
  edlType,
  entryInventory,
  onUpdateMandatory,
  onAddAdditional,
  onUpdateAdditional,
  onDeleteAdditional,
  onTakePhoto,
  onComplete,
  className,
}: FurnitureInventoryProps) {
  const [newItem, setNewItem] = useState<Partial<AdditionalFurnitureItem>>({
    quantity: 1,
    condition: "bon_etat",
  });
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const isExit = edlType === "sortie";

  const mandatoryComplete = data.mandatory.every(item => item.present);
  const mandatoryMissing = data.mandatory.filter(item => !item.present);
  const totalMandatory = data.mandatory.length;
  const presentMandatory = data.mandatory.filter(item => item.present).length;

  const handleAddItem = async () => {
    if (!newItem.designation) return;

    setIsAddingItem(true);
    try {
      await onAddAdditional({
        designation: newItem.designation,
        quantity: newItem.quantity || 1,
        condition: newItem.condition || "bon_etat",
        room: newItem.room,
        notes: newItem.notes,
      });
      setNewItem({ quantity: 1, condition: "bon_etat" });
    } finally {
      setIsAddingItem(false);
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await onComplete();
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            Inventaire du mobilier
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium">Décret n°2015-981</p>
                  <p className="text-xs">
                    Liste des éléments de mobilier obligatoires pour un logement meublé,
                    en application de l&apos;article 25-4 de la loi du 6 juillet 1989.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </h2>
          <p className="text-sm text-muted-foreground">
            État des lieux {isExit ? "de sortie" : "d'entrée"} - Bail meublé
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={mandatoryComplete ? "default" : "destructive"}>
            {presentMandatory}/{totalMandatory} éléments obligatoires
          </Badge>
        </div>
      </div>

      {/* Alerte si éléments manquants */}
      {!mandatoryComplete && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-amber-50 border border-amber-200 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">
                {mandatoryMissing.length} élément{mandatoryMissing.length > 1 ? "s" : ""} obligatoire{mandatoryMissing.length > 1 ? "s" : ""} manquant{mandatoryMissing.length > 1 ? "s" : ""}
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Pour être conforme au décret 2015-981, le logement meublé doit contenir tous les éléments obligatoires.
              </p>
              <ul className="text-sm text-amber-600 mt-2 list-disc list-inside">
                {mandatoryMissing.map(item => (
                  <li key={item.id}>{item.label}</li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      {/* Éléments obligatoires */}
      <div>
        <h3 className="text-lg font-medium mb-4">
          Éléments obligatoires (Décret 2015-981)
        </h3>
        <div className="grid gap-3">
          {data.mandatory.map((item) => {
            const entryItem = entryInventory?.mandatory.find(
              (e) => e.key === item.key
            );
            return (
              <MandatoryItemCard
                key={item.id}
                item={item}
                entryItem={entryItem}
                isExit={isExit}
                onUpdate={onUpdateMandatory}
                onTakePhoto={
                  onTakePhoto ? () => onTakePhoto(item.id, "mandatory") : undefined
                }
              />
            );
          })}
        </div>
      </div>

      {/* Mobilier supplémentaire */}
      <div>
        <h3 className="text-lg font-medium mb-4">
          Mobilier supplémentaire
        </h3>

        {data.additional.length > 0 && (
          <div className="border rounded-lg overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-left font-medium">Désignation</th>
                  <th className="p-2 text-center font-medium">Qté</th>
                  <th className="p-2 text-left font-medium">État</th>
                  <th className="p-2 text-left font-medium">Pièce</th>
                  <th className="p-2 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.additional.map((item) => (
                  <AdditionalItemRow
                    key={item.id}
                    item={item}
                    onUpdate={onUpdateAdditional}
                    onDelete={() => onDeleteAdditional(item.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Formulaire ajout */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ajouter un élément</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="col-span-2 md:col-span-1">
                <Input
                  placeholder="Désignation *"
                  value={newItem.designation || ""}
                  onChange={(e) =>
                    setNewItem({ ...newItem, designation: e.target.value })
                  }
                />
              </div>
              <div>
                <Input
                  type="number"
                  placeholder="Qté"
                  min={1}
                  value={newItem.quantity || 1}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      quantity: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
              <div>
                <Select
                  value={newItem.condition}
                  onValueChange={(v) =>
                    setNewItem({
                      ...newItem,
                      condition: v as FurnitureCondition,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="État" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONDITION_LABELS).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Input
                  placeholder="Pièce"
                  value={newItem.room || ""}
                  onChange={(e) =>
                    setNewItem({ ...newItem, room: e.target.value })
                  }
                />
              </div>
              <div>
                <Button
                  onClick={handleAddItem}
                  disabled={!newItem.designation || isAddingItem}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          size="lg"
          onClick={handleComplete}
          disabled={isCompleting}
          className="gap-2"
        >
          {isCompleting ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Check className="h-4 w-4" />
            </motion.div>
          ) : (
            <Check className="h-4 w-4" />
          )}
          Valider l&apos;inventaire
        </Button>
      </div>
    </div>
  );
}

export default FurnitureInventory;
