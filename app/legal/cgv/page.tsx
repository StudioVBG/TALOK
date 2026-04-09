import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Conditions Générales de Vente — Talok",
  description:
    "Conditions générales de vente des abonnements et services Talok — Tarifs, paiement, résiliation.",
};

export default function CGVPage() {
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
            <CardTitle className="text-3xl">
              Conditions Générales de Vente
            </CardTitle>
            <p className="text-muted-foreground">
              Dernière mise à jour : 28 mars 2026
            </p>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h2>1. Objet</h2>
            <p>
              Les présentes Conditions Générales de Vente (ci-après
              &quot;CGV&quot;) définissent les conditions dans lesquelles la
              société éditrice de la plateforme Talok (ci-après &quot;le
              Prestataire&quot;) fournit ses services de gestion locative en
              ligne (ci-après &quot;les Services&quot;) au client (ci-après
              &quot;le Client&quot;).
            </p>
            <p>
              Toute souscription à un abonnement payant implique
              l&apos;acceptation sans réserve des présentes CGV.
            </p>

            <h2>2. Services proposés</h2>
            <p>Le Prestataire propose les offres suivantes :</p>
            <ul>
              <li>
                <strong>Gratuit :</strong> accès aux fonctionnalités de base
                (gestion de 1 bien, 1 utilisateur, 500 Mo de stockage)
              </li>
              <li>
                <strong>Starter :</strong> fonctionnalités essentielles
                (3 biens, 1 utilisateur, 2 Go de stockage, paiements en ligne)
              </li>
              <li>
                <strong>Confort :</strong> fonctionnalités avancées (10 biens, 3
                utilisateurs, 2 signatures électroniques/mois, 15 Go de
                stockage, collecte automatique des loyers, comptabilité et
                export FEC)
              </li>
              <li>
                <strong>Pro :</strong> fonctionnalités complètes (50 biens,
                utilisateurs illimités, 10 signatures/mois, 200 Go de
                stockage, agent IA, accès API)
              </li>
              <li>
                <strong>Enterprise (S/M/L/XL) :</strong> offre sur mesure pour
                les grands parcs immobiliers et agences (50 à 500+ biens,
                white-label, support dédié)
              </li>
            </ul>
            <p>
              Le détail complet des fonctionnalités incluses dans chaque offre
              est disponible sur la{" "}
              <Link
                href="/pricing"
                className="text-primary hover:underline"
              >
                page Tarifs
              </Link>{" "}
              de la plateforme.
            </p>

            <h2>3. Tarifs</h2>
            <p>Les tarifs en vigueur sont les suivants (hors taxes) :</p>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Offre</th>
                    <th>Prix mensuel HT</th>
                    <th>Prix annuel HT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Gratuit</td>
                    <td>0 €</td>
                    <td>0 €</td>
                  </tr>
                  <tr>
                    <td>Starter</td>
                    <td>9 €/mois</td>
                    <td>90 €/an (soit 7,50 €/mois)</td>
                  </tr>
                  <tr>
                    <td>Confort</td>
                    <td>35 €/mois</td>
                    <td>336 €/an (soit 28 €/mois)</td>
                  </tr>
                  <tr>
                    <td>Pro</td>
                    <td>69 €/mois</td>
                    <td>662,40 €/an (soit 55,20 €/mois)</td>
                  </tr>
                  <tr>
                    <td>Enterprise S</td>
                    <td>249 €/mois</td>
                    <td>2 390,40 €/an (soit 199,20 €/mois)</td>
                  </tr>
                  <tr>
                    <td>Enterprise M</td>
                    <td>349 €/mois</td>
                    <td>3 350,40 €/an (soit 279,20 €/mois)</td>
                  </tr>
                  <tr>
                    <td>Enterprise L</td>
                    <td>499 €/mois</td>
                    <td>4 790,40 €/an (soit 399,20 €/mois)</td>
                  </tr>
                  <tr>
                    <td>Enterprise XL</td>
                    <td>799 €/mois</td>
                    <td>7 670,40 €/an (soit 639,20 €/mois)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Les prix sont indiqués hors taxes. La TVA applicable dépend du
              territoire du Client :
            </p>
            <ul>
              <li>France métropolitaine : 20 %</li>
              <li>Martinique, Guadeloupe, Réunion : 8,5 %</li>
              <li>Guyane : 2,1 %</li>
              <li>Mayotte : 0 %</li>
            </ul>
            <p>
              L&apos;abonnement annuel bénéficie d&apos;une réduction de 20 %
              par rapport au tarif mensuel.
            </p>
            <p>
              Le Prestataire se réserve le droit de modifier ses tarifs.
              Conformément à l&apos;article L. 215-1 du Code de la
              consommation, tout changement de tarif sera notifié au Client au
              moins 30 jours avant son application. Les nouveaux tarifs
              s&apos;appliquent au prochain renouvellement.
            </p>

            <h2>4. Commission sur la collecte de loyers</h2>
            <p>
              Les offres Confort et Pro incluent la collecte automatique des
              loyers par prélèvement SEPA. Une commission est prélevée sur
              chaque loyer collecté :
            </p>
            <ul>
              <li>
                <strong>Confort :</strong> 2,5 % du montant du loyer
              </li>
              <li>
                <strong>Pro :</strong> 1,5 % du montant du loyer
              </li>
              <li>
                <strong>Enterprise :</strong> 1,5 % (négociable)
              </li>
            </ul>
            <p>
              Le montant net (loyer moins commission) est reversé au
              propriétaire dans un délai standard de 5 à 7 jours ouvrés.
            </p>

            <h2>5. Commande et paiement</h2>
            <p>
              La souscription à un abonnement payant s&apos;effectue en ligne
              sur la plateforme. Le Client choisit son offre, renseigne ses
              informations de facturation et procède au paiement.
            </p>
            <p>Les moyens de paiement acceptés sont :</p>
            <ul>
              <li>Carte bancaire (Visa, Mastercard)</li>
              <li>Prélèvement SEPA</li>
            </ul>
            <p>
              La souscription est effective dès la confirmation du paiement. Une
              facture est émise et mise à disposition dans l&apos;espace client.
            </p>

            <h2>6. Essai gratuit</h2>
            <p>
              Les offres payantes bénéficient d&apos;un essai gratuit de 7 jours
              sans engagement et sans carte bancaire. À l&apos;issue de
              l&apos;essai, le Client peut choisir de souscrire à
              l&apos;abonnement ou de revenir à l&apos;offre Gratuite.
            </p>

            <h2>7. Droit de rétractation</h2>
            <p>
              Conformément aux articles L. 221-18 et suivants du Code de la
              consommation, le Client consommateur dispose d&apos;un délai de{" "}
              <strong>quatorze (14) jours</strong> à compter de la souscription
              pour exercer son droit de rétractation, sans avoir à justifier de
              motifs ni à payer de pénalités.
            </p>
            <p>
              Pour exercer ce droit, adressez votre demande par email à{" "}
              <a
                href="mailto:support@talok.fr"
                className="text-primary hover:underline"
              >
                support@talok.fr
              </a>
              . Le remboursement sera effectué dans les 14 jours suivant la
              réception de la demande, par le même moyen de paiement que celui
              utilisé pour la souscription.
            </p>
            <p>
              <strong>Exception :</strong> si le Client a expressément consenti
              à l&apos;exécution complète du service avant la fin du délai de
              rétractation et a reconnu perdre son droit de rétractation
              (article L. 221-28 du Code de la consommation), le droit de
              rétractation ne s&apos;applique pas.
            </p>

            <h2>8. Durée et renouvellement</h2>
            <p>
              Les abonnements sont souscrits pour une durée d&apos;un mois ou
              d&apos;un an selon l&apos;option choisie. Ils sont renouvelés
              tacitement à l&apos;issue de chaque période, sauf résiliation par
              le Client avant la date de renouvellement.
            </p>

            <h2>9. Résiliation</h2>
            <p>
              Le Client peut résilier son abonnement à tout moment depuis les
              paramètres de son espace client. La résiliation prend effet à la
              fin de la période en cours. Les données du Client sont conservées
              pendant 90 jours après la résiliation, puis supprimées
              définitivement.
            </p>
            <p>
              En cas de résiliation dans les 14 jours suivant la souscription,
              un remboursement au prorata est effectué conformément au droit de
              rétractation.
            </p>

            <h2>10. Obligations du Prestataire</h2>
            <p>
              Le Prestataire s&apos;engage à fournir les Services conformément à
              la description de l&apos;offre souscrite. Il s&apos;agit
              d&apos;une <strong>obligation de moyens</strong>, et non de
              résultat. Le Prestataire s&apos;efforce d&apos;assurer la
              disponibilité de la plateforme (hors maintenance programmée).
            </p>
            <p>
              <strong>
                Talok n&apos;est pas un cabinet juridique, fiscal ou comptable.
              </strong>{" "}
              Les documents générés et les informations fournies ne se
              substituent pas aux conseils d&apos;un professionnel qualifié.
            </p>

            <h2>11. Limitation de responsabilité</h2>
            <p>
              La responsabilité du Prestataire est limitée au montant des sommes
              versées par le Client au cours des{" "}
              <strong>douze (12) derniers mois</strong>. Le Prestataire ne
              saurait être tenu responsable des dommages indirects, pertes de
              données, manque à gagner ou préjudice d&apos;image.
            </p>

            <h2>12. Force majeure</h2>
            <p>
              Aucune des parties ne pourra être tenue responsable d&apos;un
              manquement à ses obligations résultant d&apos;un cas de force
              majeure au sens de l&apos;article 1218 du Code civil (catastrophe
              naturelle, pandémie, panne Internet généralisée, cyberattaque
              majeure, etc.).
            </p>

            <h2>13. Médiation et règlement des litiges</h2>
            <p>
              En cas de différend, le Client peut recourir gratuitement à un
              médiateur de la consommation conformément aux articles L. 611-1 et
              suivants du Code de la consommation. Le Client peut également
              saisir la plateforme européenne de règlement en ligne des litiges
              :{" "}
              <a
                href="https://ec.europa.eu/consumers/odr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                https://ec.europa.eu/consumers/odr
              </a>
            </p>

            <h2>14. Droit applicable et juridiction</h2>
            <p>
              Les présentes CGV sont soumises au droit français. À défaut de
              résolution amiable ou de médiation, les tribunaux de
              Fort-de-France (Martinique) seront seuls compétents.
            </p>
            <p>
              Les présentes CGV sont complétées par les{" "}
              <Link
                href="/legal/cgu"
                className="text-primary hover:underline"
              >
                Conditions Générales d&apos;Utilisation
              </Link>{" "}
              et la{" "}
              <Link
                href="/legal/privacy"
                className="text-primary hover:underline"
              >
                Politique de Confidentialité
              </Link>
              .
            </p>

            <h2>15. Contact</h2>
            <p>
              Pour toute question relative aux présentes CGV :{" "}
              <a
                href="mailto:support@talok.fr"
                className="text-primary hover:underline"
              >
                support@talok.fr
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
