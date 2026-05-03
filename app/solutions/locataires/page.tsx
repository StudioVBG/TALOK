"use client";

/**
 * Page Solution: Locataires & colocataires
 *
 * Persona: Léa, 28 ans, locataire (parfois colocataire). Veut payer en
 * 2 clics, retrouver ses quittances, signer un bail à distance, connaître
 * ses droits, signaler un incident, gérer la coloc sereinement.
 *
 * SEO: "espace locataire", "payer loyer en ligne", "quittance loyer",
 * "mes droits locataire", "colocation solidarité"
 */

import {
  Users,
  CreditCard,
  Receipt,
  Wrench,
  FileSignature,
  Scale,
  AlertTriangle,
  Smartphone,
  Calculator,
  HeartHandshake,
  Inbox,
} from "lucide-react";
import {
  SolutionHero,
  SolutionStats,
  SolutionSEOIntro,
  SolutionPainPoints,
  SolutionHowItWorks,
  SolutionFeatures,
  SolutionComparison,
  SolutionFAQ,
  SolutionTestimonialCard,
  SolutionFinalCTA,
  type SolutionTheme,
} from "@/components/marketing/solutions";

const THEME: SolutionTheme = {
  gradient: "from-emerald-400 via-cyan-400 to-emerald-300",
  accent: "emerald",
  sparkleColor: "#34D399",
};

