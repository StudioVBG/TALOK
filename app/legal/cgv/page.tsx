import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Conditions Générales de Vente - Talok",
  description: "Conditions générales de vente des services de la plateforme Talok",
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
          Retour à l'accueil
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Conditions Générales de Vente</CardTitle>
            <p className="text-muted-foreground">Dernière mise à jour : Mars 2026</p>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h2>1. Objet</h2>
            <p>
              Les présentes Conditions Générales de Vente (ci-après &quot;CGV&quot;) définissent les
              conditions dans lesquelles la société Talok (ci-après &quot;le Prestataire&quot;) fournit
              ses services de gestion locative en ligne (ci-après &quot;les Services&quot;) au client
              (ci-après &quot;le Client&quot;).
            </p>

            <h2>2. Services proposés</h2>
            <p>Le Prestataire propose les offres suivantes :</p>
            <ul>
              <li><strong>Offre Gratuite :</strong> accès aux fonctionnalités de base de la Plateforme</li>
              <li><strong>Offre Premium :</strong> accès à l&apos;ensemble des fonctionnalités avancées</li>
              <li><strong>Offre Professionnelle :</strong> fonctionnalités dédiées aux gestionnaires immobiliers</li>
            </ul>
            <p>
              Le détail des fonctionnalités incluses dans chaque offre est disponible sur la page
              de tarification de la Plateforme.
            </p>

            <h2>3. Tarifs</h2>
            <p>
              Les prix des Services sont indiqués en euros toutes taxes comprises (TTC) sur la
              Plateforme. Le Prestataire se réserve le droit de modifier ses tarifs à tout moment.
              Les nouveaux tarifs s&apos;appliquent aux nouvelles souscriptions et aux renouvellements
              suivant la notification du changement.
            </p>

            <h2>4. Commande et souscription</h2>
            <p>
              La souscription à un Service payant s&apos;effectue en ligne sur la Plateforme.
              Le Client choisit son offre, renseigne ses informations de facturation et procède
              au paiement. La souscription est effective dès la confirmation du paiement.
            </p>

            <h2>5. Modalités de paiement</h2>
            <p>Le paiement s&apos;effectue par :</p>
            <ul>
              <li>Carte bancaire (Visa, Mastercard)</li>
              <li>Prélèvement SEPA</li>
            </ul>
            <p>
              Les abonnements sont facturés mensuellement ou annuellement selon l&apos;option
              choisie par le Client. Le paiement est exigible à la date de souscription,
              puis à chaque date anniversaire.
            </p>

            <h2>6. Durée et renouvellement</h2>
            <p>
              Les abonnements sont souscrits pour une durée d&apos;un mois ou d&apos;un an selon
              l&apos;option choisie. Ils sont renouvelés tacitement à l&apos;issue de chaque période,
              sauf résiliation par le Client avant la date de renouvellement.
            </p>

            <h2>7. Droit de rétractation</h2>
            <p>
              Conformément à l&apos;article L.221-18 du Code de la consommation, le Client
              consommateur dispose d&apos;un délai de quatorze (14) jours à compter de la
              souscription pour exercer son droit de rétractation, sans avoir à justifier
              de motifs. La demande de rétractation doit être adressée par email à{" "}
              <a href="mailto:contact@talok.fr" className="text-primary hover:underline">
                contact@talok.fr
              </a>.
            </p>

            <h2>8. Résiliation</h2>
            <p>
              Le Client peut résilier son abonnement à tout moment depuis les paramètres
              de son Compte. La résiliation prend effet à la fin de la période en cours.
              Aucun remboursement au prorata ne sera effectué pour la période restante.
            </p>
            <p>
              Le Prestataire peut résilier l&apos;abonnement en cas de manquement du Client
              à ses obligations, après mise en demeure restée infructueuse pendant
              trente (30) jours.
            </p>

            <h2>9. Obligations du Prestataire</h2>
            <p>Le Prestataire s&apos;engage à :</p>
            <ul>
              <li>Fournir les Services conformément à la description de l&apos;offre souscrite</li>
              <li>Assurer la disponibilité de la Plateforme (hors maintenance programmée)</li>
              <li>Assurer la sécurité et la confidentialité des données du Client</li>
              <li>Informer le Client de toute modification substantielle des Services</li>
            </ul>

            <h2>10. Limitation de responsabilité</h2>
            <p>
              La responsabilité du Prestataire est limitée au montant des sommes versées
              par le Client au cours des douze (12) derniers mois. Le Prestataire ne saurait
              être tenu responsable des dommages indirects, pertes de données ou manque à gagner.
            </p>

            <h2>11. Facturation</h2>
            <p>
              Une facture est émise et mise à disposition du Client dans son espace personnel
              à chaque échéance de paiement. Le Client peut télécharger ses factures à tout moment.
            </p>

            <h2>12. Dispositions générales</h2>
            <p>
              Les présentes CGV sont soumises au droit français. En cas de litige, les parties
              privilégieront une résolution amiable. À défaut, les tribunaux compétents de
              Paris seront seuls compétents. Les présentes CGV sont complétées par les{" "}
              <Link href="/legal/cgu" className="text-primary hover:underline">
                Conditions Générales d&apos;Utilisation
              </Link>{" "}
              et la{" "}
              <Link href="/legal/privacy" className="text-primary hover:underline">
                Politique de Confidentialité
              </Link>.
            </p>

            <h2>13. Contact</h2>
            <p>
              Pour toute question relative aux présentes CGV, vous pouvez nous contacter à :{" "}
              <a href="mailto:legal@talok.fr" className="text-primary hover:underline">
                legal@talok.fr
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
