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
        answer: "Talok est un logiciel de gestion locative tout-en-un pour propriétaires bailleurs. Il permet de gérer vos biens, locataires, baux, quittances, états des lieux et comptabilité depuis une seule plateforme. Conçu en Martinique, Talok est le seul logiciel qui couvre spécifiquement les DOM-TOM.",
      },
      {
        question: "Pour qui est fait Talok ?",
        answer: "Talok s'adresse aux propriétaires particuliers (1-3 biens), investisseurs (5-50 biens), SCI familiales, et administrateurs de biens professionnels (50+ biens). Chaque profil dispose de fonctionnalités adaptées à ses besoins.",
      },
      {
        question: "Puis-je essayer Talok gratuitement ?",
        answer: "Oui ! Talok propose un essai gratuit de 14 jours sur tous les plans payants, sans carte bancaire requise. Vous avez également un plan gratuit permanent pour 1 bien avec les fonctionnalités essentielles.",
      },
    ],
  },
  {
    title: "Tarifs & Abonnements",
    items: [
      {
        question: "Combien coûte Talok ?",
        answer: "Talok propose plusieurs plans : Gratuit (1 bien), Starter à 9€/mois (3 biens), Confort à 35€/mois (10 biens), Pro à 69€/mois (50 biens), et des offres Enterprise à partir de 249€/mois. Réduction de 20% sur l'abonnement annuel.",
      },
      {
        question: "Y a-t-il des frais cachés ?",
        answer: "Non, le prix affiché est le prix payé. Les seuls coûts supplémentaires possibles sont les biens au-delà du quota (2-3€/bien) et les signatures électroniques supplémentaires au-delà du quota inclus dans votre plan.",
      },
      {
        question: "Puis-je changer de forfait à tout moment ?",
        answer: "Oui, vous pouvez upgrader ou downgrader votre forfait à tout moment. En cas d'upgrade, vous payez la différence au prorata. En cas de downgrade, le nouveau tarif s'applique à la prochaine période de facturation.",
      },
      {
        question: "Comment fonctionne le 1er mois offert ?",
        answer: "Le 1er mois est entièrement gratuit sur tous les forfaits payants. Vous enregistrez votre moyen de paiement à l'inscription mais vous ne serez prélevé qu'à partir du 2ème mois. Vous pouvez annuler à tout moment.",
      },
    ],
  },
  {
    title: "Fonctionnalités",
    items: [
      {
        question: "Les documents sont-ils conformes à la loi ALUR ?",
        answer: "Oui, tous nos documents (baux, quittances, états des lieux) sont conformes à la loi ALUR et régulièrement mis à jour par notre équipe juridique. Vous avez la garantie d'utiliser des documents légaux.",
      },
      {
        question: "Comment fonctionne la signature électronique ?",
        answer: "Talok intègre une signature électronique conforme au règlement européen eIDAS. Vos signataires reçoivent un email avec un lien sécurisé. Ils peuvent signer depuis n'importe quel appareil. Le document signé a la même valeur juridique qu'une signature manuscrite.",
      },
      {
        question: "Qu'est-ce que le scoring IA des locataires ?",
        answer: "Notre algorithme d'intelligence artificielle analyse les dossiers de candidature et attribue un score de solvabilité de 0 à 100. Il prend en compte les revenus, charges, situation professionnelle et historique. Précision de 94% pour prédire les risques d'impayés.",
      },
      {
        question: "Puis-je importer mes biens depuis Excel ?",
        answer: "Oui, Talok permet d'importer vos biens et locataires depuis un fichier Excel ou CSV. Notre système de mapping intelligent associe automatiquement vos colonnes aux champs Talok. Import en moins de 30 minutes pour un portefeuille de 50 biens.",
      },
    ],
  },
  {
    title: "Support & Sécurité",
    items: [
      {
        question: "Comment contacter le support ?",
        answer: "Notre support est disponible par email (support@talok.fr), téléphone (Métropole et Antilles), et chat dans l'application. Temps de réponse moyen : moins de 2 heures en jours ouvrés.",
      },
      {
        question: "Mes données sont-elles sécurisées ?",
        answer: "Oui, vos données sont hébergées en France sur des serveurs sécurisés. Nous utilisons le chiffrement TLS, sommes conformes RGPD, et effectuons des sauvegardes quotidiennes. Vos documents sont conservés 10 ans minimum.",
      },
      {
        question: "Puis-je exporter mes données si je résilie ?",
        answer: "Absolument. Vous pouvez exporter toutes vos données à tout moment depuis votre compte. Après résiliation, vos données sont conservées 30 jours avant suppression définitive.",
      },
    ],
  },
  {
    title: "DOM-TOM",
    items: [
      {
        question: "Talok est-il adapté aux DOM-TOM ?",
        answer: "Oui, Talok est né en Martinique et a été conçu spécifiquement pour les réalités des DOM-TOM. Support sur le fuseau horaire des Antilles, délais postaux intégrés, fiscalité Pinel Outre-Mer, réglementations locales.",
      },
      {
        question: "Quels territoires sont couverts ?",
        answer: "Talok couvre tous les DOM-TOM : Martinique, Guadeloupe, Guyane, La Réunion, Mayotte, ainsi que les COM (Saint-Martin, Saint-Barthélemy, Polynésie française, Nouvelle-Calédonie).",
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
