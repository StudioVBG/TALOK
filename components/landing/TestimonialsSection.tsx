"use client";

import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TESTIMONIALS = [
  {
    name: "Sophie",
    initials: "SL",
    role: "Propriétaire · 4 biens à Schoelcher",
    badge: "Plus de sérénité",
    quote:
      "Avant je passais mes dimanches à faire les quittances et vérifier les virements. Maintenant tout se fait tout seul. Je retrouve enfin une vue claire de tout.",
    gradient: "from-talok-bleu-marque to-talok-cyan",
  },
  {
    name: "David",
    initials: "DM",
    role: "Gestionnaire · 15 lots au Lamentin",
    badge: "Gain de temps",
    quote:
      "Les relances partent toutes seules, les quittances aussi. Je me concentre sur ce qui compte vraiment : mes clients et mes projets.",
    gradient: "from-talok-vert to-talok-cyan",
  },
  {
    name: "Mélanie",
    initials: "MR",
    role: "Locataire · Fort-de-France",
    badge: "Communication fluide",
    quote:
      "Je paie mon loyer en 30 secondes depuis mon téléphone. Les demandes sont suivies, je sais toujours où ça en est. Enfin un truc simple.",
    gradient: "from-talok-cyan to-talok-bleu-marque",
  },
];

export function TestimonialsSection() {
  return (
    <section className="bg-[hsl(var(--talok-gris-fond))] py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4">
        <h2 className="reveal text-center font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Ce qu&apos;en disent ceux qui ont franchi le pas
        </h2>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="reveal flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${t.gradient} text-sm font-bold text-white`}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>

              <Badge variant="secondary" className="mt-4 w-fit">
                {t.badge}
              </Badge>

              <div className="mt-3 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-yellow-400 text-yellow-400"
                  />
                ))}
              </div>

              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
