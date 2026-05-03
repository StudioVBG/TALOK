import type { Metadata } from "next";
import Link from "next/link";
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
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Solutions Talok — Une plateforme pour 7 rôles",
  description:
    "Propriétaires, investisseurs, agences, syndics, locataires, prestataires, garants : Talok adapte ses outils à chaque profil. Découvrez la solution qui vous correspond.",
  alternates: { canonical: "https://talok.fr/solutions" },
  openGraph: {
    title: "Solutions Talok — Une plateforme pour 7 rôles",
    description:
      "Une plateforme de gestion locative qui parle la langue de chacun : bailleur, locataire, syndic, artisan, garant.",
    type: "website",
    url: "https://talok.fr/solutions",
  },
};

const SOLUTIONS = [
  {
    icon: User,
    title: "Propriétaires particuliers",
    desc: "1 à 10 logements. Gérez sans agence, sans erreur juridique. À partir de 0 €.",
    href: "/solutions/proprietaires-particuliers",
    color: "from-indigo-500 to-violet-500",
    badge: "Le plus choisi",
  },
  {
    icon: Briefcase,
    title: "Investisseurs & SCI",
    desc: "Multi-biens, multi-entités. Comptabilité, fiscalité, vision patrimoniale.",
    href: "/solutions/investisseurs",
    color: "from-violet-500 to-purple-500",
    badge: "",
  },
  {
    icon: Building2,
    title: "SCI familiales",
    desc: "Comptes d’associés, quote-parts, déclaration 2072, AG. Tout pour l’expert-comptable.",
    href: "/solutions/sci-familiales",
    color: "from-purple-500 to-fuchsia-500",
    badge: "",
  },
  {
    icon: Building,
    title: "Administrateurs de biens",
    desc: "Multi-propriétaires, équipes, CRG mandant, white-label, API complète.",
    href: "/solutions/administrateurs-biens",
    color: "from-blue-500 to-cyan-500",
    badge: "Enterprise",
  },
  {
    icon: Landmark,
    title: "Syndics de copropriété",
    desc: "Bénévole ou pro. AG en ligne, appels de fonds, comptabilité copro, extranet.",
    href: "/solutions/syndics",
    color: "from-cyan-500 to-teal-500",
    badge: "",
  },
  {
    icon: Users,
    title: "Locataires & colocataires",
    desc: "Payer, signer, suivre ses droits. Gratuit pour le locataire, garants invités gratuitement.",
    href: "/solutions/locataires",
    color: "from-emerald-500 to-cyan-500",
    badge: "Gratuit",
  },
  {
    icon: Wrench,
    title: "Prestataires & artisans",
    desc: "Recevez des missions, devis & factures, planning, encaissement. Sans commission.",
    href: "/solutions/prestataires",
    color: "from-orange-500 to-amber-500",
    badge: "Gratuit",
  },
  {
    icon: ShieldCheck,
    title: "Garants",
    desc: "Acte de cautionnement clair, suivi temps réel des paiements, alertes intelligentes.",
    href: "/solutions/garants",
    color: "from-sky-500 to-blue-500",
    badge: "Gratuit",
  },
  {
    icon: Palmtree,
    title: "France d’outre-mer",
    desc: "Né en Martinique. TVA DROM, Pinel OM, Girardin, normes cycloniques natifs.",
    href: "/solutions/outre-mer",
    color: "from-pink-500 to-rose-500",
    badge: "DROM-COM",
  },
];

export default function SolutionsIndexPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 text-xs font-semibold text-indigo-300 mb-6">
              <Sparkles className="w-3 h-3" />
              7 rôles · 1 plateforme
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              La solution Talok adaptée à{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
                votre rôle
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 leading-relaxed">
              Bailleur, locataire, agence, syndic, artisan, garant : chacun a
              ses outils, ses raccourcis, son tableau de bord. Mais tout le
              monde travaille sur la même plateforme.
            </p>
          </div>
        </div>
      </section>

      {/* Solutions grid */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {SOLUTIONS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6 transition-all hover:border-slate-600 hover:bg-slate-800/50 hover:-translate-y-0.5"
              >
                {s.badge && (
                  <span className="absolute top-4 right-4 rounded-full bg-slate-900/80 border border-slate-700 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                    {s.badge}
                  </span>
                )}
                <div
                  className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${s.color} shadow-lg`}
                >
                  <s.icon className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-white mb-2">
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
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-indigo-900/40 to-violet-900/40 rounded-3xl p-10 md:p-14 border border-indigo-500/30">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Pas sûr du rôle qui vous correspond ?
            </h2>
            <p className="text-slate-300 mb-7">
              Créez votre compte, choisissez votre profil, et Talok vous
              guide. Vous pouvez changer plus tard si votre situation évolue.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors"
              >
                Créer mon compte gratuit
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Parler à l’équipe
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              1er mois offert sur les plans payants · Aucune carte bancaire requise
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
