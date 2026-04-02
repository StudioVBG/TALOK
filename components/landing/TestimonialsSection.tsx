"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fadeUp, defaultViewport } from "@/lib/marketing/animations";

const TESTIMONIALS = [
  {
    name: "Sophie",
    role: "Propriétaire · 4 biens à Schoelcher",
    badge: "Plus de sérénité",
    quote:
      "Avant je passais mes dimanches à faire les quittances et vérifier les virements. Maintenant tout se fait tout seul. Je retrouve enfin une vue claire de tout.",
    gradient: "from-talok-bleu-marque/20 to-talok-cyan/20",
  },
  {
    name: "David",
    role: "Gestionnaire · 15 lots au Lamentin",
    badge: "Gain de temps",
    quote:
      "Les relances partent toutes seules, les quittances aussi. Je me concentre sur ce qui compte vraiment : mes clients et mes projets.",
    gradient: "from-talok-vert/20 to-talok-cyan/20",
  },
  {
    name: "Mélanie",
    role: "Locataire · Fort-de-France",
    badge: "Communication fluide",
    quote:
      "Je paie mon loyer en 30 secondes depuis mon téléphone. Les demandes sont suivies, je sais toujours où ça en est. Enfin un truc simple.",
    gradient: "from-talok-cyan/20 to-talok-bleu-marque/20",
  },
];

export function TestimonialsSection() {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % TESTIMONIALS.length);
  }, []);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  }, []);

  return (
    <motion.section
      className="bg-secondary py-20 md:py-28"
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={defaultViewport}
    >
      <div className="container mx-auto max-w-6xl px-4">
        <h2 className="text-center font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Ce qu&apos;en disent ceux qui ont franchi le pas
        </h2>

        {/* Desktop: grid of 3 cards */}
        <div className="mt-14 hidden gap-8 md:grid md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <motion.div
              key={t.name}
              className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm cursor-pointer"
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <TestimonialContent testimonial={t} />
            </motion.div>
          ))}
        </div>

        {/* Mobile: swipeable carousel */}
        <div className="mt-14 md:hidden">
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_e, { offset, velocity }) => {
              if (Math.abs(velocity.x) > 500 || Math.abs(offset.x) > 100) {
                offset.x < 0 ? next() : prev();
              }
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -60 }}
                transition={{ duration: 0.35 }}
                className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <TestimonialContent testimonial={TESTIMONIALS[current]} />
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Dots + arrows */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              onClick={prev}
              className="rounded-full border border-border bg-card p-2 text-muted-foreground hover:text-foreground"
              aria-label="Témoignage précédent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex gap-2">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    i === current ? "bg-[#2563EB]" : "bg-border"
                  }`}
                  aria-label={`Témoignage ${i + 1}`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="rounded-full border border-border bg-card p-2 text-muted-foreground hover:text-foreground"
              aria-label="Témoignage suivant"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function TestimonialContent({ testimonial: t }: { testimonial: typeof TESTIMONIALS[number] }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${t.gradient}`} />
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
    </>
  );
}
