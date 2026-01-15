// =====================================================
// Page: Régularisation annuelle des charges locatives
// =====================================================

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Calculator, Euro, FileText, Download, Send, 
  CheckCircle2, AlertCircle, TrendingUp, TrendingDown,
  ChevronRight, ArrowLeft, Building2, Calendar, User,
  Sparkles, Eye
} from "lucide-react";
import Link from "next/link";
import type { ServiceType } from "@/lib/types/copro-charges";
import { SERVICE_TYPE_LABELS } from "@/lib/types/copro-charges";

interface Lease {
  id: string;
  property_name: string;
  unit_lot_number: string;
  tenant_name: string;
  tenant_email: string;
  start_date: string;
  end_date: string | null;
  monthly_provision: number;
}

interface ChargeEntry {
  service_type: ServiceType;
  label: string;
  copro_amount: number;
  recuperable_amount: number;
  prorata_tenant: number;
  final_amount: number;
}

interface RegularisationData {
  lease_id: string;
  fiscal_year: number;
  period_start: string;
  period_end: string;
  occupation_days: number;
  total_days: number;
  prorata_ratio: number;
  charges: ChargeEntry[];
  total_copro: number;
  total_recuperable: number;
  total_provisions: number;
  balance: number;
}

type StepKey = 'select' | 'review' | 'preview' | 'confirm';

