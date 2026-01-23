"use client";

/**
 * Page Solution: Administrateurs de Biens
 *
 * Persona: Professionnels gérant 50+ biens
 * SEO: Cible "logiciel gestion locative professionnel"
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  ArrowRight,
  Check,
  Users,
  Zap,
  Shield,
  BarChart3,
  Headphones,
  Settings,
  Sparkles,
  Crown,
  Lock,
  Gauge,
} from "lucide-react";

const ENTERPRISE_FEATURES = [
  {
    icon: Building2,
    title: "Biens illimités",
    description: "Aucune limite sur le nombre de biens. Scalez sans contrainte.",
  },
  {
    icon: Users,
    title: "Équipe illimitée",
    description: "Ajoutez autant de collaborateurs que nécessaire avec des rôles personnalisés.",
  },
  {
    icon: Zap,
    title: "API complète",
    description: "Intégrez Talok à vos outils existants. Documentation complète.",
  },
  {
    icon: Shield,
    title: "SLA garanti",
    description: "Disponibilité 99,9% garantie. Support prioritaire 24/7.",
  },
  {
    icon: BarChart3,
    title: "Rapports avancés",
    description: "Tableaux de bord personnalisables. Export automatisé.",
  },
  {
    icon: Settings,
    title: "Marque blanche",
    description: "Personnalisez l'interface avec votre marque et vos couleurs.",
  },
];

const PRICING_TIERS = [
  {
    name: "Enterprise S",
    properties: "50-100 biens",
    price: "249€/mois",
    features: ["50 signatures/mois incluses", "Frais CB: 1,9%", "Account Manager dédié"],
  },
  {
    name: "Enterprise M",
    properties: "100-200 biens",
    price: "449€/mois",
    popular: true,
    features: ["100 signatures/mois incluses", "Frais CB: 1,9%", "API complète", "SLA 99,9%"],
  },
  {
    name: "Enterprise L",
    properties: "200-500 biens",
    price: "Sur devis",
    features: ["Signatures illimitées", "Frais négociés", "Formation sur site", "Marque blanche"],
  },
];

const INTEGRATIONS = [
  "Comptabilité (Sage, QuickBooks)",
  "CRM (Salesforce, HubSpot)",
  "Banques (toutes banques FR)",
  "Signatures (DocuSign, Yousign)",
  "Portails (SeLoger, LeBonCoin)",
  "Assurances (partenaires GLI)",
];

export default function AdministrateursBiensPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto text-center"
          >
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 mb-4">
              <Crown className="w-3 h-3 mr-1" />
              Solutions Enterprise
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Pour les professionnels{" "}
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                de l'immobilier
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
              50, 100, 500 biens ou plus. Talok Enterprise s'adapte à votre volume
              avec des fonctionnalités avancées et un support dédié.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <Link href="/contact?subject=enterprise">
                <Button size="lg" className="bg-gradient-to-r from-amber-600 to-orange-600 hover:opacity-90">
                  Demander une démo
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  Voir tous les tarifs
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Biens illimités
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                API complète
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                SLA 99,9%
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
              Fonctionnalités Enterprise
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {ENTERPRISE_FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-amber-500/50 transition-colors">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-amber-400" />
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

      {/* Pricing Tiers */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Tarification Enterprise
            </h2>
            <p className="text-slate-400">
              Choisissez la formule adaptée à votre portefeuille
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING_TIERS.map((tier, index) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`rounded-2xl p-6 border ${
                  tier.popular
                    ? "bg-gradient-to-br from-amber-900/50 to-orange-900/50 border-amber-500/50"
                    : "bg-slate-800/30 border-slate-700/50"
                }`}
              >
                {tier.popular && (
                  <Badge className="bg-amber-500 text-white border-0 mb-4">Recommandé</Badge>
                )}
                <h3 className="text-xl font-bold text-white mb-1">{tier.name}</h3>
                <p className="text-sm text-slate-400 mb-4">{tier.properties}</p>
                <div className="text-3xl font-bold text-white mb-6">{tier.price}</div>
                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href="/contact?subject=enterprise">
                  <Button className="w-full" variant={tier.popular ? "default" : "outline"}>
                    {tier.price === "Sur devis" ? "Nous contacter" : "Demander une démo"}
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">
                Intégrations disponibles
              </h2>
              <p className="text-slate-400">
                Connectez Talok à vos outils existants via notre API
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {INTEGRATIONS.map((integration, index) => (
                <motion.div
                  key={integration}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 bg-slate-800/30 rounded-xl p-4 border border-slate-700/50"
                >
                  <Check className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <span className="text-slate-300 text-sm">{integration}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto text-center"
          >
            <h2 className="text-3xl font-bold text-white mb-8">
              Sécurité & Conformité
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { icon: Lock, label: "RGPD", desc: "Conforme" },
                { icon: Shield, label: "ISO 27001", desc: "Certifié" },
                { icon: Gauge, label: "SLA", desc: "99,9%" },
                { icon: Headphones, label: "Support", desc: "24/7" },
              ].map((item, i) => (
                <div key={item.label} className="text-center">
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
                    <item.icon className="w-8 h-8 text-amber-400" />
                  </div>
                  <p className="font-semibold text-white">{item.label}</p>
                  <p className="text-sm text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-amber-900/50 to-orange-900/50 rounded-3xl p-12 border border-amber-500/30"
          >
            <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Parlons de vos besoins
            </h2>
            <p className="text-slate-300 mb-8">
              Démo personnalisée avec un expert. Gratuit et sans engagement.
            </p>
            <Link href="/contact?subject=enterprise">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                Planifier une démo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
