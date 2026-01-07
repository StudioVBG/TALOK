"use client";
// @ts-nocheck

import { useMemo } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Home, Users, Wrench, Check, ArrowRight, Sparkles } from "lucide-react";

const features = [
  {
    role: "owner",
    title: "Pour les Propriétaires",
    description: "Gérez vos logements et vos locataires",
    icon: Home,
    gradient: "from-indigo-400/25 via-indigo-500/10 to-transparent",
    items: [
      "Gestion des logements",
      "Création et suivi des baux",
      "Facturation et paiements",
      "Gestion des tickets de maintenance",
    ],
  },
  {
    role: "tenant",
    title: "Pour les Locataires",
    description: "Suivez vos baux et paiements",
    icon: Users,
    gradient: "from-cyan-300/30 via-cyan-400/10 to-transparent",
    items: [
      "Consultation de vos baux",
      "Suivi des paiements",
      "Création de tickets",
      "Gestion de la colocation",
    ],
  },
  {
    role: "provider",
    title: "Pour les Prestataires",
    description: "Gérez vos interventions",
    icon: Wrench,
    gradient: "from-emerald-300/30 via-emerald-400/10 to-transparent",
    items: [
      "Suivi des interventions",
      "Gestion des devis",
      "Facturation",
      "Planning des interventions",
    ],
  },
];

export default function HomeClient() {
  // Utiliser useMemo pour éviter les re-créations inutiles
  const memoizedFeatures = useMemo(() => features, []);
  const prefersReducedMotion = useReducedMotion();
  const motionEnabled = !prefersReducedMotion;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      {/* Animated background gradients */}
      <div className="absolute inset-0 opacity-60">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(99,102,241,0.2),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center_right,_rgba(16,185,129,0.1),_transparent_50%)]" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-16 px-4 py-20">
        {/* Hero Section */}
        <motion.div
          initial={motionEnabled ? { opacity: 0, y: 20 } : undefined}
          animate={motionEnabled ? { opacity: 1, y: 0 } : undefined}
          transition={motionEnabled ? { type: "spring", stiffness: 120 } : undefined}
          className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center"
        >
          <motion.div
            initial={motionEnabled ? { scale: 0.9, opacity: 0 } : undefined}
            animate={motionEnabled ? { scale: 1, opacity: 1 } : undefined}
            transition={
              motionEnabled ? { delay: 0.1, type: "spring", stiffness: 200 } : undefined
            }
            className="flex items-center gap-3"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-lg shadow-indigo-500/50">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <Badge className="bg-white/10 text-white backdrop-blur">
              <Sparkles className="mr-1.5 h-3 w-3" />
              SaaS Premium
            </Badge>
          </motion.div>

          <h1 className="text-6xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            Talok
          </h1>

          <p className="text-xl text-slate-200 max-w-2xl leading-relaxed">
            Application SaaS de gestion locative pour la France et les DROM.
            <br />
            Gérez vos logements, baux, locataires et paiements en toute simplicité.
          </p>

          <motion.div
            initial={motionEnabled ? { opacity: 0, y: 10 } : undefined}
            animate={motionEnabled ? { opacity: 1, y: 0 } : undefined}
            transition={motionEnabled ? { delay: 0.2 } : undefined}
            className="flex flex-col sm:flex-row gap-4 mt-4"
          >
            <Link href="/signup/role">
              <Button
                size="lg"
                className="group bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-lg shadow-indigo-500/50 hover:from-indigo-500 hover:to-cyan-500 transition-all duration-300"
              >
                S'inscrire
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/auth/signin">
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 bg-white/5 text-white backdrop-blur hover:bg-white/10 hover:border-white/30 transition-all duration-300"
              >
                Se connecter
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={motionEnabled ? { opacity: 0, y: 20 } : undefined}
          animate={motionEnabled ? { opacity: 1, y: 0 } : undefined}
          transition={
            motionEnabled ? { delay: 0.3, type: "spring", stiffness: 120 } : undefined
          }
          className="grid gap-6 md:grid-cols-3"
        >
          {memoizedFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.role}
                initial={motionEnabled ? { opacity: 0, y: 20 } : undefined}
                animate={motionEnabled ? { opacity: 1, y: 0 } : undefined}
                transition={
                  motionEnabled
                    ? { delay: 0.4 + index * 0.1, type: "spring", stiffness: 120 }
                    : undefined
                }
                whileHover={motionEnabled ? { y: -4 } : undefined}
                className="group"
              >
                <Card className="relative h-full overflow-hidden border-white/10 bg-white/5 backdrop-blur transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:shadow-xl hover:shadow-indigo-500/10">
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  
                  <CardHeader className="relative">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur transition-all duration-300 group-hover:bg-white/20 group-hover:scale-110">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-xl text-white">{feature.title}</CardTitle>
                    <CardDescription className="text-slate-300">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="relative">
                    <ul className="space-y-3 text-sm">
                      {feature.items.map((item, itemIndex) => (
                        <motion.li
                          key={itemIndex}
                          initial={motionEnabled ? { opacity: 0, x: -10 } : undefined}
                          animate={motionEnabled ? { opacity: 1, x: 0 } : undefined}
                          transition={
                            motionEnabled
                              ? { delay: 0.5 + index * 0.1 + itemIndex * 0.05 }
                              : undefined
                          }
                          className="flex items-start gap-2 text-slate-200"
                        >
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                          <span>{item}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={motionEnabled ? { opacity: 0 } : undefined}
          animate={motionEnabled ? { opacity: 1 } : undefined}
          transition={motionEnabled ? { delay: 0.7 } : undefined}
          className="flex flex-col items-center gap-4 text-sm text-slate-300"
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span>Besoin d'aide ? </span>
            <a
              href="mailto:support@talok.fr"
              className="text-white underline-offset-4 hover:underline transition-colors"
            >
              support@talok.fr
            </a>
          </div>
          <p className="text-xs text-slate-400">
            © 2026 Talok. Tous droits réservés.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

