"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { 
  User, 
  Building2, 
  FileText, 
  CreditCard, 
  Shield,
  Camera,
  Phone,
  MapPin,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Trophy,
  Rocket,
  Star,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

// Types pour les tâches de complétion
interface CompletionTask {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  completed: boolean;
  priority: "high" | "medium" | "low";
  reward?: string;
  category: "identity" | "business" | "property" | "security";
}

interface ProfileCompletionData {
  // Profile de base
  hasFirstName: boolean;
  hasLastName: boolean;
  hasPhone: boolean;
  hasAvatar: boolean;
  hasBirthDate: boolean;
  // Owner profile
  hasOwnerType: boolean;
  hasSiret: boolean; // Requis si société
  hasIban: boolean;
  hasBillingAddress: boolean;
  // Documents
  hasIdentityDocument: boolean;
  // Propriétés
  hasProperty: boolean;
  hasLease: boolean;
  // Type de propriétaire
  ownerType: "particulier" | "societe" | null;
}

interface ProfileCompletionCardProps {
  data: ProfileCompletionData;
  className?: string;
}

// Copywriting engageant pour chaque tâche
const TASK_CONFIG: Record<string, Omit<CompletionTask, "completed">> = {
  firstName: {
    id: "firstName",
    title: "Votre prénom",
    description: "Pour personnaliser votre expérience et vos documents",
    icon: User,
    href: "/owner/profile",
    priority: "high",
    reward: "+10%",
    category: "identity",
  },
  lastName: {
    id: "lastName",
    title: "Votre nom de famille",
    description: "Essentiel pour vos baux et quittances officiels",
    icon: User,
    href: "/owner/profile",
    priority: "high",
    reward: "+10%",
    category: "identity",
  },
  phone: {
    id: "phone",
    title: "Numéro de téléphone",
    description: "Pour que vos locataires puissent vous joindre en urgence",
    icon: Phone,
    href: "/owner/profile",
    priority: "high",
    reward: "+10%",
    category: "identity",
  },
  avatar: {
    id: "avatar",
    title: "Photo de profil",
    description: "Instaurez la confiance avec une photo professionnelle",
    icon: Camera,
    href: "/owner/profile",
    priority: "medium",
    reward: "+5%",
    category: "identity",
  },
  birthDate: {
    id: "birthDate",
    title: "Date de naissance",
    description: "Obligatoire pour la conformité légale des baux",
    icon: User,
    href: "/owner/profile",
    priority: "medium",
    reward: "+5%",
    category: "identity",
  },
  ownerType: {
    id: "ownerType",
    title: "Statut juridique",
    description: "Particulier ou société ? Définissez votre cadre fiscal",
    icon: Building2,
    href: "/owner/profile/business",
    priority: "high",
    reward: "+10%",
    category: "business",
  },
  siret: {
    id: "siret",
    title: "Numéro SIRET",
    description: "Requis pour la facturation professionnelle",
    icon: FileText,
    href: "/owner/profile/business",
    priority: "high",
    reward: "+5%",
    category: "business",
  },
  iban: {
    id: "iban",
    title: "Coordonnées bancaires",
    description: "Recevez vos loyers directement sur votre compte",
    icon: CreditCard,
    href: "/owner/profile/banking",
    priority: "high",
    reward: "+15%",
    category: "business",
  },
  billingAddress: {
    id: "billingAddress",
    title: "Adresse de facturation",
    description: "Pour vos quittances et documents officiels",
    icon: MapPin,
    href: "/owner/profile/business",
    priority: "medium",
    reward: "+5%",
    category: "business",
  },
  identityDocument: {
    id: "identityDocument",
    title: "Pièce d'identité",
    description: "Vérifiez votre identité pour sécuriser vos transactions",
    icon: Shield,
    href: "/owner/profile/identity",
    priority: "high",
    reward: "+10%",
    category: "security",
  },
  property: {
    id: "property",
    title: "Ajouter votre premier bien",
    description: "Commencez à gérer votre patrimoine immobilier",
    icon: Building2,
    href: "/owner/properties/new",
    priority: "high",
    reward: "+10%",
    category: "property",
  },
  lease: {
    id: "lease",
    title: "Créer votre premier bail",
    description: "Officialisez la location de votre bien",
    icon: FileText,
    href: "/owner/leases/new",
    priority: "medium",
    reward: "+5%",
    category: "property",
  },
};

