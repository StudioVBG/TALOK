"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Calculator,
  Download,
  FileText,
  Euro,
  Home,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  Info,
  CheckCircle2,
  AlertCircle,
  PiggyBank,
  Receipt,
  Building2
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/helpers/format";
import { PageTransition } from "@/components/ui/page-transition";

type TaxRegime = "micro_foncier" | "reel" | "micro_bic" | "reel_bic";

interface PropertyTaxData {
  id: string;
  name: string;
  address: string;
  type: string;
  regime: TaxRegime;
  is_furnished: boolean;
  lmnp_status: "lmnp" | "lmp";
  // Revenus
  rental_income: number;
  other_income: number;
  // Charges (régime réel)
  interest_charges: number;
  insurance: number;
  management_fees: number;
  works: number;
  property_tax: number;
  other_charges: number;
  // BIC spécifique (régime réel BIC)
  depreciation_property: number; // Amortissement bien
  depreciation_furniture: number; // Amortissement mobilier
  cfe_amount: number; // CFE (LMP)
}

interface TaxSummary {
  total_gross_income: number;
  total_charges: number;
  taxable_income_micro: number;
  taxable_income_reel: number;
  recommended_regime: "micro_foncier" | "reel";
  savings: number;
  // BIC specifics
  bic_gross_income: number;
  bic_taxable_micro: number;
  bic_taxable_reel: number;
  bic_depreciation_total: number;
  bic_recommended: "micro_bic" | "reel_bic";
  bic_savings: number;
  has_furnished: boolean;
  lmp_threshold_warning: boolean;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3];
const MICRO_FONCIER_ABATEMENT = 0.30; // 30% d'abattement
const MICRO_FONCIER_LIMIT = 15000; // Plafond micro-foncier
const MICRO_BIC_ABATEMENT = 0.50; // 50% d'abattement BIC
const MICRO_BIC_LIMIT = 77700; // Plafond micro-BIC
const LMP_THRESHOLD = 23000; // Seuil revenu LMP

