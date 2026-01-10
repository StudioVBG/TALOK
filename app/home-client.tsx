"use client";

/**
 * HomeClient - Landing Page SOTA 2026
 *
 * Optimisations :
 * - Copywriting orienté conversion (framework PAS + AIDA)
 * - SEO avec données structurées JSON-LD
 * - Trust signals et témoignages
 * - FAQ avec schema
 * - Animations accessibles (reduced motion)
 * - Design moderne glassmorphism
 */

import { useMemo } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Home,
  Users,
  Wrench,
  Check,
  ArrowRight,
  Sparkles,
  Brain,
  Landmark,
  FileSignature,
  Shield,
  MapPin,
  Clock,
  Star,
  Play,
  Zap,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import { HomepageSchema } from "@/components/seo/JsonLd";
import { Testimonials } from "@/components/marketing/Testimonials";
import { TrustBar, CertificationBadges, Guarantees, SocialProofCompact } from "@/components/marketing/TrustBadges";
import { WhyChooseUs } from "@/components/marketing/WhyChooseUs";
import { FAQ } from "@/components/marketing/FAQ";
import { DemoVideoModal } from "@/components/marketing/DemoVideoModal";

// ============================================
// DATA
// ============================================

const FEATURES_BY_ROLE = [
  {
    role: "owner",
    title: "Pour les Propriétaires",
    description: "Automatisez votre gestion et gagnez 5h/mois",
    icon: Home,
    gradient: "from-indigo-400/25 via-indigo-500/10 to-transparent",
    items: [
      "Baux conformes ALUR en 10 minutes",
      "Quittances et relances automatiques",
      "Scoring IA des candidats (94% précision)",
      "Encaissement en ligne (CB, SEPA)",
    ],
  },
  {
    role: "tenant",
    title: "Pour les Locataires",
    description: "Votre espace locataire moderne",
    icon: Users,
    gradient: "from-cyan-300/30 via-cyan-400/10 to-transparent",
    items: [
      "Paiement du loyer en 2 clics",
      "Téléchargement des quittances",
      "Tickets maintenance instantanés",
      "Chat direct avec le propriétaire",
    ],
  },
  {
    role: "provider",
    title: "Pour les Prestataires",
    description: "Gérez vos interventions sereinement",
    icon: Wrench,
    gradient: "from-emerald-300/30 via-emerald-400/10 to-transparent",
    items: [
      "Planning des interventions",
      "Devis et facturation intégrés",
      "Suivi des travaux en temps réel",
      "Historique complet par bien",
    ],
  },
];

const KEY_FEATURES = [
  {
    icon: Brain,
    title: "Scoring IA Locataire",
    description: "Analysez la solvabilité avec 94% de précision. Évitez les impayés.",
    badge: "Exclusif",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    icon: Landmark,
    title: "Open Banking",
    description: "Synchronisation bancaire automatique. Voyez vos loyers en temps réel.",
    badge: "Unique",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: FileSignature,
    title: "E-Signature Légale",
    description: "Signatures électroniques eIDAS. Valeur juridique garantie.",
    badge: "Certifié",
    gradient: "from-blue-500 to-indigo-500",
  },
  {
    icon: MapPin,
    title: "Support DROM",
    description: "Martinique, Guadeloupe, Réunion... Le seul logiciel qui vous couvre.",
    badge: "Exclusif",
    gradient: "from-amber-500 to-orange-500",
  },
];

const INCLUDED_EVERYWHERE = [
  "Quittances automatiques",
  "Baux conformes loi ALUR",
  "Révision IRL automatique",
  "Relances impayés",
  "Export comptable",
  "EDL numériques",
  "Multi-utilisateurs",
  "Support français",
];

// ============================================
// HERO SECTION
// ============================================

