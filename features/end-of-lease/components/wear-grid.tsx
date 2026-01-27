"use client";

/**
 * Grille de Vétusté - Décret du 30 mars 2016
 *
 * Permet d'évaluer l'usure normale des éléments du logement
 * pour distinguer les dégradations imputables au locataire
 * des dégradations dues à l'usage normal.
 *
 * Durées de vie types selon les accords collectifs :
 * - Peintures/papiers peints : 7 ans
 * - Moquettes/sols souples : 7 ans
 * - Parquets/carrelages : 15 ans
 * - Équipements sanitaires : 15 ans
 * - Menuiseries intérieures : 15 ans
 * - Équipements électriques : 20 ans
 */

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Paintbrush,
  Grid3X3,
  DoorOpen,
  Bath,
  Zap,
  Lightbulb,
  Key,
  Thermometer,
  Info,
  AlertTriangle,
  Check,
  Calculator,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ==================== TYPES ====================

export type WearCategory =
  | "peintures"
  | "revetements_sols"
  | "menuiseries"
  | "sanitaires"
  | "electricite"
  | "plomberie"
  | "chauffage"
  | "serrurerie";

export type DamageType = "usure_normale" | "degradation" | "non_applicable";

export interface WearItem {
  id: string;
  category: WearCategory;
  element: string;
  room: string;
  lifespan: number; // Durée de vie en années
  ageAtEntry: number; // Âge à l'entrée en années
  currentAge: number; // Âge actuel (calculé)
  damageType: DamageType;
  damageDescription?: string;
  repairCost?: number;
  wearPercentage: number; // % de vétusté
  tenantResponsibility: number; // % à la charge du locataire
  amountDue: number; // Montant à retenir
}

export interface WearGridData {
  items: WearItem[];
  leaseStartDate: string;
  leaseEndDate: string;
  totalRepairCost: number;
  totalTenantAmount: number;
  totalWearDeduction: number;
}

interface WearGridProps {
  data: WearGridData;
  onUpdateItem: (item: WearItem) => void;
  onAddItem: (item: Omit<WearItem, "id" | "wearPercentage" | "tenantResponsibility" | "amountDue">) => void;
  onDeleteItem: (id: string) => void;
  onCalculate: () => void;
  className?: string;
}

// ==================== CONFIGURATION ====================

export const WEAR_CATEGORIES: Record<
  WearCategory,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    defaultLifespan: number;
    elements: string[];
  }
> = {
  peintures: {
    label: "Peintures et papiers peints",
    icon: Paintbrush,
    defaultLifespan: 7,
    elements: [
      "Peinture murs",
      "Peinture plafonds",
      "Papier peint",
      "Enduit décoratif",
      "Crépi intérieur",
    ],
  },
  revetements_sols: {
    label: "Revêtements de sols",
    icon: Grid3X3,
    defaultLifespan: 10,
    elements: [
      "Moquette",
      "Parquet",
      "Carrelage",
      "Lino/PVC",
      "Stratifié",
      "Béton ciré",
    ],
  },
  menuiseries: {
    label: "Menuiseries intérieures",
    icon: DoorOpen,
    defaultLifespan: 15,
    elements: [
      "Portes intérieures",
      "Placards/dressings",
      "Fenêtres (parties intérieures)",
      "Volets roulants",
      "Stores",
      "Plinthes",
    ],
  },
  sanitaires: {
    label: "Équipements sanitaires",
    icon: Bath,
    defaultLifespan: 15,
    elements: [
      "Lavabo",
      "WC",
      "Baignoire",
      "Douche/receveur",
      "Robinetterie",
      "Miroir salle de bain",
    ],
  },
  electricite: {
    label: "Équipements électriques",
    icon: Zap,
    defaultLifespan: 20,
    elements: [
      "Prises électriques",
      "Interrupteurs",
      "Tableau électrique",
      "Radiateurs électriques",
      "VMC",
    ],
  },
  plomberie: {
    label: "Plomberie",
    icon: Lightbulb,
    defaultLifespan: 20,
    elements: [
      "Tuyauterie visible",
      "Siphons",
      "Joints d'étanchéité",
      "Chauffe-eau",
      "Cumulus",
    ],
  },
  chauffage: {
    label: "Chauffage",
    icon: Thermometer,
    defaultLifespan: 15,
    elements: [
      "Chaudière (parties visibles)",
      "Radiateurs",
      "Thermostats",
      "Convecteurs",
    ],
  },
  serrurerie: {
    label: "Serrurerie",
    icon: Key,
    defaultLifespan: 20,
    elements: [
      "Serrures",
      "Clés",
      "Verrous",
      "Poignées de portes",
      "Interphone/digicode",
    ],
  },
};

const DAMAGE_TYPE_CONFIG: Record<DamageType, { label: string; color: string }> = {
  usure_normale: { label: "Usure normale", color: "text-green-600 bg-green-50" },
  degradation: { label: "Dégradation", color: "text-red-600 bg-red-50" },
  non_applicable: { label: "Non applicable", color: "text-gray-500 bg-gray-50" },
};

