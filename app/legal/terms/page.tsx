import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Conditions Générales d'Utilisation - Talok",
  description: "Conditions générales d'utilisation de la plateforme de gestion locative",
};

export default function TermsPage() {
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
            <CardTitle className="text-3xl">Conditions Générales d'Utilisation</CardTitle>
            <p className="text-muted-foreground">Dernière mise à jour : Novembre 2024</p>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h2>1. Objet</h2>
            <p>
              Les présentes Conditions Générales d'Utilisation (CGU) ont pour objet de définir 
              les modalités et conditions d'utilisation de la plateforme de gestion locative 
              (ci-après "la Plateforme").
            </p>

            <h2>2. Acceptation des CGU</h2>
            <p>
              L'utilisation de la Plateforme implique l'acceptation pleine et entière des 
              présentes CGU. Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser 
              la Plateforme.
            </p>

            <h2>3. Description du service</h2>
            <p>
              La Plateforme est un outil de gestion locative permettant aux propriétaires 
              de gérer leurs biens immobiliers, leurs locataires, les loyers et les documents 
              associés. Elle permet également aux locataires d'accéder à leurs informations 
              de location et de communiquer avec leur propriétaire.
            </p>

            <h2>4. Inscription et compte utilisateur</h2>
            <p>
              Pour utiliser la Plateforme, vous devez créer un compte en fournissant des 
              informations exactes et à jour. Vous êtes responsable de la confidentialité 
              de vos identifiants de connexion.
            </p>

            <h2>5. Obligations de l'utilisateur</h2>
            <p>L'utilisateur s'engage à :</p>
            <ul>
              <li>Fournir des informations exactes et à jour</li>
              <li>Ne pas utiliser la Plateforme à des fins illégales</li>
              <li>Respecter les droits des autres utilisateurs</li>
              <li>Ne pas tenter de nuire au fonctionnement de la Plateforme</li>
            </ul>

            <h2>6. Propriété intellectuelle</h2>
            <p>
              Tous les éléments de la Plateforme (textes, graphismes, logos, etc.) sont 
              protégés par le droit de la propriété intellectuelle. Toute reproduction 
              non autorisée est interdite.
            </p>

            <h2>7. Protection des données personnelles</h2>
            <p>
              Le traitement des données personnelles est effectué conformément à notre 
              <Link href="/legal/privacy" className="text-primary hover:underline ml-1">
                Politique de confidentialité
              </Link>.
            </p>

            <h2>8. Responsabilité</h2>
            <p>
              La Plateforme est fournie "en l'état". Nous ne garantissons pas l'absence 
              d'erreurs ou d'interruptions de service. Notre responsabilité est limitée 
              aux dommages directs et prévisibles.
            </p>

            <h2>9. Modification des CGU</h2>
            <p>
              Nous nous réservons le droit de modifier les présentes CGU à tout moment. 
              Les utilisateurs seront informés de toute modification substantielle.
            </p>

            <h2>10. Droit applicable</h2>
            <p>
              Les présentes CGU sont régies par le droit français. En cas de litige, 
              les tribunaux français seront compétents.
            </p>

            <h2>11. Contact</h2>
            <p>
              Pour toute question concernant ces CGU, vous pouvez nous contacter à l'adresse : 
              <a href="mailto:legal@talok.fr" className="text-primary hover:underline ml-1">
                legal@talok.fr
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