function HeroSection({ motionEnabled }: { motionEnabled: boolean }) {
  return (
    <section className="relative pt-8 pb-16 md:pt-16 md:pb-24">
      <div className="mx-auto max-w-5xl text-center">
        {/* Badge annonce */}
        <motion.div
          initial={motionEnabled ? { opacity: 0, y: 20 } : undefined}
          animate={motionEnabled ? { opacity: 1, y: 0 } : undefined}
          transition={motionEnabled ? { delay: 0.1 } : undefined}
          className="mb-6"
        >
          <Link href="/pricing">
            <Badge className="bg-gradient-to-r from-violet-500/20 to-indigo-500/20 text-violet-300 border-violet-500/30 px-4 py-2 text-sm hover:bg-violet-500/30 transition-colors cursor-pointer">
              <Sparkles className="w-4 h-4 mr-2" />
              Nouveau : Scoring IA locataire — 94% de précision
              <ArrowRight className="w-4 h-4 ml-2" />
            </Badge>
          </Link>
        </motion.div>

        {/* H1 - Headline principal optimisé SEO */}
        <motion.h1
          initial={motionEnabled ? { opacity: 0, y: 20 } : undefined}
          animate={motionEnabled ? { opacity: 1, y: 0 } : undefined}
          transition={motionEnabled ? { delay: 0.2 } : undefined}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
        >
          <span className="text-white">Gérez vos locations</span>
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
            comme un pro.
          </span>
        </motion.h1>

        {/* Sous-titre avec USP */}
        <motion.p
          initial={motionEnabled ? { opacity: 0, y: 20 } : undefined}
          animate={motionEnabled ? { opacity: 1, y: 0 } : undefined}
          transition={motionEnabled ? { delay: 0.3 } : undefined}
          className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto mb-8 leading-relaxed"
        >
          La seule plateforme qui combine{" "}
          <span className="text-white font-medium">Open Banking</span>,{" "}
          <span className="text-white font-medium">scoring IA</span> et{" "}
          <span className="text-white font-medium">support DROM</span>.
          <br className="hidden sm:block" />
          Rejoignez +10 000 propriétaires qui gagnent 5h/mois.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={motionEnabled ? { opacity: 0, y: 20 } : undefined}
          animate={motionEnabled ? { opacity: 1, y: 0 } : undefined}
          transition={motionEnabled ? { delay: 0.4 } : undefined}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
        >
          <Link href="/signup/role">
            <Button
              size="lg"
              className="h-14 px-8 text-lg font-semibold bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-300"
            >
              Créer mon 1er bail gratuitement
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <DemoVideoModal />
        </motion.div>

        {/* Social proof compact */}
        <motion.div
          initial={motionEnabled ? { opacity: 0 } : undefined}
          animate={motionEnabled ? { opacity: 1 } : undefined}
          transition={motionEnabled ? { delay: 0.5 } : undefined}
        >
          <SocialProofCompact />
        </motion.div>
      </div>
    </section>
  );
}

// ============================================
// KEY FEATURES SECTION
// ============================================

