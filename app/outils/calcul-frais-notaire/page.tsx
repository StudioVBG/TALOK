"use client";

/**
 * Outil: Calculateur Frais de Notaire
 *
 * SEO: Cible "calcul frais de notaire", "frais acquisition immobilier"
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
  Info,
  Sparkles,
  FileText,
  Building,
  Home,
} from "lucide-react";

type TypeBien = "ancien" | "neuf" | "terrain";

export default function CalculFraisNotairePage() {
  const [prixAchat, setPrixAchat] = useState<number>(200000);
  const [typeBien, setTypeBien] = useState<TypeBien>("ancien");
  const [departement, setDepartement] = useState<string>("75");

  const results = useMemo(() => {
    // Taux de droits de mutation selon le type de bien
    const tauxDroits: Record<TypeBien, number> = {
      ancien: 0.0580715, // ~5.8% (incluant taxe départementale majorée)
      neuf: 0.0071, // ~0.71% (TVA déjà incluse dans le prix)
      terrain: 0.0580715, // Comme l'ancien
    };

    // Émoluments du notaire (barème 2024)
    const calculEmoluments = (prix: number) => {
      let emoluments = 0;
      if (prix <= 6500) {
        emoluments = prix * 0.03945;
      } else if (prix <= 17000) {
        emoluments = 6500 * 0.03945 + (prix - 6500) * 0.01627;
      } else if (prix <= 60000) {
        emoluments = 6500 * 0.03945 + 10500 * 0.01627 + (prix - 17000) * 0.01085;
      } else {
        emoluments = 6500 * 0.03945 + 10500 * 0.01627 + 43000 * 0.01085 + (prix - 60000) * 0.00814;
      }
      return emoluments;
    };

    const droitsMutation = prixAchat * tauxDroits[typeBien];
    const emolumentsNotaire = calculEmoluments(prixAchat);
    const deboursFixes = 800; // Frais administratifs moyens
    const contributionSecurite = prixAchat * 0.001; // Contribution de sécurité immobilière

    const totalFrais = droitsMutation + emolumentsNotaire + deboursFixes + contributionSecurite;
    const pourcentage = (totalFrais / prixAchat) * 100;
    const coutTotal = prixAchat + totalFrais;

    return {
      droitsMutation: droitsMutation.toFixed(2),
      emolumentsNotaire: emolumentsNotaire.toFixed(2),
      deboursFixes: deboursFixes.toFixed(2),
      contributionSecurite: contributionSecurite.toFixed(2),
      totalFrais: totalFrais.toFixed(2),
      pourcentage: pourcentage.toFixed(2),
      coutTotal: coutTotal.toFixed(2),
    };
  }, [prixAchat, typeBien]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto text-center"
          >
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 mb-4">
              <Calculator className="w-3 h-3 mr-1" />
              Outil gratuit
            </Badge>

            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Calculateur{" "}
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                Frais de Notaire
              </span>
            </h1>

            <p className="text-lg text-slate-400 mb-6">
              Estimez les frais de notaire pour votre achat immobilier.
              Ancien, neuf ou terrain : calcul adapté à votre situation.
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
                      <Home className="w-5 h-5 text-amber-400" />
                      Votre projet
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
                      <Label className="text-slate-300">Type de bien</Label>
                      <Select value={typeBien} onValueChange={(v) => setTypeBien(v as TypeBien)}>
                        <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ancien">
                            <span className="flex items-center gap-2">
                              <Building className="w-4 h-4" />
                              Ancien (+ de 5 ans)
                            </span>
                          </SelectItem>
                          <SelectItem value="neuf">
                            <span className="flex items-center gap-2">
                              <Home className="w-4 h-4" />
                              Neuf (VEFA ou - de 5 ans)
                            </span>
                          </SelectItem>
                          <SelectItem value="terrain">
                            <span className="flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              Terrain à bâtir
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <div className="flex items-start gap-2">
                        <Info className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-slate-400">
                          <p className="font-medium text-white mb-1">À savoir</p>
                          <ul className="space-y-1">
                            <li>• <strong>Ancien</strong> : ~7-8% de frais</li>
                            <li>• <strong>Neuf</strong> : ~2-3% de frais</li>
                            <li>• Les frais réels peuvent varier selon le département</li>
                          </ul>
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
                <Card className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 border-amber-500/30">
                  <CardHeader>
                    <CardTitle className="text-white">Estimation des frais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-slate-700">
                        <span className="text-slate-400">Droits de mutation</span>
                        <span className="font-medium text-white">
                          {parseFloat(results.droitsMutation).toLocaleString()}€
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-700">
                        <span className="text-slate-400">Émoluments notaire</span>
                        <span className="font-medium text-white">
                          {parseFloat(results.emolumentsNotaire).toLocaleString()}€
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-700">
                        <span className="text-slate-400">Débours et frais</span>
                        <span className="font-medium text-white">
                          {parseFloat(results.deboursFixes).toLocaleString()}€
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-700">
                        <span className="text-slate-400">Contribution sécurité immo.</span>
                        <span className="font-medium text-white">
                          {parseFloat(results.contributionSecurite).toLocaleString()}€
                        </span>
                      </div>
                    </div>

                    <div className="bg-amber-500/20 rounded-xl p-6 text-center border border-amber-500/30">
                      <p className="text-sm text-slate-300 mb-2">Total frais de notaire</p>
                      <p className="text-4xl font-bold text-amber-400 mb-1">
                        {parseFloat(results.totalFrais).toLocaleString()}€
                      </p>
                      <p className="text-sm text-slate-400">
                        soit {results.pourcentage}% du prix d'achat
                      </p>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300">Coût total acquisition</span>
                        <span className="text-xl font-bold text-white">
                          {parseFloat(results.coutTotal).toLocaleString()}€
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/30 border-slate-700/50">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold text-white mb-3">Composition des frais</h3>
                    <ul className="space-y-2 text-sm text-slate-400">
                      <li>
                        <strong className="text-white">Droits de mutation</strong> : Taxes reversées à l'État et aux collectivités (~80%)
                      </li>
                      <li>
                        <strong className="text-white">Émoluments</strong> : Rémunération du notaire (barème réglementé)
                      </li>
                      <li>
                        <strong className="text-white">Débours</strong> : Frais avancés par le notaire (cadastre, hypothèques...)
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-amber-900/50 to-orange-900/50 rounded-3xl p-12 border border-amber-500/30"
          >
            <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">
              Prêt à investir ?
            </h2>
            <p className="text-slate-300 mb-6">
              Gérez votre futur bien avec Talok : bail, quittances, comptabilité.
              Tout inclus pour maximiser votre rendement.
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
