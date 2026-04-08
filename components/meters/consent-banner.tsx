"use client";

import { GlassCard } from "@/components/ui/glass-card";
import { Shield, ExternalLink } from "lucide-react";

interface ConsentBannerProps {
  provider: "enedis" | "grdf";
  className?: string;
}

const PROVIDER_INFO = {
  enedis: {
    name: "Enedis",
    description:
      "La connexion Enedis necessite le consentement du titulaire du contrat. Vos donnees de consommation seront accessibles pendant 3 ans.",
    link: "https://datahub-enedis.fr/",
  },
  grdf: {
    name: "GRDF",
    description:
      "La connexion GRDF necessite le consentement du titulaire du contrat. Les index mensuels seront synchronises automatiquement.",
    link: "https://www.grdf.fr/",
  },
};

export function ConsentBanner({ provider, className }: ConsentBannerProps) {
  const info = PROVIDER_INFO[provider];

  return (
    <GlassCard className={`p-4 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 ${className || ""}`}>
      <div className="flex items-start gap-3">
        <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-blue-900 dark:text-blue-200">
            Consentement {info.name} (RGPD)
          </p>
          <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            {info.description}
          </p>
          <a
            href={info.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-bold"
          >
            En savoir plus <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </GlassCard>
  );
}
