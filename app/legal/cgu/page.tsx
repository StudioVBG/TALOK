import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Conditions Générales d'Utilisation — Talok",
  description:
    "Conditions générales d'utilisation de la plateforme Talok de gestion locative.",
};

export default function CGUPage() {
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
              Conditions Générales d&apos;Utilisation
            </CardTitle>
            <p className="text-muted-foreground">
              Dernière mise à jour : 28 mars 2026
            </p>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h2>1. Objet</h2>
            <p>
              Les présentes Conditions Générales d&apos;Utilisation (ci-après
              &quot;CGU&quot;) ont pour objet de définir les modalités et
              conditions dans lesquelles la plateforme Talok (ci-après &quot;la
              Plateforme&quot;) est mise à disposition des utilisateurs.
            </p>
            <p>
              Talok est une plateforme SaaS (Software as a Service) de gestion
              locative tout-en-un permettant la gestion de biens immobiliers,
              de baux, de loyers, de documents, de signatures électroniques,
              d&apos;états des lieux, de comptabilité locative et de
              communication entre les parties.
            </p>

            <h2>2. Définitions</h2>
            <ul>
              <li>
                <strong>Utilisateur :</strong> toute personne physique ou morale
                accédant à la Plateforme, quel que soit son rôle
              </li>
              <li>
                <strong>Propriétaire :</strong> utilisateur inscrit en qualité de
                bailleur (particulier, SCI, SARL, SAS)
              </li>
              <li>
                <strong>Locataire :</strong> utilisateur inscrit en qualité de
                preneur à bail
              </li>
              <li>
                <strong>Garant :</strong> utilisateur inscrit en qualité de
                caution d&apos;un locataire
              </li>
              <li>
                <strong>Prestataire :</strong> artisan ou entreprise
                d&apos;intervention inscrit sur la Plateforme
              </li>
              <li>
                <strong>Agence :</strong> administrateur de biens ou agence
                immobilière
              </li>
              <li>
                <strong>Syndic :</strong> syndic de copropriété
              </li>
              <li>
                <strong>Compte :</strong> espace personnel créé lors de
                l&apos;inscription sur la Plateforme
              </li>
              <li>
                <strong>Services :</strong> ensemble des fonctionnalités
                proposées par la Plateforme selon le plan souscrit
              </li>
            </ul>

            <h2>3. Acceptation des CGU</h2>
            <p>
              L&apos;accès et l&apos;utilisation de la Plateforme sont
              subordonnés à l&apos;acceptation et au respect des présentes CGU.
              En créant un Compte ou en utilisant la Plateforme,
              l&apos;Utilisateur reconnaît avoir pris connaissance des CGU et les
              accepter sans réserve.
            </p>

            <h2>4. Inscription et compte utilisateur</h2>
            <p>
              L&apos;accès aux Services nécessite la création d&apos;un Compte.
              L&apos;Utilisateur s&apos;engage à fournir des informations
              exactes, complètes et à jour lors de son inscription. Il est seul
              responsable de la préservation de la confidentialité de ses
              identifiants de connexion et de toute activité effectuée depuis
              son Compte.
            </p>
            <p>
              Un seul Compte est autorisé par personne physique et par adresse
              email. L&apos;éditeur se réserve le droit de suspendre ou
              supprimer tout Compte en cas de non-respect des présentes CGU ou
              de fourniture d&apos;informations inexactes.
            </p>

            <h2>5. Description des Services</h2>
            <p>
              La Plateforme propose notamment les Services suivants, selon le
              plan souscrit :
            </p>
            <ul>
              <li>
                Gestion des biens immobiliers (création de fiches, suivi des
                caractéristiques, photos, diagnostics)
              </li>
              <li>
                Gestion des baux et des locataires (contrats conformes à la loi
                ALUR/ELAN, avenants, renouvellements)
              </li>
              <li>
                Collecte automatique des loyers par prélèvement SEPA
              </li>
              <li>
                Génération de documents légaux (quittances de loyer, avis
                d&apos;échéance, attestations)
              </li>
              <li>
                Signature électronique de documents (baux, états des lieux,
                mandats)
              </li>
              <li>
                États des lieux numériques avec photos
              </li>
              <li>
                Comptabilité locative et export FEC pour le comptable
              </li>
              <li>
                Communication entre propriétaires, locataires et prestataires
              </li>
              <li>
                Tableau de bord et reporting financier
              </li>
              <li>
                Module syndic de copropriété
              </li>
            </ul>
            <p>
              Les fonctionnalités disponibles varient selon le plan souscrit
              (Gratuit, Confort, Pro, Enterprise). Le détail est disponible sur
              la{" "}
              <Link
                href="/pricing"
                className="text-primary hover:underline"
              >
                page Tarifs
              </Link>
              .
            </p>

            <h2>6. Obligations de l&apos;Utilisateur</h2>
            <p>L&apos;Utilisateur s&apos;engage à :</p>
            <ul>
              <li>
                Utiliser la Plateforme conformément à sa destination et aux
                présentes CGU
              </li>
              <li>
                Fournir des informations exactes et les maintenir à jour
              </li>
              <li>
                Ne pas porter atteinte à la sécurité ou au bon fonctionnement de
                la Plateforme
              </li>
              <li>
                Ne pas collecter ou exploiter les données d&apos;autres
                Utilisateurs
              </li>
              <li>
                Respecter la législation en vigueur, notamment en matière de
                droit immobilier et de non-discrimination
              </li>
              <li>
                Ne pas publier de contenu illicite, diffamatoire, injurieux ou
                contraire à l&apos;ordre public
              </li>
              <li>
                Ne pas tenter de contourner les limitations du plan souscrit
              </li>
              <li>
                Ne pas procéder au reverse engineering, décompilation ou
                désassemblage de la Plateforme
              </li>
            </ul>

            <h2>7. Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble des éléments composant la Plateforme (textes,
              graphismes, logiciels, bases de données, logos, marques, etc.) sont
              protégés par les droits de propriété intellectuelle. La
              Plateforme est concédée sous licence d&apos;utilisation non
              exclusive, non transférable, limitée à la durée de
              l&apos;abonnement.
            </p>
            <p>
              Toute reproduction, représentation ou exploitation non autorisée
              est strictement interdite et constitue une contrefaçon
              sanctionnée par les articles L. 335-2 et suivants du Code de la
              propriété intellectuelle.
            </p>

            <h2>8. Données personnelles</h2>
            <p>
              Le traitement des données personnelles est régi par notre{" "}
              <Link
                href="/legal/privacy"
                className="text-primary hover:underline"
              >
                Politique de Confidentialité
              </Link>
              , qui fait partie intégrante des présentes CGU.
            </p>

            <h2>9. Responsabilité</h2>
            <p>
              L&apos;éditeur s&apos;efforce d&apos;assurer la disponibilité et
              le bon fonctionnement de la Plateforme. Toutefois, il ne saurait
              être tenu responsable en cas d&apos;interruption du service
              (maintenance programmée, panne technique), de perte de données
              résultant d&apos;un cas de force majeure, ou de dommages
              indirects.
            </p>
            <p>
              <strong>
                La Plateforme est un outil d&apos;aide à la gestion locative et
                ne se substitue pas aux obligations légales des propriétaires et
                des locataires, ni aux conseils d&apos;un professionnel du droit,
                de la fiscalité ou de la comptabilité.
              </strong>
            </p>

            <h2>10. Suspension et résiliation</h2>
            <p>
              L&apos;Utilisateur peut résilier son Compte à tout moment depuis
              les paramètres de son espace personnel. Ses données sont
              conservées 90 jours après résiliation puis supprimées
              définitivement.
            </p>
            <p>
              L&apos;éditeur se réserve le droit de suspendre ou résilier un
              Compte en cas de manquement grave aux présentes CGU, après mise en
              demeure restée infructueuse pendant 15 jours (sauf urgence).
            </p>

            <h2>11. Modification des CGU</h2>
            <p>
              L&apos;éditeur se réserve le droit de modifier les présentes CGU.
              Les Utilisateurs seront informés de toute modification
              substantielle par email ou notification sur la Plateforme{" "}
              <strong>au moins 30 jours</strong> avant l&apos;entrée en vigueur.
              La poursuite de l&apos;utilisation de la Plateforme après
              modification vaut acceptation des nouvelles CGU.
            </p>

            <h2>12. Droit applicable et juridiction</h2>
            <p>
              Les présentes CGU sont régies par le droit français. En cas de
              litige, les parties s&apos;efforceront de trouver une solution
              amiable. À défaut, les tribunaux de Fort-de-France (Martinique)
              seront seuls compétents.
            </p>

            <h2>13. Contact</h2>
            <p>
              Pour toute question relative aux présentes CGU :{" "}
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
