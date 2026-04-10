import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Politique de Confidentialité — Talok",
  description:
    "Comment Talok collecte, utilise et protège vos données personnelles — Conforme RGPD.",
};

export default function PrivacyPage() {
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
              Politique de Confidentialité
            </CardTitle>
            <p className="text-muted-foreground">
              Dernière mise à jour : 10 avril 2026
            </p>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h2>1. Introduction</h2>
            <p>
              Talok attache une grande importance à la protection de vos données
              personnelles. La présente politique de confidentialité décrit
              comment nous collectons, utilisons, stockons et protégeons vos
              informations conformément au Règlement Général sur la Protection
              des Données (RGPD — Règlement UE 2016/679) et à la loi n° 78-17
              du 6 janvier 1978 &quot;Informatique et Libertés&quot;.
            </p>

            <h2>2. Responsable du traitement</h2>
            <p>Le responsable du traitement des données est :</p>
            <ul>
              <li>
                <strong>Société :</strong>{" "}
                <span className="text-amber-600 font-semibold">
                  [À CONFIRMER PAR THOMAS — raison sociale]
                </span>
              </li>
              <li>
                <strong>Siège social :</strong>{" "}
                <span className="text-amber-600 font-semibold">
                  [À CONFIRMER PAR THOMAS — adresse siège social]
                </span>
              </li>
              <li>
                <strong>Représentant légal :</strong> Thomas VOLBERG
              </li>
              <li>
                <strong>Contact RGPD / DPO :</strong>{" "}
                <a
                  href="mailto:dpo@talok.fr"
                  className="text-primary hover:underline"
                >
                  dpo@talok.fr
                </a>
              </li>
            </ul>

            <h2>3. Données collectées</h2>
            <p>
              Dans le cadre de l&apos;utilisation de la plateforme Talok, nous
              collectons les catégories de données suivantes :
            </p>
            <ul>
              <li>
                <strong>Données d&apos;identification :</strong> nom, prénom,
                adresse email, numéro de téléphone, date de naissance
              </li>
              <li>
                <strong>Données professionnelles :</strong> situation
                professionnelle, revenus (pour les locataires et garants)
              </li>
              <li>
                <strong>Données financières :</strong> IBAN (locataires, pour le
                prélèvement SEPA), données de carte bancaire (traitées
                exclusivement par notre prestataire de paiement, jamais stockées
                par Talok)
              </li>
              <li>
                <strong>Données immobilières :</strong> adresses des biens,
                caractéristiques des logements, diagnostics
              </li>
              <li>
                <strong>Données locatives :</strong> baux, loyers, quittances,
                états des lieux, documents contractuels
              </li>
              <li>
                <strong>Documents :</strong> pièces d&apos;identité (CNI,
                passeport), justificatifs de domicile, avis d&apos;imposition
              </li>
              <li>
                <strong>Données de connexion :</strong> adresse IP, logs de
                connexion, user agent, données de navigation
              </li>
            </ul>

            <h2>4. Finalités et bases légales du traitement</h2>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Finalité</th>
                    <th>Base légale</th>
                    <th>Durée de conservation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Gestion du compte utilisateur</td>
                    <td>Exécution du contrat</td>
                    <td>Durée du contrat + 3 ans</td>
                  </tr>
                  <tr>
                    <td>Gestion des baux et documents locatifs</td>
                    <td>Exécution du contrat + obligation légale</td>
                    <td>Durée du bail + 5 ans</td>
                  </tr>
                  <tr>
                    <td>Collecte des loyers (prélèvement SEPA)</td>
                    <td>Exécution du contrat</td>
                    <td>13 mois (directive DSP2)</td>
                  </tr>
                  <tr>
                    <td>Signature électronique de documents</td>
                    <td>Exécution du contrat</td>
                    <td>Durée du document + 10 ans</td>
                  </tr>
                  <tr>
                    <td>Envoi de notifications et emails transactionnels</td>
                    <td>Intérêt légitime</td>
                    <td>Jusqu&apos;à désinscription</td>
                  </tr>
                  <tr>
                    <td>Analyse d&apos;audience et amélioration du service</td>
                    <td>Consentement</td>
                    <td>13 mois maximum (recommandation CNIL)</td>
                  </tr>
                  <tr>
                    <td>Support client</td>
                    <td>Intérêt légitime</td>
                    <td>3 ans après le dernier contact</td>
                  </tr>
                  <tr>
                    <td>
                      Obligations fiscales et comptables (export FEC)
                    </td>
                    <td>Obligation légale</td>
                    <td>10 ans</td>
                  </tr>
                  <tr>
                    <td>Scoring IA des dossiers de candidature</td>
                    <td>Intérêt légitime</td>
                    <td>Durée de la candidature + 6 mois</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2>5. Sous-traitants et destinataires des données</h2>
            <p>
              Vos données peuvent être transmises aux sous-traitants suivants,
              dans le strict cadre des finalités décrites ci-dessus :
            </p>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Sous-traitant</th>
                    <th>Rôle</th>
                    <th>Localisation</th>
                    <th>Garanties</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Supabase</td>
                    <td>Base de données, authentification, stockage</td>
                    <td>UE (AWS eu-west)</td>
                    <td>DPA signé</td>
                  </tr>
                  <tr>
                    <td>Stripe</td>
                    <td>Paiements, prélèvements SEPA</td>
                    <td>UE + États-Unis</td>
                    <td>Certifié PCI-DSS, SCC</td>
                  </tr>
                  <tr>
                    <td>Netlify</td>
                    <td>Hébergement du site web</td>
                    <td>États-Unis</td>
                    <td>SCC (Standard Contractual Clauses)</td>
                  </tr>
                  <tr>
                    <td>Resend</td>
                    <td>Emails transactionnels</td>
                    <td>États-Unis</td>
                    <td>DPA</td>
                  </tr>
                  <tr>
                    <td>Twilio</td>
                    <td>Envoi de SMS</td>
                    <td>États-Unis</td>
                    <td>DPA, SCC</td>
                  </tr>
                  <tr>
                    <td>OpenAI</td>
                    <td>IA (scoring dossiers, OCR, assistant)</td>
                    <td>États-Unis</td>
                    <td>
                      DPA, données non utilisées pour l&apos;entraînement
                    </td>
                  </tr>
                  <tr>
                    <td>PostHog</td>
                    <td>Analytics</td>
                    <td>Union Européenne</td>
                    <td>DPA</td>
                  </tr>
                  <tr>
                    <td>Sentry</td>
                    <td>Monitoring des erreurs</td>
                    <td>États-Unis</td>
                    <td>DPA</td>
                  </tr>
                  <tr>
                    <td>Upstash</td>
                    <td>Cache (Redis)</td>
                    <td>Union Européenne</td>
                    <td>DPA</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Vos données peuvent également être communiquées aux autres parties
              au contrat de location (propriétaire / locataire / garant) dans le
              cadre strict de la relation locative, ainsi qu&apos;aux
              administrations en cas d&apos;obligation légale.
            </p>

            <h2>6. Transferts hors Union Européenne</h2>
            <p>
              Certains de nos sous-traitants sont situés aux États-Unis. Ces
              transferts sont encadrés par :
            </p>
            <ul>
              <li>
                Les Clauses Contractuelles Types (SCC) adoptées par la
                Commission Européenne
              </li>
              <li>
                Le EU-US Data Privacy Framework (lorsque le sous-traitant est
                certifié)
              </li>
            </ul>
            <p>
              <strong>
                Talok ne vend jamais vos données à des tiers.
              </strong>
            </p>

            <h2>7. Vos droits (RGPD art. 15 à 22)</h2>
            <p>
              Conformément au RGPD, vous disposez des droits suivants sur vos
              données personnelles :
            </p>
            <ul>
              <li>
                <strong>Droit d&apos;accès</strong> (art. 15) : obtenir une
                copie de l&apos;ensemble de vos données
              </li>
              <li>
                <strong>Droit de rectification</strong> (art. 16) : corriger des
                données inexactes ou incomplètes
              </li>
              <li>
                <strong>Droit à l&apos;effacement</strong> (art. 17) : demander
                la suppression de vos données
              </li>
              <li>
                <strong>Droit à la limitation du traitement</strong> (art. 18) :
                restreindre temporairement le traitement
              </li>
              <li>
                <strong>Droit à la portabilité</strong> (art. 20) : recevoir vos
                données dans un format structuré et lisible par machine
              </li>
              <li>
                <strong>Droit d&apos;opposition</strong> (art. 21) : vous
                opposer au traitement fondé sur l&apos;intérêt légitime
              </li>
              <li>
                <strong>Droit de retirer votre consentement</strong> : à tout
                moment pour les traitements fondés sur le consentement (cookies
                analytiques)
              </li>
            </ul>
            <p>
              Pour exercer ces droits, contactez-nous à :{" "}
              <a
                href="mailto:dpo@talok.fr"
                className="text-primary hover:underline"
              >
                dpo@talok.fr
              </a>
            </p>
            <p>
              Nous nous engageons à répondre dans un délai de 30 jours
              conformément à l&apos;article 12 du RGPD.
            </p>

            <h2>8. Sécurité des données</h2>
            <p>
              Talok met en œuvre des mesures techniques et organisationnelles
              appropriées pour protéger vos données :
            </p>
            <ul>
              <li>
                Chiffrement en transit (TLS/SSL) sur toutes les communications
              </li>
              <li>
                Chiffrement au repos (AES-256) via notre hébergeur de base de
                données
              </li>
              <li>
                Authentification renforcée : double vérification de sécurité
                (TOTP) et clés de sécurité (WebAuthn/Passkeys)
              </li>
              <li>
                Row Level Security (RLS) : isolation stricte des données entre
                utilisateurs au niveau de la base de données
              </li>
              <li>Journalisation des accès et actions sensibles</li>
              <li>Audits de sécurité réguliers</li>
            </ul>

            <h2>9. Cookies</h2>
            <p>
              Notre plateforme utilise des cookies. Pour connaître les cookies
              utilisés et gérer vos préférences, consultez notre{" "}
              <Link
                href="/legal/cookies"
                className="text-primary hover:underline"
              >
                Politique de Cookies
              </Link>
              .
            </p>

            <h2>10. Décisions automatisées et profilage</h2>
            <p>
              Talok utilise un système de scoring IA pour évaluer les dossiers
              de candidature locative. Ce scoring est un outil d&apos;aide à la
              décision et ne constitue jamais la seule base d&apos;une décision.
              Le propriétaire conserve toujours le pouvoir de décision final.
              Vous pouvez contester toute décision fondée sur un traitement
              automatisé en nous contactant à{" "}
              <a
                href="mailto:dpo@talok.fr"
                className="text-primary hover:underline"
              >
                dpo@talok.fr
              </a>
              .
            </p>

            <h2>11. Modifications de cette politique</h2>
            <p>
              Cette politique peut être modifiée pour refléter les évolutions
              légales ou techniques. En cas de modification substantielle, vous
              serez informé par email ou notification sur la plateforme au moins
              30 jours avant l&apos;entrée en vigueur des changements.
            </p>

            <h2>12. Réclamation auprès de la CNIL</h2>
            <p>
              Si vous estimez que vos droits en matière de protection des
              données ne sont pas respectés, vous pouvez introduire une
              réclamation auprès de la Commission Nationale de
              l&apos;Informatique et des Libertés (CNIL) :
            </p>
            <ul>
              <li>
                <strong>Site web :</strong>{" "}
                <a
                  href="https://www.cnil.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  www.cnil.fr
                </a>
              </li>
              <li>
                <strong>Adresse :</strong> 3 Place de Fontenoy, TSA 80715,
                75334 Paris Cedex 07
              </li>
            </ul>

            <h2>13. Contact</h2>
            <p>
              Pour toute question relative à cette politique :{" "}
              <a
                href="mailto:dpo@talok.fr"
                className="text-primary hover:underline"
              >
                dpo@talok.fr
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
