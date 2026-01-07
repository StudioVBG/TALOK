import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Politique de Confidentialité - Talok",
  description: "Politique de confidentialité et protection des données personnelles",
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
          Retour à l'accueil
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Politique de Confidentialité</CardTitle>
            <p className="text-muted-foreground">Dernière mise à jour : Novembre 2024</p>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h2>1. Introduction</h2>
            <p>
              Nous attachons une grande importance à la protection de vos données personnelles. 
              Cette politique de confidentialité explique comment nous collectons, utilisons 
              et protégeons vos informations personnelles conformément au Règlement Général 
              sur la Protection des Données (RGPD).
            </p>

            <h2>2. Responsable du traitement</h2>
            <p>
              Le responsable du traitement des données est la société exploitant la plateforme 
              de gestion locative. Pour toute question relative à vos données, contactez notre 
              Délégué à la Protection des Données (DPO) à : 
              <a href="mailto:dpo@talok.fr" className="text-primary hover:underline ml-1">
                dpo@talok.fr
              </a>
            </p>

            <h2>3. Données collectées</h2>
            <p>Nous collectons les données suivantes :</p>
            <ul>
              <li><strong>Données d'identification :</strong> nom, prénom, email, téléphone, date de naissance</li>
              <li><strong>Données professionnelles :</strong> situation professionnelle, revenus (pour les locataires)</li>
              <li><strong>Données financières :</strong> IBAN, historique des paiements</li>
              <li><strong>Données immobilières :</strong> adresses des biens, caractéristiques des logements</li>
              <li><strong>Documents :</strong> pièces d'identité, justificatifs, contrats de bail</li>
              <li><strong>Données de connexion :</strong> adresse IP, logs de connexion</li>
            </ul>

            <h2>4. Finalités du traitement</h2>
            <p>Vos données sont utilisées pour :</p>
            <ul>
              <li>Gestion de votre compte utilisateur</li>
              <li>Exécution des services de gestion locative</li>
              <li>Communication entre propriétaires et locataires</li>
              <li>Génération de documents légaux (baux, quittances)</li>
              <li>Traitement des paiements de loyers</li>
              <li>Amélioration de nos services</li>
              <li>Respect de nos obligations légales</li>
            </ul>

            <h2>5. Base légale</h2>
            <p>Le traitement de vos données est fondé sur :</p>
            <ul>
              <li>L'exécution du contrat de service</li>
              <li>Votre consentement</li>
              <li>Nos obligations légales</li>
              <li>Notre intérêt légitime à améliorer nos services</li>
            </ul>

            <h2>6. Durée de conservation</h2>
            <p>Vos données sont conservées :</p>
            <ul>
              <li>Données de compte : pendant la durée de votre inscription + 3 ans</li>
              <li>Documents contractuels : 10 ans (obligation légale)</li>
              <li>Données de paiement : 10 ans (obligation comptable)</li>
              <li>Logs de connexion : 1 an</li>
            </ul>

            <h2>7. Destinataires des données</h2>
            <p>Vos données peuvent être partagées avec :</p>
            <ul>
              <li>Nos sous-traitants techniques (hébergement, paiement)</li>
              <li>Les administrations en cas d'obligation légale</li>
              <li>Les autres parties au contrat de location (propriétaire/locataire)</li>
            </ul>

            <h2>8. Transferts hors UE</h2>
            <p>
              Nous privilégions l'hébergement de vos données au sein de l'Union Européenne. 
              En cas de transfert hors UE, nous nous assurons que les garanties appropriées 
              sont en place (clauses contractuelles types, décision d'adéquation).
            </p>

            <h2>9. Vos droits</h2>
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul>
              <li><strong>Droit d'accès :</strong> obtenir une copie de vos données</li>
              <li><strong>Droit de rectification :</strong> corriger vos données inexactes</li>
              <li><strong>Droit à l'effacement :</strong> demander la suppression de vos données</li>
              <li><strong>Droit à la limitation :</strong> limiter le traitement de vos données</li>
              <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré</li>
              <li><strong>Droit d'opposition :</strong> vous opposer au traitement de vos données</li>
            </ul>
            <p>
              Pour exercer ces droits, contactez-nous à : 
              <a href="mailto:privacy@talok.fr" className="text-primary hover:underline ml-1">
                privacy@talok.fr
              </a>
            </p>

            <h2>10. Sécurité</h2>
            <p>
              Nous mettons en œuvre des mesures techniques et organisationnelles appropriées 
              pour protéger vos données : chiffrement, contrôle d'accès, audits de sécurité, 
              formation du personnel.
            </p>

            <h2>11. Cookies</h2>
            <p>
              Notre plateforme utilise des cookies strictement nécessaires au fonctionnement 
              du service. Pour plus d'informations, consultez notre politique de cookies.
            </p>

            <h2>12. Modifications</h2>
            <p>
              Cette politique peut être modifiée. En cas de changement substantiel, 
              vous serez informé par email ou notification sur la plateforme.
            </p>

            <h2>13. Réclamation</h2>
            <p>
              Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire 
              une réclamation auprès de la CNIL : 
              <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                www.cnil.fr
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