// ==================== UTILITAIRES ====================

/**
 * Calcule le pourcentage de vétusté selon la grille linéaire
 * Formule : (âge actuel / durée de vie) * 100, plafonné à 100%
 */
export function calculateWearPercentage(currentAge: number, lifespan: number): number {
  if (lifespan <= 0) return 0;
  const percentage = (currentAge / lifespan) * 100;
  return Math.min(100, Math.round(percentage));
}

/**
 * Calcule la responsabilité du locataire
 * = 100% - vétusté (le locataire ne paie que la partie non usée)
 */
export function calculateTenantResponsibility(wearPercentage: number, damageType: DamageType): number {
  if (damageType === "usure_normale" || damageType === "non_applicable") {
    return 0; // Pas de charge si usure normale
  }
  return Math.max(0, 100 - wearPercentage);
}

/**
 * Calcule le montant dû par le locataire
 */
export function calculateAmountDue(
  repairCost: number,
  tenantResponsibility: number
): number {
  return Math.round((repairCost * tenantResponsibility) / 100);
}

// ==================== COMPOSANTS ====================

function WearItemRow({
  item,
  onUpdate,
  onDelete,
}: {
  item: WearItem;
  onUpdate: (item: WearItem) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const category = WEAR_CATEGORIES[item.category];
  const damageConfig = DAMAGE_TYPE_CONFIG[item.damageType];

  const handleCostChange = (cost: number) => {
    const wearPct = calculateWearPercentage(item.currentAge, item.lifespan);
    const tenantResp = calculateTenantResponsibility(wearPct, item.damageType);
    const amount = calculateAmountDue(cost, tenantResp);

    onUpdate({
      ...item,
      repairCost: cost,
      wearPercentage: wearPct,
      tenantResponsibility: tenantResp,
      amountDue: amount,
    });
  };

  const handleDamageTypeChange = (type: DamageType) => {
    const wearPct = calculateWearPercentage(item.currentAge, item.lifespan);
    const tenantResp = calculateTenantResponsibility(wearPct, type);
    const amount = calculateAmountDue(item.repairCost || 0, tenantResp);

    onUpdate({
      ...item,
      damageType: type,
      wearPercentage: wearPct,
      tenantResponsibility: tenantResp,
      amountDue: amount,
    });
  };

  return (
    <TableRow className={cn(item.damageType === "degradation" && "bg-red-50/50")}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <category.icon className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm">{item.element}</p>
            <p className="text-xs text-muted-foreground">{item.room}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <span className="text-sm">{item.lifespan} ans</span>
      </TableCell>
      <TableCell className="text-center">
        <span className="text-sm">{item.currentAge} ans</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Progress value={item.wearPercentage} className="h-2 w-16" />
          <span className="text-xs font-medium">{item.wearPercentage}%</span>
        </div>
      </TableCell>
      <TableCell>
        <Select value={item.damageType} onValueChange={handleDamageTypeChange}>
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DAMAGE_TYPE_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={item.repairCost || ""}
          onChange={(e) => handleCostChange(Number(e.target.value) || 0)}
          placeholder="0"
          className="h-8 w-24"
          disabled={item.damageType !== "degradation"}
        />
      </TableCell>
      <TableCell className="text-center">
        {item.damageType === "degradation" ? (
          <Badge variant="outline" className="text-amber-600">
            {item.tenantResponsibility}%
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="text-right font-medium">
        {item.amountDue > 0 ? (
          <span className="text-red-600">{item.amountDue} €</span>
        ) : (
          <span className="text-green-600">0 €</span>
        )}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          ×
        </Button>
      </TableCell>
    </TableRow>
  );
}

function AddItemForm({
  onAdd,
  leaseYears,
}: {
  onAdd: (item: Omit<WearItem, "id" | "wearPercentage" | "tenantResponsibility" | "amountDue">) => void;
  leaseYears: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<WearCategory>("peintures");
  const [element, setElement] = useState("");
  const [room, setRoom] = useState("");
  const [ageAtEntry, setAgeAtEntry] = useState(0);

  const categoryConfig = WEAR_CATEGORIES[category];
  const currentAge = ageAtEntry + leaseYears;

  const handleSubmit = () => {
    if (!element || !room) return;

    onAdd({
      category,
      element,
      room,
      lifespan: categoryConfig.defaultLifespan,
      ageAtEntry,
      currentAge,
      damageType: "usure_normale",
    });

    // Reset form
    setElement("");
    setRoom("");
    setAgeAtEntry(0);
    setIsOpen(false);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full gap-2">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Ajouter un élément
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-3">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <Label className="text-xs">Catégorie</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as WearCategory)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(WEAR_CATEGORIES).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Élément</Label>
                <Select value={element} onValueChange={setElement}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choisir..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryConfig.elements.map((el) => (
                      <SelectItem key={el} value={el}>
                        {el}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Pièce</Label>
                <Input
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="Salon, Chambre 1..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs">Âge à l'entrée (ans)</Label>
                <Input
                  type="number"
                  value={ageAtEntry}
                  onChange={(e) => setAgeAtEntry(Number(e.target.value) || 0)}
                  min={0}
                  className="mt-1"
                />
              </div>

              <div className="flex items-end">
                <Button onClick={handleSubmit} disabled={!element || !room} className="w-full">
                  Ajouter
                </Button>
              </div>
            </div>

            <div className="mt-3 p-2 bg-slate-50 rounded text-xs text-muted-foreground">
              <p>
                Durée de vie standard : <strong>{categoryConfig.defaultLifespan} ans</strong>
              </p>
              <p>
                Âge actuel estimé : <strong>{currentAge} ans</strong> ({ageAtEntry} + {leaseYears} ans de bail)
              </p>
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ==================== COMPOSANT PRINCIPAL ====================

export function WearGrid({
  data,
  onUpdateItem,
  onAddItem,
  onDeleteItem,
  onCalculate,
  className,
}: WearGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<WearCategory | "all">("all");

  const leaseYears = useMemo(() => {
    const start = new Date(data.leaseStartDate);
    const end = new Date(data.leaseEndDate);
    return Math.round((end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  }, [data.leaseStartDate, data.leaseEndDate]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") return data.items;
    return data.items.filter((item) => item.category === selectedCategory);
  }, [data.items, selectedCategory]);

  const stats = useMemo(() => {
    const degradations = data.items.filter((i) => i.damageType === "degradation");
    return {
      totalItems: data.items.length,
      degradationCount: degradations.length,
      totalRepairCost: degradations.reduce((sum, i) => sum + (i.repairCost || 0), 0),
      totalTenantAmount: degradations.reduce((sum, i) => sum + i.amountDue, 0),
      avgWear: data.items.length > 0
        ? Math.round(data.items.reduce((sum, i) => sum + i.wearPercentage, 0) / data.items.length)
        : 0,
    };
  }, [data.items]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            Grille de Vétusté
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium">Décret du 30 mars 2016</p>
                  <p className="text-xs mt-1">
                    La grille de vétusté permet de distinguer l'usure normale des dégradations
                    imputables au locataire, pour un calcul équitable des retenues sur dépôt.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </h2>
          <p className="text-sm text-muted-foreground">
            Durée du bail : {leaseYears} an{leaseYears > 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select
            value={selectedCategory}
            onValueChange={(v) => setSelectedCategory(v as WearCategory | "all")}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrer par catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {Object.entries(WEAR_CATEGORIES).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Éléments inspectés</CardDescription>
            <CardTitle className="text-2xl">{stats.totalItems}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Dégradations</CardDescription>
            <CardTitle className="text-2xl text-red-600">{stats.degradationCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Coût total réparations</CardDescription>
            <CardTitle className="text-2xl">{stats.totalRepairCost} €</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader className="pb-2">
            <CardDescription>À la charge du locataire</CardDescription>
            <CardTitle className="text-2xl text-red-600">{stats.totalTenantAmount} €</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail des éléments</CardTitle>
          <CardDescription>
            Évaluez chaque élément selon son état et son usure normale
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredItems.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Élément</TableHead>
                    <TableHead className="text-center">Durée vie</TableHead>
                    <TableHead className="text-center">Âge actuel</TableHead>
                    <TableHead>Vétusté</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Coût répar.</TableHead>
                    <TableHead className="text-center">Part locataire</TableHead>
                    <TableHead className="text-right">Montant dû</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <WearItemRow
                      key={item.id}
                      item={item}
                      onUpdate={onUpdateItem}
                      onDelete={() => onDeleteItem(item.id)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Grid3X3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Aucun élément ajouté</p>
              <p className="text-sm">Utilisez le formulaire ci-dessous pour ajouter des éléments</p>
            </div>
          )}

          <div className="mt-4">
            <AddItemForm onAdd={onAddItem} leaseYears={leaseYears} />
          </div>
        </CardContent>
      </Card>

      {/* Explications */}
      <Card className="bg-blue-50/50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Comment est calculé le montant dû ?
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            <strong>1. Vétusté</strong> = (Âge actuel / Durée de vie) × 100%
          </p>
          <p>
            <strong>2. Part locataire</strong> = 100% - Vétusté (uniquement si dégradation)
          </p>
          <p>
            <strong>3. Montant dû</strong> = Coût réparation × Part locataire
          </p>
          <div className="mt-3 p-3 bg-white rounded border">
            <p className="font-medium">Exemple :</p>
            <p className="text-muted-foreground">
              Peinture de 5 ans (durée de vie 7 ans) = vétusté de 71%.
              <br />
              Si dégradation avec coût de 500€, le locataire paie 29% soit 145€.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between items-center pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 inline mr-1 text-amber-500" />
          Vérifiez que tous les éléments dégradés sont correctement évalués
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            Exporter PDF
          </Button>
          <Button onClick={onCalculate} className="gap-2">
            <Check className="h-4 w-4" />
            Valider la grille
          </Button>
        </div>
      </div>
    </div>
  );
}

export default WearGrid;