export default function RegularisationPage() {
  const { user } = useAuth();
  const [step, setStep] = useState<StepKey>('select');
  const [leases, setLeases] = useState<Lease[]>([]);
  const [selectedLease, setSelectedLease] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear() - 1);
  const [regularisationData, setRegularisationData] = useState<RegularisationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const availableYears = [2023, 2024, 2025];

  useEffect(() => {
    async function fetchLeases() {
      try {
        // TODO: Appeler l'API pour récupérer les baux actifs
        setLeases([
          {
            id: 'lease-1',
            property_name: 'Résidence Les Oliviers',
            unit_lot_number: '012',
            tenant_name: 'Jean Dupont',
            tenant_email: 'jean.dupont@email.com',
            start_date: '2024-01-01',
            end_date: null,
            monthly_provision: 150,
          },
          {
            id: 'lease-2',
            property_name: 'Résidence Les Oliviers',
            unit_lot_number: '015',
            tenant_name: 'Marie Martin',
            tenant_email: 'marie.martin@email.com',
            start_date: '2023-06-15',
            end_date: '2024-08-31',
            monthly_provision: 180,
          },
        ]);
      } catch (error) {
        console.error('Erreur chargement baux:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchLeases();
  }, []);

  const calculateRegularisation = async () => {
    if (!selectedLease) return;

    setCalculating(true);
    try {
      // TODO: Appeler l'API de calcul
      const mockData: RegularisationData = {
        lease_id: selectedLease,
        fiscal_year: selectedYear,
        period_start: `${selectedYear}-01-01`,
        period_end: `${selectedYear}-12-31`,
        occupation_days: 365,
        total_days: 365,
        prorata_ratio: 1,
        charges: [
          { service_type: 'eau', label: 'Eau froide', copro_amount: 450, recuperable_amount: 450, prorata_tenant: 1, final_amount: 450 },
          { service_type: 'chauffage', label: 'Chauffage collectif', copro_amount: 800, recuperable_amount: 800, prorata_tenant: 1, final_amount: 800 },
          { service_type: 'menage', label: 'Ménage parties communes', copro_amount: 300, recuperable_amount: 300, prorata_tenant: 1, final_amount: 300 },
          { service_type: 'gardiennage', label: 'Gardiennage', copro_amount: 400, recuperable_amount: 300, prorata_tenant: 1, final_amount: 300 },
          { service_type: 'electricite_commune', label: 'Électricité commune', copro_amount: 180, recuperable_amount: 180, prorata_tenant: 1, final_amount: 180 },
          { service_type: 'ordures_menageres', label: 'Ordures ménagères', copro_amount: 220, recuperable_amount: 220, prorata_tenant: 1, final_amount: 220 },
        ],
        total_copro: 2350,
        total_recuperable: 2250,
        total_provisions: 1800, // 12 mois × 150€
        balance: 450, // Locataire doit 450€
      };
      setRegularisationData(mockData);
      setStep('review');
    } catch (error) {
      console.error('Erreur calcul:', error);
    } finally {
      setCalculating(false);
    }
  };

  const selectedLeaseData = leases.find(l => l.id === selectedLease);

  const steps: { key: StepKey; label: string; icon: React.ReactNode }[] = [
    { key: 'select', label: 'Sélection', icon: <Building2 className="w-4 h-4" /> },
    { key: 'review', label: 'Vérification', icon: <Calculator className="w-4 h-4" /> },
    { key: 'preview', label: 'Aperçu', icon: <Eye className="w-4 h-4" /> },
    { key: 'confirm', label: 'Envoi', icon: <Send className="w-4 h-4" /> },
  ];

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <Link href="/owner/copro/charges">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">
              Régularisation des charges
            </h1>
            <p className="text-slate-400">
              Calculez et envoyez le décompte de régularisation à vos locataires
            </p>
          </div>
        </motion.div>

        {/* Stepper */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-center gap-2"
        >
          {steps.map((s, index) => {
            const isActive = s.key === step;
            const isPast = steps.findIndex(st => st.key === step) > index;
            
            return (
              <div key={s.key} className="flex items-center">
                <div className={`
                  flex items-center gap-2 px-4 py-2 rounded-full transition-all
                  ${isActive ? 'bg-violet-500 text-white' : 
                    isPast ? 'bg-emerald-500/20 text-emerald-400' : 
                    'bg-white/5 text-slate-400'}
                `}>
                  {isPast ? <CheckCircle2 className="w-4 h-4" /> : s.icon}
                  <span className="text-sm font-medium">{s.label}</span>
                </div>
                {index < steps.length - 1 && (
                  <ChevronRight className={`w-5 h-5 mx-2 ${
                    isPast ? 'text-emerald-400' : 'text-slate-600'
                  }`} />
                )}
              </div>
            );
          })}
        </motion.div>

        <AnimatePresence mode="wait">
          {/* Étape 1: Sélection */}
          {step === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Card className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-violet-400" />
                    Période de régularisation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">Année fiscale</Label>
                      <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {availableYears.map((year) => (
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
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <User className="w-5 h-5 text-violet-400" />
                    Sélectionner un bail
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {leases.map((lease) => (
                    <div
                      key={lease.id}
                      onClick={() => setSelectedLease(lease.id)}
                      className={`
                        p-4 rounded-lg cursor-pointer transition-all border
                        ${selectedLease === lease.id 
                          ? 'bg-violet-500/20 border-violet-500' 
                          : 'bg-slate-800/50 border-transparent hover:border-white/20'}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white">{lease.tenant_name}</p>
                          <p className="text-sm text-slate-400">
                            {lease.property_name} - Lot n°{lease.unit_lot_number}
                          </p>
                          <p className="text-xs text-slate-500">
                            Du {new Date(lease.start_date).toLocaleDateString('fr-FR')} 
                            {lease.end_date 
                              ? ` au ${new Date(lease.end_date).toLocaleDateString('fr-FR')}` 
                              : ' (en cours)'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-400">Provision mensuelle</p>
                          <p className="text-lg font-semibold text-white">
                            {lease.monthly_provision} €/mois
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button
                    onClick={calculateRegularisation}
                    disabled={!selectedLease || calculating}
                    className="bg-gradient-to-r from-violet-500 to-purple-600"
                  >
                    {calculating ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                        Calcul en cours...
                      </>
                    ) : (
                      <>
                        <Calculator className="w-4 h-4 mr-2" />
                        Calculer la régularisation
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}

          {/* Étape 2: Vérification */}
          {step === 'review' && regularisationData && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Résumé */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-white/10 bg-white/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-slate-400">Charges réelles</p>
                    <p className="text-xl font-bold text-white">
                      {regularisationData.total_recuperable.toLocaleString('fr-FR')} €
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-white/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-slate-400">Provisions versées</p>
                    <p className="text-xl font-bold text-cyan-400">
                      {regularisationData.total_provisions.toLocaleString('fr-FR')} €
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-white/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-slate-400">Prorata occupation</p>
                    <p className="text-xl font-bold text-white">
                      {(regularisationData.prorata_ratio * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-slate-500">
                      {regularisationData.occupation_days}/{regularisationData.total_days} jours
                    </p>
                  </CardContent>
                </Card>
                <Card className={`border-white/10 ${
                  regularisationData.balance > 0 
                    ? 'bg-gradient-to-br from-amber-500/20 to-orange-600/10' 
                    : 'bg-gradient-to-br from-emerald-500/20 to-green-600/10'
                }`}>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-slate-400">Solde</p>
                    <p className={`text-xl font-bold ${
                      regularisationData.balance > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {regularisationData.balance > 0 ? '+' : ''}{regularisationData.balance.toLocaleString('fr-FR')} €
                    </p>
                    <p className="text-xs text-slate-400">
                      {regularisationData.balance > 0 ? 'à payer par le locataire' : 'à rembourser au locataire'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Détail des charges */}
              <Card className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-white">Détail des charges récupérables</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-slate-400">Poste</TableHead>
                        <TableHead className="text-slate-400 text-right">Copro</TableHead>
                        <TableHead className="text-slate-400 text-right">Récupérable</TableHead>
                        <TableHead className="text-slate-400 text-right">Prorata</TableHead>
                        <TableHead className="text-slate-400 text-right">Montant final</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {regularisationData.charges.map((charge) => (
                        <TableRow key={charge.service_type} className="border-white/10">
                          <TableCell className="text-white">
                            {charge.label}
                            <span className="block text-xs text-slate-400">
                              {SERVICE_TYPE_LABELS[charge.service_type]}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-slate-300">
                            {charge.copro_amount.toLocaleString('fr-FR')} €
                          </TableCell>
                          <TableCell className="text-right text-slate-300">
                            {charge.recuperable_amount.toLocaleString('fr-FR')} €
                          </TableCell>
                          <TableCell className="text-right text-slate-400">
                            {(charge.prorata_tenant * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right font-semibold text-emerald-400">
                            {charge.final_amount.toLocaleString('fr-FR')} €
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-white/10 bg-slate-800/50">
                        <TableCell colSpan={4} className="text-white font-semibold">
                          TOTAL CHARGES RÉCUPÉRABLES
                        </TableCell>
                        <TableCell className="text-right font-bold text-white">
                          {regularisationData.total_recuperable.toLocaleString('fr-FR')} €
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setStep('select')}
                    className="border-white/10 text-white"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Retour
                  </Button>
                  <Button
                    onClick={() => setStep('preview')}
                    className="bg-gradient-to-r from-violet-500 to-purple-600"
                  >
                    Aperçu du document
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}

          {/* Étape 3: Aperçu */}
          {step === 'preview' && regularisationData && selectedLeaseData && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Card className="border-white/10 bg-white">
                <CardContent className="p-4 sm:p-6 md:p-8 text-gray-800">
                  {/* Document preview */}
                  <div className="space-y-4 md:space-y-6">
                    <div className="text-center border-b pb-4">
                      <h2 className="text-lg md:text-xl font-bold">DÉCOMPTE DE RÉGULARISATION</h2>
                      <h3 className="text-base md:text-lg">DES CHARGES LOCATIVES</h3>
                      <p className="text-sm text-gray-500">Année {regularisationData.fiscal_year}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
                      <div>
                        <p className="font-semibold">Bailleur</p>
                        <p>Nom du propriétaire</p>
                        <p className="text-sm text-gray-500">Adresse du propriétaire</p>
                      </div>
                      <div>
                        <p className="font-semibold">Locataire</p>
                        <p>{selectedLeaseData.tenant_name}</p>
                        <p className="text-sm text-gray-500">
                          {selectedLeaseData.property_name} - Lot {selectedLeaseData.unit_lot_number}
                        </p>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <p className="text-sm">
                        Période: du {new Date(regularisationData.period_start).toLocaleDateString('fr-FR')} 
                        au {new Date(regularisationData.period_end).toLocaleDateString('fr-FR')}
                      </p>
                      <p className="text-sm">
                        Occupation: {regularisationData.occupation_days} jours 
                        ({(regularisationData.prorata_ratio * 100).toFixed(1)}%)
                      </p>
                    </div>

                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Nature de la charge</th>
                          <th className="text-right py-2">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {regularisationData.charges.map((charge) => (
                          <tr key={charge.service_type} className="border-b">
                            <td className="py-2">{charge.label}</td>
                            <td className="text-right">{charge.final_amount.toFixed(2)} €</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-semibold">
                          <td className="py-2">Total des charges réelles</td>
                          <td className="text-right">{regularisationData.total_recuperable.toFixed(2)} €</td>
                        </tr>
                        <tr>
                          <td className="py-2">Provisions versées</td>
                          <td className="text-right">- {regularisationData.total_provisions.toFixed(2)} €</td>
                        </tr>
                        <tr className="font-bold text-lg border-t-2">
                          <td className="py-2">SOLDE</td>
                          <td className={`text-right ${
                            regularisationData.balance > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {regularisationData.balance > 0 ? '+' : ''}{regularisationData.balance.toFixed(2)} €
                          </td>
                        </tr>
                      </tfoot>
                    </table>

                    <div className="text-sm text-gray-500 border-t pt-4">
                      <p>
                        {regularisationData.balance > 0 
                          ? `Le locataire devra s'acquitter de la somme de ${regularisationData.balance.toFixed(2)} € correspondant au complément de charges.`
                          : `Le bailleur devra rembourser la somme de ${Math.abs(regularisationData.balance).toFixed(2)} € au locataire correspondant au trop-perçu de provisions.`
                        }
                      </p>
                      <p className="mt-2">
                        Ce décompte est établi conformément aux articles 23 et suivants de la loi n° 89-462 du 6 juillet 1989.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep('review')}
                  className="border-white/10 text-white"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" className="border-white/10 text-white">
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger PDF
                  </Button>
                  <Button
                    onClick={() => setStep('confirm')}
                    className="bg-gradient-to-r from-violet-500 to-purple-600"
                  >
                    Envoyer au locataire
                    <Send className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Étape 4: Confirmation */}
          {step === 'confirm' && selectedLeaseData && regularisationData && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10">
                <CardContent className="p-4 sm:p-6 md:p-8 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 md:mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center"
                  >
                    <CheckCircle2 className="w-10 h-10 md:w-12 md:h-12 text-emerald-400" />
                  </motion.div>
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                    Régularisation envoyée !
                  </h2>
                  <p className="text-slate-300 mb-6">
                    Le décompte de régularisation a été envoyé par email à 
                    <span className="font-semibold"> {selectedLeaseData.tenant_name}</span> 
                    ({selectedLeaseData.tenant_email}).
                  </p>

                  <div className="bg-slate-800/50 rounded-lg p-4 mb-6 w-full max-w-md mx-auto">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Année</span>
                      <span className="text-white">{regularisationData.fiscal_year}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Charges réelles</span>
                      <span className="text-white">{regularisationData.total_recuperable.toLocaleString('fr-FR')} €</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Provisions versées</span>
                      <span className="text-cyan-400">{regularisationData.total_provisions.toLocaleString('fr-FR')} €</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-2 border-t border-white/10">
                      <span className="text-slate-300">Solde</span>
                      <span className={regularisationData.balance > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                        {regularisationData.balance > 0 ? '+' : ''}{regularisationData.balance.toLocaleString('fr-FR')} €
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-center gap-3">
                    <Link href="/owner/copro/charges">
                      <Button variant="outline" className="border-white/10 text-white">
                        Retour aux charges
                      </Button>
                    </Link>
                    <Button
                      onClick={() => {
                        setStep('select');
                        setSelectedLease(null);
                        setRegularisationData(null);
                      }}
                      className="bg-gradient-to-r from-violet-500 to-purple-600"
                    >
                      Nouvelle régularisation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-12 w-72 bg-white/10" />
        <Skeleton className="h-10 w-full bg-white/10" />
        <Skeleton className="h-96 bg-white/10" />
      </div>
    </div>
  );
}

