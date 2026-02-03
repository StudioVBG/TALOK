"use client";

/**
 * Composant de calcul de vétusté
 *
 * Permet de calculer la répartition des coûts de réparation
 * entre propriétaire et locataire selon la grille de vétusté.
 */

import { useState, useMemo, useCallback } from "react";
import {
  VETUSTY_GRID,
  VetustyGridItem,
  VetustyCategory,
  VetustyCalculationInput,
  getVetustyCategories,
  getVetustyItemsByCategory,
  VETUSTY_CATEGORY_LABELS,
  VETUSTY_CATEGORY_ICONS,
} from "@/lib/constants/vetusty-grid";
import {
  calculateVetusty,
  calculateBatchVetusty,
  generateVetustyReport,
  VetustyCalculationResult,
  VetustyReport,
  VetustySummary,
  formatCurrency,
  formatPercentage,
  suggestVetustyItemsForRoom,
} from "@/lib/services/vetusty-calculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle,
  Calculator,
  ChevronRight,
  Euro,
  HelpCircle,
  Info,
  Minus,
  Plus,
  Trash2,
  FileText,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface VetustyCalculatorProps {
  leaseStartDate: string;
  leaseEndDate: string;
  edlEntryDate?: string;
  edlExitDate?: string;
  onReportGenerated?: (report: VetustyReport) => void;
  initialItems?: VetustyCalculationInput[];
  readOnly?: boolean;
}

interface VetustyItemRow {
  id: string;
  vetusty_item: VetustyGridItem;
  age_years: number;
  repair_cost: number;
  notes?: string;
}

// ============================================
// COMPOSANTS
// ============================================

/**
 * Badge de taux de vétusté avec couleur
 */
function VetustyRateBadge({ rate }: { rate: number }) {
  const getColor = () => {
    if (rate === 0) return "bg-green-100 text-green-800 border-green-200";
    if (rate < 30) return "bg-blue-100 text-blue-800 border-blue-200";
    if (rate < 50) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (rate < 70) return "bg-orange-100 text-orange-800 border-orange-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  return (
    <Badge variant="outline" className={cn("font-mono", getColor())}>
      {formatPercentage(rate)}
    </Badge>
  );
}

/**
 * Affichage d'un montant avec indicateur
 */
