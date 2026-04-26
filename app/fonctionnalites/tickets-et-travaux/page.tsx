"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wrench,
  ArrowRight,
  Check,
  MessageSquare,
  Users,
  Clock,
  FileText,
  Camera,
  Smartphone,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  {
    icon: Smartphone,
    title: "Déclaration par le locataire",
    description:
      "Votre locataire signale un problème depuis son espace mobile, avec photos et description. Vous êtes alerté immédiatement.",
  },
  {
    icon: Users,
    title: "Réseau d'artisans locaux",
    description:
      "Plombiers, électriciens, menuisiers... Choisissez dans notre réseau ou invitez votre artisan habituel.",
  },
  {
    icon: FileText,
    title: "Devis & bons d'intervention",
    description:
      "Devis comparatifs en quelques clics. Bon d'intervention généré et envoyé à l'artisan et au locataire.",
  },
  {
    icon: Clock,
    title: "Suivi temps réel",
    description:
      "12 statuts de ticket (reçu, devis en cours, accepté, programmé, en cours, terminé, facturé...). Vous savez toujours où en est chaque intervention.",
  },
  {
    icon: MessageSquare,
    title: "Messagerie intégrée",
    description:
      "Échanges centralisés propriétaire ↔ locataire ↔ artisan. Photos, devis, validations — tout dans un seul fil.",
  },
  {
    icon: Camera,
    title: "Photos avant / après",
    description:
      "Preuves photo horodatées à chaque étape. Utile pour assurance et en cas de litige avec le locataire.",
  },
];

const STATUSES = [
  { label: "Signalé", color: "bg-slate-500/20 text-slate-300" },
  { label: "Analysé", color: "bg-blue-500/20 text-blue-300" },
  { label: "Devis en cours", color: "bg-amber-500/20 text-amber-300" },
  { label: "Devis envoyé", color: "bg-amber-500/20 text-amber-300" },
  { label: "Accepté", color: "bg-emerald-500/20 text-emerald-300" },
  { label: "Programmé", color: "bg-emerald-500/20 text-emerald-300" },
  { label: "En cours", color: "bg-orange-500/20 text-orange-300" },
  { label: "Terminé", color: "bg-emerald-500/20 text-emerald-300" },
  { label: "Facturé", color: "bg-violet-500/20 text-violet-300" },
  { label: "Payé", color: "bg-violet-500/20 text-violet-300" },
];

export default function TicketsEtTravauxPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <Link
              href="/fonctionnalites"
              className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors"
            >
              <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
              Toutes les fonctionnalités
            </Link>

            <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 mb-4">
              <Wrench className="w-3 h-3 mr-1" />
              Tickets & travaux
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Les interventions{" "}
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                pilotées de bout en bout
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl">
              Vos locataires déclarent leurs problèmes, vous choisissez un artisan, suivez devis et
              factures sans quitter Talok. Zéro ticket oublié.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/essai-gratuit">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-orange-600 to-amber-600 hover:opacity-90"
                >
                  Essayer gratuitement
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Voir les tarifs
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-8 border-y border-slate-800 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "-70 %", label: "de tickets oubliés" },
              { value: "3 clics", label: "du signalement à l'artisan" },
              { value: "12", label: "statuts de suivi" },
              { value: "Photos", label: "horodatées" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl md:text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">De la fuite d'eau à la facture payée</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Un workflow pensé pour ne rien oublier, avec 12 statuts et notifications automatiques
              à chaque étape.
            </p>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
            {STATUSES.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Badge className={`${s.color} text-sm px-3 py-1`}>
                  {i + 1}. {s.label}
                </Badge>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">Toutes les fonctionnalités</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-orange-500/50 transition-colors">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4">
                      <f.icon className="w-6 h-6 text-orange-400" />
                    </div>
                    <CardTitle className="text-white">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-400">{f.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Artisans highlight */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-orange-900/30 to-amber-900/30 rounded-3xl p-8 md:p-12 border border-orange-500/20 max-w-5xl mx-auto"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <Badge className="bg-orange-500/30 text-orange-300 border-orange-500/30 mb-4">
                  <Users className="w-3 h-3 mr-1" />
                  Réseau d'artisans
                </Badge>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Trouvez le bon artisan, ou invitez le vôtre
                </h2>
                <p className="text-slate-300 mb-6">
                  Accédez à un réseau de prestataires qualifiés par région. Notés par d'autres
                  propriétaires. Ou invitez votre plombier habituel en un clic.
                </p>
                <ul className="space-y-3">
                  {[
                    "Plombiers, électriciens, menuisiers, serruriers, chauffagistes",
                    "Artisans vérifiés (SIRET, assurance décennale)",
                    "Notation après intervention",
                    "Paiement sécurisé via Talok",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-orange-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-slate-800/50 rounded-2xl p-6 text-center">
                <Wrench className="w-12 h-12 text-orange-400 mx-auto mb-4" />
                <p className="text-2xl font-bold text-white mb-2">+500 artisans</p>
                <p className="text-slate-300">dans toute la France</p>
                <p className="text-sm text-slate-500 mt-4">Métropole + DROM-COM</p>
              </div>
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-orange-900/50 to-amber-900/50 rounded-3xl p-12 border border-orange-500/30"
          >
            <Sparkles className="w-12 h-12 text-orange-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">Ne ratez plus un seul signalement</h2>
            <p className="text-slate-300 mb-8">
              Alertes en temps réel, suivi centralisé, zéro ticket oublié.
            </p>
            <Link href="/essai-gratuit">
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
