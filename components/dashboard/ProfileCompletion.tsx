"use client";

import Link from "next/link";
import {
  User,
  Phone,
  Camera,
  Calendar,
  Briefcase,
  Euro,
  FileText,
  Shield,
  Building2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ProfileTask } from "./profile-tasks";

// Map des icônes
const iconMap: Record<string, LucideIcon> = {
  User,
  Phone,
  Camera,
  Calendar,
  Briefcase,
  Euro,
  FileText,
  Shield,
  Building2,
};

interface ProfileCompletionProps {
  tasks: ProfileTask[];
  className?: string;
}

export function ProfileCompletion({ tasks, className }: ProfileCompletionProps) {
  const completedCount = tasks.filter((t) => t.done).length;
  const percentage = Math.round((completedCount / tasks.length) * 100);
  const pendingTasks = tasks.filter((t) => !t.done).slice(0, 3);

  // Si 100% complété, ne pas afficher
  if (percentage === 100) return null;

  const getMessage = () => {
    if (percentage < 30) return "Commençons par les bases ! 🚀";
    if (percentage < 60) return "Super progression ! 💪";
    if (percentage < 90) return "Presque terminé ! 🎯";
    return "Dernière ligne droite ! 🏆";
  };

  return (
    <Card className={cn(
      "relative overflow-hidden border-0",
      "bg-gradient-to-br from-primary/5 via-transparent to-primary/5",
      "dark:from-primary/10 dark:via-transparent dark:to-primary/10",
      className
    )}>
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <CardHeader className="relative pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Complétez votre profil
            </CardTitle>
            <CardDescription className="mt-1">{getMessage()}</CardDescription>
          </div>

          {/* Circular progress */}
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted/20"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="url(#progress-gradient)"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 - (251.2 * percentage) / 100}
                className="transition-all duration-500 ease-out"
              />
              <defs>
                <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(var(--primary) / 0.6)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold">{percentage}%</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        {/* Progress text */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span>
            {completedCount} sur {tasks.length} étapes complétées
          </span>
        </div>

        {/* Pending tasks */}
        {pendingTasks.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Prochaines étapes :</p>
            {pendingTasks.map((task) => {
              const Icon = iconMap[task.iconName] || User;
              return (
                <Link key={task.key} href={task.href}>
                  <div className="group flex items-center gap-3 p-3 rounded-lg bg-background/60 backdrop-blur-sm border border-border/50 hover:border-primary/30 hover:bg-background/80 transition-all cursor-pointer">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="flex-1 text-sm font-medium">{task.label}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
