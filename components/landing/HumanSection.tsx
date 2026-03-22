"use client";

const CARDS = [
  {
    title: "Propriétaire rassuré",
    text: "Vision claire des loyers et des documents",
    gradient: "from-talok-bleu-marque/30 to-talok-cyan/20",
    large: true,
  },
  {
    title: "Gestionnaire efficace",
    text: "Demandes et suivis traités en un clic",
    gradient: "from-talok-vert/30 to-talok-cyan/20",
    large: false,
  },
  {
    title: "Locataire satisfait",
    text: "Paiement simple, réponses rapides",
    gradient: "from-talok-cyan/30 to-talok-bleu-marque/20",
    large: false,
  },
];

export function HumanSection() {
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
            <div className={`absolute inset-0 bg-gradient-to-br ${CARDS[0].gradient}`} />
            {/* TODO: <Image src="/images/human-owner.jpg" alt="Propriétaire rassuré" fill className="object-cover" /> */}
            <div className="relative flex h-full min-h-[320px] flex-col justify-end p-6 md:min-h-[400px]">
              <h3 className="font-display text-xl font-bold text-talok-bleu-nuit">
                {CARDS[0].title}
              </h3>
              <p className="mt-1 text-sm text-talok-bleu-nuit/70">
                {CARDS[0].text}
              </p>
            </div>
          </div>

          {/* Small cards */}
          {CARDS.slice(1).map((card) => (
            <div
              key={card.title}
              className="relative overflow-hidden rounded-2xl"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient}`} />
              {/* TODO: <Image src="/images/human-xxx.jpg" alt={card.title} fill className="object-cover" /> */}
              <div className="relative flex min-h-[180px] flex-col justify-end p-6 md:min-h-[190px]">
                <h3 className="font-display text-lg font-bold text-talok-bleu-nuit">
                  {card.title}
                </h3>
                <p className="mt-1 text-sm text-talok-bleu-nuit/70">
                  {card.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
