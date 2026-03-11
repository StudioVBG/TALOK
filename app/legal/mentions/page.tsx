import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Mentions Légales - Talok",
  description: "Mentions légales de la plateforme Talok de gestion locative",
};

export default function MentionsLegalesPage() {
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
            <CardTitle className="text-3xl">Mentions Légales</CardTitle>
            <p className="text-muted-foreground">Dernière mise à jour : Mars 2026</p>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h2>1. Éditeur du site</h2>
            <p>
              La plateforme Talok est éditée par :
            </p>
            <ul>
              <li><strong>Raison sociale :</strong> Talok SAS</li>
              <li><strong>Forme juridique :</strong> Société par Actions Simplifiée (SAS)</li>
              <li><strong>Capital social :</strong> [Montant] euros</li>
              <li><strong>Siège social :</strong> [Adresse du siège social], France</li>
              <li><strong>RCS :</strong> [Ville] B [Numéro RCS]</li>
              <li><strong>SIRET :</strong> [Numéro SIRET]</li>
              <li><strong>Numéro TVA intracommunautaire :</strong> [Numéro TVA]</li>
              <li><strong>Directeur de la publication :</strong> [Nom du directeur de la publication]</li>
              <li><strong>Email :</strong>{" "}
                <a href="mailto:contact@talok.fr" className="text-primary hover:underline">
                  contact@talok.fr
                </a>
              </li>
            </ul>

            <h2>2. Hébergeur</h2>
            <p>La Plateforme est hébergée par :</p>
            <ul>
              <li><strong>Raison sociale :</strong> [Nom de l&apos;hébergeur]</li>
              <li><strong>Adresse :</strong> [Adresse de l&apos;hébergeur]</li>
              <li><strong>Téléphone :</strong> [Numéro de téléphone]</li>
              <li><strong>Site web :</strong> [URL du site de l&apos;hébergeur]</li>
            </ul>

            <h2>3. Activité</h2>
            <p>
              Talok est une plateforme de gestion locative en ligne destinée aux propriétaires
              bailleurs et aux locataires. Elle permet la gestion des biens immobiliers, des
              baux, des loyers, des documents et de la communication entre les parties.
            </p>

            <h2>4. Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble du contenu de la Plateforme (textes, images, graphismes, logos, icônes,
              logiciels, bases de données) est la propriété exclusive de Talok SAS ou de ses
              partenaires et est protégé par les lois françaises et internationales relatives
              à la propriété intellectuelle.
            </p>
            <p>
              Toute reproduction, représentation, modification, publication, transmission ou
              dénaturation, totale ou partielle, du contenu de la Plateforme, par quelque
              procédé que ce soit et sur quelque support que ce soit, est interdite sans
              autorisation écrite préalable de Talok SAS.
            </p>

            <h2>5. Protection des données personnelles</h2>
            <p>
              Conformément au Règlement Général sur la Protection des Données (RGPD) et à la
              loi Informatique et Libertés, vous disposez de droits sur vos données personnelles.
              Pour en savoir plus, consultez notre{" "}
              <Link href="/legal/privacy" className="text-primary hover:underline">
                Politique de Confidentialité
              </Link>.
            </p>
            <p>
              <strong>Délégué à la Protection des Données (DPO) :</strong>{" "}
              <a href="mailto:dpo@talok.fr" className="text-primary hover:underline">
                dpo@talok.fr
              </a>
            </p>

            <h2>6. Cookies</h2>
            <p>
              La Plateforme utilise des cookies pour assurer son bon fonctionnement et améliorer
              l&apos;expérience utilisateur. Pour en savoir plus, consultez notre{" "}
              <Link href="/legal/cookies" className="text-primary hover:underline">
                Politique de Cookies
              </Link>.
            </p>

            <h2>7. Liens hypertextes</h2>
            <p>
              La Plateforme peut contenir des liens hypertextes vers d&apos;autres sites internet.
              Talok SAS n&apos;exerce aucun contrôle sur ces sites et décline toute responsabilité
              quant à leur contenu ou aux traitements de données qu&apos;ils effectuent.
            </p>

            <h2>8. Limitation de responsabilité</h2>
            <p>
              Talok SAS s&apos;efforce de fournir des informations aussi précises que possible
              sur la Plateforme. Toutefois, elle ne saurait être tenue responsable des omissions,
              inexactitudes ou carences dans la mise à jour des informations, qu&apos;elles soient
              de son fait ou du fait de tiers partenaires.
            </p>

            <h2>9. Droit applicable</h2>
            <p>
              Les présentes mentions légales sont régies par le droit français. En cas de
              litige, et après tentative de résolution amiable, les tribunaux français
              seront seuls compétents.
            </p>

            <h2>10. Crédits</h2>
            <p>
              Conception et développement : Talok SAS
            </p>

            <h2>11. Contact</h2>
            <p>
              Pour toute question, vous pouvez nous contacter à :{" "}
              <a href="mailto:contact@talok.fr" className="text-primary hover:underline">
                contact@talok.fr
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
