// =====================================================
// Page: Charges récupérables (Bridge Bailleur)
// =====================================================

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
import { useAuth } from "@/lib/hooks/use-auth";
import {
  Building2, Euro, TrendingUp, TrendingDown,
  FileText, Calculator, ChevronRight, Download,
  Info, CheckCircle2, AlertCircle
} from "lucide-react";
import Link from "next/link";
import { SERVICE_TYPE_LABELS, DEFAULT_RECUPERABLE_SERVICES } from "@/lib/types/copro-charges";
import type { ServiceType } from "@/lib/types/copro-charges";

interface ChargeDetail {
  id: string;
  service_type: ServiceType;
  label: string;
  period: string;
  copro_amount: number;
  recuperable_ratio: number;
  prorata_ratio: number;
  recuperable_amount: number;
  status: string;
}

interface UnitCharges {
  unit_id: string;
  lot_number: string;
  site_name: string;
  fiscal_years: number[];
  current_year_summary: {
    total_copro: number;
    total_recuperable: number;
    by_service: Array<{
      service_type: ServiceType;
      label: string;
      copro_amount: number;
      recuperable_amount: number;
    }>;
  };
}

export default function BailleurChargesPage() {
  const { user } = useAuth();
  const [units, setUnits] = useState<UnitCharges[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [charges, setCharges] = useState<ChargeDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Récupérer les lots du propriétaire via l'API copro/units
        const unitsRes = await fetch("/api/copro/units?role=owner", { credentials: "include" });
        
        if (unitsRes.ok) {
          const unitsData = await unitsRes.json();
          
          if (unitsData && unitsData.length > 0) {
            // Transformer les données de l'API en format attendu par le composant
            const formattedUnits: UnitCharges[] = unitsData.map((unit: any) => ({
              unit_id: unit.id,
              lot_number: unit.lot_number || unit.numero_lot || "N/A",
              site_name: unit.site?.name || unit.copro_sites?.name || "Copropriété",
              fiscal_years: [2024, 2025], // Par défaut
              current_year_summary: {
                total_copro: unit.charges_total || 0,
                total_recuperable: unit.charges_recuperables || 0,
                by_service: unit.charges_by_service || [],
              },
            }));
            
            setUnits(formattedUnits);
            
            if (formattedUnits.length > 0) {
              setSelectedUnit(formattedUnits[0].unit_id);
              
              // Récupérer les charges détaillées du premier lot
              const chargesRes = await fetch(
                `/api/copro/charges?unitId=${formattedUnits[0].unit_id}&fiscalYear=${selectedYear}`,
                { credentials: "include" }
              );
              
              if (chargesRes.ok) {
                const chargesData = await chargesRes.json();
                const formattedCharges: ChargeDetail[] = chargesData.map((charge: any) => ({
                  id: charge.id,
                  service_type: charge.service?.service_type || charge.service_type || "autre",
                  label: charge.service?.label || charge.label || "Charge",
                  period: charge.period || `${charge.period_start} - ${charge.period_end}`,
                  copro_amount: Number(charge.amount) || 0,
                  recuperable_ratio: Number(charge.recuperable_ratio) || 0,
                  prorata_ratio: Number(charge.prorata_ratio) || 1,
                  recuperable_amount: Number(charge.recuperable_amount) || 0,
                  status: charge.status || "calculated",
                }));
                setCharges(formattedCharges);
              }
            }
          } else {
            // Aucun lot trouvé - page vide
            setUnits([]);
          }
        } else {
          console.warn("Erreur API copro/units:", unitsRes.status);
          // Fallback: données exemple pour démo
          setUnits([
            {
              unit_id: 'demo-unit',
              lot_number: '---',
              site_name: 'Aucune copropriété liée',
              fiscal_years: [2025],
              current_year_summary: {
                total_copro: 0,
                total_recuperable: 0,
                by_service: [],
              },
            },
          ]);
        }
      } catch (error) {
        console.error('Erreur chargement:', error);
        // En cas d'erreur, afficher un état vide
        setUnits([]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedYear]);

  useEffect(() => {
    if (units.length > 0 && !selectedUnit) {
      setSelectedUnit(units[0].unit_id);
    }
  }, [units, selectedUnit]);

  const currentUnit = units.find(u => u.unit_id === selectedUnit);
  const recuperablePercentage = currentUnit
    ? (currentUnit.current_year_summary.total_recuperable / currentUnit.current_year_summary.total_copro) * 100
    : 0;

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-white">
              Charges récupérables
            </h1>
            <p className="text-slate-400">
              Détail des charges copropriété récupérables sur vos locataires
            </p>
          </div>
          <Link href="/owner/copro/regularisation">
            <Button className="bg-gradient-to-r from-violet-500 to-purple-600">
              <Calculator className="w-4 h-4 mr-2" />
              Régularisation annuelle
            </Button>
          </Link>
        </motion.div>

        {/* Sélection lot et année */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-4"
        >
          <Select value={selectedUnit || ''} onValueChange={setSelectedUnit}>
            <SelectTrigger className="w-64 bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Sélectionner un lot" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {units.map((unit) => (
                <SelectItem 
                  key={unit.unit_id} 
                  value={unit.unit_id}
                  className="text-white focus:bg-slate-700"
                >
                  Lot n°{unit.lot_number} - {unit.site_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {currentUnit?.fiscal_years.map((year) => (
                <SelectItem 
                  key={year} 
                  value={year.toString()}
                  className="text-white focus:bg-slate-700"
                >
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {currentUnit && (
          <>
            {/* Résumé */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <Card className="border-white/10 bg-white/5">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Charges copro totales</p>
                      <p className="text-2xl font-bold text-white">
                        {currentUnit.current_year_summary.total_copro.toLocaleString('fr-FR')} €
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-cyan-500/20">
                      <Euro className="w-6 h-6 text-cyan-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Part récupérable</p>
                      <p className="text-2xl font-bold text-emerald-400">
                        {currentUnit.current_year_summary.total_recuperable.toLocaleString('fr-FR')} €
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-emerald-500/20">
                      <TrendingUp className="w-6 h-6 text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-gradient-to-br from-red-500/20 to-red-600/10">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Non récupérable</p>
                      <p className="text-2xl font-bold text-red-400">
                        {(currentUnit.current_year_summary.total_copro - currentUnit.current_year_summary.total_recuperable).toLocaleString('fr-FR')} €
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-red-500/20">
                      <TrendingDown className="w-6 h-6 text-red-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Jauge récupérabilité */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-white/10 bg-white/5">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400">Taux de récupérabilité</span>
                    <span className="text-lg font-semibold text-emerald-400">
                      {recuperablePercentage.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={recuperablePercentage} className="h-3 bg-slate-700" />
                  <div className="flex justify-between mt-2 text-xs text-slate-500">
                    <span>0%</span>
                    <span>Décret 87-713</span>
                    <span>100%</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Répartition par service */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-violet-400" />
                    Répartition par poste de charges
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {currentUnit.current_year_summary.by_service.map((service, index) => {
                      const isRecuperable = service.recuperable_amount > 0;
                      const ratio = service.copro_amount > 0 
                        ? (service.recuperable_amount / service.copro_amount) * 100 
                        : 0;
                      
                      return (
                        <motion.div
                          key={service.service_type}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 * index }}
                          className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isRecuperable ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                              {isRecuperable 
                                ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                : <AlertCircle className="w-4 h-4 text-red-400" />
                              }
                            </div>
                            <div>
                              <p className="text-white font-medium">{service.label}</p>
                              <p className="text-xs text-slate-400">
                                {SERVICE_TYPE_LABELS[service.service_type]}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-sm text-slate-400">Copro</p>
                              <p className="text-white font-medium">
                                {service.copro_amount.toLocaleString('fr-FR')} €
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-slate-400">Récupérable</p>
                              <p className={`font-semibold ${isRecuperable ? 'text-emerald-400' : 'text-red-400'}`}>
                                {service.recuperable_amount.toLocaleString('fr-FR')} €
                              </p>
                            </div>
                            <Badge className={
                              ratio === 100 ? 'bg-emerald-500/20 text-emerald-400' :
                              ratio > 0 ? 'bg-amber-500/20 text-amber-400' :
                              'bg-red-500/20 text-red-400'
                            }>
                              {ratio.toFixed(0)}%
                            </Badge>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Tableau détaillé */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="border-white/10 bg-white/5">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-white">Détail par période</CardTitle>
                  <Button variant="outline" size="sm" className="border-white/10 text-white">
                    <Download className="w-4 h-4 mr-2" />
                    Exporter
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-slate-400">Période</TableHead>
                        <TableHead className="text-slate-400">Poste</TableHead>
                        <TableHead className="text-slate-400 text-right">Montant copro</TableHead>
                        <TableHead className="text-slate-400 text-right">Ratio</TableHead>
                        <TableHead className="text-slate-400 text-right">Prorata</TableHead>
                        <TableHead className="text-slate-400 text-right">Récupérable</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {charges.map((charge) => (
                        <TableRow key={charge.id} className="border-white/10">
                          <TableCell className="text-white">{charge.period}</TableCell>
                          <TableCell className="text-slate-300">{charge.label}</TableCell>
                          <TableCell className="text-right text-white">
                            {charge.copro_amount.toLocaleString('fr-FR')} €
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className={
                              charge.recuperable_ratio === 1 ? 'bg-emerald-500/20 text-emerald-400' :
                              charge.recuperable_ratio > 0 ? 'bg-amber-500/20 text-amber-400' :
                              'bg-red-500/20 text-red-400'
                            }>
                              {(charge.recuperable_ratio * 100).toFixed(0)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-slate-400">
                            {(charge.prorata_ratio * 100).toFixed(0)}%
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${
                            charge.recuperable_amount > 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {charge.recuperable_amount.toLocaleString('fr-FR')} €
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </motion.div>

            {/* Info légale */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card className="border-cyan-500/30 bg-cyan-500/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-cyan-400 mt-0.5" />
                    <div className="text-sm text-slate-300">
                      <p className="font-medium text-cyan-400 mb-1">Base légale</p>
                      <p>
                        Les charges récupérables sont définies par le <strong>décret n° 87-713 du 26 août 1987</strong>. 
                        Certaines charges ne sont que partiellement récupérables (ex: gardiennage à 75%).
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-12 w-64 bg-white/10" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-64 bg-white/10" />
          <Skeleton className="h-10 w-40 bg-white/10" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 bg-white/10" />
          ))}
        </div>
        <Skeleton className="h-64 bg-white/10" />
      </div>
    </div>
  );
}

