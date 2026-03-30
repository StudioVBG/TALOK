"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ_ITEMS = [
  {
    q: "Combien de temps pour être opérationnel ?",
    a: "10 minutes. Vous créez votre compte, ajoutez votre premier bien, et créez votre premier bail. Pas de formation, pas d'installation. Tout se fait depuis votre navigateur.",
  },
  {
    q: "C'est adapté à la Martinique / Guadeloupe / Réunion ?",
    a: "Oui, c'est même notre point fort. TVA locale, fuseaux horaires, codes postaux DROM-COM — tout est intégré nativement. Pas de bidouillage.",
  },
  {
    q: "Comment mes locataires paient ?",
    a: "Par carte bancaire ou virement SEPA, directement depuis un lien envoyé par Talok. L'argent arrive sur votre compte. La quittance part automatiquement.",
  },
  {
    q: "Je peux gérer une SCI ou plusieurs structures ?",
    a: "Oui, le plan Premium permet de gérer SCI, SARL, SAS ou indivision. Chaque structure a son espace, ses documents et ses flux, mais tout reste accessible depuis un seul compte.",
  },
  {
    q: "Mes données sont en sécurité ?",
    a: "Oui. Chiffrement de bout en bout, accès sécurisé, vérification en deux étapes. Conforme RGPD. Seuls vous et les personnes que vous autorisez peuvent voir vos données.",
  },
  {
    q: "Et si je veux juste essayer ?",
    a: "Le plan Découverte est 100% gratuit, sans limite de durée, pour 2 biens. Pas de carte bancaire demandée. Le plan Pro offre 14 jours d'essai gratuit si vous voulez aller plus loin.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="py-20 md:py-28">
      <div className="container mx-auto max-w-3xl px-4">
        <h2 className="reveal text-center font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Vous hésitez encore ? On répond à tout.
        </h2>

        <Accordion type="single" collapsible className="reveal mt-14">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-base font-medium">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
