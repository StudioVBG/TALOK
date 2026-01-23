"use client";

/**
 * Outil: Calculateur Révision IRL
 *
 * SEO: Cible "calcul révision loyer IRL", "indice IRL"
 * Volume recherche: 1,200/mois
 */

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Calculator,
  ArrowRight,
  TrendingUp,
  Info,
  Calendar,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

// IRL values (Q3 2024 to Q4 2025 - should be updated regularly)
const IRL_VALUES: Record<string, number> = {
  "2025-T4": 145.47,
  "2025-T3": 144.50,
  "2025-T2": 143.58,
  "2025-T1": 142.70,
  "2024-T4": 142.06,
  "2024-T3": 141.03,
  "2024-T2": 140.59,
  "2024-T1": 139.86,
  "2023-T4": 138.97,
  "2023-T3": 138.31,
  "2023-T2": 137.52,
  "2023-T1": 136.27,
};

export default function CalculRevisionIRLPage() {
  const [loyerActuel, setLoyerActuel] = useState<number>(800);
  const [irlReference, setIrlReference] = useState<string>("2024-T3");
  const [irlNouveau, setIrlNouveau] = useState<string>("2025-T3");

  const results = useMemo(() => {
    const irlRefValue = IRL_VALUES[irlReference] || 0;
    const irlNewValue = IRL_VALUES[irlNouveau] || 0;

    if (!irlRefValue || !irlNewValue) {
      return null;
    }

    const nouveauLoyer = (loyerActuel * irlNewValue) / irlRefValue;
    const augmentation = nouveauLoyer - loyerActuel;
    const pourcentage = ((irlNewValue - irlRefValue) / irlRefValue) * 100;

    return {
      nouveauLoyer: nouveauLoyer.toFixed(2),
      augmentation: augmentation.toFixed(2),
      pourcentage: pourcentage.toFixed(2),
      irlRefValue,
      irlNewValue,
    };
  }, [loyerActuel, irlReference, irlNouveau]);

  const irlOptions = Object.keys(IRL_VALUES).map((key) => {
    const [year, quarter] = key.split("-");
    return {
      value: key,
      label: `${quarter} ${year} (${IRL_VALUES[key]})`,
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto text-center"
          >
            <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 mb-4">
              <Calculator className="w-3 h-3 mr-1" />
              Outil gratuit
            </Badge>

            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Calculateur{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Révision IRL
              </span>
            </h1>

            <p className="text-lg text-slate-400 mb-6">
              Calculez la révision annuelle de votre loyer selon l'Indice de Référence des Loyers (IRL).
              Utilisez les derniers indices publiés par l'INSEE.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Calculator */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Inputs */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Card className="bg-slate-800/30 border-slate-700/50">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-cyan-400" />
                      Paramètres de calcul
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Loyer actuel (€)</Label>
                      <Input
                        type="number"
                        value={loyerActuel}
                        onChange={(e) => setLoyerActuel(Number(e.target.value))}
                        className="bg-slate-900/50 border-slate-700 text-white"
                      />
                      <p className="text-xs text-slate-500">Loyer hors charges</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">IRL de référence (bail)</Label>
                      <Select value={irlReference} onValueChange={setIrlReference}>
                        <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {irlOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">IRL mentionné dans le bail ou dernière révision</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Nouvel IRL applicable</Label>
                      <Select value={irlNouveau} onValueChange={setIrlNouveau}>
                        <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {irlOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">IRL du même trimestre, 1 an plus tard</p>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <div className="flex items-start gap-2">
                        <Info className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-slate-400">
                          <p className="font-medium text-white mb-1">Formule de calcul</p>
                          <code className="text-cyan-300">
                            Nouveau loyer = Loyer actuel × (Nouvel IRL / IRL de référence)
                          </code>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Results */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {results && (
                  <Card className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border-cyan-500/30">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-cyan-400" />
                        Résultat
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="bg-slate-800/50 rounded-xl p-6 text-center">
                        <p className="text-sm text-slate-400 mb-2">Nouveau loyer mensuel</p>
                        <p className="text-4xl font-bold text-white mb-2">
                          {parseFloat(results.nouveauLoyer).toLocaleString()}€
                        </p>
                        <Badge className={parseFloat(results.augmentation) > 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}>
                          {parseFloat(results.augmentation) > 0 ? '+' : ''}{results.augmentation}€/mois
                          ({results.pourcentage}%)
                        </Badge>
                      </div>

                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center py-2 border-b border-slate-700">
                          <span className="text-slate-400">Loyer actuel</span>
                          <span className="text-white">{loyerActuel.toLocaleString()}€</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-700">
                          <span className="text-slate-400">IRL de référence</span>
                          <span className="text-white">{results.irlRefValue}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-700">
                          <span className="text-slate-400">Nouvel IRL</span>
                          <span className="text-white">{results.irlNewValue}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-slate-400">Variation annuelle</span>
                          <span className="font-semibold text-cyan-400">+{results.pourcentage}%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="bg-slate-800/30 border-slate-700/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-slate-400">
                        <p className="font-medium text-white mb-2">Points importants</p>
                        <ul className="space-y-1">
                          <li>• La révision ne peut intervenir qu'une fois par an</li>
                          <li>• Elle doit être prévue par une clause du bail</li>
                          <li>• Le bailleur dispose d'un an pour la réclamer</li>
                          <li>• L'IRL est publié chaque trimestre par l'INSEE</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-cyan-900/50 to-blue-900/50 rounded-3xl p-12 border border-cyan-500/30"
          >
            <Sparkles className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">
              Révision automatique avec Talok
            </h2>
            <p className="text-slate-300 mb-6">
              Talok calcule et applique automatiquement la révision IRL chaque année.
              Plus besoin de vous en souvenir.
            </p>
            <Link href="/auth/signup">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                Essayer gratuitement
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
