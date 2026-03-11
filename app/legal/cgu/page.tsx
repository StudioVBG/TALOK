import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Conditions Générales d'Utilisation - Talok",
  description: "Conditions générales d'utilisation de la plateforme Talok de gestion locative",
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
          Retour à l'accueil
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Conditions Générales d&apos;Utilisation</CardTitle>
            <p className="text-muted-foreground">Dernière mise à jour : Mars 2026</p>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h2>1. Objet</h2>
            <p>
              Les présentes Conditions Générales d&apos;Utilisation (ci-après &quot;CGU&quot;) ont pour objet
              de définir les modalités et conditions dans lesquelles la société Talok
              (ci-après &quot;l&apos;Éditeur&quot;) met à disposition sa plateforme de gestion locative
              (ci-après &quot;la Plateforme&quot;) et les services associés.
            </p>

            <h2>2. Définitions</h2>
            <ul>
              <li><strong>Utilisateur :</strong> toute personne physique ou morale accédant à la Plateforme</li>
              <li><strong>Propriétaire :</strong> utilisateur inscrit en qualité de bailleur</li>
              <li><strong>Locataire :</strong> utilisateur inscrit en qualité de preneur</li>
              <li><strong>Compte :</strong> espace personnel créé lors de l&apos;inscription sur la Plateforme</li>
              <li><strong>Services :</strong> ensemble des fonctionnalités proposées par la Plateforme</li>
            </ul>

            <h2>3. Acceptation des CGU</h2>
            <p>
              L&apos;accès et l&apos;utilisation de la Plateforme sont subordonnés à l&apos;acceptation
              et au respect des présentes CGU. En créant un compte ou en utilisant la Plateforme,
              l&apos;Utilisateur reconnaît avoir pris connaissance des CGU et les accepter sans réserve.
            </p>

            <h2>4. Inscription et compte utilisateur</h2>
            <p>
              L&apos;accès aux Services nécessite la création d&apos;un Compte. L&apos;Utilisateur s&apos;engage
              à fournir des informations exactes, complètes et à jour lors de son inscription.
              Il est seul responsable de la préservation de la confidentialité de ses identifiants
              de connexion et de toute activité effectuée depuis son Compte.
            </p>
            <p>
              L&apos;Éditeur se réserve le droit de suspendre ou supprimer tout Compte en cas de
              non-respect des présentes CGU ou de fourniture d&apos;informations inexactes.
            </p>

            <h2>5. Description des Services</h2>
            <p>La Plateforme propose notamment les Services suivants :</p>
            <ul>
              <li>Gestion des biens immobiliers (création de fiches, suivi des caractéristiques)</li>
              <li>Gestion des baux et des locataires</li>
              <li>Suivi des loyers et des paiements</li>
              <li>Génération de documents légaux (quittances, avis d&apos;échéance)</li>
              <li>Communication entre propriétaires et locataires</li>
              <li>Tableau de bord et reporting financier</li>
            </ul>

            <h2>6. Obligations de l&apos;Utilisateur</h2>
            <p>L&apos;Utilisateur s&apos;engage à :</p>
            <ul>
              <li>Utiliser la Plateforme conformément à sa destination et aux présentes CGU</li>
              <li>Ne pas porter atteinte à la sécurité ou au bon fonctionnement de la Plateforme</li>
              <li>Ne pas collecter ou exploiter les données d&apos;autres Utilisateurs</li>
              <li>Respecter la législation en vigueur, notamment en matière de droit immobilier</li>
              <li>Maintenir ses informations de compte à jour</li>
            </ul>

            <h2>7. Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble des éléments composant la Plateforme (textes, graphismes, logiciels,
              bases de données, logos, marques, etc.) sont protégés par les droits de propriété
              intellectuelle. Toute reproduction, représentation ou exploitation non autorisée
              est strictement interdite.
            </p>

            <h2>8. Données personnelles</h2>
            <p>
              Le traitement des données personnelles est régi par notre{" "}
              <Link href="/legal/privacy" className="text-primary hover:underline">
                Politique de Confidentialité
              </Link>,
              qui fait partie intégrante des présentes CGU.
            </p>

            <h2>9. Responsabilité</h2>
            <p>
              L&apos;Éditeur s&apos;efforce d&apos;assurer la disponibilité et le bon fonctionnement
              de la Plateforme. Toutefois, il ne saurait être tenu responsable en cas
              d&apos;interruption du service, de perte de données ou de dommages indirects.
              La Plateforme est un outil d&apos;aide à la gestion et ne se substitue pas aux
              obligations légales des propriétaires et des locataires.
            </p>

            <h2>10. Suspension et résiliation</h2>
            <p>
              L&apos;Utilisateur peut résilier son Compte à tout moment depuis les paramètres
              de son espace personnel. L&apos;Éditeur se réserve le droit de suspendre ou
              résilier un Compte en cas de manquement aux présentes CGU, sans préjudice
              de tout dommage et intérêt.
            </p>

            <h2>11. Modification des CGU</h2>
            <p>
              L&apos;Éditeur se réserve le droit de modifier les présentes CGU à tout moment.
              Les Utilisateurs seront informés de toute modification substantielle par email
              ou notification sur la Plateforme. La poursuite de l&apos;utilisation de la
              Plateforme après modification vaut acceptation des nouvelles CGU.
            </p>

            <h2>12. Droit applicable et juridiction</h2>
            <p>
              Les présentes CGU sont régies par le droit français. En cas de litige relatif
              à l&apos;interprétation ou à l&apos;exécution des présentes, les parties s&apos;efforceront
              de trouver une solution amiable. À défaut, les tribunaux compétents de Paris
              seront seuls compétents.
            </p>

            <h2>13. Contact</h2>
            <p>
              Pour toute question relative aux présentes CGU, vous pouvez nous contacter à :{" "}
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
