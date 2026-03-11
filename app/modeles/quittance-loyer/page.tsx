import { Metadata } from "next";
import Link from "next/link";
import {
  Receipt,
  ArrowRight,
  CheckCircle2,
  Shield,
  Sparkles,
  ArrowLeft,
  FileText,
  Calendar,
  Scale,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Modele Quittance de Loyer Gratuit 2026 | Conforme Loi ALUR - Talok",
  description:
    "Telecharger notre modele de quittance de loyer conforme a la loi ALUR. Toutes les mentions obligatoires incluses, gratuit en PDF et Word.",
};

const SECTIONS = [
  {
    title: "Identification des parties",
    items: [
      "Nom et adresse du bailleur",
      "Nom du locataire",
      "Adresse du logement concerne",
    ],
  },
  {
    title: "Detail du paiement",
    items: [
      "Periode concernee (mois et annee)",
      "Montant du loyer hors charges",
      "Montant des charges (provision ou forfait)",
      "Montant total regle",
      "Date du paiement",
    ],
  },
  {
    title: "Mentions legales et signature",
    items: [
      "Mention de la loi du 6 juillet 1989 (article 21)",
      "Date d'emission de la quittance",
      "Signature du bailleur",
      "Mention du caractere gratuit de la delivrance",
    ],
  },
];

const AVANTAGES = [
  {
    icon: Shield,
    title: "Conforme loi ALUR",
    description:
      "Toutes les mentions obligatoires prevues par la loi du 6 juillet 1989 sont incluses dans le modele.",
  },
  {
    icon: Scale,
    title: "Obligation legale",
    description:
      "Le bailleur est tenu de delivrer une quittance a toute demande du locataire ayant paye l'integralite du loyer.",
  },
  {
    icon: Calendar,
    title: "Emission mensuelle",
    description:
      "Generez une quittance chaque mois pour garder une trace comptable propre et faciliter vos declarations.",
  },
  {
    icon: FileText,
    title: "PDF et Word",
    description:
      "Disponible en format PDF pret a envoyer ou en Word modifiable pour l'adapter a vos besoins.",
  },
];

export default function QuittanceLoyerPage() {
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
                <Receipt className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <span className="inline-block bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium px-2.5 py-0.5 rounded-full mb-1">
                  Populaire - PDF / Word
                </span>
                <h1 className="text-3xl md:text-4xl font-bold text-white">
                  Modele de Quittance de Loyer
                </h1>
              </div>
            </div>

            <p className="text-lg text-slate-400 mb-8 leading-relaxed">
              La quittance de loyer est un document que le bailleur doit
              obligatoirement remettre au locataire qui en fait la demande,
              apres paiement complet du loyer et des charges. Elle constitue une
              preuve de paiement essentielle pour le locataire.
            </p>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 bg-slate-800/30 rounded-full px-4 py-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-white">Conforme loi ALUR</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-800/30 rounded-full px-4 py-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-white">6 200 recherches/mois</span>
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
              Qu&apos;est-ce qu&apos;une quittance de loyer ?
            </h2>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 text-slate-300 space-y-4">
              <p>
                La quittance de loyer est un document ecrit par lequel le
                bailleur atteste que le locataire a bien paye son loyer et ses
                charges pour une periode donnee. C&apos;est un document{" "}
                <strong className="text-white">gratuit et obligatoire</strong>{" "}
                sur simple demande du locataire (article 21 de la loi du 6
                juillet 1989).
              </p>
              <p>
                Elle ne doit pas etre confondue avec un{" "}
                <strong className="text-white">recu de paiement</strong>, qui
                est delivre en cas de paiement partiel. La quittance n&apos;est
                emise que lorsque la totalite du loyer et des charges a ete
                reglee.
              </p>
              <p>
                La quittance de loyer est souvent demandee comme justificatif de
                domicile, pour constituer un dossier de location, ou dans le
                cadre de demarches administratives (CAF, banque, prefecture).
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
              Generez vos quittances automatiquement
            </h2>
            <p className="text-slate-300 mb-6">
              Avec Talok, les quittances de loyer sont generees et envoyees
              automatiquement chaque mois apres reception du paiement. Plus
              besoin de les creer manuellement.
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
