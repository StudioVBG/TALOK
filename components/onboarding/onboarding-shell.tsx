"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";

type OnboardingShellProps = {
  stepLabel: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function OnboardingShell({ stepLabel, title, subtitle, children, footer }: OnboardingShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 opacity-60">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(99,102,241,0.2),_transparent_60%)]" />
      </div>

      <div className="relative mx-auto flex max-w-5xl flex-col gap-10 px-4 pb-20 pt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 120 }}
          className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center px-4"
        >
          <Badge className="bg-white/10 text-white backdrop-blur">{stepLabel}</Badge>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight break-words">{title}</h1>
          <p className="text-base sm:text-lg text-slate-200 break-words">{subtitle}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 120 }}
          className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-white shadow-2xl backdrop-blur"
        >
          {children}
        </motion.div>

        <div className="flex flex-col items-center gap-4 text-sm text-slate-200">
          {footer}
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span>Besoin d’aide ? </span>
            <a href="mailto:support@talok.fr" className="text-white underline-offset-4 hover:underline">
              support@talok.fr
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

