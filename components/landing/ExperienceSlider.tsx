"use client";

const SLIDES = [
  {
    tag: "En 5 min",
    title: "Créer un bail complet",
    text: "L'assistant vous guide, le contrat sort conforme",
    gradient: "from-talok-bleu-marque/20 to-talok-cyan/10",
  },
  {
    tag: "Zéro oubli",
    title: "Recevoir les loyers",
    text: "Paiement en ligne, suivi automatique, quittance envoyée",
    gradient: "from-talok-vert/20 to-talok-cyan/10",
  },
  {
    tag: "Tout au même endroit",
    title: "Retrouver un document",
    text: "Baux, quittances, EDL — rangés et accessibles",
    gradient: "from-talok-cyan/20 to-talok-bleu-marque/10",
  },
  {
    tag: "Desktop & mobile",
    title: "Gérer depuis n'importe où",
    text: "Sur votre canapé ou sur le terrain, même interface",
    gradient: "from-talok-bleu-nuit/20 to-talok-bleu-marque/10",
  },
  {
    tag: "Automatique",
    title: "Relancer un locataire en retard",
    text: "Email + SMS part tout seul à J+3",
    gradient: "from-talok-orange/20 to-talok-vert/10",
  },
  {
    tag: "En un coup d'œil",
    title: "Voir si c'est rentable",
    text: "Rendement net, taux d'occupation, tendances",
    gradient: "from-talok-vert/20 to-talok-bleu-marque/10",
  },
];

// Duplicate for seamless loop
const ALL_SLIDES = [...SLIDES, ...SLIDES];

export function ExperienceSlider() {
  return (
    <section className="overflow-hidden py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4">
        <h2 className="reveal text-center font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          L&apos;expérience Talok
        </h2>
      </div>

      {/* Marquee track */}
      <div className="group mt-14">
        <div
          className="flex gap-6 pl-6"
          style={{
            width: "max-content",
            animation: "marquee 40s linear infinite",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.animationPlayState = "paused";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.animationPlayState = "running";
          }}
        >
          {ALL_SLIDES.map((slide, i) => (
            <div
              key={i}
              className="w-[300px] shrink-0 rounded-2xl border bg-white p-5 shadow-sm md:w-[340px]"
            >
              <span className="inline-block rounded-full bg-talok-bleu-marque/10 px-3 py-1 text-xs font-semibold text-talok-bleu-marque">
                {slide.tag}
              </span>
              <h3 className="mt-3 font-display text-lg font-semibold text-foreground">
                {slide.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{slide.text}</p>
              {/* Image placeholder */}
              <div
                className={`mt-4 h-36 rounded-xl bg-gradient-to-br ${slide.gradient}`}
              />
              {/* TODO: remplacer par <Image src="/images/slide-${i % 6 + 1}.jpg" alt={slide.title} width={300} height={144} className="rounded-xl object-cover" /> */}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
