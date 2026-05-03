"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  User,
  Briefcase,
  Building,
  Building2,
  Landmark,
  Users,
  Wrench,
  ShieldCheck,
  Palmtree,
  ArrowRight,
  Sparkles as SparklesIcon,
  Globe,
} from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles";
import { Button } from "@/components/ui/button";
import { useCountUp, blurUp, blurWord } from "@/components/marketing/hooks";

type Solution = {
  icon: typeof User;
  title: string;
  desc: string;
  href: string;
  iconGradient: string;
  badge?: string;
  badgeColor?: string;
};

const SOLUTIONS: Solution[] = [
  {
    icon: User,
    title: "Propriétaires particuliers",
    desc: "1 à 10 logements. Gérez sans agence, sans erreur juridique. À partir de 0 €.",
    href: "/solutions/proprietaires-particuliers",
    iconGradient: "from-indigo-400 to-violet-500",
    badge: "Le plus choisi",
    badgeColor: "bg-indigo-500/15 text-indigo-200 border-indigo-500/30",
  },
  {
    icon: Briefcase,
    title: "Investisseurs & SCI",
    desc: "Multi-biens, multi-entités. Comptabilité, fiscalité, vision patrimoniale.",
    href: "/solutions/investisseurs",
    iconGradient: "from-violet-400 to-purple-500",
  },
  {
    icon: Building2,
    title: "SCI familiales",
    desc: "Comptes d’associés, quote-parts, déclaration 2072, AG. Tout pour l’expert-comptable.",
    href: "/solutions/sci-familiales",
    iconGradient: "from-purple-400 to-fuchsia-500",
  },
  {
    icon: Building,
    title: "Administrateurs de biens",
    desc: "Multi-propriétaires, équipes, CRG mandant, white-label, API complète.",
    href: "/solutions/administrateurs-biens",
    iconGradient: "from-blue-400 to-cyan-500",
    badge: "Enterprise",
    badgeColor: "bg-blue-500/15 text-blue-200 border-blue-500/30",
  },
  {
    icon: Landmark,
    title: "Syndics de copropriété",
    desc: "Bénévole ou pro. AG en ligne, appels de fonds, comptabilité copro, extranet.",
    href: "/solutions/syndics",
    iconGradient: "from-cyan-400 to-teal-500",
  },
  {
    icon: Users,
    title: "Locataires & colocataires",
    desc: "Payer, signer, suivre ses droits. Gratuit pour le locataire, garants invités gratuitement.",
    href: "/solutions/locataires",
    iconGradient: "from-emerald-400 to-cyan-500",
    badge: "Gratuit",
    badgeColor: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  },
  {
    icon: Wrench,
    title: "Prestataires & artisans",
    desc: "Recevez des missions, devis & factures, planning, encaissement. Sans commission.",
    href: "/solutions/prestataires",
    iconGradient: "from-orange-400 to-amber-500",
    badge: "Gratuit",
    badgeColor: "bg-orange-500/15 text-orange-200 border-orange-500/30",
  },
  {
    icon: ShieldCheck,
    title: "Garants",
    desc: "Acte de cautionnement clair, suivi temps réel des paiements, alertes intelligentes.",
    href: "/solutions/garants",
    iconGradient: "from-sky-400 to-blue-500",
    badge: "Gratuit",
    badgeColor: "bg-sky-500/15 text-sky-200 border-sky-500/30",
  },
  {
    icon: Palmtree,
    title: "France d’outre-mer",
    desc: "Né en Martinique. TVA DROM, Pinel OM, Girardin, normes cycloniques natifs.",
    href: "/solutions/outre-mer",
    iconGradient: "from-pink-400 to-rose-500",
    badge: "DROM-COM",
    badgeColor: "bg-pink-500/15 text-pink-200 border-pink-500/30",
  },
];

const STATS = [
  { value: 9, suffix: " rôles", label: "Profils couverts nativement" },
  { value: 1, suffix: " plateforme", label: "Pour parler la même langue" },
  { value: 100, suffix: " %", label: "Gratuit pour locataires, garants, prestataires" },
  { value: 30, suffix: " jours", label: "1er mois offert sur les plans payants" },
];

function StatBox({
  value,
  suffix,
  label,
  delay,
}: {
  value: number;
  suffix?: string;
  label: string;
  delay: number;
}) {
  const { ref, display } = useCountUp(value, 1.4, { suffix });
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay }}
      className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 backdrop-blur-sm"
    >
      <div className="absolute -top-10 -right-10 h-20 w-20 rounded-full bg-indigo-500/10 blur-2xl" />
      <div className="text-2xl md:text-3xl font-bold text-white tabular-nums">
        <span ref={ref}>{display}</span>
      </div>
      <div className="mt-1 text-xs text-slate-400 leading-tight">{label}</div>
    </motion.div>
  );
}

