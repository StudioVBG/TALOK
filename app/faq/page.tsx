"use client";

/**
 * Page FAQ
 *
 * Questions fréquentes avec schema markup
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  HelpCircle,
  ArrowRight,
  MessageSquare,
  Sparkles,
} from "lucide-react";

const FAQ_CATEGORIES = [
  {
    title: "Général",
    items: [
      {
        question: "Qu'est-ce que Talok ?",
        answer: "Talok est un logiciel de gestion locative tout-en-un. Il permet de gérer vos biens, locataires, baux, quittances, états des lieux, collecte de loyers et comptabilité depuis une seule plateforme. Né en Martinique, Talok est le seul logiciel conçu nativement pour toute la France, y compris la France d'outre-mer.",
      },
      {
        question: "Pour qui est fait Talok ?",
        answer: "Talok s'adresse aux propriétaires particuliers (1 à 3 biens), investisseurs et SCI (5 à 50 biens), agences immobilières, syndics de copropriété, et prestataires du bâtiment. Chaque profil dispose de fonctionnalités adaptées à ses besoins.",
      },
      {
        question: "Puis-je essayer Talok gratuitement ?",
        answer: "Oui ! Les plans Starter, Confort et Pro bénéficient du 1er mois offert (30 jours) sans engagement. De plus, le plan Gratuit est permanent et vous permet de gérer 1 bien avec les fonctionnalités essentielles, sans carte bancaire.",
      },
    ],
  },
  {
    title: "Inscription et compte",
    items: [
      {
        question: "Comment créer un compte ?",
        answer: "Inscrivez-vous en quelques clics depuis la page d'accueil. Choisissez votre rôle (propriétaire, locataire, etc.), confirmez votre email, et commencez à utiliser la plateforme immédiatement.",
      },
      {
        question: "Puis-je avoir plusieurs rôles (propriétaire et locataire) ?",
        answer: "Non, chaque adresse email est associée à un seul rôle. Si vous êtes à la fois propriétaire et locataire, vous pouvez créer deux comptes avec deux adresses email différentes.",
      },
    ],
  },
  {
    title: "Forfaits et tarifs",
    items: [
      {
        question: "Combien coûte Talok ?",
        answer: "Gratuit (1 bien), Starter à 9 €/mois (3 biens), Confort à 35 €/mois (10 biens, 2 signatures incluses, collecte de loyers), Pro à 69 €/mois (50 biens, 10 signatures, agent IA). Réduction de 20 % sur l'abonnement annuel : 336 €/an (Confort) ou 662 €/an (Pro). Premier mois offert sur tous les plans payants. TVA en sus selon votre localisation.",
      },
      {
        question: "Y a-t-il des frais cachés ?",
        answer: "Non, aucun frais caché. Le prix affiché est le prix hors taxes. Des frais de paiement s'appliquent uniquement si vous utilisez la collecte automatique de loyers : 2,2 % par carte bancaire ou 0,50 € par prélèvement SEPA. La TVA s'applique selon votre territoire.",
      },
      {
        question: "Puis-je changer de forfait à tout moment ?",
        answer: "Oui, vous pouvez upgrader ou downgrader votre forfait à tout moment depuis votre espace client. En cas d'upgrade, vous payez la différence au prorata. En cas de downgrade, le nouveau tarif s'applique à la prochaine période de facturation.",
      },
      {
        question: "Comment fonctionne la réduction annuelle ?",
        answer: "L'abonnement annuel offre -20 % par rapport au mensuel. Par exemple, le plan Confort passe de 420 € (12 × 35 €) à 336 €/an, soit une économie de 84 €.",
      },
    ],
  },
  {
    title: "Paiements et loyers",
    items: [
      {
        question: "Comment fonctionne la collecte automatique des loyers ?",
        answer: "À partir du plan Starter, vos locataires paient par prélèvement automatique. Le loyer est prélevé à la date choisie, une quittance est générée automatiquement, et le montant net (après frais de paiement) est reversé sur votre compte sous 5 à 7 jours ouvrés.",
      },
      {
        question: "Quels sont les frais sur les loyers collectés ?",
        answer: "Les frais de paiement sont de 2,2 % par carte bancaire ou 0,50 € par prélèvement SEPA (1,9 % CB et 0,40 € SEPA pour les plans Enterprise). Par exemple, sur un loyer de 700 € par SEPA, les frais sont de 0,50 €.",
      },
      {
        question: "Le locataire doit-il créer un compte ?",
        answer: "Oui, le locataire reçoit une invitation par email pour créer son compte gratuit. Il dispose ensuite de son propre espace avec ses quittances, documents et un accès à la messagerie avec le propriétaire.",
      },
    ],
  },
  {
    title: "Documents et signatures",
    items: [
      {
        question: "Les baux sont-ils conformes à la loi ?",
        answer: "Oui, tous les documents générés par Talok (baux d'habitation, baux meublés, quittances, avis d'échéance, états des lieux) sont conformes aux lois ALUR et ELAN en vigueur, et régulièrement mis à jour.",
      },
      {
        question: "Comment fonctionne la signature électronique ?",
        answer: "Les signataires reçoivent un email avec un lien sécurisé. Ils vérifient leur identité, signent depuis n'importe quel appareil, et le document signé a la même valeur légale qu'un original papier.",
      },
      {
        question: "Combien de signatures sont incluses ?",
        answer: "Le plan Gratuit n'inclut pas de signature. Le plan Confort inclut 5 signatures par mois. Le plan Pro offre des signatures illimitées. Des packs de 10 signatures supplémentaires sont disponibles à 19 €.",
      },
    ],
  },
  {
    title: "Baux et contrats",
    items: [
      {
        question: "Puis-je gérer des colocations ?",
        answer: "Oui, Talok gère les colocations avec baux individuels ou collectifs, répartition des charges, planning de ménage et règlement intérieur partagé.",
      },
      {
        question: "Comment résilier un bail ?",
        answer: "Depuis la fiche du bail, vous pouvez lancer la procédure de congé (préavis propriétaire ou locataire), générer la lettre de congé, planifier l'état des lieux de sortie et calculer la restitution du dépôt de garantie.",
      },
    ],
  },
  {
    title: "Sécurité et données",
    items: [
      {
        question: "Mes données sont-elles sécurisées ?",
        answer: "Oui. Vos données sont hébergées en Union Européenne sur des serveurs sécurisés. Nous utilisons le chiffrement TLS en transit et AES-256 au repos, la double vérification de sécurité (2FA), et l'isolation stricte des données entre utilisateurs. Talok est conforme au RGPD.",
      },
      {
        question: "Puis-je exporter mes données ?",
        answer: "Oui, conformément à l'article 20 du RGPD (droit à la portabilité), vous pouvez exporter toutes vos données à tout moment depuis votre espace client. Après résiliation, vos données sont conservées 90 jours avant suppression.",
      },
      {
        question: "Comment contacter le support ?",
        answer: "Par email à support@talok.fr (réponse sous 48h pour le plan Gratuit, 24h pour Confort, prioritaire pour Pro). Un chat en direct est disponible pour les utilisateurs Pro.",
      },
    ],
  },
  {
    title: "France d'outre-mer",
    items: [
      {
        question: "Talok est-il adapté à l'outre-mer ?",
        answer: "Talok est né en Martinique. Il n'a pas été « adapté » à l'outre-mer — il a été conçu ici. TVA spécifique par territoire (8,5 % Martinique/Guadeloupe/Réunion, 2,1 % Guyane, 0 % Mayotte), codes postaux, réglementations locales : tout est intégré nativement.",
      },
      {
        question: "Quels territoires sont couverts ?",
        answer: "Talok couvre l'ensemble de la France : métropole et les DROM (Martinique, Guadeloupe, Guyane, La Réunion, Mayotte). Les COM (Saint-Martin, Saint-Barthélemy) sont également supportées.",
      },
      {
        question: "La TVA est-elle calculée automatiquement ?",
        answer: "Oui. Talok applique automatiquement le bon taux de TVA selon le territoire du bien : 20 % en métropole, 8,5 % en Martinique/Guadeloupe/Réunion, 2,1 % en Guyane, 0 % à Mayotte.",
      },
    ],
  },
];

export default function FAQPage() {
  // Generate schema for SEO
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_CATEGORIES.flatMap((cat) =>
      cat.items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      }))
    ),
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Hero */}
      <section className="relative pt-24 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 mb-4">
              <HelpCircle className="w-3 h-3 mr-1" />
              Centre d'aide
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Questions{" "}
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                Fréquentes
              </span>
            </h1>

            <p className="text-lg text-slate-400">
              Trouvez rapidement les réponses à vos questions sur Talok.
              Vous ne trouvez pas ce que vous cherchez ? Contactez-nous.
            </p>
          </motion.div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-12">
            {FAQ_CATEGORIES.map((category, catIndex) => (
              <motion.div
                key={category.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: catIndex * 0.1 }}
              >
                <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-slate-800">
                  {category.title}
                </h2>
                <Accordion type="single" collapsible className="space-y-3">
                  {category.items.map((item, itemIndex) => (
                    <AccordionItem
                      key={itemIndex}
                      value={`${catIndex}-${itemIndex}`}
                      className="bg-slate-800/30 border border-slate-700/50 rounded-xl px-6 overflow-hidden"
                    >
                      <AccordionTrigger className="text-left text-white hover:no-underline py-4">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-slate-400 pb-4">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-violet-900/50 to-purple-900/50 rounded-3xl p-12 border border-violet-500/30"
          >
            <MessageSquare className="w-12 h-12 text-violet-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">
              Vous avez d'autres questions ?
            </h2>
            <p className="text-slate-300 mb-6">
              Notre équipe est là pour vous aider. Contactez-nous et obtenez une réponse sous 24h.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                  Nous contacter
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/auth/signup">
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                  Essayer gratuitement
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
