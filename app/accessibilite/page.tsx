import Link from "next/link";
import { Accessibility, Mail, FileWarning, Scale, CheckCircle2 } from "lucide-react";

const LAST_UPDATED = "24 avril 2026";

export default function AccessibilitePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-24 pb-16">
      <div className="container mx-auto px-4">
        <article className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 text-xs font-medium mb-4">
              <Accessibility className="w-3 h-3" />
              Conforme RGAA 4.1
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Déclaration d&apos;accessibilité
            </h1>
            <p className="text-slate-400">
              Dernière mise à jour : {LAST_UPDATED}
            </p>
          </div>

          <div className="prose prose-invert prose-slate max-w-none space-y-8">
            <section>
              <p className="text-slate-300 leading-relaxed">
                Talok (édité par <strong>Explore Moi</strong>) s&apos;engage à
                rendre son site accessible conformément à l&apos;article 47 de
                la loi n° 2005-102 du 11 février 2005 pour l&apos;égalité des
                droits et des chances, la participation et la citoyenneté des
                personnes handicapées. Cette déclaration d&apos;accessibilité
                s&apos;applique au site <strong>talok.fr</strong>.
              </p>
            </section>

            {/* État de conformité */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                État de conformité
              </h2>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
                <p className="text-amber-200 font-semibold mb-2">
                  Partiellement conforme
                </p>
                <p className="text-slate-300 text-sm">
                  Talok est en <strong>partielle conformité</strong> avec le
                  référentiel général d&apos;amélioration de l&apos;accessibilité
                  (RGAA 4.1), compte tenu des non-conformités et des dérogations
                  énumérées ci-dessous. Un audit complet par un organisme
                  certifié est prévu au cours de l&apos;année.
                </p>
              </div>
            </section>

            {/* Résultats de tests */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">
                Résultats des tests
              </h2>
              <p className="text-slate-300 mb-4">
                Un premier auto-audit interne a été mené en avril 2026 sur un
                échantillon de pages couvrant les principaux parcours :
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2">
                <li>Page d&apos;accueil</li>
                <li>Page tarifs</li>
                <li>Pages fonctionnalités</li>
                <li>Pages solutions par segment</li>
                <li>Formulaire de contact</li>
                <li>Parcours d&apos;inscription</li>
              </ul>
            </section>

            {/* Contenus non accessibles */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <FileWarning className="w-6 h-6 text-amber-400" />
                Contenus non accessibles
              </h2>
              <h3 className="text-lg font-semibold text-white mt-4 mb-2">
                Non-conformités connues
              </h3>
              <ul className="list-disc list-inside text-slate-300 space-y-2">
                <li>
                  Certains contrastes de couleur sur les badges secondaires
                  peuvent être inférieurs au ratio 4,5:1 recommandé.
                </li>
                <li>
                  Certaines animations au défilement (framer-motion) ne sont pas
                  encore intégralement désactivées par la préférence{" "}
                  <code className="text-emerald-300">prefers-reduced-motion</code>.
                </li>
                <li>
                  Quelques images décoratives du site vitrine n&apos;ont pas
                  d&apos;attribut <code className="text-emerald-300">alt</code>{" "}
                  explicite.
                </li>
              </ul>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">
                Dérogations pour charge disproportionnée
              </h3>
              <p className="text-slate-300">Aucune à ce jour.</p>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">
                Contenus non soumis à l&apos;obligation d&apos;accessibilité
              </h3>
              <ul className="list-disc list-inside text-slate-300 space-y-2">
                <li>
                  Documents PDF générés par les utilisateurs (baux, quittances,
                  EDL) : ces documents reflètent des modèles juridiques fixes
                  et sont couverts par des alternatives textuelles HTML dans
                  l&apos;application.
                </li>
              </ul>
            </section>

            {/* Établissement de la déclaration */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">
                Établissement de cette déclaration
              </h2>
              <p className="text-slate-300 mb-4">
                Cette déclaration a été établie le {LAST_UPDATED}.
              </p>
              <h3 className="text-lg font-semibold text-white mt-4 mb-2">
                Technologies utilisées
              </h3>
              <ul className="list-disc list-inside text-slate-300 space-y-2">
                <li>HTML5, CSS3 (Tailwind CSS)</li>
                <li>JavaScript / TypeScript (React 18, Next.js 14)</li>
                <li>ARIA (Radix UI primitives)</li>
              </ul>

              <h3 className="text-lg font-semibold text-white mt-6 mb-2">
                Environnement de test
              </h3>
              <p className="text-slate-300 mb-2">
                Les tests ont été effectués avec les combinaisons suivantes :
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2">
                <li>Firefox 124 + NVDA 2024</li>
                <li>Chrome 124 + VoiceOver (macOS)</li>
                <li>Safari 17 + VoiceOver (iOS)</li>
              </ul>
            </section>

            {/* Retour d'information */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Mail className="w-6 h-6 text-blue-400" />
                Retour d&apos;information et contact
              </h2>
              <p className="text-slate-300 mb-4">
                Si vous n&apos;arrivez pas à accéder à un contenu ou à un
                service, vous pouvez nous contacter pour être orienté vers une
                alternative accessible ou obtenir le contenu sous une autre
                forme.
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2">
                <li>
                  Envoyez un email à{" "}
                  <a
                    href="mailto:accessibilite@talok.fr"
                    className="text-blue-400 hover:underline"
                  >
                    accessibilite@talok.fr
                  </a>
                </li>
                <li>
                  Utilisez{" "}
                  <Link href="/contact" className="text-blue-400 hover:underline">
                    le formulaire de contact
                  </Link>{" "}
                  en indiquant « accessibilité » en objet
                </li>
              </ul>
            </section>

            {/* Voie de recours */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Scale className="w-6 h-6 text-violet-400" />
                Voie de recours
              </h2>
              <p className="text-slate-300 mb-4">
                Si vous constatez un défaut d&apos;accessibilité vous empêchant
                d&apos;accéder à un contenu ou un service du portail, que vous
                nous le signalez et que vous ne parvenez pas à obtenir une
                réponse de notre part, vous êtes en droit de faire parvenir :
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2">
                <li>
                  Un signalement au{" "}
                  <a
                    href="https://www.defenseurdesdroits.fr/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    Défenseur des droits
                  </a>
                </li>
                <li>
                  Un courrier par voie postale (gratuit, ne pas affranchir) :
                  <br />
                  <span className="text-slate-400 text-sm">
                    Défenseur des droits
                    <br />
                    Libre réponse 71120
                    <br />
                    75342 Paris CEDEX 07
                  </span>
                </li>
              </ul>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
}
