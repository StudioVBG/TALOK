"use client";

/**
 * Page Solution: France d'outre-mer (Différenciateur majeur)
 *
 * USP: Seul logiciel né aux Antilles, conçu pour les réalités DROM-COM
 * SEO: Cible "gestion locative martinique", "location guadeloupe"
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Palmtree,
  ArrowRight,
  Check,
  Phone,
  Clock,
  FileText,
  Euro,
  Sun,
  MapPin,
  Heart,
  Ship,
  Building2,
  Calculator,
} from "lucide-react";

const DROM_REGIONS = [
  { name: "Martinique", flag: "🇲🇶", users: "+800" },
  { name: "Guadeloupe", flag: "🇬🇵", users: "+650" },
  { name: "Guyane", flag: "🇬🇫", users: "+150" },
  { name: "La Réunion", flag: "🇷🇪", users: "+400" },
  { name: "Mayotte", flag: "🇾🇹", users: "+50" },
];

const DROM_SPECIFICITIES = [
  {
    icon: Clock,
    title: "Support fuseau horaire Antilles",
    description:
      "Notre équipe est disponible sur le fuseau des Antilles. Plus besoin d'attendre minuit pour avoir une réponse.",
  },
  {
    icon: Ship,
    title: "Délais postaux compris",
    description:
      "Les courriers mettent 2 semaines ? On le sait. Nos relances sont calibrées pour les délais DROM-COM.",
  },
  {
    icon: Euro,
    title: "Fiscalité Pinel Outre-Mer",
    description:
      "Exports adaptés aux spécificités fiscales DROM-COM : Pinel OM, Girardin, réductions majorées.",
  },
  {
    icon: FileText,
    title: "Réglementations locales",
    description:
      "Documents conformes aux arrêtés préfectoraux locaux. Zones tendues, encadrement des loyers.",
  },
  {
    icon: Building2,
    title: "Spécificités construction",
    description:
      "Normes cycloniques, parasismiques... Nos EDL intègrent les points de contrôle locaux.",
  },
  {
    icon: Sun,
    title: "Saisonnalité comprise",
    description:
      "Haute saison touristique, carnaval, vacances scolaires décalées. On connaît votre calendrier.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Enfin un logiciel qui comprend nos réalités ! Le support répond à mes heures, les documents sont adaptés.",
    author: "Jean-Marc P.",
    location: "Schœlcher, Martinique",
    properties: "4 biens",
  },
  {
    quote:
      "J'ai testé 3 logiciels métropolitains avant. Talok est le seul qui gère correctement mes spécificités fiscales Pinel OM.",
    author: "Corine D.",
    location: "Pointe-à-Pitre, Guadeloupe",
    properties: "SCI · 8 biens",
  },
];

export default function OutreMerPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto text-center"
          >
            <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30 mb-4">
              <Palmtree className="w-3 h-3 mr-1" />
              Conçu en Martinique
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Le seul logiciel{" "}
              <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                né aux Antilles
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
              Les logiciels parisiens ne comprennent pas vos réalités.
              Talok est né à Fort-de-France. On connaît vos contraintes, vos délais, votre fiscalité.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <Link href="/essai-gratuit">
                <Button size="lg" className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:opacity-90">
                  Essayer gratuitement
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <a href="tel:+596696000000">
                <Button size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  <Phone className="w-4 h-4 mr-2" />
                  0696 XX XX XX
                </Button>
              </a>
            </div>

            {/* DROM Regions */}
            <div className="flex flex-wrap justify-center gap-4 mt-8">
              {DROM_REGIONS.map((region) => (
                <div
                  key={region.name}
                  className="flex items-center gap-2 bg-slate-800/30 rounded-full px-4 py-2 border border-slate-700/50"
                >
                  <span className="text-2xl">{region.flag}</span>
                  <span className="text-white font-medium">{region.name}</span>
                  <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30 text-xs">
                    {region.users}
                  </Badge>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Why outre-mer specific */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Ce qu'on comprend (parce qu'on le vit)
            </h2>
            <p className="text-slate-400">
              Nos équipes sont basées aux Antilles. On connaît vos défis quotidiens.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {DROM_SPECIFICITIES.map((spec, index) => (
              <motion.div
                key={spec.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-teal-500/50 transition-colors">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center mb-4">
                      <spec.icon className="w-6 h-6 text-teal-400" />
                    </div>
                    <CardTitle className="text-white">{spec.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-400">{spec.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Support Highlight */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-teal-900/30 to-cyan-900/30 rounded-3xl p-8 md:p-12 border border-teal-500/20 max-w-4xl mx-auto"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <Badge className="bg-teal-500/30 text-teal-300 border-teal-500/30 mb-4">
                  <Phone className="w-3 h-3 mr-1" />
                  Support local
                </Badge>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Un support sur votre fuseau horaire
                </h2>
                <p className="text-slate-300 mb-6">
                  Fini d'attendre minuit pour avoir une réponse. Notre équipe est disponible
                  aux heures des Antilles. On parle votre langue, on comprend vos besoins.
                </p>
                <ul className="space-y-3">
                  {[
                    "Support téléphonique local",
                    "WhatsApp pour les urgences",
                    "Réponse en moins de 2h",
                    "Le fondateur répond personnellement",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-teal-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-slate-800/50 rounded-2xl p-6 text-center">
                <div className="text-6xl mb-4">📞</div>
                <p className="text-2xl font-bold text-white mb-2">0696 XX XX XX</p>
                <p className="text-slate-400">Martinique · Guadeloupe</p>
                <p className="text-sm text-slate-500 mt-2">Lun-Ven 8h-18h (heure Antilles)</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pinel OM Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <div className="text-center mb-12">
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 mb-4">
                <Calculator className="w-3 h-3 mr-1" />
                Fiscalité outre-mer
              </Badge>
              <h2 className="text-3xl font-bold text-white mb-4">
                Pinel Outre-Mer, Girardin... On gère
              </h2>
              <p className="text-slate-400">
                Les dispositifs fiscaux DROM-COM ont leurs spécificités. Nos exports sont adaptés.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50">
                <h3 className="font-semibold text-white mb-4">✅ Ce que Talok calcule</h3>
                <ul className="space-y-2">
                  {[
                    "Réduction Pinel OM majorée (jusqu'à 32%)",
                    "Plafonds de loyers spécifiques DROM-COM",
                    "Plafonds de ressources locataires",
                    "Zones éligibles A, B1, B2",
                    "Girardin industriel et logement social",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-slate-300 text-sm">
                      <Check className="w-4 h-4 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50">
                <h3 className="font-semibold text-white mb-4">📊 Export fiscal adapté</h3>
                <ul className="space-y-2">
                  {[
                    "Déclaration 2044 spéciale outre-mer",
                    "Formulaire 2042 C - réductions d'impôt",
                    "Justificatifs éligibilité",
                    "Suivi des engagements de location",
                    "Alertes fin de dispositif",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-slate-300 text-sm">
                      <Check className="w-4 h-4 text-teal-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Ils nous font confiance aux Antilles
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {TESTIMONIALS.map((testimonial, index) => (
              <motion.div
                key={testimonial.author}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50"
              >
                <blockquote className="text-slate-300 mb-4">
                  "{testimonial.quote}"
                </blockquote>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center">
                    <span className="text-teal-400 font-semibold">{testimonial.author[0]}</span>
                  </div>
                  <div>
                    <div className="font-medium text-white">{testimonial.author}</div>
                    <div className="text-sm text-slate-400">
                      <MapPin className="w-3 h-3 inline mr-1" />
                      {testimonial.location} · {testimonial.properties}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-teal-900/50 to-cyan-900/50 rounded-3xl p-12 border border-teal-500/30"
          >
            <Heart className="w-12 h-12 text-teal-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Rejoignez +2 000 propriétaires ultramarins
            </h2>
            <p className="text-slate-300 mb-8">
              Né en Martinique. Pensé pour vos réalités.
              Essayez gratuitement pendant 14 jours.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/essai-gratuit">
                <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                  Créer mon compte gratuit
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <a href="tel:+596696000000">
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                  <Phone className="w-4 h-4 mr-2" />
                  Appelez-nous
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
