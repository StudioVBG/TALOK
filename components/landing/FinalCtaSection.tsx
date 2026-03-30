"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function FinalCtaSection() {
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-talok-bleu-nuit via-talok-bleu-marque to-talok-cyan" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(33,196,200,0.3),transparent_60%)]" />

      <div className="container relative z-10 mx-auto max-w-3xl px-4 text-center">
        <h2 className="reveal font-display text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
          Prêt à simplifier votre gestion locative ?
        </h2>
        <p className="reveal mx-auto mt-6 max-w-xl text-lg text-white/80">
          Créez votre compte en 2 minutes. Gratuit, sans engagement, sans carte bancaire.
        </p>
        <div className="reveal mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button size="lg" className="bg-white text-talok-bleu-nuit hover:bg-white/90" asChild>
            <Link href="/signup/plan">
              Commencer gratuitement
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
            <Link href="/demo">Demander une démo</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