export function SolutionsIndexClient() {
  const titleStart = "La solution Talok adaptée à";
  const startWords = titleStart.trim().split(" ");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-28 pb-12 overflow-hidden">
        <div className="absolute inset-0 -z-0 opacity-40">
          <Sparkles
            className="absolute inset-0"
            color="#818CF8"
            density={400}
            size={1.4}
            minSize={0.4}
            speed={0.4}
            opacity={0.7}
            opacitySpeed={2}
          />
        </div>
        <div className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 text-xs font-semibold text-indigo-200 mb-6">
                <SparklesIcon className="w-3 h-3" />
                7 rôles · 1 plateforme
              </span>
            </motion.div>

            <motion.h1
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.06 } },
              }}
              initial="hidden"
              animate="visible"
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-[1.05]"
            >
              {startWords.map((word, i) => (
                <motion.span
                  key={`${word}-${i}`}
                  variants={blurWord(0)}
                  className="mr-[0.25em] inline-block"
                >
                  {word}
                </motion.span>
              ))}
              <br className="hidden md:block" />
              <motion.span
                variants={blurUp}
                className="inline-block bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent"
              >
                votre rôle
              </motion.span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-lg md:text-xl text-slate-300 leading-relaxed"
            >
              Bailleur, locataire, agence, syndic, artisan, garant : chacun a
              ses outils, ses raccourcis, son tableau de bord. Mais tout le
              monde travaille sur la même plateforme.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="pb-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {STATS.map((s, i) => (
              <StatBox key={s.label} {...s} delay={i * 0.06} />
            ))}
          </div>
        </div>
      </section>

      {/* Solutions grid */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <motion.div
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.06 } },
            }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto"
          >
            {SOLUTIONS.map((s) => (
              <motion.div
                key={s.href}
                variants={{
                  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
                  visible: {
                    opacity: 1,
                    y: 0,
                    filter: "blur(0px)",
                    transition: { duration: 0.5 },
                  },
                }}
              >
                <Link
                  href={s.href}
                  className="group relative block overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6 transition-all hover:border-slate-600 hover:bg-slate-800/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/50"
                >
                  {s.badge && (
                    <span
                      className={`absolute top-4 right-4 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.badgeColor ?? "bg-slate-900/80 border-slate-700 text-slate-300"}`}
                    >
                      {s.badge}
                    </span>
                  )}
                  <div
                    className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${s.iconGradient} shadow-lg transition-transform group-hover:scale-110`}
                  >
                    <s.icon className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-white mb-2 leading-snug">
                    {s.title}
                  </h2>
                  <p className="text-sm text-slate-400 leading-relaxed mb-4">
                    {s.desc}
                  </p>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-indigo-300 group-hover:text-indigo-200 transition-colors">
                    Découvrir
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* SEO long-form */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto"
          >
            <div className="mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                <Globe className="inline-block w-3 h-3 mr-1 -mt-0.5" />
                Une plateforme, tous les acteurs
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
              La gestion locative, c’est un sport d’équipe
            </h2>
            <div className="space-y-4 text-base md:text-lg text-slate-300 leading-relaxed">
              <p>
                Un logement loué fait intervenir au moins quatre personnes :
                un propriétaire, un locataire, parfois un garant, et tôt ou
                tard un artisan. Si l’immeuble est en copropriété, un syndic
                s’ajoute. Si le bailleur délègue, c’est un administrateur de
                biens. La plupart des logiciels de gestion locative ne
                voient qu’un seul de ces acteurs — Talok les voit tous.
              </p>
              <p>
                Concrètement, ça veut dire que la quittance générée par le
                propriétaire est instantanément disponible dans l’espace du
                locataire et accessible au garant. Que le ticket d’incident
                signalé par le locataire arrive directement chez l’artisan
                concerné. Que les comptes du syndic sont visibles par les
                copropriétaires sans export Excel à envoyer. Tout circule
                entre les bons acteurs, au bon moment, sans friction.
              </p>
              <p>
                Pour le bailleur, c’est moins de mails et de relances. Pour
                le locataire, c’est moins de paperasse et plus de
                visibilité. Pour le prestataire, c’est plus de chantiers et
                moins d’administratif. Et pour le syndic ou l’agence, c’est
                un outil enfin pensé pour des équipes qui gèrent à plusieurs.
                Découvrez ci-dessus la solution adaptée à votre rôle.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
            className="relative overflow-hidden max-w-4xl mx-auto rounded-[2rem] border border-indigo-500/30 bg-gradient-to-br from-indigo-900/40 via-slate-900/60 to-violet-900/30 p-10 md:p-14"
          >
            <div className="absolute inset-0 opacity-40 pointer-events-none">
              <Sparkles
                className="absolute inset-0"
                color="#818CF8"
                density={300}
                size={1.2}
                speed={0.5}
                opacity={0.6}
              />
            </div>

            <div className="relative z-10 text-center">
              <SparklesIcon className="w-12 h-12 text-indigo-300 mx-auto mb-5" />
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                Pas sûr du rôle qui vous correspond ?
              </h2>
              <p className="text-slate-300 mb-8 max-w-2xl mx-auto leading-relaxed">
                Créez votre compte, choisissez votre profil, et Talok vous
                guide. Vous pouvez ajouter d’autres rôles plus tard si
                votre situation évolue.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/auth/signup">
                  <Button
                    size="lg"
                    className="bg-white text-slate-900 hover:bg-slate-100 shadow-xl shadow-black/30"
                  >
                    Créer mon compte gratuit
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white bg-slate-900/40 backdrop-blur-sm"
                  >
                    Parler à l’équipe
                  </Button>
                </Link>
              </div>
              <p className="mt-5 text-sm text-slate-400">
                1er mois offert sur les plans payants · Aucune carte bancaire requise
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
