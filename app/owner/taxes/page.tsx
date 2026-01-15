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

interface PropertyTaxData {
  id: string;
  name: string;
  address: string;
  type: string;
  regime: "micro_foncier" | "reel";
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
}

interface TaxSummary {
  total_gross_income: number;
  total_charges: number;
  taxable_income_micro: number;
  taxable_income_reel: number;
  recommended_regime: "micro_foncier" | "reel";
  savings: number;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3];
const MICRO_FONCIER_ABATEMENT = 0.30; // 30% d'abattement
const MICRO_FONCIER_LIMIT = 15000; // Plafond micro-foncier

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

      // Récupérer les propriétés
      const { data: propertiesData } = await supabase
        .from("properties")
        .select(`
          id,
          adresse_complete,
          ville,
          code_postal,
          type,
          leases (
            loyer,
            charges_forfaitaires,
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
          prop.leases?.forEach((lease: any) => {
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

          return {
            id: prop.id,
            name: `${prop.adresse_complete}`,
            address: `${prop.code_postal} ${prop.ville}`,
            type: prop.type,
            regime: rental_income > MICRO_FONCIER_LIMIT ? "reel" : "micro_foncier",
            rental_income,
            other_income: 0,
            interest_charges: 0,
            insurance: 0,
            management_fees: 0,
            works: 0,
            property_tax: total_charges * 0.3, // Estimation
            other_charges: total_charges * 0.7,
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
    const total_gross_income = properties.reduce((sum, p) => sum + p.rental_income + p.other_income, 0);
    const total_charges = properties.reduce((sum, p) => 
      sum + p.interest_charges + p.insurance + p.management_fees + p.works + p.property_tax + p.other_charges, 0
    );

    const taxable_income_micro = total_gross_income * (1 - MICRO_FONCIER_ABATEMENT);
    const taxable_income_reel = Math.max(0, total_gross_income - total_charges);

    const recommended_regime = taxable_income_reel < taxable_income_micro ? "reel" : "micro_foncier";
    const savings = Math.abs(taxable_income_micro - taxable_income_reel);

    return {
      total_gross_income,
      total_charges,
      taxable_income_micro,
      taxable_income_reel,
      recommended_regime,
      savings,
    };
  };

  const handleUpdateProperty = (updatedProperty: PropertyTaxData) => {
    setProperties(properties.map(p => 
      p.id === updatedProperty.id ? updatedProperty : p
    ));
    setDialogOpen(false);
    setEditingProperty(null);
    toast({
      title: "Données mises à jour",
      description: "Les informations fiscales ont été enregistrées",
    });
  };

  const handleExportPDF = () => {
    toast({
      title: "Export en cours",
      description: "Le récapitulatif fiscal va être téléchargé",
    });
    // Ici, implémenter la génération PDF
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
                            {property.regime === "micro_foncier" ? "Micro-foncier" : "Réel"}
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
                      regime: v as "micro_foncier" | "reel"
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="micro_foncier">Micro-foncier (30% d'abattement)</SelectItem>
                      <SelectItem value="reel">Régime réel (charges réelles)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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

