import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Mentions Légales — Talok",
  description:
    "Mentions légales du site talok.fr — Éditeur, hébergement, propriété intellectuelle.",
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
          Retour à l&apos;accueil
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Mentions Légales</CardTitle>
            <p className="text-muted-foreground">
              Dernière mise à jour : 28 mars 2026
            </p>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              Conformément aux dispositions de la loi n° 2004-575 du 21 juin
              2004 pour la confiance dans l&apos;économie numérique (LCEN),
              il est porté à la connaissance des utilisateurs du site{" "}
              <strong>talok.fr</strong> les informations suivantes.
            </p>

            <h2>1. Éditeur du site</h2>
            <p>Le site talok.fr est édité par :</p>
            <ul>
              <li>
                <strong>Raison sociale :</strong>{" "}
                {/* LEGAL: Thomas doit fournir cette info */}
                <span className="text-amber-600 font-semibold">
                  [À REMPLIR — nom exact de la société]
                </span>
              </li>
              <li>
                <strong>Forme juridique :</strong>{" "}
                {/* LEGAL: Thomas doit fournir cette info */}
                <span className="text-amber-600 font-semibold">
                  [À REMPLIR — SAS, SARL, EURL, Auto-entrepreneur…]
                </span>
              </li>
              <li>
                {/* LEGAL: Thomas doit fournir cette info */}
                <strong>Capital social :</strong>{" "}
                <span className="text-amber-600 font-semibold">
                  [À REMPLIR]
                </span>{" "}
                euros
              </li>
              <li>
                <strong>Siège social :</strong>{" "}
                {/* LEGAL: Thomas doit fournir cette info */}
                <span className="text-amber-600 font-semibold">
                  [À REMPLIR — adresse complète, Martinique]
                </span>
              </li>
              <li>
                {/* LEGAL: Thomas doit fournir cette info */}
                <strong>SIRET :</strong>{" "}
                <span className="text-amber-600 font-semibold">
                  [À REMPLIR]
                </span>
              </li>
              <li>
                <strong>RCS :</strong>{" "}
                {/* LEGAL: Thomas doit fournir cette info */}
                <span className="text-amber-600 font-semibold">
                  [À REMPLIR — ex : RCS Fort-de-France B 000 000 000]
                </span>
              </li>
              <li>
                <strong>N° TVA intracommunautaire :</strong>{" "}
                {/* LEGAL: Thomas doit fournir cette info */}
                <span className="text-amber-600 font-semibold">
                  [À REMPLIR ou &quot;Non applicable&quot; si franchise en base
                  de TVA]
                </span>
              </li>
              <li>
                <strong>Directeur de la publication :</strong> Thomas VOLBERG
              </li>
              <li>
                <strong>Email :</strong>{" "}
                <a
                  href="mailto:contact@talok.fr"
                  className="text-primary hover:underline"
                >
                  contact@talok.fr
                </a>
              </li>
              <li>
                {/* LEGAL: Thomas doit fournir cette info */}
                <strong>Téléphone :</strong>{" "}
                <span className="text-amber-600 font-semibold">
                  [À REMPLIR]
                </span>
              </li>
            </ul>

            <h2>2. Hébergement</h2>
            <p>Le site talok.fr est hébergé par :</p>
            <ul>
              <li>
                <strong>Raison sociale :</strong> Netlify, Inc.
              </li>
              <li>
                <strong>Adresse :</strong> 2325 3rd Street, Suite 296, San
                Francisco, CA 94107, États-Unis
              </li>
              <li>
                <strong>Site web :</strong>{" "}
                <a
                  href="https://www.netlify.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  https://www.netlify.com
                </a>
              </li>
            </ul>
            <p>La base de données est hébergée par :</p>
            <ul>
              <li>
                <strong>Raison sociale :</strong> Supabase, Inc.
              </li>
              <li>
                <strong>Adresse :</strong> 970 Toa Payoh North #07-04, Singapore
                318992
              </li>
              <li>
                <strong>Localisation des données :</strong> Union Européenne
                (AWS eu-west)
              </li>
              <li>
                <strong>Site web :</strong>{" "}
                <a
                  href="https://supabase.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  https://supabase.com
                </a>
              </li>
            </ul>

            <h2>3. Activité</h2>
            <p>
              Talok est une plateforme de gestion locative en ligne (SaaS)
              destinée aux propriétaires bailleurs, locataires, garants,
              prestataires, agences immobilières et syndics de copropriété.
              Elle permet notamment la gestion des biens immobiliers, des baux,
              des loyers, de la signature électronique de documents, des états
              des lieux, de la comptabilité locative et de la communication
              entre les parties.
            </p>

            <h2>4. Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble du contenu du site talok.fr et de la plateforme
              Talok (textes, images, graphismes, logos, icônes, logiciels, bases
              de données) est la propriété exclusive de l&apos;éditeur ou de ses
              partenaires et est protégé par les lois françaises et
              internationales relatives à la propriété intellectuelle.
            </p>
            <p>
              Le logo Talok (représentation stylisée d&apos;une maison avec une
              serrure intégrée dans la lettre &quot;a&quot;) est une création
              originale protégée par le droit d&apos;auteur.
            </p>
            <p>
              Toute reproduction, représentation, modification, publication,
              transmission ou dénaturation, totale ou partielle, du contenu de
              la plateforme, par quelque procédé que ce soit et sur quelque
              support que ce soit, est interdite sans autorisation écrite
              préalable de l&apos;éditeur.
            </p>

            <h2>5. Protection des données personnelles</h2>
            <p>
              Conformément au Règlement Général sur la Protection des Données
              (RGPD — Règlement UE 2016/679) et à la loi n° 78-17 du 6 janvier
              1978 &quot;Informatique et Libertés&quot;, vous disposez de droits
              sur vos données personnelles. Pour en savoir plus, consultez
              notre{" "}
              <Link
                href="/legal/privacy"
                className="text-primary hover:underline"
              >
                Politique de Confidentialité
              </Link>
              .
            </p>
            <p>
              <strong>Contact RGPD :</strong>{" "}
              <a
                href="mailto:dpo@talok.fr"
                className="text-primary hover:underline"
              >
                dpo@talok.fr
              </a>
            </p>

            <h2>6. Cookies</h2>
            <p>
              Le site utilise des cookies pour assurer son bon fonctionnement et
              améliorer l&apos;expérience utilisateur. Pour en savoir plus,
              consultez notre{" "}
              <Link
                href="/legal/cookies"
                className="text-primary hover:underline"
              >
                Politique de Cookies
              </Link>
              .
            </p>

            <h2>7. Liens hypertextes</h2>
            <p>
              Le site peut contenir des liens hypertextes vers d&apos;autres
              sites internet. L&apos;éditeur n&apos;exerce aucun contrôle sur
              ces sites et décline toute responsabilité quant à leur contenu ou
              aux traitements de données qu&apos;ils effectuent.
            </p>

            <h2>8. Limitation de responsabilité</h2>
            <p>
              L&apos;éditeur s&apos;efforce de fournir des informations aussi
              précises que possible. Toutefois, il ne saurait être tenu
              responsable des omissions, inexactitudes ou carences dans la mise
              à jour des informations. La plateforme Talok est un outil
              d&apos;aide à la gestion locative et ne se substitue en aucun cas
              aux conseils d&apos;un avocat, d&apos;un notaire ou d&apos;un
              expert-comptable.
            </p>

            <h2>9. Droit applicable</h2>
            <p>
              Les présentes mentions légales sont régies par le droit français.
              En cas de litige, et après tentative de résolution amiable, les
              tribunaux de Fort-de-France (Martinique) seront seuls compétents.
            </p>

            <h2>10. Crédits</h2>
            <ul>
              <li>
                <strong>Conception et développement :</strong> Talok
              </li>
              <li>
                <strong>Images :</strong> Unsplash (licence libre)
              </li>
              <li>
                <strong>Icônes :</strong> Lucide Icons (licence MIT)
              </li>
            </ul>

            <h2>11. Contact</h2>
            <p>
              Pour toute question relative aux présentes mentions légales :{" "}
              <a
                href="mailto:contact@talok.fr"
                className="text-primary hover:underline"
              >
                contact@talok.fr
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