// Messages motivants selon le pourcentage
const getMotivationalMessage = (percentage: number): { title: string; subtitle: string; emoji: string } => {
  if (percentage === 100) {
    return {
      title: "Profil parfait ! 🏆",
      subtitle: "Vous êtes prêt à gérer vos biens comme un pro",
      emoji: "🎉",
    };
  }
  if (percentage >= 80) {
    return {
      title: "Presque au sommet !",
      subtitle: "Plus que quelques étapes pour débloquer tout le potentiel",
      emoji: "🚀",
    };
  }
  if (percentage >= 60) {
    return {
      title: "Belle progression !",
      subtitle: "Vous êtes sur la bonne voie, continuez !",
      emoji: "⭐",
    };
  }
  if (percentage >= 40) {
    return {
      title: "Bon début !",
      subtitle: "Complétez votre profil pour une meilleure expérience",
      emoji: "💪",
    };
  }
  if (percentage >= 20) {
    return {
      title: "C'est parti !",
      subtitle: "Quelques minutes suffisent pour tout configurer",
      emoji: "🌟",
    };
  }
  return {
    title: "Bienvenue !",
    subtitle: "Configurez votre espace pour commencer",
    emoji: "👋",
  };
};

// Couleur selon la priorité
const getPriorityColor = (priority: CompletionTask["priority"]) => {
  switch (priority) {
    case "high":
      return "bg-red-500/10 text-red-600 border-red-200";
    case "medium":
      return "bg-amber-500/10 text-amber-600 border-amber-200";
    case "low":
      return "bg-green-500/10 text-green-600 border-green-200";
  }
};

// Composant cercle de progression animé
function CircularProgress({ percentage, size = 120 }: { percentage: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Cercle de fond */}
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-slate-100"
        />
        {/* Cercle de progression avec gradient */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      {/* Pourcentage au centre */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
        >
          {percentage}%
        </motion.span>
        <span className="text-xs text-muted-foreground">complété</span>
      </div>
    </div>
  );
}

// Composant tâche individuelle
function TaskItem({ task, index }: { task: CompletionTask; index: number }) {
  const Icon = task.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        "group relative",
        task.completed && "opacity-60"
      )}
    >
      <Link
        href={task.href}
        className={cn(
          "flex items-center gap-4 p-4 rounded-xl border transition-all duration-300",
          task.completed
            ? "bg-green-50/50 border-green-200"
            : "bg-white hover:bg-slate-50 border-slate-200 hover:border-blue-300 hover:shadow-md"
        )}
      >
        {/* Icône */}
        <div
          className={cn(
            "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
            task.completed
              ? "bg-green-100 text-green-600"
              : "bg-gradient-to-br from-blue-100 to-purple-100 text-blue-600 group-hover:scale-110"
          )}
        >
          {task.completed ? (
            <CheckCircle2 className="w-6 h-6" />
          ) : (
            <Icon className="w-6 h-6" />
          )}
        </div>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={cn(
              "font-semibold text-sm",
              task.completed ? "text-green-700 line-through" : "text-slate-900"
            )}>
              {task.title}
            </h4>
            {!task.completed && task.reward && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                {task.reward}
              </span>
            )}
          </div>
          <p className={cn(
            "text-xs mt-0.5",
            task.completed ? "text-green-600" : "text-muted-foreground"
          )}>
            {task.completed ? "✓ Complété" : task.description}
          </p>
        </div>

        {/* Flèche */}
        {!task.completed && (
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
        )}
      </Link>
    </motion.div>
  );
}

