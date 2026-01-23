"use client";

/**
 * Page Fonctionnalité: Paiements en Ligne
 *
 * SEO: Cible "paiement loyer en ligne", "prélèvement loyer automatique"
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CreditCard,
  ArrowRight,
  Check,
  Banknote,
  RefreshCw,
  Shield,
  Smartphone,
  TrendingUp,
  Zap,
  Sparkles,
  Building2,
} from "lucide-react";

const FEATURES = [
  {
    icon: CreditCard,
    title: "Paiement par carte bancaire",
    description: "Vos locataires paient en 2 clics par CB. Visa, Mastercard, American Express acceptés.",
  },
  {
    icon: Banknote,
    title: "Prélèvement SEPA",
    description: "Mettez en place le prélèvement automatique. Le loyer arrive chaque mois sans action.",
  },
  {
    icon: RefreshCw,
    title: "Réconciliation automatique",
    description: "Les paiements sont automatiquement rapprochés des factures. Fini le suivi manuel.",
  },
  {
    icon: Building2,
    title: "Open Banking",
    description: "Synchronisez votre compte bancaire. Voyez les virements arriver en temps réel.",
  },
  {
    icon: Shield,
    title: "Paiements sécurisés",
    description: "Infrastructure Stripe. PCI-DSS niveau 1. 3D Secure 2 activé.",
  },
  {
    icon: TrendingUp,
    title: "Tableau de bord financier",
    description: "Visualisez vos encaissements, retards, et prévisions de trésorerie.",
  },
];

const PAYMENT_METHODS = [
  { name: "Carte bancaire", fee: "2,2%", delay: "Instantané" },
  { name: "Prélèvement SEPA", fee: "0,50€", delay: "3-5 jours" },
  { name: "Virement bancaire", fee: "Gratuit", delay: "1-2 jours" },
  { name: "Open Banking", fee: "Inclus", delay: "Temps réel" },
];

export default function PaiementsEnLignePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <Link href="/fonctionnalites" className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors">
              <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
              Toutes les fonctionnalités
            </Link>

            <Badge className="bg-green-500/20 text-green-300 border-green-500/30 mb-4">
              <CreditCard className="w-3 h-3 mr-1" />
              Paiements en Ligne
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Encaissez vos loyers{" "}
              <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                automatiquement
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl">
              CB, SEPA, virement, Open Banking. Proposez tous les moyens de paiement
              à vos locataires et recevez vos loyers sans effort.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/auth/signup">
                <Button size="lg" className="bg-gradient-to-r from-green-600 to-emerald-600 hover:opacity-90">
                  Essayer gratuitement
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  Voir les tarifs
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-8 border-y border-slate-800 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "+2M€", label: "encaissés/mois" },
              { value: "99,9%", label: "taux de succès" },
              { value: "J+2", label: "versement moyen" },
              { value: "-60%", label: "de retards" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl md:text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Payment Methods */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Moyens de paiement acceptés
            </h2>
            <p className="text-slate-400">
              Offrez le choix à vos locataires. Frais transparents.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {PAYMENT_METHODS.map((method, index) => (
              <motion.div
                key={method.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 hover:border-green-500/50 transition-colors"
              >
                <h3 className="font-semibold text-white mb-4">{method.name}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Frais</span>
                    <span className="text-white font-medium">{method.fee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Délai</span>
                    <span className="text-white font-medium">{method.delay}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Banking Highlight */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 rounded-3xl p-8 md:p-12 border border-green-500/20"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <Badge className="bg-green-500/30 text-green-300 border-green-500/30 mb-4">
                  <Zap className="w-3 h-3 mr-1" />
                  Exclusif Talok
                </Badge>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Open Banking intégré
                </h2>
                <p className="text-slate-300 mb-6">
                  Connectez votre compte bancaire et voyez vos loyers arriver en temps réel.
                  Réconciliation automatique, plus besoin de vérifier manuellement.
                </p>
                <ul className="space-y-3">
                  {[
                    "Synchronisation en temps réel",
                    "Détection automatique des loyers",
                    "Rapprochement intelligent",
                    "Alertes virements manquants",
                    "Compatible toutes banques FR",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-green-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-slate-800/50 rounded-2xl p-6">
                <div className="space-y-3">
                  {[
                    { name: "Loyer Apt. 12 - Dupont", amount: "+850,00 €", status: "Reçu", time: "Il y a 2h" },
                    { name: "Loyer Studio - Martin", amount: "+520,00 €", status: "Reçu", time: "Il y a 5h" },
                    { name: "Loyer T3 - Bernard", amount: "+1 200,00 €", status: "En attente", time: "Échéance J-2" },
                  ].map((tx, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-900/50 rounded-xl p-4">
                      <div>
                        <p className="font-medium text-white text-sm">{tx.name}</p>
                        <p className="text-xs text-slate-400">{tx.time}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-emerald-400">{tx.amount}</p>
                        <Badge className={tx.status === "Reçu" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}>
                          {tx.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Toutes les fonctionnalités
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-green-500/50 transition-colors">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-green-400" />
                    </div>
                    <CardTitle className="text-white">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-400">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold text-white mb-4">
                Sécurité maximale
              </h2>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { icon: Shield, label: "PCI-DSS Niveau 1" },
                { icon: Shield, label: "3D Secure 2" },
                { icon: Shield, label: "Chiffrement TLS" },
                { icon: Shield, label: "Fraude détection IA" },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                    <item.icon className="w-8 h-8 text-green-400" />
                  </div>
                  <p className="text-white font-medium">{item.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-green-900/50 to-emerald-900/50 rounded-3xl p-12 border border-green-500/30"
          >
            <Sparkles className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Encaissez vos premiers loyers en ligne
            </h2>
            <p className="text-slate-300 mb-8">
              Configuration en 5 minutes. Premiers paiements dès demain.
            </p>
            <Link href="/auth/signup">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                Créer mon compte gratuit
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
