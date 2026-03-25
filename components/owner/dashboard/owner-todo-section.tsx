"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertCircle, FileText, TrendingUp, Calendar, Shield } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/helpers/format";

interface TodoItem {
  id: string;
  type: "rent_arrears" | "sign_contracts" | "indexation" | "lease_end" | "compliance";
  priority: "high" | "medium" | "low";
  label: string;
  count?: number;
  total_amount?: number;
  action_url: string;
}

interface OwnerTodoSectionProps {
  todos: TodoItem[];
}

const todoIcons = {
  rent_arrears: AlertCircle,
  sign_contracts: FileText,
  indexation: TrendingUp,
  lease_end: Calendar,
  compliance: Shield,
};

const todoColors = {
  rent_arrears: "destructive",
  sign_contracts: "default",
  indexation: "secondary",
  lease_end: "outline",
  compliance: "warning",
} as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20, scale: 0.95 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 25,
    },
  },
};

export function OwnerTodoSection({ todos }: OwnerTodoSectionProps) {
  if (todos.length === 0) {
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
                <Shield className="h-5 w-5 text-green-600" />
              </motion.div>
              À faire maintenant
            </CardTitle>
            <CardDescription>Rien à faire pour le moment !</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-4">
              Tous vos dossiers sont à jour.
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
              <AlertCircle className="h-5 w-5 text-orange-600" />
            </motion.div>
            À faire maintenant
          </CardTitle>
          <CardDescription>Actions requises pour optimiser votre gestion</CardDescription>
        </CardHeader>
        <CardContent>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            <AnimatePresence>
              {todos.slice(0, 5).map((todo, index) => {
                const Icon = todoIcons[todo.type];
                const color = todoColors[todo.type] || "default";
                
                return (
                  <motion.div
                    key={todo.id}
                    variants={itemVariants}
                    whileHover={{ scale: 1.02, x: 4 }}
                    className="group relative overflow-hidden"
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-blue-500/5 group-hover:via-purple-500/5 group-hover:to-pink-500/5 transition-all duration-300"
                      initial={{ x: "-100%" }}
                      whileHover={{ x: "100%" }}
                      transition={{ duration: 0.6 }}
                    />
                    <div className="relative flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-all duration-300 backdrop-blur-sm">
                      <div className="flex items-center gap-3 flex-1">
                        <motion.div
                          className={`p-2 rounded-lg ${
                            color === "destructive" ? "bg-red-50" :
                            color === "warning" ? "bg-orange-50" :
                            "bg-blue-50"
                          }`}
                          whileHover={{ rotate: [0, -10, 10, 0] }}
                          transition={{ duration: 0.5 }}
                        >
                          <Icon className={`h-5 w-5 ${
                            color === "destructive" ? "text-red-600" :
                            color === "warning" ? "text-orange-600" :
                            "text-blue-600"
                          }`} />
                        </motion.div>
                        <div className="flex-1">
                          <motion.p
                            className="text-sm font-medium text-foreground"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            {todo.label}
                          </motion.p>
                          {todo.count !== undefined && (
                            <motion.p
                              className="text-xs text-muted-foreground mt-1"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: index * 0.1 + 0.1 }}
                            >
                              {todo.count} {todo.count > 1 ? "éléments" : "élément"}
                              {todo.total_amount !== undefined && ` • ${formatCurrency(todo.total_amount)}`}
                            </motion.p>
                          )}
                        </div>
                      </div>
                      <motion.div
                        whileHover={{ x: 4 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        <Button variant="outline" size="sm" asChild className="group/btn">
                          <Link href={todo.action_url}>
                            Voir
                            <motion.div
                              className="inline-block ml-2"
                              whileHover={{ x: 4 }}
                              transition={{ type: "spring", stiffness: 400 }}
                            >
                              <ArrowRight className="h-4 w-4" />
                            </motion.div>
                          </Link>
                        </Button>
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
