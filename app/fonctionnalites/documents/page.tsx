"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FolderOpen,
  ArrowRight,
  Check,
  Shield,
  Share2,
  Search,
  Archive,
  ScanLine,
  Lock,
  Sparkles,
  FileCheck,
} from "lucide-react";

const FEATURES = [
  {
    icon: Archive,
    title: "Coffre-fort chiffré",
    description:
      "Stockage hébergé en France, chiffrement AES-256 au repos et TLS en transit. Sauvegardé en temps réel.",
  },
  {
    icon: FolderOpen,
    title: "Classement automatique",
    description:
      "Chaque document est rangé automatiquement par bien, locataire, type (bail, quittance, diagnostic, CNI...).",
  },
  {
    icon: ScanLine,
    title: "OCR des justificatifs",
    description:
      "Talok lit vos documents : dates, montants, IBAN, dépenses. Zéro saisie manuelle pour la comptabilité.",
  },
  {
    icon: Share2,
    title: "Partage sécurisé en un clic",
    description:
      "Lien temporaire pour garant, banque, notaire ou expert-comptable. Mot de passe, expiration, traçabilité.",
  },
  {
    icon: Search,
    title: "Recherche instantanée",
    description:
      "Recherche full-text dans les documents scannés. Retrouvez une quittance, un diagnostic, un RIB en 2 secondes.",
  },
  {
    icon: FileCheck,
    title: "Archivage 10 ans conforme",
    description:
      "Respect des obligations légales d'archivage. Export groupé en ZIP pour votre comptable, votre notaire.",
  },
];

const DOC_TYPES = [
  "Baux signés",
  "Quittances de loyer",
  "Diagnostics (DPE, amiante, plomb...)",
  "Cartes d'identité & justificatifs locataire",
  "Avis de taxe foncière",
  "Assurances PNO & garant",
  "Factures travaux",
  "Attestations & certificats",
  "PV d'assemblée générale",
];

export default function DocumentsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent" />

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

            <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 mb-4">
              <FolderOpen className="w-3 h-3 mr-1" />
              Documents
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Votre coffre-fort locatif,{" "}
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                chiffré et organisé
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl">
              Tous vos documents au même endroit : baux, quittances, diagnostics, CNI, attestations.
              Classement automatique, OCR intelligent, partage sécurisé.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/essai-gratuit">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90"
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
              { value: "AES-256", label: "chiffrement" },
              { value: "🇫🇷", label: "hébergement France" },
              { value: "10 ans", label: "archivage" },
              { value: "RGPD", label: "conforme" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl md:text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Types de documents */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">Tous les documents de votre activité</h2>
            <p className="text-slate-400">
              Talok centralise tous les types de documents liés à la gestion locative.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl mx-auto">
            {DOC_TYPES.map((doc, i) => (
              <motion.div
                key={doc}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 bg-slate-800/30 rounded-xl p-4 border border-slate-700/50"
              >
                <Check className="w-4 h-4 text-violet-400 shrink-0" />
                <span className="text-slate-300 text-sm">{doc}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Partage sécurisé */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-violet-900/30 to-purple-900/30 rounded-3xl p-8 md:p-12 border border-violet-500/20 max-w-5xl mx-auto"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <Badge className="bg-violet-500/30 text-violet-300 border-violet-500/30 mb-4">
                  <Share2 className="w-3 h-3 mr-1" />
                  Partage intelligent
                </Badge>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Envoyez un dossier sans fuite
                </h2>
                <p className="text-slate-300 mb-6">
                  Besoin de transmettre un bail à votre banque, un dossier locataire à votre garant,
                  un bilan à votre expert-comptable ? Créez un lien sécurisé avec mot de passe et
                  date d'expiration.
                </p>
                <ul className="space-y-3">
                  {[
                    "Lien unique par destinataire",
                    "Mot de passe optionnel",
                    "Date d'expiration (24h, 7j, 30j)",
                    "Traçabilité des téléchargements",
                    "Révocation en 1 clic",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-violet-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-slate-800/50 rounded-2xl p-6">
                <div className="space-y-3">
                  {[
                    { name: "Bail signé - Apt. Dupont", recipient: "banque-mutuelle.fr", status: "Envoyé" },
                    { name: "CNI + fiche paie locataire", recipient: "garant@exemple.fr", status: "Téléchargé" },
                    { name: "Bilan SCI 2025", recipient: "cabinet@compta.fr", status: "En attente" },
                  ].map((tx) => (
                    <div
                      key={tx.name}
                      className="flex items-center justify-between bg-slate-900/50 rounded-xl p-4"
                    >
                      <div>
                        <p className="font-medium text-white text-sm">{tx.name}</p>
                        <p className="text-xs text-slate-400">{tx.recipient}</p>
                      </div>
                      <Badge className="bg-violet-500/20 text-violet-300 text-xs">{tx.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20">
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
                <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-violet-500/50 transition-colors">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center mb-4">
                      <f.icon className="w-6 h-6 text-violet-400" />
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

      {/* Security highlight */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold text-white mb-4">Sécurité au niveau entreprise</h2>
            </motion.div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { icon: Lock, label: "Chiffrement AES-256" },
                { icon: Shield, label: "Hébergement FR" },
                { icon: Archive, label: "Sauvegarde continue" },
                { icon: FileCheck, label: "Conforme RGPD" },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-3">
                    <item.icon className="w-8 h-8 text-violet-400" />
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-violet-900/50 to-purple-900/50 rounded-3xl p-12 border border-violet-500/30"
          >
            <Sparkles className="w-12 h-12 text-violet-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Mettez tous vos documents à l'abri
            </h2>
            <p className="text-slate-300 mb-8">
              100 Mo gratuits pour démarrer. Jusqu'à 5 Go avec le plan Confort.
            </p>
            <Link href="/essai-gratuit">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                Créer mon coffre-fort gratuit
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
