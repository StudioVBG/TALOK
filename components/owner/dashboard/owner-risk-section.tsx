"use client";

import { motion, AnimatePresence, Variants } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileText, TrendingUp, Calendar } from "lucide-react";
import Link from "next/link";
import { OWNER_ROUTES } from "@/lib/config/owner-routes";

interface RiskItem {
  id: string;
  type: "dpe_expiring" | "lease_end" | "indexation_due" | "tax_declaration" | "compliance";
  severity: "high" | "medium" | "low";
  label: string;
  action_url: string;
}

interface OwnerRiskSectionProps {
  risks: RiskItem[];
}

const riskIcons = {
  dpe_expiring: FileText,
  lease_end: Calendar,
  indexation_due: TrendingUp,
  tax_declaration: FileText,
  compliance: AlertTriangle,
};

const severityColors = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-orange-50 text-orange-700 border-orange-200",
  low: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -20, scale: 0.95 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25,
    },
  },
};

export function OwnerRiskSection({ risks }: OwnerRiskSectionProps) {
  if (risks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <AlertTriangle className="h-5 w-5 text-green-600" />
              </motion.div>
              Conformité & risques
            </CardTitle>
            <CardDescription>Aucun risque identifié</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-4">
              Tous vos éléments de conformité sont à jour.
            </p>
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
      <Card className="backdrop-blur-sm bg-card/80 border-border/20 shadow-xl hover:shadow-2xl transition-all duration-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </motion.div>
            Conformité & risques
          </CardTitle>
          <CardDescription>Éléments nécessitant votre attention</CardDescription>
        </CardHeader>
        <CardContent>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            <AnimatePresence>
              {risks.slice(0, 5).map((risk, index) => {
                const Icon = riskIcons[risk.type] || AlertTriangle;
                const colorClass = severityColors[risk.severity] || severityColors.medium;
                
                return (
                  <motion.div
                    key={risk.id}
                    variants={itemVariants}
                    whileHover={{ scale: 1.02, x: 4 }}
                    className="group relative overflow-hidden"
                  >
                    <motion.div
                      className={`absolute inset-0 ${colorClass} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                      initial={{ x: "-100%" }}
                      whileHover={{ x: "100%" }}
                      transition={{ duration: 0.6 }}
                    />
                    <div className={`relative flex items-center justify-between p-3 rounded-lg border ${colorClass} cursor-pointer transition-all duration-300`}>
                      <div className="flex items-center gap-3 flex-1">
                        <motion.div
                          whileHover={{ rotate: [0, -10, 10, 0] }}
                          transition={{ duration: 0.5 }}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                        </motion.div>
                        <div className="flex-1">
                          <motion.p
                            className="text-sm font-medium"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            {risk.label}
                          </motion.p>
                        </div>
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          transition={{ type: "spring", stiffness: 400 }}
                        >
                          <Badge
                            variant={
                              risk.severity === "high"
                                ? "destructive"
                                : risk.severity === "medium"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {risk.severity === "high" ? "Urgent" : risk.severity === "medium" ? "Important" : "À surveiller"}
                          </Badge>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>

          {risks.length > 5 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button variant="outline" className="w-full mt-4" asChild>
                <Link href={`${OWNER_ROUTES.contracts.path}?view=risks`}>
                  Voir tous les risques ({risks.length})
                </Link>
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