export default function OwnerTaxesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR - 1);
  const [properties, setProperties] = useState<PropertyTaxData[]>([]);
  const [editingProperty, setEditingProperty] = useState<PropertyTaxData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

      // Récupérer les propriétés avec données BIC
      const { data: propertiesData } = await supabase
        .from("properties")
        .select(`
          id,
          adresse_complete,
          ville,
          code_postal,
          type,
          is_furnished,
          leases (
            loyer,
            charges_forfaitaires,
            type_bail,
            tax_regime,
            lmnp_status,
            invoices (
              montant_total,
              statut,
              periode
            )
          ),
          charges (
            montant,
            type
          )
        `)
        .eq("owner_id", profile.id);

      if (propertiesData) {
        const taxData: PropertyTaxData[] = propertiesData.map((prop: any) => {
          // Calculer les revenus locatifs de l'année
          let rental_income = 0;
          let isFurnished = prop.is_furnished || false;
          let savedRegime: TaxRegime | null = null;
          let savedLmnp: "lmnp" | "lmp" = "lmnp";

          prop.leases?.forEach((lease: any) => {
            // Détecter si meublé via le type de bail
            if (["meuble", "bail_mobilite", "etudiant", "saisonnier"].includes(lease.type_bail)) {
              isFurnished = true;
            }
            if (lease.tax_regime) savedRegime = lease.tax_regime;
            if (lease.lmnp_status) savedLmnp = lease.lmnp_status;

            lease.invoices?.forEach((inv: any) => {
              if (inv.statut === 'paid' && inv.periode?.startsWith(selectedYear.toString())) {
                rental_income += inv.montant_total || 0;
              }
            });
          });

          // Calculer les charges
          let total_charges = 0;
          prop.charges?.forEach((charge: any) => {
            total_charges += charge.montant || 0;
          });

          // Déterminer le régime par défaut selon le type
          let defaultRegime: TaxRegime;
          if (isFurnished) {
            defaultRegime = rental_income > MICRO_BIC_LIMIT ? "reel_bic" : "micro_bic";
          } else {
            defaultRegime = rental_income > MICRO_FONCIER_LIMIT ? "reel" : "micro_foncier";
          }

          return {
            id: prop.id,
            name: `${prop.adresse_complete}`,
            address: `${prop.code_postal} ${prop.ville}`,
            type: prop.type,
            regime: savedRegime || defaultRegime,
            is_furnished: isFurnished,
            lmnp_status: savedLmnp,
            rental_income,
            other_income: 0,
            interest_charges: 0,
            insurance: 0,
            management_fees: 0,
            works: 0,
            property_tax: total_charges * 0.3,
            other_charges: total_charges * 0.7,
            depreciation_property: 0,
            depreciation_furniture: 0,
            cfe_amount: 0,
          };
        });

        setProperties(taxData);
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données fiscales",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (): TaxSummary => {
    // Séparer biens nus et meublés
    const nuProperties = properties.filter(p => !p.is_furnished);
    const furnishedProperties = properties.filter(p => p.is_furnished);

    // Revenus fonciers (nu)
    const total_gross_income = nuProperties.reduce((sum, p) => sum + p.rental_income + p.other_income, 0);
    const total_charges = nuProperties.reduce((sum, p) =>
      sum + p.interest_charges + p.insurance + p.management_fees + p.works + p.property_tax + p.other_charges, 0
    );
    const taxable_income_micro = total_gross_income * (1 - MICRO_FONCIER_ABATEMENT);
    const taxable_income_reel = Math.max(0, total_gross_income - total_charges);
    const recommended_regime = taxable_income_reel < taxable_income_micro ? "reel" as const : "micro_foncier" as const;
    const savings = Math.abs(taxable_income_micro - taxable_income_reel);

    // Revenus BIC (meublé)
    const bic_gross_income = furnishedProperties.reduce((sum, p) => sum + p.rental_income + p.other_income, 0);
    const bic_charges = furnishedProperties.reduce((sum, p) =>
      sum + p.interest_charges + p.insurance + p.management_fees + p.works + p.property_tax + p.other_charges, 0
    );
    const bic_depreciation_total = furnishedProperties.reduce((sum, p) =>
      sum + p.depreciation_property + p.depreciation_furniture, 0
    );
    const bic_taxable_micro = bic_gross_income * (1 - MICRO_BIC_ABATEMENT);
    const bic_taxable_reel = Math.max(0, bic_gross_income - bic_charges - bic_depreciation_total);
    const bic_recommended = bic_taxable_reel < bic_taxable_micro ? "reel_bic" as const : "micro_bic" as const;
    const bic_savings = Math.abs(bic_taxable_micro - bic_taxable_reel);
    const has_furnished = furnishedProperties.length > 0;
    const lmp_threshold_warning = bic_gross_income >= LMP_THRESHOLD;

    return {
      total_gross_income,
      total_charges,
      taxable_income_micro,
      taxable_income_reel,
      recommended_regime,
      savings,
      bic_gross_income,
      bic_taxable_micro,
      bic_taxable_reel,
      bic_depreciation_total,
      bic_recommended,
      bic_savings,
      has_furnished,
      lmp_threshold_warning,
    };
  };

  const handleUpdateProperty = async (updatedProperty: PropertyTaxData) => {
    // Mettre à jour l'état local immédiatement pour l'UX
    setProperties(properties.map(p => 
      p.id === updatedProperty.id ? updatedProperty : p
    ));
    setDialogOpen(false);
    setEditingProperty(null);

    try {
      // Sauvegarder le régime fiscal sur le bail actif en base de données
      const { data: leases } = await supabase
        .from("leases")
        .select("id")
        .eq("property_id", updatedProperty.id)
        .eq("statut", "active")
        .limit(1);

      if (leases && leases.length > 0) {
        await supabase
          .from("leases")
          .update({
            tax_regime: updatedProperty.regime,
            lmnp_status: updatedProperty.is_furnished ? updatedProperty.lmnp_status : null,
          })
          .eq("id", leases[0].id);
      }

      toast({
        title: "Données mises à jour",
        description: "Les informations fiscales ont été enregistrées en base de données.",
      });
    } catch (error) {
      console.error("Erreur sauvegarde fiscale:", error);
      toast({
        title: "Erreur",
        description: "Les données ont été mises à jour localement mais la sauvegarde en base a échoué.",
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = async () => {
    toast({
      title: "Export en cours",
      description: "Génération du récapitulatif fiscal...",
    });
    try {
      const response = await fetch("/api/exports/tax-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: selectedYear,
          properties: properties.map(p => ({
            name: p.name,
            address: p.address,
            regime: p.regime,
            rental_income: p.rental_income,
            total_charges: p.interest_charges + p.insurance + p.management_fees + p.works + p.property_tax + p.other_charges,
          })),
          summary,
        }),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recapitulatif-fiscal-${selectedYear}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Export terminé", description: "Le fichier a été téléchargé." });
      } else {
        toast({ title: "Export non disponible", description: "La génération PDF sera disponible prochainement.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Export non disponible", description: "La génération PDF sera disponible prochainement.", variant: "destructive" });
    }
  };

  const summary = calculateSummary();

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <PageTransition>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-6 space-y-6 max-w-7xl mx-auto"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Calculator className="h-6 w-6" />
              Déclaration fiscale
            </h1>
            <p className="text-muted-foreground">
              Simulez et préparez votre déclaration de revenus fonciers
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Select 
              value={selectedYear.toString()} 
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Année" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    Revenus {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleExportPDF}>
              <Download className="h-4 w-4 mr-2" />
              Exporter PDF
            </Button>
          </div>
        </div>

        {/* Info banner */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-4">
              <Info className="h-6 w-6 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900">
                  Choix du régime fiscal
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  <strong>Micro-foncier</strong> : Abattement forfaitaire de 30% sur les revenus bruts 
                  (si revenus &lt; 15 000€/an). <br />
                  <strong>Régime réel</strong> : Déduction des charges réelles (intérêts, travaux, assurances...).
                  Plus avantageux si vos charges dépassent 30% de vos revenus.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Revenus bruts</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.total_gross_income)}</p>
                </div>
                <Euro className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total charges</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.total_charges)}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className={summary.recommended_regime === "micro_foncier" ? "border-primary" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Micro-foncier</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.taxable_income_micro)}</p>
                  <p className="text-xs text-muted-foreground">imposable</p>
                </div>
                {summary.recommended_regime === "micro_foncier" && (
                  <Badge className="bg-green-100 text-green-700">Recommandé</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className={summary.recommended_regime === "reel" ? "border-primary" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Régime réel</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.taxable_income_reel)}</p>
                  <p className="text-xs text-muted-foreground">imposable</p>
                </div>
                {summary.recommended_regime === "reel" && (
                  <Badge className="bg-green-100 text-green-700">Recommandé</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ✅ BIC Section — Revenus meublés */}
        {summary.has_furnished && (
          <>
            <Card className="border-cyan-200 bg-cyan-50">
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <Info className="h-6 w-6 text-cyan-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-cyan-900">
                      Revenus BIC (Location meublée)
                    </h3>
                    <p className="text-sm text-cyan-700 mt-1">
                      <strong>Micro-BIC</strong> : Abattement forfaitaire de 50% sur les recettes
                      (si recettes &lt; {MICRO_BIC_LIMIT.toLocaleString("fr-FR")} €/an). <br />
                      <strong>Régime réel BIC</strong> : Déduction des charges réelles + amortissement du bien et du mobilier.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Recettes meublées</p>
                      <p className="text-2xl font-bold">{formatCurrency(summary.bic_gross_income)}</p>
                    </div>
                    <Euro className="h-8 w-8 text-cyan-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Amortissements</p>
                      <p className="text-2xl font-bold text-purple-600">{formatCurrency(summary.bic_depreciation_total)}</p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className={summary.bic_recommended === "micro_bic" ? "border-primary" : ""}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Micro-BIC (50%)</p>
                      <p className="text-2xl font-bold">{formatCurrency(summary.bic_taxable_micro)}</p>
                      <p className="text-xs text-muted-foreground">imposable</p>
                    </div>
                    {summary.bic_recommended === "micro_bic" && (
                      <Badge className="bg-green-100 text-green-700">Recommandé</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className={summary.bic_recommended === "reel_bic" ? "border-primary" : ""}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Réel BIC</p>
                      <p className="text-2xl font-bold">{formatCurrency(summary.bic_taxable_reel)}</p>
                      <p className="text-xs text-muted-foreground">imposable</p>
                    </div>
                    {summary.bic_recommended === "reel_bic" && (
                      <Badge className="bg-green-100 text-green-700">Recommandé</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* LMP Threshold Warning */}
            {summary.lmp_threshold_warning && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <AlertCircle className="h-10 w-10 text-amber-600" />
                    <div>
                      <h3 className="font-semibold text-amber-900">
                        Seuil LMP atteint
                      </h3>
                      <p className="text-sm text-amber-700">
                        Vos recettes meublées (<strong>{formatCurrency(summary.bic_gross_income)}</strong>)
                        dépassent le seuil de <strong>{LMP_THRESHOLD.toLocaleString("fr-FR")} €</strong>.
                        Si elles représentent plus de 50% de vos revenus professionnels,
                        vous êtes considéré <strong>Loueur Meublé Professionnel (LMP)</strong>.
                        Cela implique des cotisations sociales SSI et la CFE.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* BIC Savings */}
            {summary.bic_savings > 0 && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <PiggyBank className="h-10 w-10 text-green-600" />
                    <div>
                      <h3 className="font-semibold text-green-900">
                        Économie BIC avec le régime {summary.bic_recommended === "reel_bic" ? "réel" : "micro-BIC"}
                      </h3>
                      <p className="text-sm text-green-700">
                        En optant pour le régime {summary.bic_recommended === "reel_bic" ? "réel BIC (avec amortissements)" : "micro-BIC"},
                        vous pourriez réduire votre base imposable de <strong>{formatCurrency(summary.bic_savings)}</strong>.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Recommendation */}
        {summary.savings > 0 && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <PiggyBank className="h-10 w-10 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-900">
                    Économie potentielle avec le régime {summary.recommended_regime === "reel" ? "réel" : "micro-foncier"}
                  </h3>
                  <p className="text-sm text-green-700">
                    En optant pour le régime {summary.recommended_regime === "reel" ? "réel" : "micro-foncier"}, 
                    vous pourriez réduire votre base imposable de <strong>{formatCurrency(summary.savings)}</strong>.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Properties detail */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Détail par bien ({properties.length})
            </CardTitle>
            <CardDescription>
              Cliquez sur un bien pour modifier les données fiscales
            </CardDescription>
          </CardHeader>
          <CardContent>
            {properties.length === 0 ? (
              <div className="text-center py-12">
                <Home className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">Aucun bien enregistré</p>
              </div>
            ) : (
              <>
              {/* Mobile card view */}
              <div className="md:hidden space-y-3">
                {properties.map((property) => {
                  const totalIncome = property.rental_income + property.other_income;
                  const totalCharges = property.interest_charges + property.insurance +
                    property.management_fees + property.works + property.property_tax + property.other_charges;
                  const result = totalIncome - totalCharges;
                  return (
                    <div key={property.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{property.name}</p>
                          <p className="text-sm text-muted-foreground">{property.address}</p>
                        </div>
                        <Badge variant="outline">
                          {property.regime === "micro_foncier" ? "Micro-foncier" 
                            : property.regime === "micro_bic" ? "Micro-BIC"
                            : property.regime === "reel_bic" ? "Réel BIC"
                            : "Réel"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div><p className="text-muted-foreground">Revenus</p><p className="font-medium text-green-600">{formatCurrency(totalIncome)}</p></div>
                        <div><p className="text-muted-foreground">Charges</p><p className="font-medium text-red-600">{formatCurrency(totalCharges)}</p></div>
                        <div><p className="text-muted-foreground">Résultat</p><p className={`font-bold ${result >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(result)}</p></div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full" onClick={() => { setEditingProperty(property); setDialogOpen(true); }}>Modifier</Button>
                    </div>
                  );
                })}
              </div>
              {/* Desktop table view */}
              <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bien</TableHead>
                    <TableHead className="text-right">Revenus</TableHead>
                    <TableHead className="text-right">Charges</TableHead>
                    <TableHead className="text-right">Résultat</TableHead>
                    <TableHead>Régime</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {properties.map((property) => {
                    const totalIncome = property.rental_income + property.other_income;
                    const totalCharges = property.interest_charges + property.insurance +
                      property.management_fees + property.works + property.property_tax + property.other_charges;
                    const result = totalIncome - totalCharges;

                    return (
                      <TableRow key={property.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{property.name}</p>
                            <p className="text-sm text-muted-foreground">{property.address}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-medium">
                          {formatCurrency(totalIncome)}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {formatCurrency(totalCharges)}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${result >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(result)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {property.regime === "micro_foncier" ? "Micro-foncier" 
                              : property.regime === "micro_bic" ? "Micro-BIC"
                              : property.regime === "reel_bic" ? "Réel BIC"
                              : "Réel"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingProperty(property);
                              setDialogOpen(true);
                            }}
                          >
                            Modifier
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Formulaires fiscaux */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Formulaires à remplir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">Formulaire 2044</h4>
                    <p className="text-sm text-muted-foreground">Déclaration des revenus fonciers (régime réel)</p>
                  </div>
                </div>
                {summary.recommended_regime === "reel" && (
                  <Badge className="mt-2">À remplir</Badge>
                )}
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Receipt className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">Déclaration 2042</h4>
                    <p className="text-sm text-muted-foreground">Case 4BE (micro-foncier) ou report du 2044</p>
                  </div>
                </div>
                <Badge className="mt-2">À remplir</Badge>
              </div>

              {/* Formulaires BIC */}
              {summary.has_furnished && (
                <>
                  <div className="p-4 border rounded-lg border-cyan-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-cyan-100 rounded-lg">
                        <FileText className="h-5 w-5 text-cyan-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">Formulaire 2031 / 2033</h4>
                        <p className="text-sm text-muted-foreground">Liasse fiscale BIC (régime réel meublé)</p>
                      </div>
                    </div>
                    {summary.bic_recommended === "reel_bic" && (
                      <Badge className="mt-2 bg-cyan-100 text-cyan-700 border-cyan-200">À remplir</Badge>
                    )}
                  </div>

                  <div className="p-4 border rounded-lg border-cyan-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-cyan-100 rounded-lg">
                        <Receipt className="h-5 w-5 text-cyan-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">Déclaration 2042-C-PRO</h4>
                        <p className="text-sm text-muted-foreground">
                          {summary.bic_recommended === "micro_bic"
                            ? "Case 5ND (micro-BIC meublé)"
                            : "Report du résultat BIC réel"}
                        </p>
                      </div>
                    </div>
                    <Badge className="mt-2 bg-cyan-100 text-cyan-700 border-cyan-200">À remplir</Badge>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Modifier les données fiscales</DialogTitle>
              <DialogDescription>
                {editingProperty?.name}
              </DialogDescription>
            </DialogHeader>
            
            {editingProperty && (
              <div className="space-y-6 py-4">
                <Tabs defaultValue="income">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="income">Revenus</TabsTrigger>
                    <TabsTrigger value="charges">Charges</TabsTrigger>
                  </TabsList>

                  <TabsContent value="income" className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Loyers perçus</Label>
                        <Input
                          type="number"
                          value={editingProperty.rental_income}
                          onChange={(e) => setEditingProperty({
                            ...editingProperty,
                            rental_income: parseFloat(e.target.value) || 0
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Autres revenus</Label>
                        <Input
                          type="number"
                          value={editingProperty.other_income}
                          onChange={(e) => setEditingProperty({
                            ...editingProperty,
                            other_income: parseFloat(e.target.value) || 0
                          })}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="charges" className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Intérêts d'emprunt</Label>
                        <Input
                          type="number"
                          value={editingProperty.interest_charges}
                          onChange={(e) => setEditingProperty({
                            ...editingProperty,
                            interest_charges: parseFloat(e.target.value) || 0
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Assurance PNO</Label>
                        <Input
                          type="number"
                          value={editingProperty.insurance}
                          onChange={(e) => setEditingProperty({
                            ...editingProperty,
                            insurance: parseFloat(e.target.value) || 0
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Frais de gestion</Label>
                        <Input
                          type="number"
                          value={editingProperty.management_fees}
                          onChange={(e) => setEditingProperty({
                            ...editingProperty,
                            management_fees: parseFloat(e.target.value) || 0
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Travaux déductibles</Label>
                        <Input
                          type="number"
                          value={editingProperty.works}
                          onChange={(e) => setEditingProperty({
                            ...editingProperty,
                            works: parseFloat(e.target.value) || 0
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Taxe foncière</Label>
                        <Input
                          type="number"
                          value={editingProperty.property_tax}
                          onChange={(e) => setEditingProperty({
                            ...editingProperty,
                            property_tax: parseFloat(e.target.value) || 0
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Autres charges</Label>
                        <Input
                          type="number"
                          value={editingProperty.other_charges}
                          onChange={(e) => setEditingProperty({
                            ...editingProperty,
                            other_charges: parseFloat(e.target.value) || 0
                          })}
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="space-y-2">
                  <Label>Régime fiscal</Label>
                  <Select
                    value={editingProperty.regime}
                    onValueChange={(v) => setEditingProperty({
                      ...editingProperty,
                      regime: v as TaxRegime
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {editingProperty.is_furnished ? (
                        <>
                          <SelectItem value="micro_bic">Micro-BIC (50% d'abattement)</SelectItem>
                          <SelectItem value="reel_bic">Régime réel BIC (charges + amortissement)</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="micro_foncier">Micro-foncier (30% d'abattement)</SelectItem>
                          <SelectItem value="reel">Régime réel (charges réelles)</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  {editingProperty.is_furnished && (
                    <p className="text-xs text-cyan-600 mt-1">
                      Bien meublé — régime BIC (Bénéfices Industriels et Commerciaux)
                    </p>
                  )}
                </div>

                {/* BIC: Amortissements (régime réel uniquement) */}
                {editingProperty.is_furnished && editingProperty.regime === "reel_bic" && (
                  <div className="space-y-4 p-4 rounded-lg bg-purple-50 border border-purple-200">
                    <h5 className="text-sm font-medium text-purple-800">Amortissements (régime réel BIC)</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Amortissement du bien (€/an)</Label>
                        <Input
                          type="number"
                          value={editingProperty.depreciation_property}
                          onChange={(e) => setEditingProperty({
                            ...editingProperty,
                            depreciation_property: parseFloat(e.target.value) || 0
                          })}
                          placeholder="Ex: 3500"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Durée: 20-30 ans (hors terrain ~15%)
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Amortissement mobilier (€/an)</Label>
                        <Input
                          type="number"
                          value={editingProperty.depreciation_furniture}
                          onChange={(e) => setEditingProperty({
                            ...editingProperty,
                            depreciation_furniture: parseFloat(e.target.value) || 0
                          })}
                          placeholder="Ex: 800"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Durée: 5-10 ans selon le mobilier
                        </p>
                      </div>
                    </div>
                    {editingProperty.lmnp_status === "lmp" && (
                      <div className="space-y-2">
                        <Label className="text-xs">CFE — Cotisation Foncière des Entreprises (€/an)</Label>
                        <Input
                          type="number"
                          value={editingProperty.cfe_amount}
                          onChange={(e) => setEditingProperty({
                            ...editingProperty,
                            cfe_amount: parseFloat(e.target.value) || 0
                          })}
                          placeholder="Ex: 200"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={() => editingProperty && handleUpdateProperty(editingProperty)}>
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </PageTransition>
  );
}

