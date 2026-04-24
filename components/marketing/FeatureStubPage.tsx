import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, type LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  badgeLabel: string;
  title: string;
  highlight: string;
  subtitle: string;
  bullets: string[];
};

export function FeatureStubPage({
  icon: Icon,
  badgeLabel,
  title,
  highlight,
  subtitle,
  bullets,
}: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-24 pb-16">
      <section className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <Link
            href="/fonctionnalites"
            className="mb-6 inline-flex items-center text-slate-400 transition-colors hover:text-white"
          >
            <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
            Toutes les fonctionnalités
          </Link>

          <Badge className="mb-4 border-blue-500/30 bg-blue-500/20 text-blue-300">
            <Icon className="mr-1 h-3 w-3" />
            {badgeLabel}
          </Badge>

          <h1 className="mb-6 text-4xl font-bold text-white md:text-5xl">
            {title}{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              {highlight}
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-xl text-slate-400">{subtitle}</p>

          <div className="mx-auto mb-10 max-w-xl rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6 text-left">
            <ul className="space-y-3">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-slate-300">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/essai-gratuit">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:opacity-90"
              >
                Essayer gratuitement
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                size="lg"
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Voir les tarifs
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