function AmountDisplay({
  amount,
  label,
  variant = "default",
}: {
  amount: number;
  label: string;
  variant?: "default" | "owner" | "tenant";
}) {
  const colors = {
    default: "text-gray-900",
    owner: "text-blue-600",
    tenant: "text-orange-600",
  };

  return (
    <div className="text-center">
      <div className={cn("text-lg font-semibold", colors[variant])}>
        {formatCurrency(amount)}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/**
 * Sélecteur d'élément de vétusté
 */
function VetustyItemSelector({
  selectedItem,
  onSelect,
  suggestedItems,
}: {
  selectedItem?: VetustyGridItem;
  onSelect: (item: VetustyGridItem) => void;
  suggestedItems?: VetustyGridItem[];
}) {
  const [selectedCategory, setSelectedCategory] = useState<VetustyCategory | "all">("all");
  const categories = getVetustyCategories();

  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") {
      return VETUSTY_GRID;
    }
    return getVetustyItemsByCategory(selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="space-y-3">
      {/* Suggestions si disponibles */}
      {suggestedItems && suggestedItems.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Suggestions</Label>
          <div className="flex flex-wrap gap-1">
            {suggestedItems.slice(0, 6).map((item) => (
              <Badge
                key={item.id}
                variant="outline"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={() => onSelect(item)}
              >
                {item.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Filtre par catégorie */}
      <div className="space-y-2">
        <Label>Catégorie</Label>
        <Select
          value={selectedCategory}
          onValueChange={(v) => setSelectedCategory(v as VetustyCategory | "all")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Toutes les catégories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.category} value={cat.category}>
                {cat.icon} {cat.label} ({cat.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Liste des éléments */}
      <div className="space-y-2">
        <Label>Élément</Label>
        <Select
          value={selectedItem?.id || ""}
          onValueChange={(id) => {
            const item = VETUSTY_GRID.find((i) => i.id === id);
            if (item) onSelect(item);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner un élément" />
          </SelectTrigger>
          <SelectContent>
            <ScrollArea className="h-[200px]">
              {filteredItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  <div className="flex items-center gap-2">
                    <span>{item.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({item.lifespan_years} ans)
                    </span>
                  </div>
                </SelectItem>
              ))}
            </ScrollArea>
          </SelectContent>
        </Select>
      </div>

      {/* Détails de l'élément sélectionné */}
      {selectedItem && (
        <div className="rounded-lg border bg-muted/50 p-3 text-sm">
          <div className="font-medium">{selectedItem.name}</div>
          <div className="text-muted-foreground text-xs mt-1">
            {selectedItem.description}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
            <div>
              <span className="text-muted-foreground">Durée de vie:</span>{" "}
              <span className="font-medium">{selectedItem.lifespan_years} ans</span>
            </div>
            <div>
              <span className="text-muted-foreground">Franchise:</span>{" "}
              <span className="font-medium">{selectedItem.franchise_years} ans</span>
            </div>
            <div>
              <span className="text-muted-foreground">Taux annuel:</span>{" "}
              <span className="font-medium">{selectedItem.annual_rate}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">Vétusté max:</span>{" "}
              <span className="font-medium">{selectedItem.max_vetusty_rate}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Ligne de résultat de calcul
 */
function CalculationResultRow({
  result,
  onRemove,
  readOnly,
}: {
  result: VetustyCalculationResult;
  onRemove?: () => void;
  readOnly?: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <>
      <TableRow>
        <TableCell>
          <div>
            <div className="font-medium">{result.item_name}</div>
            <div className="text-xs text-muted-foreground">
              {VETUSTY_CATEGORY_ICONS[result.category]}{" "}
              {VETUSTY_CATEGORY_LABELS[result.category]}
            </div>
          </div>
        </TableCell>
        <TableCell className="text-center">
          {result.age_years} / {result.lifespan_years} ans
        </TableCell>
        <TableCell className="text-center">
          <VetustyRateBadge rate={result.vetusty_rate} />
        </TableCell>
        <TableCell className="text-right font-mono">
          {formatCurrency(result.repair_cost)}
        </TableCell>
        <TableCell className="text-right font-mono text-blue-600">
          {formatCurrency(result.owner_share)}
        </TableCell>
        <TableCell className="text-right font-mono text-orange-600">
          {formatCurrency(result.tenant_share)}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowDetails(!showDetails)}
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <pre className="text-xs whitespace-pre-wrap">
                    {result.calculation_details}
                  </pre>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {!readOnly && onRemove && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={onRemove}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    </>
  );
}

/**
 * Résumé des calculs
 */
function CalculationSummary({ summary }: { summary: VetustySummary }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Résumé des calculs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-gray-50">
            <div className="text-2xl font-bold">{summary.total_items}</div>
            <div className="text-xs text-muted-foreground">Éléments</div>
          </div>

          <div className="text-center p-3 rounded-lg bg-gray-50">
            <div className="text-2xl font-bold">
              {formatCurrency(summary.total_repair_cost)}
            </div>
            <div className="text-xs text-muted-foreground">Coût total</div>
          </div>

          <div className="text-center p-3 rounded-lg bg-blue-50">
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(summary.total_owner_share)}
            </div>
            <div className="text-xs text-muted-foreground">Part propriétaire</div>
            <div className="text-xs text-blue-600">
              ({formatPercentage((summary.total_owner_share / summary.total_repair_cost) * 100 || 0)})
            </div>
          </div>

          <div className="text-center p-3 rounded-lg bg-orange-50">
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(summary.total_tenant_share)}
            </div>
            <div className="text-xs text-muted-foreground">Part locataire</div>
            <div className="text-xs text-orange-600">
              ({formatPercentage((summary.total_tenant_share / summary.total_repair_cost) * 100 || 0)})
            </div>
          </div>
        </div>

        {/* Barre de répartition visuelle */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Propriétaire (vétusté)</span>
            <span>Locataire (dégradations)</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden flex bg-gray-200">
            <div
              className="bg-blue-500 transition-all"
              style={{
                width: `${(summary.total_owner_share / summary.total_repair_cost) * 100 || 0}%`,
              }}
            />
            <div
              className="bg-orange-500 transition-all"
              style={{
                width: `${(summary.total_tenant_share / summary.total_repair_cost) * 100 || 0}%`,
              }}
            />
          </div>
        </div>

        {/* Détail par catégorie */}
        {Object.keys(summary.items_by_category).length > 0 && (
          <Accordion type="single" collapsible className="mt-4">
            <AccordionItem value="categories">
              <AccordionTrigger className="text-sm">
                Détail par catégorie
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {Object.values(summary.items_by_category).map((cat) => (
                    <div
                      key={cat.category}
                      className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                    >
                      <span>
                        {VETUSTY_CATEGORY_ICONS[cat.category]} {cat.label}
                        <span className="text-muted-foreground ml-1">
                          ({cat.item_count})
                        </span>
                      </span>
                      <div className="flex gap-4 text-xs">
                        <span className="text-blue-600">
                          {formatCurrency(cat.owner_share)}
                        </span>
                        <span className="text-orange-600">
                          {formatCurrency(cat.tenant_share)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export function VetustyCalculator({
  leaseStartDate,
  leaseEndDate,
  edlEntryDate,
  edlExitDate,
  onReportGenerated,
  initialItems = [],
  readOnly = false,
}: VetustyCalculatorProps) {
  // État pour les items à calculer
  const [items, setItems] = useState<VetustyItemRow[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // État pour le formulaire d'ajout
  const [selectedItem, setSelectedItem] = useState<VetustyGridItem | undefined>();
  const [ageYears, setAgeYears] = useState<number>(0);
  const [repairCost, setRepairCost] = useState<number>(0);

  // Calcul de la durée du bail
  const leaseDurationYears = useMemo(() => {
    const start = new Date(leaseStartDate);
    const end = new Date(leaseEndDate);
    return Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25)) * 10) / 10;
  }, [leaseStartDate, leaseEndDate]);

  // Calculs de vétusté
  const calculations = useMemo<VetustyCalculationResult[]>(() => {
    if (items.length === 0) return [];

    const inputs: VetustyCalculationInput[] = items.map((item) => ({
      item_id: item.vetusty_item.id,
      age_years: item.age_years,
      repair_cost: item.repair_cost,
    }));

    return calculateBatchVetusty(inputs);
  }, [items]);

  // Résumé
  const summary = useMemo<VetustySummary | null>(() => {
    if (calculations.length === 0) return null;

    const total_repair_cost = calculations.reduce((sum, c) => sum + c.repair_cost, 0);
    const total_owner_share = calculations.reduce((sum, c) => sum + c.owner_share, 0);
    const total_tenant_share = calculations.reduce((sum, c) => sum + c.tenant_share, 0);

    const items_by_category: Record<VetustyCategory, any> = {} as any;
    calculations.forEach((calc) => {
      if (!items_by_category[calc.category]) {
        items_by_category[calc.category] = {
          category: calc.category,
          label: VETUSTY_CATEGORY_LABELS[calc.category],
          item_count: 0,
          repair_cost: 0,
          owner_share: 0,
          tenant_share: 0,
        };
      }
      items_by_category[calc.category].item_count++;
      items_by_category[calc.category].repair_cost += calc.repair_cost;
      items_by_category[calc.category].owner_share += calc.owner_share;
      items_by_category[calc.category].tenant_share += calc.tenant_share;
    });

    return {
      total_items: calculations.length,
      total_repair_cost,
      total_owner_share,
      total_tenant_share,
      average_vetusty_rate: total_repair_cost > 0
        ? calculations.reduce((sum, c) => sum + c.vetusty_rate * c.repair_cost, 0) / total_repair_cost
        : 0,
      items_by_category,
    };
  }, [calculations]);

  // Ajouter un élément
  const handleAddItem = useCallback(() => {
    if (!selectedItem || repairCost <= 0) return;

    const newItem: VetustyItemRow = {
      id: `${selectedItem.id}_${Date.now()}`,
      vetusty_item: selectedItem,
      age_years: ageYears,
      repair_cost: repairCost,
    };

    setItems((prev) => [...prev, newItem]);
    setShowAddDialog(false);
    setSelectedItem(undefined);
    setAgeYears(leaseDurationYears);
    setRepairCost(0);
  }, [selectedItem, ageYears, repairCost, leaseDurationYears]);

  // Supprimer un élément
  const handleRemoveItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Générer le rapport
  const handleGenerateReport = useCallback(() => {
    if (items.length === 0) return;

    const inputs: VetustyCalculationInput[] = items.map((item) => ({
      item_id: item.vetusty_item.id,
      age_years: item.age_years,
      repair_cost: item.repair_cost,
    }));

    const report = generateVetustyReport({
      items: inputs,
      lease_start_date: leaseStartDate,
      lease_end_date: leaseEndDate,
      edl_entry_date: edlEntryDate,
      edl_exit_date: edlExitDate,
    });

    onReportGenerated?.(report);
  }, [items, leaseStartDate, leaseEndDate, edlEntryDate, edlExitDate, onReportGenerated]);

  return (
    <div className="space-y-4">
      {/* En-tête avec infos bail */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Calcul de vétusté</CardTitle>
              <CardDescription>
                Répartition des coûts de réparation selon la grille de vétusté
              </CardDescription>
            </div>
            <Badge variant="outline">
              Bail : {leaseDurationYears} ans
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Tableau des éléments */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Éléments à évaluer</CardTitle>
            {!readOnly && (
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Ajouter un élément</DialogTitle>
                    <DialogDescription>
                      Sélectionnez un élément et renseignez son âge et le coût de réparation.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <VetustyItemSelector
                      selectedItem={selectedItem}
                      onSelect={setSelectedItem}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Âge (années)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={ageYears}
                          onChange={(e) => setAgeYears(parseFloat(e.target.value) || 0)}
                          placeholder={`Ex: ${leaseDurationYears}`}
                        />
                        <p className="text-xs text-muted-foreground">
                          Durée du bail : {leaseDurationYears} ans
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Coût réparation (€)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={10}
                          value={repairCost || ""}
                          onChange={(e) => setRepairCost(parseFloat(e.target.value) || 0)}
                          placeholder="Ex: 150"
                        />
                      </div>
                    </div>

                    {/* Aperçu du calcul */}
                    {selectedItem && repairCost > 0 && (
                      <div className="rounded-lg border bg-muted/50 p-3">
                        <div className="text-sm font-medium mb-2">Aperçu du calcul</div>
                        {(() => {
                          const result = calculateVetusty({
                            item_id: selectedItem.id,
                            age_years: ageYears,
                            repair_cost: repairCost,
                          });
                          return (
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <VetustyRateBadge rate={result.vetusty_rate} />
                                <div className="text-xs text-muted-foreground mt-1">
                                  Vétusté
                                </div>
                              </div>
                              <div>
                                <div className="font-medium text-blue-600">
                                  {formatCurrency(result.owner_share)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Propriétaire
                                </div>
                              </div>
                              <div>
                                <div className="font-medium text-orange-600">
                                  {formatCurrency(result.tenant_share)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Locataire
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                      Annuler
                    </Button>
                    <Button
                      onClick={handleAddItem}
                      disabled={!selectedItem || repairCost <= 0}
                    >
                      Ajouter
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calculator className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Aucun élément à évaluer</p>
              {!readOnly && (
                <p className="text-sm">
                  Cliquez sur &quot;Ajouter&quot; pour commencer
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élément</TableHead>
                  <TableHead className="text-center">Âge / Durée vie</TableHead>
                  <TableHead className="text-center">Vétusté</TableHead>
                  <TableHead className="text-right">Coût</TableHead>
                  <TableHead className="text-right text-blue-600">Propriétaire</TableHead>
                  <TableHead className="text-right text-orange-600">Locataire</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculations.map((calc, index) => (
                  <CalculationResultRow
                    key={items[index].id}
                    result={calc}
                    onRemove={() => handleRemoveItem(items[index].id)}
                    readOnly={readOnly}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Résumé */}
      {summary && <CalculationSummary summary={summary} />}

      {/* Actions */}
      {!readOnly && items.length > 0 && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setItems([])}>
            <Trash2 className="h-4 w-4 mr-1" />
            Tout effacer
          </Button>
          <Button onClick={handleGenerateReport}>
            <FileText className="h-4 w-4 mr-1" />
            Générer le rapport
          </Button>
        </div>
      )}

      {/* Info légale */}
      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-foreground">
              Grille de vétusté - Accords collectifs
            </p>
            <p className="mt-1">
              Ce calcul est basé sur les grilles de vétusté types (ANIL, FNAIM, UNPI).
              La vétusté correspond à l&apos;usure normale du bien dans le temps,
              à la charge du propriétaire. Seules les dégradations anormales
              sont imputables au locataire.
            </p>
            <p className="mt-1">
              Références : Loi ALUR du 24/03/2014 (art. 7-1), Décret du 30/03/2016.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VetustyCalculator;
