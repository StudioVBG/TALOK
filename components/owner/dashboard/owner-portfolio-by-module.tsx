"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Home, Briefcase, Car, Plus } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/helpers/format";
import { OWNER_ROUTES } from "@/lib/config/owner-routes";
import type { OwnerModuleKey } from "@/lib/config/owner-app-config";

interface ModuleStats {
  module: OwnerModuleKey;
  label: string;
  stats: {
    active_leases?: number;
    monthly_revenue?: number;
    occupancy_rate?: number;
    nights_sold?: number;
    revenue?: number;
    properties_count?: number;
  };
  action_url: string;
}

interface OwnerPortfolioByModuleProps {
  modules: ModuleStats[];
}

const moduleIcons = {
  habitation: Home,
  lcd: Building2,
  pro: Briefcase,
  parking: Car,
};

const moduleColors = {
  habitation: "bg-blue-50 text-blue-700 border-blue-200",
  lcd: "bg-purple-50 text-purple-700 border-purple-200",
  pro: "bg-green-50 text-green-700 border-green-200",
  parking: "bg-orange-50 text-orange-700 border-orange-200",
};

const moduleVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      type: "spring" as const,
      stiffness: 200,
      damping: 20,
    },
  }),
};

export function OwnerPortfolioByModule({ modules }: OwnerPortfolioByModuleProps) {
  if (modules.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="backdrop-blur-sm bg-white/80 border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardHeader>
            <CardTitle>Portefeuille par module</CardTitle>
            <CardDescription>Commencer avec votre premier bien</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" className="w-full">
              <Link href={`${OWNER_ROUTES.properties.path}/new`}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un bien
              </Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="backdrop-blur-sm bg-white/80 border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300">
        <CardHeader>
          <CardTitle>Portefeuille par module</CardTitle>
          <CardDescription>Vue d'ensemble de vos biens par catégorie</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modules.map((module, index) => {
              const Icon = moduleIcons[module.module];
              const colorClass = moduleColors[module.module] || "bg-slate-50 text-slate-700 border-slate-200";
              
              return (
                <motion.div
                  key={module.module}
                  custom={index}
                  variants={moduleVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover={{ scale: 1.03, y: -4 }}
                  className={`p-4 rounded-lg border ${colorClass} cursor-pointer transition-all duration-300`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <motion.div
                        whileHover={{ rotate: [0, -10, 10, 0] }}
                        transition={{ duration: 0.5 }}
                      >
                        <Icon className="h-5 w-5" />
                      </motion.div>
                      <h3 className="font-semibold">{module.label}</h3>
                    </div>
                    <Badge variant="outline" className="bg-white/50">
                      {module.module}
                    </Badge>
                  </div>

                  <motion.div
                    className="space-y-2 mb-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.1 + 0.2 }}
                  >
                    {module.stats.active_leases !== undefined && (
                      <motion.p
                        className="text-sm"
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.1 + 0.3 }}
                      >
                        <span className="font-medium">{module.stats.active_leases}</span> baux actifs
                      </motion.p>
                    )}
                    {module.stats.properties_count !== undefined && (
                      <motion.p
                        className="text-sm"
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.1 + 0.4 }}
                      >
                        <span className="font-medium">{module.stats.properties_count}</span> biens
                      </motion.p>
                    )}
                    {module.stats.monthly_revenue !== undefined && (
                      <motion.p
                        className="text-sm"
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.1 + 0.5 }}
                      >
                        <span className="font-medium">{formatCurrency(module.stats.monthly_revenue)}</span> / mois
                      </motion.p>
                    )}
                    {module.stats.revenue !== undefined && (
                      <motion.p
                        className="text-sm"
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.1 + 0.5 }}
                      >
                        <span className="font-medium">{formatCurrency(module.stats.revenue)}</span> CA
                      </motion.p>
                    )}
                    {module.stats.nights_sold !== undefined && (
                      <motion.p
                        className="text-sm"
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.1 + 0.5 }}
                      >
                        <span className="font-medium">{module.stats.nights_sold}</span> nuits vendues
                      </motion.p>
                    )}
                    {module.stats.occupancy_rate !== undefined && (
                      <motion.p
                        className="text-sm"
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.1 + 0.5 }}
                      >
                        <span className="font-medium">{module.stats.occupancy_rate.toFixed(0)}%</span> occupé
                      </motion.p>
                    )}
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link href={module.action_url}>
                        Voir les biens {module.label.toLowerCase()}
                      </Link>
                    </Button>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
