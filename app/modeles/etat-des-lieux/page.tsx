import { Metadata } from "next";
import Link from "next/link";
import {
  ClipboardCheck,
  ArrowRight,
  CheckCircle2,
  Shield,
  Sparkles,
  ArrowLeft,
  Home,
  Eye,
  FileText,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Modele Etat des Lieux Gratuit 2026 | Conforme Loi ALUR - Talok",
  description:
    "Telecharger notre modele d'etat des lieux d'entree et de sortie conforme au decret 2016 et a la loi ALUR. Grille complete piece par piece, gratuit en PDF.",
};

const SECTIONS = [
  {
    title: "Informations generales",
    items: [
      "Identite du bailleur et du locataire",
      "Adresse et description du logement",
      "Date d'entree ou de sortie",
      "Releve des compteurs (eau, electricite, gaz)",
    ],
  },
  {
    title: "Description piece par piece",
    items: [
      "Sols : nature, etat, observations",
      "Murs et plafonds : revetement, etat",
      "Menuiseries : portes, fenetres, volets",
      "Equipements : prises, interrupteurs, radiateurs",
      "Observations et commentaires libres",
    ],
  },
  {
    title: "Annexes et signatures",
    items: [
      "Photos et preuves visuelles",
      "Grille de vetuste applicable",
      "Cles remises (nombre et type)",
      "Signatures des deux parties",
    ],
  },
];

const AVANTAGES = [
  {
    icon: Shield,
    title: "Conforme decret 2016",
    description:
      "Respecte toutes les mentions obligatoires du decret du 30 mars 2016 relatif a l'etat des lieux.",
  },
  {
    icon: Eye,
    title: "Grille detaillee",
    description:
      "Chaque piece est detaillee element par element pour ne rien oublier lors de l'inspection.",
  },
  {
    icon: Home,
    title: "Entree et sortie",
    description:
      "Utilisable pour l'etat des lieux d'entree comme de sortie, avec comparatif integre.",
  },
  {
    icon: FileText,
    title: "Format PDF",
    description:
      "Telechargeable en PDF pret a imprimer ou a remplir numeriquement.",
  },
];

export default function EtatDesLieuxPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto">
            <Link
              href="/modeles"
              className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-emerald-400 transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Tous les modeles
            </Link>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <ClipboardCheck className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <span className="inline-block bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium px-2.5 py-0.5 rounded-full mb-1">
                  Gratuit - PDF
                </span>
                <h1 className="text-3xl md:text-4xl font-bold text-white">
                  Modele d&apos;Etat des Lieux
                </h1>
              </div>
            </div>

            <p className="text-lg text-slate-400 mb-8 leading-relaxed">
              L&apos;etat des lieux est un document essentiel qui protege le
              bailleur comme le locataire. Il decrit l&apos;etat du logement a
              l&apos;entree et a la sortie du locataire, et sert de reference en
              cas de litige sur les reparations locatives ou la restitution du
              depot de garantie.
            </p>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 bg-slate-800/30 rounded-full px-4 py-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-white">Conforme decret 2016</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-800/30 rounded-full px-4 py-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-white">Mentions obligatoires incluses</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quand utiliser */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-4">
              Quand utiliser un etat des lieux ?
            </h2>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 text-slate-300 space-y-4">
              <p>
                La realisation d&apos;un etat des lieux est{" "}
                <strong className="text-white">obligatoire</strong> a l&apos;entree
                et a la sortie de tout logement loue. Il doit etre etabli de
                maniere contradictoire entre le bailleur (ou son representant) et
                le locataire.
              </p>
              <p>
                En l&apos;absence d&apos;etat des lieux d&apos;entree, le
                locataire est presume avoir recu le logement en bon etat. A la
                sortie, l&apos;etat des lieux permet de comparer l&apos;etat
                initial et final pour determiner les eventuelles retenues sur le
                depot de garantie.
              </p>
              <p>
                Depuis le{" "}
                <strong className="text-white">decret du 30 mars 2016</strong>,
                l&apos;etat des lieux doit respecter un formalisme precis et
                contenir des mentions obligatoires. Notre modele integre toutes
                ces exigences.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Avantages */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6">
              Pourquoi utiliser notre modele ?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AVANTAGES.map((avantage) => (
                <div
                  key={avantage.title}
                  className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5 hover:border-emerald-500/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-3">
                    <avantage.icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h3 className="text-white font-semibold mb-1">
                    {avantage.title}
                  </h3>
                  <p className="text-slate-400 text-sm">{avantage.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sections du document */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6">
              Contenu du modele
            </h2>
            <div className="space-y-6">
              {SECTIONS.map((section, index) => (
                <div
                  key={section.title}
                  className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    <h3 className="text-lg font-semibold text-white">
                      {section.title}
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {section.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        <span className="text-slate-300 text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-emerald-900/50 to-teal-900/50 rounded-3xl p-12 border border-emerald-500/30">
            <Sparkles className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">
              Generez vos etats des lieux automatiquement
            </h2>
            <p className="text-slate-300 mb-6">
              Avec Talok, realisez vos etats des lieux directement sur
              smartphone ou tablette. Photos, annotations et signatures
              electroniques integrees. Le document PDF est genere
              automatiquement.
            </p>
            <Link href="/auth/signup">
              <button className="inline-flex items-center justify-center rounded-md text-sm font-medium h-11 px-8 bg-white text-slate-900 hover:bg-slate-100 transition-colors">
                Essayer gratuitement
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
