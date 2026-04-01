"use client";

import { Badge } from "@/components/ui/badge";

const CARDS = [
  {
    emoji: "💰",
    title: "La bonne TVA, au bon endroit",
    text: "Talok applique automatiquement la TVA de votre territoire : 8,5 % en Martinique, Guadeloupe et Réunion — 2,1 % en Guyane — 0 % à Mayotte. Pas besoin de calculer vous-même.",
  },
  {
    emoji: "🕐",
    title: "Relances au bon moment",
    text: "Les notifications et relances respectent votre fuseau horaire. Pas de SMS à 3h du matin parce que le serveur est à Paris.",
  },
  {
    emoji: "📮",
    title: "Adresses reconnues",
    text: "Les codes postaux 972, 973, 974, 976 sont gérés nativement. Pas de formulaire qui bloque parce que votre adresse « n'existe pas ».",
  },
];

const TERRITORIES = [
  { name: "Martinique", tva: "8,5 %" },
  { name: "Guadeloupe", tva: "8,5 %" },
  { name: "La Réunion", tva: "8,5 %" },
  { name: "Guyane", tva: "2,1 %" },
  { name: "Mayotte", tva: "0 %" },
  { name: "Métropole", tva: null },
];

export function DomTomSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="reveal mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Pensé pour la Martinique, la Guadeloupe, la Réunion — et toute la France
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Les autres plateformes sont faites pour Paris. Talok est née en
            Martinique — pas adaptée, née ici.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {CARDS.map((card) => (
            <div
              key={card.title}
              className="reveal rounded-2xl border bg-white p-6 shadow-sm"
            >
              <span className="text-3xl">{card.emoji}</span>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                {card.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {card.text}
              </p>
            </div>
          ))}
        </div>

        <div className="reveal mt-10 flex flex-wrap items-center justify-center gap-3">
          {TERRITORIES.map((t) => (
            <Badge
              key={t.name}
              variant="secondary"
              className="px-4 py-1.5 text-sm"
            >
              {t.name}{t.tva ? ` · TVA ${t.tva}` : ""}
            </Badge>
          ))}
        </div>
      </div>
    </section>
  );
}
