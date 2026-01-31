// =====================================================
// Onboarding Syndic - Étape 5: Tantièmes
// =====================================================

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
  Calculator, ArrowRight, ArrowLeft, Sparkles, AlertCircle,
  CheckCircle2, Info, BarChart3, Percent
} from "lucide-react";

interface StoredUnit {
  id: string;
  building_id: string;
  building_name: string;
  lot_number: string;
  type: string;
  floor: number;
  surface_m2: number | null;
}

interface UnitTantiemes {
  unit_id: string;
  lot_number: string;
  building_name: string;
  type: string;
  surface_m2: number | null;
  tantieme_general: number;
  tantieme_ascenseur: number | null;
  tantieme_chauffage: number | null;
  tantieme_eau: number | null;
}

type TantiemeType = 'tantieme_general' | 'tantieme_ascenseur' | 'tantieme_chauffage' | 'tantieme_eau';

const TANTIEME_TYPES: { key: TantiemeType; label: string; description: string; optional: boolean }[] = [
  { key: 'tantieme_general', label: 'Tantièmes généraux', description: 'Charges communes à tous les copropriétaires', optional: false },
  { key: 'tantieme_ascenseur', label: 'Tantièmes ascenseur', description: 'Selon l\'usage (RDC exclut souvent)', optional: true },
  { key: 'tantieme_chauffage', label: 'Tantièmes chauffage', description: 'Chauffage collectif', optional: true },
  { key: 'tantieme_eau', label: 'Tantièmes eau', description: 'Eau froide collective', optional: true },
];

