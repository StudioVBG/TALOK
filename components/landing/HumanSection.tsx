"use client";

import { Home, Briefcase, User } from "lucide-react";

const CARDS = [
  {
    title: "Propriétaire rassuré",
    text: "Vision claire des loyers et des documents. Tout est rangé, suivi, à jour.",
    gradient: "from-talok-bleu-marque/30 to-talok-cyan/20",
    icon: Home,
    iconColor: "text-talok-bleu-marque",
    large: true,
  },
  {
    title: "Gestionnaire efficace",
    text: "Demandes et suivis traités en un clic",
    gradient: "from-talok-vert/30 to-talok-cyan/20",
    icon: Briefcase,
    iconColor: "text-talok-vert",
    large: false,
  },
  {
    title: "Locataire satisfait",
    text: "Paiement simple, réponses rapides",
    gradient: "from-talok-cyan/30 to-talok-bleu-marque/20",
    icon: User,
    iconColor: "text-talok-cyan",
    large: false,
  },
];

function CardIcon({ card, size, extra }: { card: typeof CARDS[number]; size: string; extra?: string }) {
  const Icon = card.icon;
  return <Icon className={`${size} ${extra || ""}`} />;
}

export function HumanSection() {
  const mainCard = CARDS[0];
  const MainIcon = mainCard.icon;

  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="reveal mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-talok-cyan/10 px-4 py-1.5 text-sm font-medium text-talok-cyan">
            Pensé pour de vraies personnes
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Derrière chaque clic, quelqu&apos;un qui gagne du temps.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Talok n&apos;est pas un outil de plus. C&apos;est l&apos;assistant qui manquait
            aux propriétaires débordés, aux locataires qui veulent des réponses
            rapides, et aux gestionnaires qui veulent dormir tranquille.
          </p>
        </div>

        {/* Asymmetric grid: 1 large + 2 small */}
        <div className="reveal mt-14 grid gap-6 md:grid-cols-2">
          {/* Large card */}
          <div className="relative overflow-hidden rounded-2xl md:row-span-2">
            <div className={`absolute inset-0 bg-gradient-to-br ${mainCard.gradient}`} />
            <div className="absolute inset-0 flex items-center justify-center opacity-10">
              <MainIcon className="h-48 w-48 text-talok-bleu-nuit" strokeWidth={0.5} />
            </div>
            <div className="relative flex h-full min-h-[320px] flex-col justify-end p-6 md:min-h-[400px]">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm">
                <MainIcon className={`h-6 w-6 ${mainCard.iconColor}`} />
              </div>
              <h3 className="font-display text-xl font-bold text-talok-bleu-nuit">
                {mainCard.title}
              </h3>
              <p className="mt-1 text-sm text-talok-bleu-nuit/70">
                {mainCard.text}
              </p>
            </div>
          </div>

          {/* Small cards */}
          {CARDS.slice(1).map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="relative overflow-hidden rounded-2xl"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient}`} />
                <div className="absolute right-4 top-4 opacity-10">
                  <Icon className="h-24 w-24 text-talok-bleu-nuit" strokeWidth={0.5} />
                </div>
                <div className="relative flex min-h-[180px] flex-col justify-end p-6 md:min-h-[190px]">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
                    <Icon className={`h-5 w-5 ${card.iconColor}`} />
                  </div>
                  <h3 className="font-display text-lg font-bold text-talok-bleu-nuit">
                    {card.title}
                  </h3>
                  <p className="mt-1 text-sm text-talok-bleu-nuit/70">
                    {card.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
