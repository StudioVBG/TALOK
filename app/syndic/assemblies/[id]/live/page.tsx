"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Play,
  Square,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Vote,
  Radio,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { BureauSetupCard } from "./_components/BureauSetupCard";
import { VoteRecorderCard } from "./_components/VoteRecorderCard";
import { QuorumGauge } from "./_components/QuorumGauge";

interface Assembly {
  id: string;
  site_id: string;
  title: string;
  reference_number: string | null;
  assembly_type: string;
  status: string;
  quorum_required: number | null;
  present_tantiemes: number | null;
  quorum_reached: boolean | null;
  presided_by: string | null;
  secretary_profile_id: string | null;
  scrutineers: Array<{ profile_id: string; unit_id?: string }> | null;
  held_at: string | null;
}

interface Resolution {
  id: string;
  resolution_number: number;
  title: string;
  description: string;
  category: string;
  majority_rule: string;
  status: string;
  votes_for_count: number;
  votes_against_count: number;
  votes_abstain_count: number;
  tantiemes_for: number;
  tantiemes_against: number;
  tantiemes_abstain: number;
}

interface Unit {
  id: string;
  lot_number: string;
  owner_profile_id: string | null;
  owner_name: string;
  tantieme_general: number;
}

interface SiteInfo {
  name: string;
  total_tantiemes_general: number;
}

export default function LiveAssemblyPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const assemblyId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [assembly, setAssembly] = useState<Assembly | null>(null);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [site, setSite] = useState<SiteInfo | null>(null);
  const [starting, setStarting] = useState(false);
  const [closing, setClosing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [assemblyRes, unitsRes] = await Promise.all([
        fetch(`/api/copro/assemblies/${assemblyId}`),
        fetch(`/api/copro/assemblies/${assemblyId}/units`),
      ]);

      if (!assemblyRes.ok) {
        if (assemblyRes.status === 404) {
          toast({ title: "Assemblée introuvable", variant: "destructive" });
          router.push("/syndic/assemblies");
          return;
        }
        throw new Error("Erreur de chargement");
      }

      const assemblyData = await assemblyRes.json();
      setAssembly(assemblyData.assembly);
      setResolutions(assemblyData.resolutions || []);

      if (unitsRes.ok) {
        const unitsData = await unitsRes.json();
        setUnits(unitsData.units || []);
        setSite(unitsData.site || null);
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Chargement impossible",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [assemblyId, router, toast]);

  useEffect(() => {
    if (assemblyId) {
      fetchData();
    }
  }, [assemblyId, fetchData]);

  const handleStart = async (bureau: {
    presided_by: string;
    secretary_profile_id: string;
    scrutineers: Array<{ profile_id: string }>;
    present_tantiemes: number;
  }) => {
    setStarting(true);
    try {
      const res = await fetch(`/api/copro/assemblies/${assemblyId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bureau),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }

      const data = await res.json();
      toast({
        title: "Session démarrée",
        description: data.message,
        variant: data.quorum_reached ? "default" : "destructive",
      });

      await fetchData();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de démarrer",
        variant: "destructive",
      });
    } finally {
      setStarting(false);
    }
  };

  const handleClose = async () => {
    if (!confirm("Clôturer définitivement cette assemblée ? Les résolutions ne pourront plus être votées.")) {
      return;
    }

    setClosing(true);
    try {
      const res = await fetch(`/api/copro/assemblies/${assemblyId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }

      const data = await res.json();
      toast({
        title: "Session clôturée",
        description: data.message,
      });

      router.push(`/syndic/assemblies/${assemblyId}`);
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de clôturer",
        variant: "destructive",
      });
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-0">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-12 w-96 bg-muted" />
          <Skeleton className="h-48 bg-muted" />
          <Skeleton className="h-96 bg-muted" />
        </div>
      </div>
    );
  }

  if (!assembly) {
    return (
      <div className="p-0">
        <p className="text-foreground text-center py-12">Assemblée introuvable</p>
      </div>
    );
  }

  const canStart = assembly.status === "convened";
  const isInProgress = assembly.status === "in_progress";
  const isHeld = assembly.status === "held";
  const totalTantiemes = site?.total_tantiemes_general || 10000;
  const presentTantiemes = assembly.present_tantiemes || 0;

  // Si l'AG n'est pas encore convoquée, rediriger vers la page détail
  if (assembly.status === "draft") {
    return (
      <div className="p-0">
        <div className="max-w-3xl mx-auto">
          <Card className="bg-muted/30 border-amber-200 backdrop-blur">
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-amber-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Assemblée en brouillon</h2>
              <p className="text-foreground mb-6">
                Vous devez d'abord envoyer les convocations avant de démarrer la session.
              </p>
              <Link href={`/syndic/assemblies/${assemblyId}`}>
                <Button className="bg-violet-500 hover:bg-violet-600">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour à l'assemblée
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-0">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Link href={`/syndic/assemblies/${assemblyId}`}>
            <Button variant="ghost" size="sm" className="text-foreground hover:text-foreground hover:bg-muted mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à l'assemblée
            </Button>
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Radio className={`h-6 w-6 ${isInProgress ? "text-red-600 animate-pulse" : "text-muted-foreground"}`} />
                <h1 className="text-2xl font-bold text-foreground">Session en direct</h1>
                {isInProgress && (
                  <Badge className="bg-red-100 text-red-700 border-red-200 border">
                    ● EN COURS
                  </Badge>
                )}
                {isHeld && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border">
                    Clôturée
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">{assembly.title}</p>
              <p className="text-muted-foreground font-mono text-xs">{assembly.reference_number}</p>
            </div>

            {isInProgress && (
              <Button
                onClick={handleClose}
                disabled={closing}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
              >
                {closing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Clôture...
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Clôturer la session
                  </>
                )}
              </Button>
            )}
          </div>
        </motion.div>

        {/* Quorum gauge */}
        <QuorumGauge
          totalTantiemes={totalTantiemes}
          presentTantiemes={presentTantiemes}
          quorumRequired={assembly.quorum_required || 0}
          quorumReached={assembly.quorum_reached || false}
          siteName={site?.name || "Copropriété"}
        />

        {/* Bureau setup (if convened, not yet started) */}
        {canStart && (
          <BureauSetupCard
            units={units}
            totalTantiemes={totalTantiemes}
            onStart={handleStart}
            starting={starting}
          />
        )}

        {/* Vote recording (if in progress) */}
        {isInProgress && resolutions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-foreground">
              <Vote className="h-5 w-5 text-violet-600" />
              <h2 className="text-lg font-semibold">Résolutions à voter</h2>
            </div>
            {resolutions.map((resolution) => (
              <VoteRecorderCard
                key={resolution.id}
                resolution={resolution}
                units={units}
                onVoted={fetchData}
              />
            ))}
          </div>
        )}

        {/* Held state summary */}
        {isHeld && (
          <Card className="">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Session clôturée
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Tenue le {new Date(assembly.held_at || "").toLocaleString("fr-FR")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-foreground mb-4">
                La session est terminée. Vous pouvez maintenant générer le procès-verbal.
              </p>
              <Link href={`/syndic/assemblies/${assemblyId}`}>
                <Button className="bg-violet-500 hover:bg-violet-600">
                  Retour à l'assemblée
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
