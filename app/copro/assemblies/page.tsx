"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
} from "lucide-react";
import Link from "next/link";

interface AssemblySummary {
  id: string;
  label: string;
  site_name: string;
  scheduled_at: string;
  type: "ordinary" | "extraordinary";
  status: "upcoming" | "in_progress" | "completed" | "cancelled";
  motions_count: number;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  upcoming: { label: "À venir", icon: Clock, className: "bg-blue-100 text-blue-700" },
  in_progress: { label: "En cours", icon: AlertCircle, className: "bg-amber-100 text-amber-700" },
  completed: { label: "Terminée", icon: CheckCircle2, className: "bg-green-100 text-green-700" },
  cancelled: { label: "Annulée", icon: XCircle, className: "bg-red-100 text-red-700" },
};

export default function CoproAssembliesPage() {
  const [assemblies, setAssemblies] = useState<AssemblySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAssemblies() {
      try {
        const res = await fetch("/api/copro/assemblies");
        if (res.ok) {
          setAssemblies(await res.json());
        }
      } catch (error) {
        console.error("Erreur chargement assemblées:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAssemblies();
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link
            href="/copro/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au tableau de bord
          </Link>
          <h1 className="text-2xl font-bold">Assemblées Générales</h1>
          <p className="text-muted-foreground">
            Consultez les assemblées générales de votre copropriété
          </p>
        </div>

        {/* List */}
        {assemblies.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune assemblée générale</h3>
              <p className="text-muted-foreground">
                Aucune assemblée générale n&apos;est programmée pour le moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {assemblies.map((assembly, index) => {
              const status = statusConfig[assembly.status] || statusConfig.upcoming;
              const StatusIcon = status.icon;
              return (
                <motion.div
                  key={assembly.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link href={`/copro/assemblies/${assembly.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-lg bg-indigo-100">
                            <Calendar className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{assembly.label}</h3>
                            <p className="text-sm text-muted-foreground">
                              {assembly.site_name} &middot;{" "}
                              {new Date(assembly.scheduled_at).toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={status.className}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {status.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {assembly.motions_count} résolution(s)
                              </span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
