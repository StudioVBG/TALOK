"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingUp, MapPin } from "lucide-react";

const CHART_HEIGHTS = [40, 55, 45, 65, 50, 70, 60, 75, 55, 80, 65, 85];

const TENANTS = [
  { name: "Jean Dupont", type: "T3", city: "Fort-de-France", amount: "1 250 €", status: "Payé", statusEmoji: "✅", statusColor: "text-emerald-600 bg-emerald-50" },
  { name: "Marie Laurent", type: "T2", city: "Le Lamentin", amount: "890 €", status: "En cours", statusEmoji: "🟡", statusColor: "text-yellow-600 bg-yellow-50" },
  { name: "Pierre Bernard", type: "T4", city: "Schoelcher", amount: "1 450 €", status: "Retard", statusEmoji: "🔴", statusColor: "text-red-600 bg-red-50" },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-16 pt-8 md:pb-24 md:pt-12">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--talok-gris-fond))] to-white" />
      <div className="absolute right-0 top-0 h-[600px] w-[600px] -translate-y-1/3 translate-x-1/3 rounded-full bg-talok-cyan/5 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-[400px] w-[400px] translate-y-1/3 -translate-x-1/3 rounded-full bg-talok-bleu-marque/5 blur-3xl" />

      <div className="container relative z-10 mx-auto max-w-6xl px-4">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Copy */}
          <div>
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Disponible en France &amp; DOM-TOM
            </Badge>

            <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
              Gérez vos locations{" "}
              <span className="bg-gradient-to-r from-talok-bleu-marque to-talok-cyan bg-clip-text text-transparent">
                sans prise de tête
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Baux, loyers, quittances, relances, documents — tout est regroupé
              dans un seul outil. Vous gardez le contrôle, sans y passer vos
              soirées.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="bg-talok-bleu-marque text-white hover:bg-talok-bleu-marque/90" asChild>
                <Link href="/inscription">
                  Essayer gratuitement
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#comment-ca-marche">Comment ça marche ?</a>
              </Button>
            </div>

            {/* Reassurance pills */}
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm">
                ✓ Gratuit pour 1 bien
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm">
                ✓ Sans engagement
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm">
                ✓ Conforme droit français
              </span>
            </div>
          </div>

          {/* Right: Dashboard Mockup */}
          <div className="relative">
            <div
              className="rounded-2xl border bg-white/80 p-5 shadow-xl backdrop-blur-sm"
              style={{ animation: "float 6s ease-in-out infinite" }}
            >
              {/* KPI row */}
              <div className="grid grid-cols-3 gap-3">
                <KpiCard label="Loyers encaissés" value="12 450 €" delta="+8,2%" />
                <KpiCard label="Taux occupation" value="94%" delta="+2,1%" />
                <KpiCard label="Rendement net" value="6,8%" delta="+0,4%" />
              </div>

              {/* Mini chart */}
              <div className="mt-4 flex items-end gap-1.5" style={{ height: 80 }}>
                {CHART_HEIGHTS.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-talok-bleu-marque/70"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">Encaissements mensuels</p>

              {/* Tenant list */}
              <div className="mt-4 divide-y text-xs">
                {TENANTS.map((t) => (
                  <div key={t.name} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-talok-bleu-marque/20 to-talok-cyan/20" />
                      <div>
                        <p className="font-medium text-foreground">{t.name}</p>
                        <p className="text-muted-foreground">
                          {t.type} · {t.city}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-foreground">{t.amount}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${t.statusColor}`}>
                        {t.status} {t.statusEmoji}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function KpiCard({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="rounded-xl bg-[hsl(var(--talok-gris-fond))] p-3">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
      <span className="flex items-center gap-0.5 text-[10px] font-medium text-talok-vert">
        <TrendingUp className="h-3 w-3" />
        {delta}
      </span>
    </div>
  );
}
