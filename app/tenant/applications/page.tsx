"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileSearch,
  Clock,
  CheckCircle2,
  XCircle,
  FileSignature,
  Home,
  Loader2,
  ChevronRight,
  Info,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/helpers/format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ErrorState } from "@/components/ui/error-state";
import { useToast } from "@/components/ui/use-toast";
import { useTenantApplications } from "@/lib/hooks/queries/use-tenant-applications";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  started: { label: "En cours", color: "bg-blue-100 text-blue-700", icon: Clock },
  docs_pending: { label: "Documents requis", color: "bg-amber-100 text-amber-700", icon: FileSearch },
  review: { label: "En examen", color: "bg-purple-100 text-purple-700", icon: FileSearch },
  ready_to_sign: { label: "Prêt à signer", color: "bg-emerald-100 text-emerald-700", icon: FileSignature },
  signed: { label: "Signée", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  rejected: { label: "Refusée", color: "bg-red-100 text-red-700", icon: XCircle },
};

export default function TenantApplicationsPage() {
  const { data: applications = [], isLoading, error, refetch } = useTenantApplications();
  const [propertyCode, setPropertyCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleValidateCode = async () => {
    const code = propertyCode.trim().toUpperCase();
    if (!code) return;
    setIsValidating(true);
    try {
      router.push(`/invitation/${code}`);
    } catch {
      toast({ variant: "destructive", title: "Code invalide", description: "Vérifiez le code et réessayez." });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-5xl space-y-4 sm:space-y-6">
        <Breadcrumb
          items={[{ label: "Mes candidatures" }]}
          homeHref="/tenant/dashboard"
        />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-violet-600 rounded-lg shadow-lg shadow-violet-200">
                <FileSearch className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Mes Candidatures</h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Suivez l&apos;avancement de vos candidatures locatives.
            </p>
          </motion.div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <div role="status" aria-label="Chargement des candidatures">
              <Loader2 className="animate-spin h-10 w-10 text-violet-600" />
              <span className="sr-only">Chargement en cours…</span>
            </div>
          </div>
        ) : applications.length === 0 ? (
          <GlassCard className="p-12 text-center border-border">
            <div className="h-20 w-20 bg-violet-50 dark:bg-violet-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileSearch className="h-10 w-10 text-violet-300 dark:text-violet-500" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Aucune candidature</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto mb-6">
              Entrez le code logement fourni par votre futur propriétaire pour postuler.
            </p>
            <div className="flex items-center gap-2 max-w-sm mx-auto">
              <div className="relative flex-1">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ex : ABC123"
                  value={propertyCode}
                  onChange={(e) => setPropertyCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleValidateCode()}
                  className="pl-10 h-11 font-mono uppercase tracking-widest"
                  aria-label="Code logement"
                />
              </div>
              <Button
                onClick={handleValidateCode}
                disabled={!propertyCode.trim() || isValidating}
                className="h-11 px-6 font-bold"
              >
                {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Valider"}
              </Button>
            </div>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {applications.map((app, index) => {
              const config = STATUS_CONFIG[app.status] || STATUS_CONFIG.started;
              const StatusIcon = config.icon;

              return (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <GlassCard className="p-6 border-border bg-card hover:shadow-xl transition-all duration-300">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={cn("p-3 rounded-2xl", config.color.split(" ")[0])}>
                          <StatusIcon className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg text-foreground">
                              {app.property?.adresse_complete || "Logement"}
                            </h3>
                            <Badge className={cn("text-[10px] h-5", config.color)}>
                              {config.label}
                            </Badge>
                          </div>
                          {app.property?.ville && (
                            <p className="text-muted-foreground text-sm flex items-center gap-1.5">
                              <Home className="h-3.5 w-3.5" /> {app.property.ville}
                            </p>
                          )}
                          <p className="text-muted-foreground/60 text-xs mt-1">
                            Candidature du {formatDateShort(app.created_at)}
                          </p>
                          {app.rejection_reason && (
                            <p className="text-red-600 text-xs mt-1">
                              Motif : {app.rejection_reason}
                            </p>
                          )}
                        </div>
                      </div>

                      {(app.status === "docs_pending" || app.status === "ready_to_sign") && (
                        <Button variant="default" className="h-11 px-6 font-bold rounded-xl" asChild>
                          <Link href={`/tenant/onboarding/documents?application=${app.id}`}>
                            {app.status === "ready_to_sign" ? "Signer" : "Compléter"}
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        )}

        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="mt-8 p-6 bg-muted rounded-3xl border border-border flex items-start gap-4">
          <Info className="h-6 w-6 text-violet-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-foreground">Comment candidater ?</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Votre propriétaire vous enverra un <strong>code logement</strong> ou un lien d&apos;invitation. Saisissez-le ci-dessus ou utilisez le lien reçu par email.
            </p>
          </div>
        </motion.div>
      </div>
    </PageTransition>
  );
}
