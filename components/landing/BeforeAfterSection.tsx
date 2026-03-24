"use client";

import { cn } from "@/lib/utils";

export function BeforeAfterSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="reveal mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Vous en avez marre de jongler entre les outils ?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
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
            Vous gérez vos biens avec des fichiers Excel, des relances par SMS au
            feeling, des quittances faites à la main, et des documents éparpillés
            entre emails, WhatsApp et dossiers papier. Résultat : du stress, des
            oublis, et des loyers en retard.
          </Card>

          {/* Avec Talok */}
          <Card
            emoji="😎"
            label="Avec Talok"
            className="border-talok-vert/20 bg-talok-vert/5"
            labelClassName="bg-talok-vert/10 text-talok-vert"
          >
            Tout est au même endroit. Vos baux se créent en 5 minutes. Les
            quittances partent toutes seules. Les relances aussi. Vous voyez en un
            coup d&apos;œil qui a payé, qui est en retard, et combien vous rapporte
            chaque bien. Simple.
          </Card>
        </div>
      </div>
    </section>
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
    <div
      className={cn(
        "reveal rounded-2xl border p-8 transition-transform hover:-translate-y-1",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{emoji}</span>
        <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", labelClassName)}>
          {label}
        </span>
      </div>
      <p className="mt-5 text-base leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  );
}
