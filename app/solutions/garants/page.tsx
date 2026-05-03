"use client";

/**
 * Page Solution: Garants
 *
 * Persona: Patricia, 58 ans, parente d'un étudiant locataire. Veut
 * comprendre son engagement, recevoir les quittances, suivre les paiements,
 * être alertée tôt en cas de retard mais pas paniquée pour rien.
 *
 * SEO: "espace garant", "acte cautionnement", "caution solidaire bail",
 * "engagement caution", "résiliation caution"
 */

import {
  ShieldCheck,
  FileSignature,
  Bell,
  Eye,
  FileCheck,
  Scale,
  AlertTriangle,
  Inbox,
  Clock,
  CheckCircle2,
  PieChart,
  MessageSquare,
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
  gradient: "from-sky-400 via-blue-400 to-cyan-300",
  accent: "sky",
  sparkleColor: "#38BDF8",
};

export default function GarantsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <SolutionHero
        theme={THEME}
        badgeIcon={ShieldCheck}
        badgeLabel="Pour les garants"
        titleStart="Vous vous portez garant ?"
        titleEnd="Restez en contrôle"
        description="Comprenez votre engagement, suivez les paiements de la personne que vous cautionnez, et soyez alerté tôt en cas de difficulté. Sans pour autant être harcelé pour rien."
        primaryCta={{ label: "Créer mon espace garant", href: "/auth/signup?role=guarantor" }}
        secondaryCta={{ label: "J’ai reçu une invitation", href: "/invite" }}
        reassurances={[
          "100 % gratuit pour le garant",
          "Acte de caution conforme",
          "Visibilité temps réel sur les paiements",
        ]}
      />

      <SolutionStats
        theme={THEME}
        stats={[
          { value: 100, suffix: " %", label: "Mentions obligatoires conformes", icon: ShieldCheck },
          { value: 5, suffix: " jours", label: "Avant alerte sur retard", icon: Clock },
          { value: 0, suffix: " €", label: "Coût pour le garant", icon: CheckCircle2 },
          { value: 22, prefix: "art. ", suffix: "-1", label: "Loi 89-462 respectée", icon: Scale },
        ]}
      />

      <SolutionSEOIntro
        eyebrow="Espace garant"
        heading="Un cautionnement transparent, sans piège"
        paragraphs={[
          "Se porter garant, c’est s’engager juridiquement à payer le loyer, les charges et éventuellement les indemnités d’occupation à la place du locataire s’il ne le fait pas. Cet engagement est encadré par les articles 22-1 de la loi du 6 juillet 1989 et 2297 du Code civil : il doit comporter des mentions obligatoires précises, en chiffres et en lettres, avec une durée et un plafond clairement indiqués. Talok présente l’acte intégralement avant signature, en français clair, sans jargon.",
          "Une fois la caution active, votre tableau de bord vous donne une vue temps réel sur la situation : loyer en cours, statut payé/en retard, montant cumulé sur la période, durée restante de votre engagement, plafond exact. Pas besoin d’appeler le locataire ou le bailleur tous les 10 du mois pour savoir si « ça a été payé » — l’information est là, en permanence, sans intrusion dans la vie privée de la personne que vous cautionnez (vous voyez seulement les loyers, pas ses autres données).",
          "Talok ajoute deux protections importantes. D’une part, des alertes intelligentes : vous n’êtes notifié que lorsqu’un loyer accuse un retard significatif (par défaut 5 jours), pas pour chaque petit décalage. D’autre part, vos documents sont archivés à vie : acte de caution, bail, avenants, quittances, courriers de mise en demeure éventuelle. Précieux le jour où vous voulez résilier votre engagement (cautionnement à durée indéterminée) ou répondre à une banque qui vous demande votre situation.",
        ]}
        keywords={[
          "espace garant",
          "acte de cautionnement",
          "caution solidaire bail",
          "engagement de caution",
          "article 22-1 loi 1989",
          "article 2297 Code civil",
          "résiliation cautionnement",
          "plafond caution",
          "durée cautionnement",
          "garant étudiant",
        ]}
      />

      <SolutionPainPoints
        theme={THEME}
        heading="Les vraies inquiétudes du garant"
        subheading="Et la transparence que Talok apporte."
        items={[
          {
            icon: AlertTriangle,
            title: "« Je ne sais pas vraiment à quoi je m’engage »",
            solution:
              "Talok présente l’acte avec montants en chiffres et en lettres, durée, plafond et limites avant signature. Toutes les mentions légales sont expliquées en français clair.",
          },
          {
            icon: AlertTriangle,
            title: "« Je n’ai aucune visibilité sur les paiements »",
            solution:
              "Tableau de bord temps réel : loyer payé/en retard, période actuelle, plafond restant. Pas besoin de demander au locataire ni au bailleur.",
          },
          {
            icon: AlertTriangle,
            title: "« Je découvre les problèmes trop tard »",
            solution:
              "Alerte dès qu’un loyer est en retard de 5 jours, avant que la situation se dégrade. Vous pouvez réagir tôt avec le locataire.",
          },
        ]}
      />

      <SolutionHowItWorks
        theme={THEME}
        heading="De l’invitation à la sérénité, en 4 étapes"
        steps={[
          {
            icon: Inbox,
            title: "Recevoir l’invitation",
            desc: "Le bailleur ou le locataire vous envoie un lien sécurisé.",
          },
          {
            icon: Eye,
            title: "Lire l’acte",
            desc: "Lecture intégrale, mentions obligatoires expliquées.",
          },
          {
            icon: FileSignature,
            title: "Signer électroniquement",
            desc: "Mentions manuscrites guidées, signature à valeur légale.",
          },
          {
            icon: PieChart,
            title: "Suivre en temps réel",
            desc: "Tableau de bord paiements, alertes intelligentes, archives.",
          },
        ]}
      />

      <SolutionFeatures
        theme={THEME}
        heading="Votre tableau de bord garant"
        subheading="Tout ce qu’il faut pour exercer sereinement votre rôle."
        features={[
          {
            icon: FileSignature,
            title: "Signer l’acte à distance",
            description:
              "Acte conforme aux articles 22-1 (loi 1989) et 2297 (Code civil). Mentions manuscrites guidées, signature électronique eIDAS. Reçu en PDF immédiatement.",
          },
          {
            icon: Eye,
            title: "Suivre les loyers en temps réel",
            description:
              "Tableau de bord avec statut de chaque période : payée, en retard, contestée. Aucune surprise, vous voyez tout sans intrusion.",
          },
          {
            icon: Bell,
            title: "Alertes intelligentes",
            description:
              "Notification dès qu’un loyer est en retard significatif (5 j par défaut). Pas de spam : vous n’êtes prévenu que quand c’est important.",
          },
          {
            icon: FileCheck,
            title: "Documents centralisés",
            description:
              "Acte de caution, bail, avenants, quittances et courriers accessibles à vie. Pratique pour les démarches bancaires ou administratives.",
          },
          {
            icon: Scale,
            title: "Vos droits, expliqués",
            description:
              "Plafond exact, durée restante, modalités de résiliation : tout est rappelé en haut de votre tableau de bord en permanence.",
          },
          {
            icon: MessageSquare,
            title: "Modèle de résiliation inclus",
            description:
              "Lettre de résiliation prête à l’emploi (cautionnement à durée indéterminée), envoi en recommandé tracé, accusé de réception archivé.",
          },
        ]}
      />

      <SolutionComparison
        theme={THEME}
        heading="Avant Talok / avec Talok"
        rows={[
          {
            topic: "Comprendre l’engagement",
            without: "Acte papier dense, jargon juridique, signé sans tout lire",
            with: "Acte présenté en français clair, mentions expliquées",
          },
          {
            topic: "Visibilité paiements",
            without: "Demander au locataire, parfois conflictuel",
            with: "Tableau de bord temps réel, sans intrusion",
          },
          {
            topic: "Détection des retards",
            without: "Découverte du problème après plusieurs impayés",
            with: "Alerte automatique dès 5 jours de retard significatif",
          },
          {
            topic: "Documents",
            without: "Acte papier perdu, copie introuvable au moment crucial",
            with: "Coffre-fort numérique, accès à vie, exportable PDF",
          },
          {
            topic: "Résiliation",
            without: "Modèle introuvable, peur de mal faire",
            with: "Lettre type, envoi recommandé tracé, AR archivé",
          },
        ]}
      />

      <SolutionTestimonialCard
        theme={THEME}
        avatarIcon={ShieldCheck}
        testimonial={{
          quote:
            "Mon fils est étudiant à Lille. Avant Talok, je le harcelais le 10 du mois pour savoir s’il avait payé. Maintenant je vois directement dans l’app. Et je sais exactement ce que je risque.",
          author: "Patricia G.",
          location: "Pointe-à-Pitre, Guadeloupe",
          context: "Garante de son fils étudiant",
        }}
      />

      <SolutionFAQ
        heading="Vos questions de garant"
        items={[
          {
            question: "L’espace garant Talok est-il vraiment gratuit pour moi ?",
            answer:
              "Oui, totalement. Comme pour les locataires, votre espace est financé par l’abonnement du bailleur. Vous n’avez aucune carte bancaire à fournir pour activer votre espace, signer l’acte ou consulter les paiements.",
          },
          {
            question: "Quelle est la valeur juridique de l’acte de cautionnement signé sur Talok ?",
            answer:
              "L’acte respecte intégralement l’article 22-1 de la loi du 6 juillet 1989 et l’article 2297 du Code civil : montant maximal en chiffres et en lettres, durée, étendue de l’engagement, mention de connaissance des conséquences. La signature électronique est conforme au règlement européen eIDAS, avec la même valeur qu’une signature manuscrite sur papier.",
          },
          {
            question: "Puis-je résilier mon engagement de caution ?",
            answer:
              "Cela dépend de la durée prévue dans l’acte. Si la caution est à durée déterminée, l’engagement court jusqu’à la fin de cette durée. Si elle est à durée indéterminée, vous pouvez la résilier à tout moment par lettre recommandée — la résiliation prend effet à la fin du bail en cours. Talok inclut le modèle de lettre prêt à l’emploi.",
          },
          {
            question: "Quel est le plafond exact de mon engagement ?",
            answer:
              "Il est inscrit dans l’acte que vous avez signé : montant maximum cumulé que vous pouvez avoir à payer (loyers, charges, indemnités d’occupation, frais éventuels). Talok l’affiche en permanence en haut de votre tableau de bord, avec le solde déjà engagé. Votre responsabilité ne dépasse jamais ce plafond.",
          },
          {
            question: "Quelles informations sur le locataire puis-je voir ?",
            answer:
              "Strictement les informations liées au bail : montant du loyer, statut de paiement par période (payé/en retard), quittances, durée restante du bail. Vous ne voyez ni ses revenus, ni ses messages avec le bailleur, ni ses autres données personnelles. Talok respecte le RGPD.",
          },
          {
            question: "Que se passe-t-il si le locataire ne paie vraiment pas ?",
            answer:
              "Si après alertes le loyer reste impayé, le bailleur peut activer la caution selon les modalités prévues dans l’acte. Talok vous notifie de chaque étape, vous communique les courriers échangés, et conserve une trace de tout. Vous restez informé en continu — l’objectif est qu’aucune action ne se passe sans que vous le sachiez.",
          },
        ]}
      />

      <SolutionFinalCTA
        theme={THEME}
        heading="Vous avez reçu une invitation à vous porter garant ?"
        description="Activez votre espace en 2 minutes. Vous pourrez relire l’acte avant de le signer, et garder un œil sur les paiements en continu."
        primaryCta={{ label: "Activer mon invitation", href: "/invite" }}
        secondaryCta={{ label: "Une question juridique ?", href: "/contact" }}
        reassurance="Garant : c’est toujours gratuit · Aucune carte bancaire"
      />
    </div>
  );
}