export default function OnboardingTantiemesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [units, setUnits] = useState<StoredUnit[]>([]);
  const [tantiemes, setTantiemes] = useState<UnitTantiemes[]>([]);
  const [activeTantiemeType, setActiveTantiemeType] = useState<TantiemeType>('tantieme_general');
  const [enabledTypes, setEnabledTypes] = useState<Set<TantiemeType>>(new Set(['tantieme_general']));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Charger les données
  useEffect(() => {
    const storedUnits = localStorage.getItem('syndic_onboarding_units');
    const storedTantiemes = localStorage.getItem('syndic_onboarding_tantiemes');

    if (storedUnits) {
      const unitsData = JSON.parse(storedUnits) as StoredUnit[];
      setUnits(unitsData);

      if (storedTantiemes) {
        setTantiemes(JSON.parse(storedTantiemes));
      } else {
        // Initialiser les tantièmes
        const initialTantiemes: UnitTantiemes[] = unitsData.map(unit => ({
          unit_id: unit.id,
          lot_number: unit.lot_number,
          building_name: unit.building_name,
          type: unit.type,
          surface_m2: unit.surface_m2,
          tantieme_general: 0,
          tantieme_ascenseur: null,
          tantieme_chauffage: null,
          tantieme_eau: null,
        }));
        setTantiemes(initialTantiemes);
      }
    } else {
      router.push('/syndic/onboarding/units');
    }

    setLoading(false);
  }, [router]);

  // Calculer les totaux
  const getTotal = (type: TantiemeType): number => {
    return tantiemes.reduce((sum, t) => sum + (t[type] || 0), 0);
  };

  const totalGeneral = getTotal('tantieme_general');

  // Mise à jour d'un tantième
  const updateTantieme = (unitId: string, type: TantiemeType, value: number) => {
    setTantiemes(prev => prev.map(t => 
      t.unit_id === unitId ? { ...t, [type]: value } : t
    ));
  };

  // Auto-calcul basé sur la surface
  const autoCalculateFromSurface = (type: TantiemeType, targetTotal: number = 10000) => {
    const unitsWithSurface = tantiemes.filter(t => t.surface_m2 && t.surface_m2 > 0);
    const totalSurface = unitsWithSurface.reduce((sum, t) => sum + (t.surface_m2 || 0), 0);

    if (totalSurface === 0) {
      toast({
        title: "Impossible",
        description: "Aucune surface renseignée. Complétez d'abord les surfaces des lots.",
        variant: "destructive"
      });
      return;
    }

    setTantiemes(prev => prev.map(t => {
      if (t.surface_m2 && t.surface_m2 > 0) {
        const ratio = t.surface_m2 / totalSurface;
        return { ...t, [type]: Math.round(ratio * targetTotal) };
      }
      return t;
    }));

    toast({
      title: "Calcul effectué",
      description: `Tantièmes calculés proportionnellement aux surfaces (base ${targetTotal}).`
    });
  };

  // Égaliser les tantièmes
  const equalizeAll = (type: TantiemeType, targetTotal: number = 10000) => {
    const count = tantiemes.length;
    const perUnit = Math.floor(targetTotal / count);
    const remainder = targetTotal - (perUnit * count);

    setTantiemes(prev => prev.map((t, index) => ({
      ...t,
      [type]: perUnit + (index < remainder ? 1 : 0)
    })));

    toast({
      title: "Répartition égale",
      description: `Tantièmes répartis également entre ${count} lots.`
    });
  };

  // Toggle type de tantième optionnel
  const toggleTantiemeType = (type: TantiemeType) => {
    const newEnabled = new Set(enabledTypes);
    if (newEnabled.has(type)) {
      newEnabled.delete(type);
      // Reset les valeurs
      setTantiemes(prev => prev.map(t => ({ ...t, [type]: null })));
    } else {
      newEnabled.add(type);
      // Initialiser à 0
      setTantiemes(prev => prev.map(t => ({ ...t, [type]: 0 })));
    }
    setEnabledTypes(newEnabled);
  };

  const handleSubmit = async () => {
    // Validation
    if (totalGeneral === 0) {
      toast({
        title: "Tantièmes requis",
        description: "Les tantièmes généraux doivent avoir une valeur > 0.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);

    try {
      localStorage.setItem('syndic_onboarding_tantiemes', JSON.stringify(tantiemes));
      router.push('/syndic/onboarding/owners');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la sauvegarde.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-xl font-bold text-white mb-2">Configuration des tantièmes</h2>
        <p className="text-slate-400">
          Définissez les tantièmes de chaque lot pour le calcul des charges.
        </p>
      </motion.div>

      {/* Sélection des types de tantièmes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white text-lg">Types de tantièmes à configurer</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TANTIEME_TYPES.map((type) => {
              const isEnabled = enabledTypes.has(type.key);
              const total = getTotal(type.key);
              
              return (
                <button
                  key={type.key}
                  onClick={() => type.optional && toggleTantiemeType(type.key)}
                  disabled={!type.optional}
                  className={`
                    p-4 rounded-lg border text-left transition-all
                    ${isEnabled 
                      ? 'bg-violet-500/20 border-violet-500/50' 
                      : 'bg-white/5 border-white/10 opacity-50'}
                    ${type.optional ? 'cursor-pointer hover:border-violet-400/50' : 'cursor-default'}
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium text-sm">{type.label}</span>
                    {isEnabled && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  {isEnabled && (
                    <div className="text-2xl font-bold text-violet-400">
                      {total.toLocaleString('fr-FR')}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-1">{type.description}</p>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs pour chaque type actif */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-white/10 bg-white/5">
          <Tabs value={activeTantiemeType} onValueChange={(v) => setActiveTantiemeType(v as TantiemeType)}>
            <CardHeader className="pb-0">
              <TabsList className="bg-white/5 w-full justify-start">
                {TANTIEME_TYPES.filter(t => enabledTypes.has(t.key)).map((type) => (
                  <TabsTrigger 
                    key={type.key} 
                    value={type.key}
                    className="data-[state=active]:bg-violet-500"
                  >
                    {type.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </CardHeader>

            {TANTIEME_TYPES.filter(t => enabledTypes.has(t.key)).map((type) => (
              <TabsContent key={type.key} value={type.key}>
                <CardContent className="pt-4">
                  {/* Actions rapides */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => autoCalculateFromSurface(type.key)}
                      className="border-white/10 text-white"
                    >
                      <Calculator className="w-4 h-4 mr-2" />
                      Calculer selon surface
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => equalizeAll(type.key)}
                      className="border-white/10 text-white"
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Répartir également
                    </Button>
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-slate-400 text-sm">Total:</span>
                      <Badge className={
                        getTotal(type.key) === 10000 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : getTotal(type.key) > 0 
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-red-500/20 text-red-400'
                      }>
                        {getTotal(type.key).toLocaleString('fr-FR')}
                        {getTotal(type.key) === 10000 && <CheckCircle2 className="w-3 h-3 ml-1" />}
                      </Badge>
                    </div>
                  </div>

                  {/* Mobile card view */}
                  <div className="md:hidden space-y-3">
                    {tantiemes.map((t) => {
                      const value = t[type.key] || 0;
                      const total = getTotal(type.key);
                      const percentage = total > 0 ? (value / total) * 100 : 0;
                      return (
                        <div key={t.unit_id} className="rounded-lg border border-white/10 bg-slate-800/30 p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-mono font-medium">Lot {t.lot_number}</span>
                            <Badge className="bg-slate-500/20 text-slate-300">{t.type === 'appartement' ? 'Appt' : t.type === 'parking' ? 'Parking' : t.type}</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><p className="text-slate-400">Bâtiment</p><p className="text-slate-300">{t.building_name}</p></div>
                            <div><p className="text-slate-400">Surface</p><p className="text-slate-300">{t.surface_m2 ? `${t.surface_m2} m²` : '-'}</p></div>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-white/10">
                            <div className="flex items-center gap-2">
                              <Input type="number" value={value} onChange={(e) => updateTantieme(t.unit_id, type.key, parseInt(e.target.value) || 0)} className="w-24 text-right bg-white/5 border-white/10 text-white" />
                              <span className="text-xs text-slate-400">tantièmes</span>
                            </div>
                            <span className={`font-mono text-sm ${percentage > 0 ? 'text-violet-400' : 'text-slate-500'}`}>{percentage.toFixed(2)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop table view */}
                  <div className="hidden md:block max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10">
                          <TableHead className="text-slate-400">Lot</TableHead>
                          <TableHead className="text-slate-400">Bâtiment</TableHead>
                          <TableHead className="text-slate-400">Type</TableHead>
                          <TableHead className="text-slate-400">Surface</TableHead>
                          <TableHead className="text-slate-400 text-right">Tantièmes</TableHead>
                          <TableHead className="text-slate-400 text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tantiemes.map((t) => {
                          const value = t[type.key] || 0;
                          const total = getTotal(type.key);
                          const percentage = total > 0 ? (value / total) * 100 : 0;

                          return (
                            <TableRow key={t.unit_id} className="border-white/10">
                              <TableCell className="text-white font-mono">{t.lot_number}</TableCell>
                              <TableCell className="text-slate-300">{t.building_name}</TableCell>
                              <TableCell>
                                <Badge className="bg-slate-500/20 text-slate-300">
                                  {t.type === 'appartement' ? 'Appt' : 
                                   t.type === 'parking' ? 'Parking' : t.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-slate-300">
                                {t.surface_m2 ? `${t.surface_m2} m²` : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  value={value}
                                  onChange={(e) => updateTantieme(t.unit_id, type.key, parseInt(e.target.value) || 0)}
                                  className="w-24 text-right bg-white/5 border-white/10 text-white"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={`font-mono ${percentage > 0 ? 'text-violet-400' : 'text-slate-500'}`}>
                                  {percentage.toFixed(2)}%
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Barre de progression */}
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Progression vers 10 000</span>
                      <span className={getTotal(type.key) === 10000 ? 'text-emerald-400' : 'text-white'}>
                        {((getTotal(type.key) / 10000) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={Math.min((getTotal(type.key) / 10000) * 100, 100)} 
                      className="h-2 bg-slate-700"
                    />
                  </div>
                </CardContent>
              </TabsContent>
            ))}
          </Tabs>
        </Card>
      </motion.div>

      {/* Info légale */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-cyan-500/30 bg-cyan-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-cyan-400 mt-0.5" />
              <div className="text-sm text-slate-300">
                <p className="font-medium text-cyan-400 mb-1">À propos des tantièmes</p>
                <p>
                  Les tantièmes représentent la quote-part de chaque lot dans la copropriété.
                  Ils sont définis dans le règlement de copropriété et servent au calcul
                  des charges et des droits de vote en assemblée générale.
                  La base habituelle est 10 000 ou 1 000 tantièmes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex justify-between pt-4"
      >
        <Button 
          variant="outline" 
          onClick={() => router.push('/syndic/onboarding/units')}
          className="border-white/10 text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={saving || totalGeneral === 0}
          className="bg-gradient-to-r from-violet-500 to-purple-600"
        >
          {saving ? (
            <>
              <Sparkles className="w-4 h-4 mr-2 animate-spin" />
              Sauvegarde...
            </>
          ) : (
            <>
              Continuer vers les copropriétaires
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </motion.div>
    </div>
  );
}