function KeyFeaturesSection({ motionEnabled }: { motionEnabled: boolean }) {
  return (
    <section className="py-16 md:py-20">
      <div className="text-center mb-12">
        <motion.div
          initial={motionEnabled ? { opacity: 0, y: 20 } : undefined}
          whileInView={motionEnabled ? { opacity: 1, y: 0 } : undefined}
          viewport={{ once: true }}
        >
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 mb-4">
            <Zap className="w-3 h-3 mr-1" />
            4 avantages uniques
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ce qui nous rend{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              différents
            </span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Après analyse de 15 concurrents, voici pourquoi Talok est le choix n°1
            des propriétaires exigeants.
          </p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {KEY_FEATURES.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={motionEnabled ? { opacity: 0, y: 20 } : undefined}
            whileInView={motionEnabled ? { opacity: 1, y: 0 } : undefined}
            viewport={{ once: true }}
            transition={motionEnabled ? { delay: index * 0.1 } : undefined}
            whileHover={motionEnabled ? { y: -4 } : undefined}
            className="relative p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50 hover:border-slate-600 transition-all duration-300 group"
          >
            {/* Badge */}
            <div className="absolute -top-2.5 right-4">
              <Badge
                className={`border-0 text-white text-xs font-bold bg-gradient-to-r ${feature.gradient}`}
              >
                {feature.badge}
              </Badge>
            </div>

            {/* Icon */}
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br ${feature.gradient} text-white group-hover:scale-110 transition-transform duration-300`}
            >
              <feature.icon className="w-6 h-6" />
            </div>

            {/* Content */}
            <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ============================================
// FEATURES BY ROLE SECTION
// ============================================

function FeaturesByRoleSection({ motionEnabled }: { motionEnabled: boolean }) {
  return (
    <section className="py-16 md:py-20">
      <div className="text-center mb-12">
        <motion.div
          initial={motionEnabled ? { opacity: 0, y: 20 } : undefined}
          whileInView={motionEnabled ? { opacity: 1, y: 0 } : undefined}
          viewport={{ once: true }}
        >
          <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 mb-4">
            <Users className="w-3 h-3 mr-1" />
            Pour chaque utilisateur
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Une plateforme,{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              trois portails
            </span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Propriétaires, locataires et prestataires ont chacun leur espace dédié.
            Tout le monde y gagne.
          </p>
        </motion.div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {FEATURES_BY_ROLE.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.role}
              initial={motionEnabled ? { opacity: 0, y: 20 } : undefined}
              whileInView={motionEnabled ? { opacity: 1, y: 0 } : undefined}
              viewport={{ once: true }}
              transition={motionEnabled ? { delay: index * 0.1 } : undefined}
              whileHover={motionEnabled ? { y: -4 } : undefined}
              className="group"
            >
              <Card className="relative h-full overflow-hidden border-white/10 bg-white/5 backdrop-blur transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-indigo-500/10">
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                />

                <CardHeader className="relative">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur transition-all duration-300 group-hover:bg-white/20 group-hover:scale-110">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl text-white">
                    {feature.title}
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    {feature.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="relative">
                  <ul className="space-y-3 text-sm">
                    {feature.items.map((item, itemIndex) => (
                      <li
                        key={itemIndex}
                        className="flex items-start gap-2 text-slate-200"
                      >
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================
// INCLUDED FEATURES SECTION
// ============================================

function IncludedFeaturesSection({ motionEnabled }: { motionEnabled: boolean }) {
  return (
    <section className="py-12 md:py-16">
      <motion.div
        initial={motionEnabled ? { opacity: 0, y: 20 } : undefined}
        whileInView={motionEnabled ? { opacity: 1, y: 0 } : undefined}
        viewport={{ once: true }}
        className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-3xl border border-slate-700/50 p-8 md:p-12"
      >
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-white mb-2">
            Inclus dans tous les forfaits
          </h3>
          <p className="text-slate-400">
            Même le plan gratuit inclut l'essentiel pour bien démarrer.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {INCLUDED_EVERYWHERE.map((feature, index) => (
            <motion.div
              key={feature}
              initial={motionEnabled ? { opacity: 0 } : undefined}
              whileInView={motionEnabled ? { opacity: 1 } : undefined}
              viewport={{ once: true }}
              transition={motionEnabled ? { delay: index * 0.05 } : undefined}
              className="flex items-center gap-2"
            >
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-slate-300 text-sm">{feature}</span>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link href="/pricing">
            <Button
              variant="outline"
              className="border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10"
            >
              Voir tous les tarifs
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

// ============================================
// CTA SECTION
// ============================================

function CTASection({ motionEnabled }: { motionEnabled: boolean }) {
  return (
    <section className="py-16 md:py-24">
      <motion.div
        initial={motionEnabled ? { opacity: 0, y: 20 } : undefined}
        whileInView={motionEnabled ? { opacity: 1, y: 0 } : undefined}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-cyan-600 p-8 md:p-16 text-center"
      >
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>

        <div className="relative">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            Prêt à simplifier votre gestion locative ?
          </h2>
          <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
            Rejoignez +10 000 propriétaires qui gagnent du temps et de l'argent
            avec Talok. Premier mois offert, sans engagement.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup/role">
              <Button
                size="lg"
                className="h-14 px-8 text-lg font-semibold bg-white text-indigo-600 hover:bg-slate-100 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Démarrer gratuitement
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-8 text-lg font-semibold border-white/30 text-white hover:bg-white/10 transition-all duration-300"
              >
                Voir les tarifs
              </Button>
            </Link>
          </div>

          <p className="mt-6 text-sm text-white/60">
            1er mois offert · Sans engagement · Support français 24h
          </p>
        </div>
      </motion.div>
    </section>
  );
}

// ============================================
// FOOTER
// ============================================

function Footer({ motionEnabled }: { motionEnabled: boolean }) {
  return (
    <footer className="py-12 border-t border-slate-800">
      <motion.div
        initial={motionEnabled ? { opacity: 0 } : undefined}
        whileInView={motionEnabled ? { opacity: 1 } : undefined}
        viewport={{ once: true }}
        className="flex flex-col items-center gap-6"
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">Talok</span>
        </div>

        {/* Links */}
        <div className="flex flex-wrap justify-center gap-6 text-sm">
          <Link href="/pricing" className="text-slate-400 hover:text-white transition-colors">
            Tarifs
          </Link>
          <Link href="/features" className="text-slate-400 hover:text-white transition-colors">
            Fonctionnalités
          </Link>
          <Link href="/blog" className="text-slate-400 hover:text-white transition-colors">
            Blog
          </Link>
          <Link href="/legal/privacy" className="text-slate-400 hover:text-white transition-colors">
            Confidentialité
          </Link>
          <Link href="/legal/terms" className="text-slate-400 hover:text-white transition-colors">
            CGU
          </Link>
        </div>

        {/* Contact */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>Besoin d'aide ?</span>
          <a
            href="mailto:support@talok.fr"
            className="text-white hover:underline"
          >
            support@talok.fr
          </a>
        </div>

        {/* Copyright */}
        <p className="text-xs text-slate-500">
          © 2026 Talok. Tous droits réservés. Fait avec passion en France.
        </p>
      </motion.div>
    </footer>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function HomeClient() {
  const prefersReducedMotion = useReducedMotion();
  const motionEnabled = !prefersReducedMotion;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* Schema.org JSON-LD pour SEO */}
      <HomepageSchema />

      {/* Animated background gradients */}
      <div className="absolute inset-0 opacity-60 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(99,102,241,0.2),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center_right,_rgba(16,185,129,0.1),_transparent_50%)]" />
      </div>

      {/* Content */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <HeroSection motionEnabled={motionEnabled} />

        {/* Trust Bar */}
        <TrustBar />

        {/* Key Features (4 avantages uniques) */}
        <KeyFeaturesSection motionEnabled={motionEnabled} />

        {/* Features by Role */}
        <FeaturesByRoleSection motionEnabled={motionEnabled} />

        {/* Included Features */}
        <IncludedFeaturesSection motionEnabled={motionEnabled} />

        {/* Certifications */}
        <CertificationBadges />

        {/* Testimonials */}
        <Testimonials maxItems={3} />

        {/* Why Choose Us (comparaison concurrence) */}
        <WhyChooseUs variant="compact" />

        {/* FAQ avec Schema JSON-LD */}
        <FAQ maxItems={6} showCategories={false} />

        {/* CTA Final */}
        <CTASection motionEnabled={motionEnabled} />

        {/* Guarantees */}
        <Guarantees />

        {/* Footer */}
        <Footer motionEnabled={motionEnabled} />
      </div>
    </div>
  );
}
