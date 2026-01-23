"use client";

/**
 * Outil: Calculateur de Rendement Locatif
 *
 * SEO: Cible "calcul rendement locatif", "rentabilité locative"
 * Volume recherche: 2,900/mois
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
  Calculator,
  ArrowRight,
  TrendingUp,
  Info,
  Download,
  Sparkles,
  Euro,
  Home,
  PieChart,
} from "lucide-react";

export default function CalculRendementLocatifPage() {
  const [prixAchat, setPrixAchat] = useState<number>(200000);
  const [fraisNotaire, setFraisNotaire] = useState<number>(16000);
  const [travaux, setTravaux] = useState<number>(10000);
  const [loyerMensuel, setLoyerMensuel] = useState<number>(800);
  const [chargesAnnuelles, setChargesAnnuelles] = useState<number>(2400);
  const [taxeFonciere, setTaxeFonciere] = useState<number>(1200);
  const [vacanceLocative, setVacanceLocative] = useState<number>(5);

  const results = useMemo(() => {
    const investissementTotal = prixAchat + fraisNotaire + travaux;
    const loyerAnnuel = loyerMensuel * 12;
    const loyerNetVacance = loyerAnnuel * (1 - vacanceLocative / 100);
    const chargesTotal = chargesAnnuelles + taxeFonciere;

    const rendementBrut = (loyerAnnuel / investissementTotal) * 100;
    const rendementNet = ((loyerNetVacance - chargesTotal) / investissementTotal) * 100;
    const cashFlowAnnuel = loyerNetVacance - chargesTotal;
    const cashFlowMensuel = cashFlowAnnuel / 12;

    return {
      investissementTotal,
      loyerAnnuel,
      rendementBrut: rendementBrut.toFixed(2),
      rendementNet: rendementNet.toFixed(2),
      cashFlowAnnuel: Math.round(cashFlowAnnuel),
      cashFlowMensuel: Math.round(cashFlowMensuel),
    };
  }, [prixAchat, fraisNotaire, travaux, loyerMensuel, chargesAnnuelles, taxeFonciere, vacanceLocative]);

  const getRendementColor = (rendement: string) => {
    const r = parseFloat(rendement);
    if (r >= 7) return "text-emerald-400";
    if (r >= 5) return "text-amber-400";
    return "text-red-400";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto text-center"
          >
            <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 mb-4">
              <Calculator className="w-3 h-3 mr-1" />
              Outil gratuit
            </Badge>

            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Calculateur de{" "}
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                Rendement Locatif
              </span>
            </h1>

            <p className="text-lg text-slate-400 mb-6">
              Calculez le rendement brut et net de votre investissement immobilier.
              Simulez votre cash-flow mensuel en quelques clics.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Calculator */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Inputs */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Card className="bg-slate-800/30 border-slate-700/50">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Home className="w-5 h-5 text-violet-400" />
                      Données de l'investissement
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Prix d'achat (€)</Label>
                      <Input
                        type="number"
                        value={prixAchat}
                        onChange={(e) => setPrixAchat(Number(e.target.value))}
                        className="bg-slate-900/50 border-slate-700 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Frais de notaire (€)</Label>
                      <Input
                        type="number"
                        value={fraisNotaire}
                        onChange={(e) => setFraisNotaire(Number(e.target.value))}
                        className="bg-slate-900/50 border-slate-700 text-white"
                      />
                      <p className="text-xs text-slate-500">~7-8% dans l'ancien, ~2-3% dans le neuf</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Travaux (€)</Label>
                      <Input
                        type="number"
                        value={travaux}
                        onChange={(e) => setTravaux(Number(e.target.value))}
                        className="bg-slate-900/50 border-slate-700 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Loyer mensuel (€)</Label>
                      <Input
                        type="number"
                        value={loyerMensuel}
                        onChange={(e) => setLoyerMensuel(Number(e.target.value))}
                        className="bg-slate-900/50 border-slate-700 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Charges annuelles (€)</Label>
                      <Input
                        type="number"
                        value={chargesAnnuelles}
                        onChange={(e) => setChargesAnnuelles(Number(e.target.value))}
                        className="bg-slate-900/50 border-slate-700 text-white"
                      />
                      <p className="text-xs text-slate-500">Copropriété, assurance PNO, gestion...</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Taxe foncière annuelle (€)</Label>
                      <Input
                        type="number"
                        value={taxeFonciere}
                        onChange={(e) => setTaxeFonciere(Number(e.target.value))}
                        className="bg-slate-900/50 border-slate-700 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Vacance locative (%)</Label>
                      <Input
                        type="number"
                        value={vacanceLocative}
                        onChange={(e) => setVacanceLocative(Number(e.target.value))}
                        className="bg-slate-900/50 border-slate-700 text-white"
                      />
                      <p className="text-xs text-slate-500">En moyenne 5-8% selon la zone</p>
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
                <Card className="bg-gradient-to-br from-violet-900/30 to-purple-900/30 border-violet-500/30">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-violet-400" />
                      Résultats
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                        <p className="text-sm text-slate-400 mb-1">Rendement Brut</p>
                        <p className={`text-3xl font-bold ${getRendementColor(results.rendementBrut)}`}>
                          {results.rendementBrut}%
                        </p>
                      </div>
                      <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                        <p className="text-sm text-slate-400 mb-1">Rendement Net</p>
                        <p className={`text-3xl font-bold ${getRendementColor(results.rendementNet)}`}>
                          {results.rendementNet}%
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-400">Investissement total</span>
                        <span className="font-semibold text-white">
                          {results.investissementTotal.toLocaleString()}€
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-400">Loyer annuel</span>
                        <span className="font-semibold text-white">
                          {results.loyerAnnuel.toLocaleString()}€
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                        <span className="text-slate-400">Cash-flow mensuel</span>
                        <span className={`font-bold text-xl ${results.cashFlowMensuel >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {results.cashFlowMensuel >= 0 ? '+' : ''}{results.cashFlowMensuel}€
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <div className="flex items-start gap-2">
                        <Info className="w-5 h-5 text-violet-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-slate-400">
                          <p className="mb-2">
                            <strong className="text-white">Rendement brut</strong> = Loyer annuel / Investissement total
                          </p>
                          <p>
                            <strong className="text-white">Rendement net</strong> = (Loyer - Charges - Vacance) / Investissement total
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Interpretation */}
                <Card className="bg-slate-800/30 border-slate-700/50">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold text-white mb-3">Interprétation</h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-400" />
                        <span className="text-slate-300">&gt; 7% : Excellent rendement</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-amber-400" />
                        <span className="text-slate-300">5-7% : Bon rendement</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-400" />
                        <span className="text-slate-300">&lt; 5% : Rendement faible</span>
                      </li>
                    </ul>
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-violet-900/50 to-purple-900/50 rounded-3xl p-12 border border-violet-500/30"
          >
            <Sparkles className="w-12 h-12 text-violet-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">
              Gérez vos investissements avec Talok
            </h2>
            <p className="text-slate-300 mb-6">
              Suivi automatique de la rentabilité, export fiscal, tableau de bord investisseur.
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
