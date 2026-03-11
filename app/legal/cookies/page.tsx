import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Politique de Cookies - Talok",
  description: "Politique de cookies de la plateforme Talok de gestion locative",
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
          Retour à l'accueil
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Politique de Cookies</CardTitle>
            <p className="text-muted-foreground">Dernière mise à jour : Mars 2026</p>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h2>1. Qu&apos;est-ce qu&apos;un cookie ?</h2>
            <p>
              Un cookie est un petit fichier texte déposé sur votre terminal (ordinateur,
              tablette, smartphone) lors de la consultation de notre Plateforme. Il permet
              de stocker des informations relatives à votre navigation et de vous reconnaître
              lors de vos visites ultérieures.
            </p>

            <h2>2. Les cookies que nous utilisons</h2>
            <p>Notre Plateforme utilise les catégories de cookies suivantes :</p>

            <h3>2.1 Cookies strictement nécessaires</h3>
            <p>
              Ces cookies sont indispensables au fonctionnement de la Plateforme. Ils vous
              permettent de naviguer et d&apos;utiliser les fonctionnalités essentielles
              (authentification, sécurité, préférences de session). Ils ne peuvent pas être
              désactivés.
            </p>
            <ul>
              <li><strong>Session d&apos;authentification :</strong> maintien de votre connexion sécurisée</li>
              <li><strong>Préférences de sécurité :</strong> protection contre les attaques CSRF</li>
              <li><strong>Consentement cookies :</strong> mémorisation de vos choix en matière de cookies</li>
            </ul>

            <h3>2.2 Cookies de performance et analytiques</h3>
            <p>
              Ces cookies nous permettent de mesurer l&apos;audience de la Plateforme, d&apos;analyser
              les parcours de navigation et d&apos;identifier les éventuels dysfonctionnements
              afin d&apos;améliorer nos Services.
            </p>
            <ul>
              <li><strong>Analyse d&apos;audience :</strong> nombre de visiteurs, pages consultées, durée des sessions</li>
              <li><strong>Performance :</strong> temps de chargement, erreurs rencontrées</li>
            </ul>

            <h3>2.3 Cookies fonctionnels</h3>
            <p>
              Ces cookies permettent de mémoriser vos préférences (langue, affichage, paramètres)
              afin de personnaliser votre expérience sur la Plateforme.
            </p>

            <h2>3. Durée de conservation des cookies</h2>
            <p>Les cookies sont conservés pour les durées suivantes :</p>
            <ul>
              <li><strong>Cookies de session :</strong> supprimés à la fermeture du navigateur</li>
              <li><strong>Cookies persistants :</strong> conservés pour une durée maximale de 13 mois conformément aux recommandations de la CNIL</li>
            </ul>

            <h2>4. Gestion de vos préférences</h2>
            <p>
              Vous pouvez à tout moment modifier vos préférences en matière de cookies.
              Plusieurs options s&apos;offrent à vous :
            </p>
            <ul>
              <li><strong>Bandeau de consentement :</strong> lors de votre première visite, un bandeau vous permet d&apos;accepter ou de refuser les cookies non essentiels</li>
              <li><strong>Paramètres du navigateur :</strong> vous pouvez configurer votre navigateur pour accepter, refuser ou supprimer les cookies</li>
            </ul>

            <h2>5. Paramétrage du navigateur</h2>
            <p>
              Pour gérer les cookies via votre navigateur, suivez les instructions selon
              votre navigateur :
            </p>
            <ul>
              <li><strong>Chrome :</strong> Paramètres &gt; Confidentialité et sécurité &gt; Cookies</li>
              <li><strong>Firefox :</strong> Options &gt; Vie privée et sécurité &gt; Cookies</li>
              <li><strong>Safari :</strong> Préférences &gt; Confidentialité &gt; Cookies</li>
              <li><strong>Edge :</strong> Paramètres &gt; Cookies et autorisations de site</li>
            </ul>
            <p>
              La désactivation de certains cookies peut altérer votre expérience de navigation
              et limiter l&apos;accès à certaines fonctionnalités de la Plateforme.
            </p>

            <h2>6. Cookies tiers</h2>
            <p>
              Certains cookies peuvent être déposés par des services tiers intégrés à notre
              Plateforme (prestataires de paiement, outils d&apos;analyse). Ces tiers disposent
              de leurs propres politiques de confidentialité auxquelles nous vous invitons
              à vous référer.
            </p>

            <h2>7. Base légale</h2>
            <p>
              Conformément à la directive ePrivacy et aux recommandations de la CNIL, les
              cookies strictement nécessaires sont déposés sans consentement préalable.
              Pour les autres catégories, votre consentement est recueilli avant tout dépôt
              de cookies.
            </p>

            <h2>8. Mise à jour de la politique</h2>
            <p>
              La présente politique de cookies peut être modifiée à tout moment. En cas de
              changement, la date de mise à jour sera révisée en haut de cette page. Nous vous
              encourageons à consulter régulièrement cette page.
            </p>

            <h2>9. Contact</h2>
            <p>
              Pour toute question relative à notre utilisation des cookies, vous pouvez
              nous contacter à :{" "}
              <a href="mailto:privacy@talok.fr" className="text-primary hover:underline">
                privacy@talok.fr
              </a>
            </p>
            <p>
              Pour en savoir plus sur la protection de vos données, consultez notre{" "}
              <Link href="/legal/privacy" className="text-primary hover:underline">
                Politique de Confidentialité
              </Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
