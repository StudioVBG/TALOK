import Link from "next/link";
import {
  BookOpen,
  ArrowRight,
  FileText,
  Calculator,
  Sparkles,
  Compass,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Blog",
  description:
    "Conseils, actualités et guides pratiques pour la gestion locative en France et en DROM-COM. Bientôt disponible sur Talok.",
  alternates: { canonical: "https://talok.fr/blog" },
  robots: { index: false, follow: true },
};

const UPCOMING_TOPICS = [
  {
    icon: FileText,
    title: "Rédaction de baux ALUR/ELAN",
    description: "Guides pas-à-pas pour chaque type de bail (meublé, vide, colocation, mobilité).",
  },
  {
    icon: Calculator,
    title: "Fiscalité foncière",
    description: "Déclaration 2044, régime micro-foncier, BIC, amortissement LMNP, Pinel OM.",
  },
  {
    icon: Compass,
    title: "Gestion locative DROM-COM",
    description: "Spécificités Antilles/Guyane/Réunion/Mayotte : TVA, Girardin, normes cycloniques.",
  },
  {
    icon: Sparkles,
    title: "Actualités juridiques",
    description: "Évolutions ALUR, ELAN, décrets charges, jurisprudence impayés et expulsion.",
  },
];

const POPULAR_NOW = [
  {
    title: "Outils gratuits",
    description: "4 calculateurs (rentabilité, frais de notaire, IRL, charges).",
    href: "/outils",
    cta: "Utiliser les outils",
  },
  {
    title: "Guides pratiques",
    description: "Nos guides long format pour propriétaires bailleurs.",
    href: "/guides",
    cta: "Lire les guides",
  },
  {
    title: "Calculateur d'économies",
    description: "Combien économisez-vous avec Talok vs une agence ?",
    href: "/calculateur-roi",
    cta: "Calculer",
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-24 pb-16">
      <div className="container mx-auto px-4">
        {/* Hero */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/20 border border-blue-500/30 mb-6">
            <BookOpen className="h-8 w-8 text-blue-400" />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 text-xs font-medium mb-4">
            <Bell className="w-3 h-3" />
            Bientôt disponible
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Le blog Talok arrive{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              bientôt
            </span>
          </h1>
          <p className="text-xl text-slate-400">
            On prépare des contenus approfondis pour propriétaires bailleurs :
            conseils pratiques, actualités juridiques, fiscalité, spécificités
            DROM-COM.
          </p>
        </div>

        {/* Upcoming topics */}
        <section className="max-w-5xl mx-auto mb-16">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-slate-500 mb-6">
            Au programme
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {UPCOMING_TOPICS.map((topic) => (
              <div
                key={topic.title}
                className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                  <topic.icon className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">{topic.title}</h3>
                  <p className="text-sm text-slate-400">{topic.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Already available */}
        <section className="max-w-5xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-white mb-2">
            En attendant, explorez ce qui est déjà disponible
          </h2>
          <p className="text-slate-400 mb-8">
            Talok propose déjà plusieurs ressources gratuites, sans inscription.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {POPULAR_NOW.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 hover:border-blue-500/50 transition-colors"
              >
                <h3 className="text-white font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400 mb-4">{item.description}</p>
                <div className="flex items-center text-blue-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
                  {item.cta}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto">
          <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 rounded-2xl p-8 border border-blue-500/20 text-center">
            <Sparkles className="w-10 h-10 text-blue-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-3">
              Commencez dès maintenant avec Talok
            </h2>
            <p className="text-slate-300 mb-6">
              Pendant qu&apos;on prépare le blog, vous pouvez déjà gérer votre
              premier bien gratuitement.
            </p>
            <Link href="/essai-gratuit">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                Créer mon compte gratuit
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <p className="text-xs text-slate-500 mt-4">
              Gratuit pour 1 bien · Sans carte bancaire · Sans engagement
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
