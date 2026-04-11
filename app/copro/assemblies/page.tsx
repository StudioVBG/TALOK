"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
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
  Vote,
  Radio,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Assembly {
  id: string;
  site_id: string;
  title: string;
  reference_number: string | null;
  assembly_type: "ordinaire" | "extraordinaire" | "concertation" | "consultation_ecrite";
  scheduled_at: string;
  location: string | null;
  status: "draft" | "convened" | "in_progress" | "held" | "adjourned" | "cancelled";
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  draft: { label: "Brouillon", icon: Clock, className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  convened: { label: "Convoquée", icon: Calendar, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  in_progress: {
    label: "En cours",
    icon: Radio,
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  held: {
    label: "Terminée",
    icon: CheckCircle2,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  adjourned: { label: "Ajournée", icon: AlertCircle, className: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Annulée", icon: XCircle, className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

const TYPE_LABELS: Record<string, string> = {
  ordinaire: "AG Ordinaire",
  extraordinaire: "AG Extraordinaire",
  concertation: "Concertation",
  consultation_ecrite: "Consultation écrite",
};

export default function CoproAssembliesPage() {
  const { toast } = useToast();
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAssemblies() {
      try {
        const res = await fetch("/api/copro/assemblies");
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Erreur de chargement");
        }
        const data = await res.json();
        setAssemblies(Array.isArray(data) ? data : []);
      } catch (error) {
        toast({
          title: "Erreur",
          description: error instanceof Error ? error.message : "Impossible de charger",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchAssemblies();
  }, [toast]);

  const upcoming = assemblies.filter(
    (a) => ["convened", "in_progress"].includes(a.status) && new Date(a.scheduled_at) >= new Date()
  );
  const past = assemblies.filter((a) => ["held", "adjourned", "cancelled"].includes(a.status));

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
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
        <div>
          <Link
            href="/copro/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au tableau de bord
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Vote className="h-6 w-6 text-violet-600" />
            Assemblées Générales
          </h1>
          <p className="text-muted-foreground">
            Consultez les assemblées de votre copropriété et votez en ligne avant la séance
          </p>
        </div>

        {assemblies.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune assemblée générale</h3>
              <p className="text-muted-foreground">
                Aucune assemblée n'est programmée pour le moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  À venir ({upcoming.length})
                </h2>
                <div className="space-y-3">
                  {upcoming.map((a, i) => (
                    <AssemblyCard key={a.id} assembly={a} delay={i * 0.05} />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Passées ({past.length})
                </h2>
                <div className="space-y-3">
                  {past.map((a, i) => (
                    <AssemblyCard key={a.id} assembly={a} delay={i * 0.05} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AssemblyCard({ assembly, delay }: { assembly: Assembly; delay: number }) {
  const status = STATUS_CONFIG[assembly.status] || STATUS_CONFIG.draft;
  const StatusIcon = status.icon;
  const typeLabel = TYPE_LABELS[assembly.assembly_type] || assembly.assembly_type;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Link href={`/copro/assemblies/${assembly.id}`}>
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="p-3 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex-shrink-0">
                <Calendar className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold truncate">{assembly.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {typeLabel}
                  {assembly.reference_number && ` · ${assembly.reference_number}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(assembly.scheduled_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <div className="mt-1">
                  <Badge className={status.className}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {status.label}
                  </Badge>
                </div>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
