"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Video,
  Vote,
  FileText,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Assembly {
  id: string;
  site_id: string;
  title: string;
  reference_number: string | null;
  assembly_type: string;
  scheduled_at: string;
  location: string | null;
  location_address: string | null;
  online_meeting_url: string | null;
  is_hybrid: boolean;
  status: string;
  quorum_required: number | null;
  description: string | null;
}

interface Resolution {
  id: string;
  resolution_number: number;
  title: string;
  description: string;
  category: string;
  majority_rule: string;
  status: string;
  estimated_amount_cents: number | null;
}

interface Unit {
  id: string;
  lot_number: string;
  type: string;
  tantieme_general: number;
}

interface MyVote {
  id: string;
  resolution_id: string;
  unit_id: string;
  vote: "for" | "against" | "abstain";
  voted_at: string;
  vote_method: string;
}

interface Minute {
  id: string;
  version: number;
  status: string;
  distributed_at: string | null;
  signed_by_president_at: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  ordinaire: "Assemblée Générale Ordinaire",
  extraordinaire: "Assemblée Générale Extraordinaire",
  concertation: "Concertation",
  consultation_ecrite: "Consultation écrite",
};

const CATEGORY_LABELS: Record<string, string> = {
  gestion: "Gestion",
  budget: "Budget",
  travaux: "Travaux",
  reglement: "Règlement",
  honoraires: "Honoraires",
  conseil_syndical: "Conseil syndical",
  assurance: "Assurance",
  conflits: "Conflits",
  autre: "Autre",
};

const MAJORITY_LABELS: Record<string, string> = {
  article_24: "Article 24",
  article_25: "Article 25",
  article_25_1: "Article 25-1",
  article_26: "Article 26",
  article_26_1: "Article 26-1",
  unanimite: "Unanimité",
};