export function ProfileCompletionCard({ data, className }: ProfileCompletionCardProps) {
  // Calculer les tâches et le pourcentage
  const { tasks, percentage, completedCount, totalCount } = useMemo(() => {
    const allTasks: CompletionTask[] = [];

    // Tâches d'identité
    allTasks.push({ ...TASK_CONFIG.firstName, completed: data.hasFirstName });
    allTasks.push({ ...TASK_CONFIG.lastName, completed: data.hasLastName });
    allTasks.push({ ...TASK_CONFIG.phone, completed: data.hasPhone });
    allTasks.push({ ...TASK_CONFIG.avatar, completed: data.hasAvatar });
    // allTasks.push({ ...TASK_CONFIG.birthDate, completed: data.hasBirthDate });

    // Tâches business
    allTasks.push({ ...TASK_CONFIG.ownerType, completed: data.hasOwnerType });
    if (data.ownerType === "societe") {
      allTasks.push({ ...TASK_CONFIG.siret, completed: data.hasSiret });
    }
    allTasks.push({ ...TASK_CONFIG.iban, completed: data.hasIban });
    allTasks.push({ ...TASK_CONFIG.billingAddress, completed: data.hasBillingAddress });

    // Tâches sécurité
    allTasks.push({ ...TASK_CONFIG.identityDocument, completed: data.hasIdentityDocument });

    // Tâches propriété
    allTasks.push({ ...TASK_CONFIG.property, completed: data.hasProperty });
    if (data.hasProperty) {
      allTasks.push({ ...TASK_CONFIG.lease, completed: data.hasLease });
    }

    const completed = allTasks.filter((t) => t.completed).length;
    const total = allTasks.length;
    const pct = Math.round((completed / total) * 100);

    // Trier : non complétées en premier, puis par priorité
    const sortedTasks = [...allTasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return {
      tasks: sortedTasks,
      percentage: pct,
      completedCount: completed,
      totalCount: total,
    };
  }, [data]);

  const message = getMotivationalMessage(percentage);
  const incompleteTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  // Si profil complet à 100%
  if (percentage === 100) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border border-green-200 p-6",
          className
        )}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-200/40 to-emerald-200/40 rounded-full blur-3xl" />
        <div className="relative flex items-center gap-6">
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg"
          >
            <Trophy className="w-8 h-8 text-white" />
          </motion.div>
          <div>
            <h3 className="text-xl font-bold text-green-800 flex items-center gap-2">
              {message.title}
              <motion.span
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
              >
                {message.emoji}
              </motion.span>
            </h3>
            <p className="text-green-600 mt-1">{message.subtitle}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm",
        className
      )}
    >
      {/* Background décoratif */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-100/50 via-purple-100/50 to-pink-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      {/* Header */}
      <div className="relative p-6 pb-4 border-b border-slate-100">
        <div className="flex items-start gap-6">
          <CircularProgress percentage={percentage} />
          <div className="flex-1 pt-2">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-bold text-slate-900">
                {message.title}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {message.subtitle}
            </p>
            <div className="flex items-center gap-3">
              <Progress value={percentage} className="h-2 flex-1" />
              <span className="text-sm font-medium text-slate-600">
                {completedCount}/{totalCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des tâches */}
      <div className="relative p-4 space-y-3">
        {/* Tâches non complétées */}
        {incompleteTasks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-2 mb-3">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Actions recommandées
              </span>
            </div>
            {incompleteTasks.slice(0, 4).map((task, index) => (
              <TaskItem key={task.id} task={task} index={index} />
            ))}
            {incompleteTasks.length > 4 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-2"
              >
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/owner/profile" className="text-blue-600">
                    Voir toutes les tâches ({incompleteTasks.length - 4} de plus)
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              </motion.div>
            )}
          </div>
        )}

        {/* Tâches complétées (collapsées) */}
        {completedTasks.length > 0 && (
          <details className="group">
            <summary className="flex items-center gap-2 px-2 py-2 cursor-pointer text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>{completedTasks.length} tâche{completedTasks.length > 1 ? "s" : ""} complétée{completedTasks.length > 1 ? "s" : ""}</span>
              <ChevronRight className="w-4 h-4 ml-auto group-open:rotate-90 transition-transform" />
            </summary>
            <div className="space-y-2 mt-2">
              {completedTasks.map((task, index) => (
                <TaskItem key={task.id} task={task} index={index} />
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Footer motivant */}
      <div className="relative px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50/50 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Rocket className="w-4 h-4 text-blue-500" />
            <span>
              Encore <strong className="text-blue-600">{100 - percentage}%</strong> pour débloquer toutes les fonctionnalités
            </span>
          </div>
          <Button size="sm" asChild className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600">
            <Link href="/owner/profile">
              Compléter
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// Export du type pour utilisation externe
export type { ProfileCompletionData };

