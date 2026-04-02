"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { fadeUp, springItem, springIcon, defaultViewport } from "@/lib/marketing/animations";

const SANS_ITEMS = [
  "Fichiers Excel éparpillés",
  "Relances à la main",
  "Quittances Word",
  "Documents perdus dans les mails",
];

const AVEC_ITEMS = [
  "Tout au même endroit",
  "Baux en 5 minutes",
  "Quittances automatiques",
  "Vue claire de chaque bien",
];

export function BeforeAfterSection() {
  return (
    <motion.section
      className="py-20 md:py-28"
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={defaultViewport}
    >
      <div className="container mx-auto max-w-5xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Vous en avez marre de jongler entre les outils ?
          </h2>
          <p className="mt-4 text-base font-normal leading-relaxed text-muted-foreground">
            Fichiers Excel, relances à la main, documents éparpillés, locataires
            qu&apos;on oublie de rappeler… On connaît. C&apos;est exactement pour ça
            qu&apos;on a créé Talok.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {/* Sans Talok */}
          <Card
            emoji="😤"
            label="Sans Talok"
            className="border-talok-rouge/20 bg-talok-rouge/5"
            labelClassName="bg-talok-rouge/10 text-talok-rouge"
          >
            <ul className="mt-4 space-y-3">
              {SANS_ITEMS.map((item, index) => (
                <motion.li
                  key={item}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  variants={springItem(index)}
                  initial="hidden"
                  whileInView="visible"
                  viewport={defaultViewport}
                >
                  <motion.span
                    className="text-talok-rouge font-bold"
                    variants={springIcon(index)}
                    initial="hidden"
                    whileInView="visible"
                    viewport={defaultViewport}
                  >
                    ✕
                  </motion.span>
                  {item}
                </motion.li>
              ))}
            </ul>
          </Card>

          {/* Avec Talok */}
          <Card
            emoji="😎"
            label="Avec Talok"
            className="border-talok-vert/20 bg-talok-vert/5"
            labelClassName="bg-talok-vert/10 text-talok-vert"
          >
            <ul className="mt-4 space-y-3">
              {AVEC_ITEMS.map((item, index) => (
                <motion.li
                  key={item}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  variants={springItem(index)}
                  initial="hidden"
                  whileInView="visible"
                  viewport={defaultViewport}
                >
                  <motion.span
                    className="text-talok-vert font-bold"
                    variants={springIcon(index)}
                    initial="hidden"
                    whileInView="visible"
                    viewport={defaultViewport}
                  >
                    ✓
                  </motion.span>
                  {item}
                </motion.li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </motion.section>
  );
}

function Card({
  emoji,
  label,
  children,
  className,
  labelClassName,
}: {
  emoji: string;
  label: string;
  children: React.ReactNode;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <motion.div
      className={cn("rounded-2xl border p-8", className)}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{emoji}</span>
        <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", labelClassName)}>
          {label}
        </span>
      </div>
      {children}
    </motion.div>
  );
}