export default function CoproAssemblyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const assemblyId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [assembly, setAssembly] = useState<Assembly | null>(null);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [myUnits, setMyUnits] = useState<Unit[]>([]);
  const [myVotes, setMyVotes] = useState<MyVote[]>([]);
  const [minutes, setMinutes] = useState<Minute[]>([]);
  const [canVoteOnline, setCanVoteOnline] = useState(false);
  const [submittingVote, setSubmittingVote] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/copro/assemblies/${assemblyId}/my-vote`);
      if (!res.ok) {
        if (res.status === 404) {
          toast({ title: "Assemblée introuvable", variant: "destructive" });
          router.push("/copro/assemblies");
          return;
        }
        if (res.status === 403) {
          toast({
            title: "Accès refusé",
            description: "Vous n'êtes pas copropriétaire de ce site",
            variant: "destructive",
          });
          router.push("/copro/assemblies");
          return;
        }
        throw new Error("Erreur de chargement");
      }
      const data = await res.json();
      setAssembly(data.assembly);
      setResolutions(data.resolutions || []);
      setMyUnits(data.my_units || []);
      setMyVotes(data.my_votes || []);
      setMinutes(data.minutes || []);
      setCanVoteOnline(data.can_vote_online || false);
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
    if (assemblyId) fetchData();
  }, [assemblyId, fetchData]);

  const handleVote = async (
    resolutionId: string,
    unitId: string,
    vote: "for" | "against" | "abstain"
  ) => {
    const voteKey = `${resolutionId}-${unitId}`;
    setSubmittingVote(voteKey);

    try {
      const res = await fetch(`/api/copro/assemblies/${assemblyId}/my-vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution_id: resolutionId, unit_id: unitId, vote }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors du vote");
      }

      toast({
        title: "Vote enregistré",
        description: "Votre vote a bien été pris en compte",
      });

      await fetchData();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Vote impossible",
        variant: "destructive",
      });
    } finally {
      setSubmittingVote(null);
    }
  };

  const getMyVoteFor = (resolutionId: string, unitId: string): MyVote | undefined => {
    return myVotes.find((v) => v.resolution_id === resolutionId && v.unit_id === unitId);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!assembly) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-center py-12 text-muted-foreground">Assemblée introuvable</p>
      </div>
    );
  }

  const typeLabel = TYPE_LABELS[assembly.assembly_type] || assembly.assembly_type;
  const hasMinutes = minutes.length > 0;

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Link
            href="/copro/assemblies"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux assemblées
          </Link>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-2xl font-bold">{assembly.title}</h1>
            <StatusBadge status={assembly.status} />
          </div>
          <p className="text-muted-foreground">
            {typeLabel}
            {assembly.reference_number && ` · ${assembly.reference_number}`}
          </p>
        </motion.div>

        {/* Info card */}
        <Card>
          <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoItem
              icon={Calendar}
              label="Date prévue"
              value={new Date(assembly.scheduled_at).toLocaleString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
            {assembly.location && <InfoItem icon={MapPin} label="Lieu" value={assembly.location} />}
            {assembly.location_address && (
              <InfoItem icon={MapPin} label="Adresse" value={assembly.location_address} />
            )}
            {assembly.online_meeting_url && (
              <InfoItem icon={Video} label="Visio" value={assembly.online_meeting_url} />
            )}
            {assembly.quorum_required && (
              <InfoItem
                icon={Vote}
                label="Quorum requis"
                value={`${assembly.quorum_required.toLocaleString("fr-FR")} tantièmes`}
              />
            )}
          </CardContent>
          {assembly.description && (
            <div className="px-6 pb-6">
              <p className="text-sm text-muted-foreground">{assembly.description}</p>
            </div>
          )}
        </Card>

        {/* My units */}
        {myUnits.length > 0 && (
          <Card className="border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Vos lots dans cette copropriété</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {myUnits.map((unit) => (
                  <Badge key={unit.id} variant="outline" className="border-violet-300 bg-white dark:bg-slate-900">
                    Lot {unit.lot_number} — {unit.tantieme_general} tant.
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resolutions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Vote className="h-5 w-5 text-violet-600" />
              Ordre du jour ({resolutions.length})
            </CardTitle>
            <CardDescription>
              {canVoteOnline && myUnits.length > 0
                ? "Vous pouvez voter en ligne avant la séance"
                : canVoteOnline
                ? "Vous n'avez pas de lot dans cette copropriété — consultation uniquement"
                : "Consultation des résolutions"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resolutions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Aucune résolution</p>
            ) : (
              resolutions.map((resolution) => (
                <ResolutionCard
                  key={resolution.id}
                  resolution={resolution}
                  myUnits={myUnits}
                  getMyVote={(unitId) => getMyVoteFor(resolution.id, unitId)}
                  canVote={canVoteOnline && myUnits.length > 0}
                  onVote={(unitId, vote) => handleVote(resolution.id, unitId, vote)}
                  submittingVote={submittingVote}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Download convocation */}
        {assembly.status !== "draft" && myUnits.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-8 w-8 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium">Votre convocation</p>
                    <p className="text-sm text-muted-foreground">
                      Téléchargez la convocation officielle
                    </p>
                  </div>
                </div>
                <a
                  href={`/api/copro/assemblies/${assemblyId}/convocation-pdf?unit_id=${myUnits[0].id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="flex-shrink-0">
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Minutes (published only) */}
        {hasMinutes && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                Procès-verbaux
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {minutes.map((minute) => (
                  <div
                    key={minute.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">Version {minute.version}</p>
                      <p className="text-sm text-muted-foreground">
                        {minute.distributed_at
                          ? `Distribué le ${new Date(minute.distributed_at).toLocaleDateString("fr-FR")}`
                          : minute.signed_by_president_at
                          ? `Signé le ${new Date(minute.signed_by_president_at).toLocaleDateString("fr-FR")}`
                          : ""}
                      </p>
                    </div>
                    <a
                      href={`/api/copro/minutes/${minute.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </a>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm truncate">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
  > = {
    draft: { label: "Brouillon", icon: Clock, className: "bg-slate-100 text-slate-700" },
    convened: { label: "Convoquée", icon: Calendar, className: "bg-blue-100 text-blue-700" },
    in_progress: { label: "En cours", icon: AlertCircle, className: "bg-amber-100 text-amber-700" },
    held: { label: "Tenue", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700" },
    cancelled: { label: "Annulée", icon: XCircle, className: "bg-red-100 text-red-700" },
  };
  const c = config[status] || config.draft;
  const Icon = c.icon;
  return (
    <Badge className={c.className}>
      <Icon className="h-3 w-3 mr-1" />
      {c.label}
    </Badge>
  );
}

function ResolutionCard({
  resolution,
  myUnits,
  getMyVote,
  canVote,
  onVote,
  submittingVote,
}: {
  resolution: Resolution;
  myUnits: Unit[];
  getMyVote: (unitId: string) => MyVote | undefined;
  canVote: boolean;
  onVote: (unitId: string, vote: "for" | "against" | "abstain") => void;
  submittingVote: string | null;
}) {
  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">#{resolution.resolution_number}</span>
            <Badge variant="outline" className="text-xs">
              {CATEGORY_LABELS[resolution.category] || resolution.category}
            </Badge>
            <Badge variant="outline" className="text-xs border-violet-300">
              {MAJORITY_LABELS[resolution.majority_rule] || resolution.majority_rule}
            </Badge>
          </div>
          <h4 className="font-medium">{resolution.title}</h4>
          <p className="text-sm text-muted-foreground mt-1">{resolution.description}</p>
          {resolution.estimated_amount_cents && (
            <p className="text-xs text-amber-600 mt-1">
              Montant estimé : {(resolution.estimated_amount_cents / 100).toLocaleString("fr-FR")} €
            </p>
          )}
        </div>
      </div>

      {canVote && resolution.status === "proposed" && (
        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Votre vote</p>
          {myUnits.map((unit) => {
            const existingVote = getMyVote(unit.id);
            const voteKey = `${resolution.id}-${unit.id}`;
            const isSubmitting = submittingVote === voteKey;

            if (existingVote) {
              const voteLabel = { for: "Pour", against: "Contre", abstain: "Abstention" }[
                existingVote.vote
              ];
              const voteColor = {
                for: "text-emerald-600",
                against: "text-red-600",
                abstain: "text-amber-600",
              }[existingVote.vote];
              return (
                <div
                  key={unit.id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 p-2 text-sm"
                >
                  <span>Lot {unit.lot_number}</span>
                  <span className={`font-semibold ${voteColor}`}>
                    <CheckCircle2 className="h-3 w-3 inline mr-1" />
                    {voteLabel} (enregistré)
                  </span>
                </div>
              );
            }

            return (
              <div
                key={unit.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border p-2"
              >
                <span className="text-sm">Lot {unit.lot_number}</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onVote(unit.id, "for")}
                    disabled={isSubmitting}
                    className="border-emerald-200 hover:bg-emerald-50 text-emerald-700 dark:text-emerald-400"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <ThumbsUp className="h-3 w-3 mr-1" />
                        Pour
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onVote(unit.id, "against")}
                    disabled={isSubmitting}
                    className="border-red-200 hover:bg-red-50 text-red-700 dark:text-red-400"
                  >
                    <ThumbsDown className="h-3 w-3 mr-1" />
                    Contre
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onVote(unit.id, "abstain")}
                    disabled={isSubmitting}
                    className="border-amber-200 hover:bg-amber-50 text-amber-700 dark:text-amber-400"
                  >
                    <Minus className="h-3 w-3 mr-1" />
                    Abs.
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!canVote && resolution.status !== "proposed" && (
        <p className="text-xs text-muted-foreground pt-2 border-t">
          Vote terminé — statut :{" "}
          <span className="font-semibold">
            {resolution.status === "voted_for"
              ? "ADOPTÉE"
              : resolution.status === "voted_against"
              ? "REJETÉE"
              : resolution.status}
          </span>
        </p>
      )}
    </div>
  );
}
