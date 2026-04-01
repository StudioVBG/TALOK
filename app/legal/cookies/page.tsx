import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Politique de Cookies — Talok",
  description:
    "Cookies utilisés par la plateforme Talok — Types, finalités, gestion de vos préférences.",
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à l&apos;accueil
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Politique de Cookies</CardTitle>
            <p className="text-muted-foreground">
              Dernière mise à jour : 28 mars 2026
            </p>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h2>1. Qu&apos;est-ce qu&apos;un cookie ?</h2>
            <p>
              Un cookie est un petit fichier texte déposé sur votre terminal
              (ordinateur, tablette, smartphone) lors de la consultation de notre
              plateforme. Il permet de stocker des informations relatives à votre
              navigation et de vous reconnaître lors de vos visites ultérieures.
            </p>

            <h2>2. Cookies utilisés par Talok</h2>
            <p>
              Notre plateforme utilise les cookies suivants, classés par
              catégorie :
            </p>

            <h3>2.1 Cookies strictement nécessaires (essentiels)</h3>
            <p>
              Ces cookies sont indispensables au fonctionnement de la plateforme.
              Ils ne peuvent pas être désactivés. Aucun consentement n&apos;est
              requis pour ces cookies (directive ePrivacy).
            </p>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Cookie</th>
                    <th>Finalité</th>
                    <th>Durée</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <code>sb-*</code> (Supabase)
                    </td>
                    <td>
                      Authentification et session utilisateur sécurisée
                    </td>
                    <td>Session / 30 jours</td>
                  </tr>
                  <tr>
                    <td>
                      <code>__stripe_*</code>
                    </td>
                    <td>
                      Sécurisation des paiements et prévention de la fraude
                    </td>
                    <td>Session</td>
                  </tr>
                  <tr>
                    <td>
                      <code>cookie-consent</code>
                    </td>
                    <td>
                      Mémorisation de vos choix en matière de cookies
                    </td>
                    <td>13 mois</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>2.2 Cookies analytiques (mesure d&apos;audience)</h3>
            <p>
              Ces cookies nous permettent de mesurer l&apos;audience, analyser
              les parcours de navigation et identifier les dysfonctionnements
              afin d&apos;améliorer nos services.{" "}
              <strong>
                Ils ne sont déposés qu&apos;avec votre consentement.
              </strong>
            </p>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Cookie</th>
                    <th>Finalité</th>
                    <th>Durée</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <code>ph_*</code> (PostHog)
                    </td>
                    <td>
                      Analyse d&apos;audience : pages consultées, durée des
                      sessions, parcours utilisateur
                    </td>
                    <td>13 mois maximum</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>2.3 Cookies fonctionnels</h3>
            <p>
              Ces cookies permettent de mémoriser vos préférences (thème
              d&apos;affichage, langue, paramètres) pour personnaliser votre
              expérience.
            </p>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Cookie</th>
                    <th>Finalité</th>
                    <th>Durée</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <code>theme</code>
                    </td>
                    <td>
                      Préférence de thème (clair/sombre)
                    </td>
                    <td>1 an</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2>3. Durée de conservation</h2>
            <ul>
              <li>
                <strong>Cookies de session :</strong> supprimés à la fermeture
                du navigateur
              </li>
              <li>
                <strong>Cookies persistants :</strong> conservés pour une durée
                maximale de <strong>13 mois</strong> conformément aux
                recommandations de la CNIL
              </li>
            </ul>

            <h2>4. Gestion de vos préférences</h2>
            <p>
              Vous pouvez à tout moment modifier vos préférences en matière de
              cookies :
            </p>
            <ul>
              <li>
                <strong>Bandeau de consentement :</strong> lors de votre
                première visite, un bandeau vous permet d&apos;accepter ou de
                refuser les cookies non essentiels. Vous pouvez modifier ce
                choix à tout moment.
              </li>
              <li>
                <strong>Paramètres du navigateur :</strong> vous pouvez
                configurer votre navigateur pour accepter, refuser ou supprimer
                les cookies.
              </li>
            </ul>

            <h2>5. Paramétrage par navigateur</h2>
            <ul>
              <li>
                <strong>Chrome :</strong> Paramètres &gt; Confidentialité et
                sécurité &gt; Cookies et autres données de sites
              </li>
              <li>
                <strong>Firefox :</strong> Paramètres &gt; Vie privée et
                sécurité &gt; Cookies et données de sites
              </li>
              <li>
                <strong>Safari :</strong> Préférences &gt; Confidentialité &gt;
                Gestion des données de site web
              </li>
              <li>
                <strong>Edge :</strong> Paramètres &gt; Cookies et autorisations
                de site
              </li>
            </ul>
            <p>
              La désactivation de certains cookies peut altérer votre expérience
              de navigation et limiter l&apos;accès à certaines fonctionnalités.
            </p>

            <h2>6. Cookies tiers</h2>
            <p>
              Certains cookies sont déposés par des services tiers intégrés à
              notre plateforme :
            </p>
            <ul>
              <li>
                <strong>Stripe</strong> — pour la sécurisation des paiements
                (politique :{" "}
                <a
                  href="https://stripe.com/fr/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  stripe.com/fr/privacy
                </a>
                )
              </li>
              <li>
                <strong>PostHog</strong> — pour l&apos;analyse d&apos;audience
                (hébergé en UE, politique :{" "}
                <a
                  href="https://posthog.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  posthog.com/privacy
                </a>
                )
              </li>
            </ul>

            <h2>7. Base légale</h2>
            <p>
              Conformément à la directive ePrivacy (2002/58/CE) et aux
              recommandations de la CNIL (délibération n° 2020-091 du 17
              septembre 2020), les cookies strictement nécessaires sont déposés
              sans consentement préalable. Pour toutes les autres catégories,
              votre consentement explicite est recueilli avant tout dépôt.
            </p>

            <h2>8. Mise à jour</h2>
            <p>
              La présente politique peut être modifiée à tout moment. La date de
              mise à jour est indiquée en haut de cette page.
            </p>

            <h2>9. Contact</h2>
            <p>
              Pour toute question relative aux cookies :{" "}
              <a
                href="mailto:dpo@talok.fr"
                className="text-primary hover:underline"
              >
                dpo@talok.fr
              </a>
            </p>
            <p>
              Pour en savoir plus sur la protection de vos données, consultez
              notre{" "}
              <Link
                href="/legal/privacy"
                className="text-primary hover:underline"
              >
                Politique de Confidentialité
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
