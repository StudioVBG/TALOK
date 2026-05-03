"use client";

/**
 * Page Solution: Prestataires & artisans
 *
 * Persona: Karl, plombier indépendant en Martinique. Veut recevoir des
 * missions ciblées, envoyer des devis pro, facturer en ligne, gérer son
 * planning, encaisser plus vite, être visible auprès de centaines de
 * bailleurs et syndics.
 *
 * SEO: "logiciel artisan", "marketplace prestataires bâtiment",
 * "devis facture artisan", "logiciel BTP intervention", "logiciel plombier"
 */

import {
  Wrench,
  Briefcase,
  FileText,
  Calendar,
  Banknote,
  ShieldCheck,
  Star,
  Users,
  CheckCircle2,
  ClipboardCheck,
  Inbox,
  AlertTriangle,
  PiggyBank,
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
  gradient: "from-orange-400 via-amber-400 to-orange-300",
  accent: "orange",
  sparkleColor: "#FB923C",
};

export default function PrestatairesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <SolutionHero
        theme={THEME}
        badgeIcon={Wrench}
        badgeLabel="Pour les artisans & entreprises d’intervention"
        titleStart="Plus de chantiers,"
        titleEnd="moins de paperasse"
        description="Recevez des missions adaptées à votre métier et votre zone, envoyez devis et factures en quelques clics, gérez votre planning et encaissez plus vite. Tout sur Talok, gratuit, sans commission."
        primaryCta={{ label: "Rejoindre le catalogue", href: "/auth/signup?role=provider" }}
        secondaryCta={{ label: "Voir comment ça marche", href: "/fonctionnalites/tickets-et-travaux" }}
        reassurances={[
          "Inscription gratuite, sans engagement",
          "10 000+ bailleurs sur la plateforme",
          "Application iPhone & Android",
        ]}
      />

      <SolutionStats
        theme={THEME}
        stats={[
          { value: 10000, prefix: "", suffix: "+", label: "Bailleurs et syndics actifs", icon: Users },
          { value: 5, suffix: " min", label: "Pour créer un devis", icon: FileText },
          { value: 0, suffix: " %", label: "Commission sur vos chantiers", icon: PiggyBank },
          { value: 24, suffix: " h", label: "Validation de votre profil", icon: CheckCircle2 },
        ]}
      />

      <SolutionSEOIntro
        eyebrow="Espace prestataire"
        heading="Le logiciel d’artisan que vous attendiez"
        paragraphs={[
          "Vous êtes plombier, électricien, peintre, serrurier, climaticien ? Vous passez probablement plus de temps à courir après les paiements, à faire vos devis le soir sur Word et vos factures sur un autre logiciel, qu’à exercer votre métier. Talok change ça : une seule plateforme pour recevoir des missions, devis, planning, facturation et encaissement.",
          "Notre marketplace met en relation directe les bailleurs particuliers, investisseurs, agences et syndics avec des artisans vérifiés. Vous indiquez votre métier, votre zone d’intervention et vos disponibilités. Quand un ticket correspond, vous recevez une notification sur votre téléphone. Vous décidez d’accepter, de proposer un devis ou de passer. Aucune obligation, aucun chantier minimum.",
          "Côté outils : devis et factures pré-remplis aux normes (numérotation auto, mentions légales, TVA, BIC), conversion en un clic, signature électronique, paiement par CB ou virement directement après facturation. Stockage de vos attestations (décennale, RC pro, Kbis, URSSAF) avec rappel avant expiration. Avis clients sur votre profil public pour booster votre visibilité. Tout en français, optimisé pour le terrain depuis votre smartphone.",
        ]}
        keywords={[
          "logiciel artisan",
          "logiciel plombier",
          "logiciel électricien",
          "marketplace prestataires bâtiment",
          "devis en ligne artisan",
          "facture en ligne artisan",
          "planning intervention",
          "attestation décennale",
          "trouver des chantiers",
          "BTP intervention",
        ]}
      />

      <SolutionPainPoints
        theme={THEME}
        heading="Les vraies frustrations des artisans"
        subheading="Et comment Talok les résout, concrètement."
        items={[
          {
            icon: AlertTriangle,
            title: "« Je perds des heures à courir après les paiements »",
            solution:
              "Devis signé en ligne, facture envoyée à la fin du chantier, paiement par CB ou virement directement dans Talok. Vous êtes payé plus vite, sans relance.",
          },
          {
            icon: AlertTriangle,
            title: "« Je dois trouver mes clients moi-même »",
            solution:
              "Inscrivez-vous au catalogue. Plus de 10 000 bailleurs et syndics vous voient quand un ticket correspond à votre métier et votre zone géographique.",
          },
          {
            icon: AlertTriangle,
            title: "« Mon agenda est un fichier Excel chaotique »",
            solution:
              "Planning visuel avec créneaux, rappels SMS automatiques aux clients, vue des chantiers en cours. Synchro Google Calendar et iCloud.",
          },
        ]}
      />

      <SolutionHowItWorks
        theme={THEME}
        heading="4 étapes pour démarrer"
        steps={[
          {
            icon: ClipboardCheck,
            title: "Inscription en 5 min",
            desc: "Métier, zone, photos, attestation décennale. Validation sous 24 h.",
          },
          {
            icon: Inbox,
            title: "Recevez des tickets",
            desc: "Notifications quand un bien dans votre zone a besoin de votre métier.",
          },
          {
            icon: FileText,
            title: "Devis → mission → facture",
            desc: "Tout dans Talok, avec signature et paiement intégrés.",
          },
          {
            icon: Star,
            title: "Notation client",
            desc: "L’avis du bailleur ou locataire booste votre profil public.",
          },
        ]}
      />

      <SolutionFeatures
        theme={THEME}
        heading="Votre logiciel d’artisan complet"
        subheading="Du premier contact au paiement, sans changer d’outil."
        features={[
          {
            icon: Briefcase,
            title: "Recevoir des missions ciblées",
            description:
              "Bailleurs et syndics envoient des tickets adaptés à votre métier, votre zone et vos disponibilités. Plus de prospection à froid.",
          },
          {
            icon: FileText,
            title: "Devis & factures en 5 minutes",
            description:
              "Modèles pros pré-remplis, signature électronique, conversion devis → facture en un clic. Numérotation et archivage automatiques.",
          },
          {
            icon: Calendar,
            title: "Planning & rendez-vous",
            description:
              "Calendrier des interventions, rappels SMS au client, gestion des urgences. Synchronisation Google Calendar / iCloud.",
          },
          {
            icon: Banknote,
            title: "Encaisser plus vite",
            description:
              "Paiement par CB ou virement directement après facturation. Versement rapide. Suivi des impayés intégré.",
          },
          {
            icon: ShieldCheck,
            title: "Conformité & assurances",
            description:
              "Stockez attestation décennale, RC pro, Kbis, URSSAF. Renouvellement signalé automatiquement avant expiration.",
          },
          {
            icon: Star,
            title: "Avis & portfolio",
            description:
              "Chaque mission notée alimente votre profil public. Photos avant/après pour montrer la qualité de votre travail.",
          },
        ]}
      />

      <SolutionComparison
        theme={THEME}
        heading="Avant Talok / avec Talok"
        rows={[
          {
            topic: "Trouver des clients",
            without: "Bouche à oreille, prospection à froid, panneaux dans la rue",
            with: "Catalogue Talok visible par 10 000+ bailleurs et syndics",
          },
          {
            topic: "Faire un devis",
            without: "30 min sur Word, parfois oublié de signer",
            with: "Modèle pré-rempli, devis signé électroniquement en 5 min",
          },
          {
            topic: "Encaisser",
            without: "Chèque, virement à relancer, parfois mois de délai",
            with: "Paiement CB / virement intégré dès la facture",
          },
          {
            topic: "Planning",
            without: "Excel, agenda papier, rendez-vous oubliés",
            with: "Calendrier centralisé, rappels SMS au client",
          },
          {
            topic: "Documents pro",
            without: "Décennale archivée n’importe où, expiration oubliée",
            with: "Stockage sécurisé + alerte avant expiration",
          },
          {
            topic: "Réputation",
            without: "Pas de visibilité du sérieux de votre travail",
            with: "Profil public avec avis vérifiés et portfolio photos",
          },
        ]}
      />

      <SolutionTestimonialCard
        theme={THEME}
        avatarIcon={Wrench}
        testimonial={{
          quote:
            "Avant Talok, je passais une heure le soir à faire mes devis sur Word et mes factures sur un autre logiciel. Maintenant tout est dans la poche, et les bailleurs me trouvent au lieu de l’inverse.",
          author: "Karl D.",
          location: "Le Lamentin, Martinique",
          context: "Plombier · 12 ans d’expérience",
        }}
      />

      <SolutionFAQ
        heading="Vos questions de prestataire"
        items={[
          {
            question: "Combien Talok prélève sur mes chantiers ?",
            answer:
              "Zéro. Talok ne prend aucune commission sur les chantiers que vous réalisez. Le bailleur paie le montant que vous facturez, point. Notre modèle économique repose sur l’abonnement des bailleurs et syndics, pas sur vos revenus d’artisan.",
          },
          {
            question: "Quels métiers sont acceptés sur la marketplace ?",
            answer:
              "Tous les métiers liés au logement et à l’entretien d’un bien : plomberie, électricité, peinture, serrurerie, vitrerie, climatisation, jardinage, ménage de fin de bail, ramonage, débouchage, désinsectisation, multiservices… Si votre métier intervient régulièrement chez un bailleur, vous avez votre place.",
          },
          {
            question: "Quels documents dois-je fournir pour être validé ?",
            answer:
              "Trois documents obligatoires : votre Kbis (ou statut équivalent), votre attestation d’assurance décennale (si métier concerné) ou RC pro à jour, et une attestation URSSAF/cotisations. Validation sous 24 h ouvrables. Rappel automatique avant expiration de chaque document.",
          },
          {
            question: "Comment fonctionne le paiement après une mission ?",
            answer:
              "Vous facturez via Talok à la fin du chantier. Le bailleur règle directement (CB ou virement) dans la plateforme. Le montant est versé sur votre compte bancaire après vérification (généralement sous 2 à 5 jours ouvrés). Aucun délai grand-compte, pas de chèque qui se perd.",
          },
          {
            question: "Puis-je décliner une mission qui ne me convient pas ?",
            answer:
              "Bien sûr. Quand vous recevez un ticket, vous décidez d’accepter, de proposer un devis avec contre-proposition de date, ou de décliner sans justification. Aucune obligation, aucun chantier minimum. Votre taux de réponse est tout de même affiché sur votre profil — répondre rapidement (même par un refus) booste votre score.",
          },
          {
            question: "Mes données de chantier restent-elles privées ?",
            answer:
              "Oui. Les détails techniques d’un chantier (adresse, nature de l’intervention, photos avant/après) ne sont visibles que par vous, le bailleur et le locataire concerné. Talok ne revend aucune donnée. Votre profil public, lui, n’expose que les informations que vous choisissez (zone, métier, photos portfolio, avis).",
          },
        ]}
      />

      <SolutionFinalCTA
        theme={THEME}
        heading="Prêt à recevoir vos premières missions ?"
        description="Inscription gratuite, aucune commission sur vos chantiers, validation de votre profil sous 24 h ouvrables."
        primaryCta={{ label: "Créer mon profil prestataire", href: "/auth/signup?role=provider" }}
        secondaryCta={{ label: "Une question ?", href: "/contact" }}
        reassurance="Gratuit · Sans engagement · Support en français"
      />
    </div>
  );
}
