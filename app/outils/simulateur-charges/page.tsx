"use client";

/**
 * Outil: Simulateur Régularisation Charges
 *
 * SEO: Cible "régularisation charges locatives", "calcul charges locataire"
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
  Info,
  Sparkles,
  Euro,
  Thermometer,
  Droplets,
  Trash2,
  Lightbulb,
  Building,
} from "lucide-react";

const CHARGE_CATEGORIES = [
  { id: "chauffage", label: "Chauffage collectif", icon: Thermometer },
  { id: "eau", label: "Eau froide/chaude", icon: Droplets },
  { id: "ordures", label: "Ordures ménagères", icon: Trash2 },
  { id: "electricite", label: "Électricité parties communes", icon: Lightbulb },
  { id: "entretien", label: "Entretien immeuble", icon: Building },
];

export default function SimulateurChargesPage() {
  const [provisionsPercues, setProvisionsPercues] = useState<number>(1200);
  const [charges, setCharges] = useState<Record<string, number>>({
    chauffage: 400,
    eau: 350,
    ordures: 150,
    electricite: 100,
    entretien: 250,
  });
  const [tantiemes, setTantiemes] = useState<number>(100);
  const [tantiemsTotal, setTantiemsTotal] = useState<number>(1000);

  const results = useMemo(() => {
    const totalChargesImmeuble = Object.values(charges).reduce((a, b) => a + b, 0);
    const quotePartLocataire = (totalChargesImmeuble * tantiemes) / tantiemsTotal;
    const difference = provisionsPercues - quotePartLocataire;

    return {
      totalChargesImmeuble,
      quotePartLocataire: quotePartLocataire.toFixed(2),
      difference: difference.toFixed(2),
      isExcedent: difference > 0,
    };
  }, [charges, provisionsPercues, tantiemes, tantiemsTotal]);

  const handleChargeChange = (id: string, value: number) => {
    setCharges((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto text-center"
          >
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 mb-4">
              <Calculator className="w-3 h-3 mr-1" />
              Outil gratuit
            </Badge>

            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Simulateur{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Régularisation Charges
              </span>
            </h1>

            <p className="text-lg text-slate-400 mb-6">
              Calculez la régularisation annuelle des charges locatives.
              Déterminez si votre locataire doit un complément ou a un trop-perçu.
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
                className="space-y-6"
              >
                <Card className="bg-slate-800/30 border-slate-700/50">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Euro className="w-5 h-5 text-emerald-400" />
                      Provisions perçues
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Total provisions sur l'année (€)</Label>
                      <Input
                        type="number"
                        value={provisionsPercues}
                        onChange={(e) => setProvisionsPercues(Number(e.target.value))}
                        className="bg-slate-900/50 border-slate-700 text-white"
                      />
                      <p className="text-xs text-slate-500">Ex: 100€/mois × 12 mois = 1 200€</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/30 border-slate-700/50">
                  <CardHeader>
                    <CardTitle className="text-white">Charges réelles de l'immeuble (€)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {CHARGE_CATEGORIES.map((cat) => (
                      <div key={cat.id} className="space-y-2">
                        <Label className="text-slate-300 flex items-center gap-2">
                          <cat.icon className="w-4 h-4 text-emerald-400" />
                          {cat.label}
                        </Label>
                        <Input
                          type="number"
                          value={charges[cat.id]}
                          onChange={(e) => handleChargeChange(cat.id, Number(e.target.value))}
                          className="bg-slate-900/50 border-slate-700 text-white"
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/30 border-slate-700/50">
                  <CardHeader>
                    <CardTitle className="text-white">Quote-part (tantièmes)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-slate-300">Tantièmes du lot</Label>
                        <Input
                          type="number"
                          value={tantiemes}
                          onChange={(e) => setTantiemes(Number(e.target.value))}
                          className="bg-slate-900/50 border-slate-700 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-300">Total immeuble</Label>
                        <Input
                          type="number"
                          value={tantiemsTotal}
                          onChange={(e) => setTantiemsTotal(Number(e.target.value))}
                          className="bg-slate-900/50 border-slate-700 text-white"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      Quote-part = {((tantiemes / tantiemsTotal) * 100).toFixed(2)}%
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Results */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <Card className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border-emerald-500/30">
                  <CardHeader>
                    <CardTitle className="text-white">Résultat de la régularisation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-3 border-b border-slate-700">
                        <span className="text-slate-400">Total charges immeuble</span>
                        <span className="font-semibold text-white">
                          {results.totalChargesImmeuble.toLocaleString()}€
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-slate-700">
                        <span className="text-slate-400">Quote-part locataire</span>
                        <span className="font-semibold text-white">
                          {parseFloat(results.quotePartLocataire).toLocaleString()}€
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-slate-700">
                        <span className="text-slate-400">Provisions perçues</span>
                        <span className="font-semibold text-white">
                          {provisionsPercues.toLocaleString()}€
                        </span>
                      </div>
                    </div>

                    <div className={`rounded-xl p-6 text-center ${
                      results.isExcedent
                        ? "bg-emerald-500/20 border border-emerald-500/30"
                        : "bg-amber-500/20 border border-amber-500/30"
                    }`}>
                      <p className="text-sm text-slate-300 mb-2">
                        {results.isExcedent ? "Excédent à rembourser" : "Complément à percevoir"}
                      </p>
                      <p className={`text-4xl font-bold ${
                        results.isExcedent ? "text-emerald-400" : "text-amber-400"
                      }`}>
                        {results.isExcedent ? '-' : '+'}{Math.abs(parseFloat(results.difference)).toLocaleString()}€
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/30 border-slate-700/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-slate-400">
                        <p className="font-medium text-white mb-2">Obligations légales</p>
                        <ul className="space-y-1">
                          <li>• Régularisation annuelle obligatoire</li>
                          <li>• Justificatifs à tenir à disposition 6 ans</li>
                          <li>• Délai de prescription : 3 ans</li>
                          <li>• Décompte détaillé à fournir au locataire</li>
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-emerald-900/50 to-teal-900/50 rounded-3xl p-12 border border-emerald-500/30"
          >
            <Sparkles className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">
              Régularisation automatique avec Talok
            </h2>
            <p className="text-slate-300 mb-6">
              Talok calcule et génère automatiquement le décompte de régularisation chaque année.
              Envoi automatique au locataire.
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
