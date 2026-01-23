"use client";

/**
 * Page Témoignages
 *
 * Social proof avec témoignages clients
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Star,
  ArrowRight,
  Quote,
  MapPin,
  Building,
  Home,
  Users,
  Sparkles,
  CheckCircle,
} from "lucide-react";

const TESTIMONIALS = [
  {
    quote: "J'ai tout configuré en 10 minutes et quand j'ai eu une question, on m'a rappelé dans l'heure. Avec les autres logiciels, j'attendais des jours.",
    author: "Jean-Marc P.",
    location: "Schœlcher, Martinique",
    role: "4 appartements",
    avatar: "JM",
    rating: 5,
    highlight: "Support réactif",
  },
  {
    quote: "Enfin un logiciel qui comprend nos réalités ! Le support répond à mes heures, les documents sont adaptés au DOM-TOM.",
    author: "Corine D.",
    location: "Pointe-à-Pitre, Guadeloupe",
    role: "SCI familiale · 12 biens",
    avatar: "CD",
    rating: 5,
    highlight: "Adapté aux DOM-TOM",
  },
  {
    quote: "Avant Talok, on passait des heures à s'envoyer des Excel entre associés. Maintenant, tout le monde a accès aux mêmes informations.",
    author: "Sylvie M.",
    location: "Guadeloupe",
    role: "SCI familiale · 8 biens",
    avatar: "SM",
    rating: 5,
    highlight: "Multi-associés",
  },
  {
    quote: "Le scoring IA m'a évité un impayé sur mon dernier locataire. Le dossier semblait bon mais le score était à 45. J'ai écouté l'algorithme.",
    author: "Pierre L.",
    location: "Lyon",
    role: "Investisseur · 8 biens",
    avatar: "PL",
    rating: 5,
    highlight: "Scoring IA",
  },
  {
    quote: "J'ai économisé 2 400€/an en quittant mon agence. Et je gagne du temps car tout est automatisé.",
    author: "Marie T.",
    location: "Fort-de-France, Martinique",
    role: "2 appartements",
    avatar: "MT",
    rating: 5,
    highlight: "Économies réalisées",
  },
  {
    quote: "Les états des lieux sur mobile sont un game changer. Photos horodatées, signature sur place, PDF envoyé dans la foulée.",
    author: "Nicolas B.",
    location: "Paris",
    role: "Investisseur · 5 biens",
    avatar: "NB",
    rating: 5,
    highlight: "EDL numérique",
  },
  {
    quote: "L'export 2044 m'a sauvé des heures de travail. Tout est prêt en 2 clics, je n'ai plus qu'à reporter les chiffres.",
    author: "François D.",
    location: "Bordeaux",
    role: "SCI · 15 biens",
    avatar: "FD",
    rating: 5,
    highlight: "Export fiscal",
  },
  {
    quote: "Simple, efficace, pas de blabla. C'est exactement ce dont j'avais besoin pour mes 2 studios.",
    author: "Amandine R.",
    location: "Le Lamentin, Martinique",
    role: "2 studios",
    avatar: "AR",
    rating: 5,
    highlight: "Simplicité",
  },
  {
    quote: "Après avoir testé Rentila et BailFacile, Talok est de loin le plus complet. Et le support est incomparable.",
    author: "Thomas K.",
    location: "Nantes",
    role: "Investisseur · 6 biens",
    avatar: "TK",
    rating: 5,
    highlight: "Comparatif",
  },
];

const STATS = [
  { value: "4.8/5", label: "Note moyenne", icon: Star },
  { value: "+500", label: "Avis clients", icon: Quote },
  { value: "98%", label: "Recommandent Talok", icon: CheckCircle },
];

export default function TemoignagesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 mb-4">
              <Star className="w-3 h-3 mr-1 fill-current" />
              Témoignages clients
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ils nous font{" "}
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                confiance
              </span>
            </h1>

            <p className="text-lg text-slate-400 mb-8">
              Découvrez ce que nos clients disent de Talok.
              +10 000 propriétaires utilisent notre plateforme au quotidien.
            </p>

            {/* Stats */}
            <div className="flex flex-wrap justify-center gap-6">
              {STATS.map((stat) => (
                <div key={stat.label} className="flex items-center gap-2 bg-slate-800/30 rounded-full px-5 py-2.5">
                  <stat.icon className="w-5 h-5 text-amber-400" />
                  <span className="font-bold text-white">{stat.value}</span>
                  <span className="text-slate-400">{stat.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="columns-1 md:columns-2 lg:columns-3 gap-6 max-w-6xl mx-auto">
            {TESTIMONIALS.map((testimonial, index) => (
              <motion.div
                key={testimonial.author}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (index % 6) * 0.05 }}
                className="break-inside-avoid mb-6"
              >
                <Card className="bg-slate-800/30 border-slate-700/50 hover:border-amber-500/30 transition-colors">
                  <CardContent className="pt-6">
                    {/* Rating */}
                    <div className="flex items-center gap-1 mb-4">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 text-amber-400 fill-current" />
                      ))}
                    </div>

                    {/* Highlight Badge */}
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 mb-4">
                      {testimonial.highlight}
                    </Badge>

                    {/* Quote */}
                    <blockquote className="text-slate-300 mb-6 leading-relaxed">
                      "{testimonial.quote}"
                    </blockquote>

                    {/* Author */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <span className="text-amber-400 font-semibold text-sm">{testimonial.avatar}</span>
                      </div>
                      <div>
                        <div className="font-medium text-white">{testimonial.author}</div>
                        <div className="text-sm text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {testimonial.location}
                        </div>
                        <div className="text-xs text-slate-500">{testimonial.role}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Video Testimonials Placeholder */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Ils témoignent en vidéo
            </h2>
            <p className="text-slate-400">
              Découvrez les retours d'expérience de nos clients.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { name: "SCI familiale en Guadeloupe", duration: "2:34" },
              { name: "Investisseur à Lyon", duration: "3:12" },
              { name: "Propriétaire en Martinique", duration: "2:45" },
            ].map((video, index) => (
              <motion.div
                key={video.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="aspect-video bg-slate-800/30 rounded-2xl border border-slate-700/50 flex flex-col items-center justify-center cursor-pointer hover:border-amber-500/30 transition-colors"
              >
                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-3">
                  <div className="w-0 h-0 border-l-[12px] border-l-amber-400 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent ml-1" />
                </div>
                <p className="text-white font-medium">{video.name}</p>
                <p className="text-slate-400 text-sm">{video.duration}</p>
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-amber-900/50 to-orange-900/50 rounded-3xl p-12 border border-amber-500/30"
          >
            <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">
              Rejoignez +10 000 propriétaires satisfaits
            </h2>
            <p className="text-slate-300 mb-6">
              Essayez gratuitement pendant 14 jours. Sans carte bancaire.
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