export default function LocatairesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <SolutionHero
        theme={THEME}
        badgeIcon={Users}
        badgeLabel="Pour les locataires & colocataires"
        titleStart="Votre logement,"
        titleEnd="sous contrôle"
        description="Payez votre loyer en 2 clics, retrouvez toutes vos quittances, signez votre bail à distance, signalez un incident et calculez vos droits. Talok centralise toute votre vie de locataire."
        primaryCta={{ label: "Créer mon espace gratuit", href: "/auth/signup" }}
        secondaryCta={{ label: "J’ai reçu une invitation", href: "/rejoindre-logement" }}
        reassurances={[
          "100 % gratuit pour le locataire",
          "Quittances ALUR archivées à vie",
          "Application iPhone & Android",
        ]}
      />

      <SolutionStats
        theme={THEME}
        stats={[
          { value: 30, suffix: " s", label: "Pour signaler un incident", icon: Smartphone },
          { value: 2, suffix: " clics", label: "Pour payer le loyer", icon: CreditCard },
          { value: 100, suffix: " %", label: "Quittances ALUR archivées", icon: Receipt },
          { value: 6, suffix: " calc.", label: "Outils de calcul juridique", icon: Calculator },
        ]}
      />

      <SolutionSEOIntro
        eyebrow="Espace locataire"
        heading="Tout ce qu’un locataire moderne attend de son logiciel"
        paragraphs={[
          "Être locataire en France en 2026, c’est jongler entre virements bancaires manuels, quittances reçues en PDF désordonnés par email, démarches CAF qui réclament un justificatif perdu, et un bailleur ou syndic qu’on n’arrive pas à joindre quand un robinet fuit. Talok résout ces frictions du quotidien : un espace unique, gratuit pour vous, où votre bail vit en temps réel.",
          "Vous payez votre loyer par carte bancaire ou prélèvement automatique SEPA en quelques secondes. Votre quittance ALUR vous est envoyée par email et conservée à vie dans votre coffre-fort numérique — prête à être téléchargée pour la CAF, votre banque ou votre prochain dossier de location. Si vous emménagez à plusieurs, la colocation est traitée comme un cas de première classe : quote-part individuelle, paiements séparés, clause de solidarité conforme ALUR, départ d’un colocataire géré sans drame.",
          "Pour vos droits, Talok intègre l’assistant TALO : 6 calculateurs (préavis selon la zone, révision IRL, charges récupérables, dépôt de garantie, prorata et plus), 15 modèles de lettres types et une FAQ juridique alimentée par les textes officiels. Vos questions trouvent une réponse claire, en français, sans avocat. Et si quelque chose dérape, le signalement d’incident en 30 secondes (photo + description) déclenche immédiatement un ticket suivi par votre bailleur ou son artisan.",
        ]}
        keywords={[
          "espace locataire",
          "payer loyer en ligne",
          "quittance ALUR",
          "signature électronique bail",
          "colocation solidarité",
          "mes droits de locataire",
          "calcul préavis logement",
          "révision IRL",
          "dépôt de garantie",
          "signalement incident location",
        ]}
      />

      <SolutionPainPoints
        theme={THEME}
        heading="Ce que les locataires nous disent"
        subheading="Et comment Talok règle chacun de ces points concrets."
        items={[
          {
            icon: AlertTriangle,
            title: "« Je perds mes quittances »",
            solution:
              "Toutes vos quittances ALUR et votre bail sont archivés à vie dans votre coffre. Téléchargeables en PDF en 2 clics, prêts pour la CAF, les impôts ou la banque.",
          },
          {
            icon: AlertTriangle,
            title: "« Je ne sais pas quoi faire en cas de problème »",
            solution:
              "Robinet qui fuit, chaudière en panne, serrure cassée ? Signalez avec photo en 30 secondes. Le bailleur est notifié et peut envoyer un artisan dans la foulée.",
          },
          {
            icon: AlertTriangle,
            title: "« Je veux connaître mes droits »",
            solution:
              "Espace « Mes droits » intégré : protocoles, lettres types, calculateurs (préavis, IRL, charges, dépôt). Mis à jour par notre IA TALO sur les textes officiels.",
          },
        ]}
      />

      <SolutionHowItWorks
        theme={THEME}
        heading="De l’invitation à la quittance, en 4 étapes"
        steps={[
          {
            icon: Inbox,
            title: "Reçevez votre invitation",
            desc: "Votre bailleur ou syndic vous envoie un lien par email. 2 minutes pour activer.",
          },
          {
            icon: FileSignature,
            title: "Signez votre bail",
            desc: "Lecture du bail conforme ALUR, signature électronique avec valeur légale.",
          },
          {
            icon: CreditCard,
            title: "Payez en 2 clics",
            desc: "CB ou prélèvement SEPA. Confirmation immédiate, prélèvement à la date convenue.",
          },
          {
            icon: Receipt,
            title: "Recevez votre quittance",
            desc: "Quittance ALUR générée et archivée. Téléchargeable à tout moment.",
          },
        ]}
      />

      <SolutionFeatures
        theme={THEME}
        heading="Tout ce dont vous avez besoin"
        subheading="Du paiement aux droits, sans rien oublier."
        features={[
          {
            icon: CreditCard,
            title: "Payer en 2 clics",
            description:
              "Carte bancaire, prélèvement automatique SEPA ou virement. Confirmation instantanée. Plus de chèque, plus d’oubli, plus de relance.",
          },
          {
            icon: Receipt,
            title: "Quittances automatiques",
            description:
              "Dès le paiement validé, votre quittance ALUR vous est envoyée par email et archivée à vie dans votre coffre-fort numérique.",
          },
          {
            icon: FileSignature,
            title: "Signer son bail à distance",
            description:
              "Bail, avenant, état des lieux : signature électronique avec valeur légale d’un original papier. Aucun déplacement.",
          },
          {
            icon: Wrench,
            title: "Signaler un incident",
            description:
              "Photo, description, urgence : votre demande arrive directement au bailleur ou syndic. Suivi temps réel jusqu’à résolution.",
          },
          {
            icon: Scale,
            title: "Mes droits de locataire",
            description:
              "6 calculateurs (préavis, IRL, charges, dépôt) + 15 modèles de lettres + FAQ juridique alimentée par TALO. À jour de la loi.",
          },
          {
            icon: HeartHandshake,
            title: "Colocation simplifiée",
            description:
              "Quote-part individuelle, paiements séparés, clause de solidarité ALUR de 6 mois, départ d’un colocataire géré sereinement.",
          },
        ]}
      />

      <SolutionComparison
        theme={THEME}
        heading="Comment Talok change la vie quotidienne du locataire"
        subheading="Les frictions classiques côté gauche. Ce que Talok apporte côté droit."
        rows={[
          {
            topic: "Paiement du loyer",
            without: "Virement manuel chaque mois, parfois oublié, RIB qu’on cherche",
            with: "Prélèvement automatique SEPA ou paiement CB en 2 clics",
          },
          {
            topic: "Quittance",
            without: "Réclamée par email, reçue en retard ou jamais",
            with: "Générée automatiquement, archivée à vie, téléchargeable en PDF",
          },
          {
            topic: "Signature du bail",
            without: "Impression, signature papier, scan, retour en recommandé",
            with: "Lecture en ligne, signature électronique conforme eIDAS",
          },
          {
            topic: "Incident logement",
            without: "Coup de fil au bailleur sans réponse, SMS perdu",
            with: "Ticket avec photo, suivi temps réel, artisan assigné",
          },
          {
            topic: "Mes droits",
            without: "Recherche Google, sites datés, lettre type approximative",
            with: "Calculateurs IRL, préavis, dépôt + 15 modèles validés",
          },
          {
            topic: "Colocation",
            without: "Un seul bail, conflits sur qui paie quoi, départs houleux",
            with: "Quote-part individuelle, paiements séparés, solidarité claire",
          },
        ]}
      />

      <SolutionTestimonialCard
        theme={THEME}
        avatarIcon={Users}
        testimonial={{
          quote:
            "J’avais perdu mes 3 dernières quittances pour un dossier banque. Sur Talok, je les ai retrouvées en 10 secondes. Et je signale les problèmes sans attendre que mon proprio décroche.",
          author: "Léa M.",
          location: "Saint-Denis, La Réunion",
          context: "Locataire d’un T2",
        }}
      />

      <SolutionFAQ
        heading="Vos questions de locataire"
        items={[
          {
            question: "L’espace locataire Talok est-il vraiment gratuit pour moi ?",
            answer:
              "Oui, totalement. Le coût est pris en charge par votre bailleur ou syndic dans son abonnement. Vous n’avez aucune carte bancaire à fournir pour activer votre espace, signer votre bail ou télécharger vos quittances. Les frais de paiement (CB ou SEPA) sont également supportés par le bailleur.",
          },
          {
            question: "Mes quittances Talok sont-elles légalement valables ?",
            answer:
              "Oui. Les quittances générées par Talok respectent l’article 21 de la loi du 6 juillet 1989 (loi ALUR) : période concernée, montant détaillé loyer + charges, signature du bailleur. Elles sont acceptées par la CAF, votre banque, les impôts et tout administrateur de biens.",
          },
          {
            question: "Comment fonctionne la signature électronique du bail ?",
            answer:
              "Talok utilise une signature électronique conforme au règlement européen eIDAS, avec la même valeur légale qu’un original papier. Vous recevez le bail par email, vous le lisez sur votre téléphone, vous saisissez un code reçu par SMS et c’est signé. Le PDF signé est archivé à vie dans votre espace.",
          },
          {
            question: "Que se passe-t-il en colocation si l’un de nous part ?",
            answer:
              "Talok gère la solidarité ALUR de 6 mois automatiquement : à compter du préavis du colocataire sortant, sa responsabilité solidaire prend fin 6 mois après son départ effectif (sauf s’il est remplacé avant). Sa quote-part bascule sur les colocataires restants, avec génération automatique de l’avenant.",
          },
          {
            question: "Mon bailleur ne souhaite pas utiliser Talok, que faire ?",
            answer:
              "Parlez-lui en : l’inscription est gratuite (plan Gratuit pour 1 bien) et il pourra continuer à gérer comme il préfère. Le plus souvent, le gain de temps sur quittances et paiements convainc rapidement. Si malgré tout il refuse, vous pouvez tout de même utiliser nos outils gratuits (calculateurs IRL, préavis) sans bailleur connecté.",
          },
          {
            question: "Comment signaler un incident sérieux (urgence) ?",
            answer:
              "Quand vous créez un ticket, vous choisissez le niveau d’urgence (faible, moyen, élevé, urgence). Une urgence (fuite d’eau, coupure totale d’électricité, sinistre) déclenche une notification SMS immédiate au bailleur ou au syndic. Talok recommande aussi les numéros publics utiles (pompiers, gendarmerie, EDF dépannage).",
          },
        ]}
      />

      <SolutionFinalCTA
        theme={THEME}
        heading="Votre bailleur n’est pas encore sur Talok ?"
        description="Parlez-lui en. Il pourra créer son compte gratuit en 2 minutes et vous inviter dans la foulée. Vous gagnerez tous du temps."
        primaryCta={{ label: "Créer mon espace gratuit", href: "/auth/signup" }}
        secondaryCta={{ label: "Une question ?", href: "/contact" }}
        reassurance="Locataire : c’est toujours gratuit · Aucune carte bancaire requise"
      />
    </div>
  );
}
