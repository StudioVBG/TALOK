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
  Calendar,
  MapPin,
  Video,
  Users,
  FileText,
  Plus,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Edit,
  Trash2,
  Vote,
  Radio,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatDateShort } from "@/lib/helpers/format";
import { AddResolutionDialog } from "./_components/AddResolutionDialog";
import { SendConvocationsDialog } from "./_components/SendConvocationsDialog";
import { DownloadPdfButton } from "./_components/DownloadPdfButton";

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
  fiscal_year: number | null;
  description: string | null;
  notes: string | null;
  first_convocation_sent_at: string | null;
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
  estimated_amount_cents: number | null;
  votes_for_count: number;
  votes_against_count: number;
  votes_abstain_count: number;
  tantiemes_for: number;
  tantiemes_against: number;
  tantiemes_abstain: number;
}

interface ConvocationSummary {
  id: string;
  status: string;
  delivery_method: string;
  sent_at: string | null;
  delivered_at: string | null;
  recipient_name: string;
}

interface MinuteSummary {
  id: string;
  version: number;
  status: string;
  signed_by_president_at: string | null;
  distributed_at: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-foreground border-slate-200" },
  convened: { label: "Convoquée", color: "bg-blue-100 text-blue-700 border-blue-200" },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-700 border-amber-200" },
  held: { label: "Tenue", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Annulée", color: "bg-red-100 text-red-700 border-red-200" },
};

const RESOLUTION_STATUS_LABELS: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  proposed: { label: "Proposée", color: "bg-slate-100 text-foreground", icon: Clock },
  voted_for: { label: "Adoptée", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  voted_against: { label: "Rejetée", color: "bg-red-100 text-red-700", icon: XCircle },
  abstained: { label: "Abstention", color: "bg-amber-100 text-amber-700", icon: AlertCircle },
  adjourned: { label: "Ajournée", color: "bg-orange-100 text-orange-700", icon: Clock },
  withdrawn: { label: "Retirée", color: "bg-slate-100 text-foreground", icon: XCircle },
};

const MAJORITY_LABELS: Record<string, string> = {
  article_24: "Art. 24 (majorité simple)",
  article_25: "Art. 25 (majorité absolue)",
  article_25_1: "Art. 25-1 (absolue + passerelle)",
  article_26: "Art. 26 (double majorité)",
  article_26_1: "Art. 26-1 (double + passerelle)",
  unanimite: "Unanimité",
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

export default function AssemblyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const assemblyId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [assembly, setAssembly] = useState<Assembly | null>(null);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [convocations, setConvocations] = useState<ConvocationSummary[]>([]);
  const [minutes, setMinutes] = useState<MinuteSummary[]>([]);
  const [showAddResolution, setShowAddResolution] = useState(false);
  const [showSendConvocations, setShowSendConvocations] = useState(false);

  const fetchAssembly = useCallback(async () => {
    try {
      const res = await fetch(`/api/copro/assemblies/${assemblyId}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast({ title: "Assemblée introuvable", variant: "destructive" });
          router.push("/syndic/assemblies");
          return;
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur de chargement");
      }
      const data = await res.json();
      setAssembly(data.assembly);
      setResolutions(data.resolutions || []);
      setConvocations(data.convocations || []);
      setMinutes(data.minutes || []);
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger l'assemblée",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [assemblyId, router, toast]);

  useEffect(() => {
    if (assemblyId) {
      fetchAssembly();
    }
  }, [assemblyId, fetchAssembly]);

  const handleDelete = async () => {
    if (!confirm("Annuler cette assemblée ? Cette action peut être réversible en la recréant.")) return;

    try {
      const res = await fetch(`/api/copro/assemblies/${assemblyId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }
      toast({ title: "Assemblée annulée" });
      router.push("/syndic/assemblies");
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'annuler",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="p-0">
        <div className="max-w-5xl mx-auto space-y-6">
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
        <div className="max-w-5xl mx-auto">
          <p className="text-foreground text-center py-12">Assemblée introuvable</p>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_LABELS[assembly.status] || STATUS_LABELS.draft;
  const canEdit = ["draft", "convened"].includes(assembly.status);
  const canConvene = ["draft", "convened"].includes(assembly.status);
  const canAddResolution = ["draft", "convened", "in_progress"].includes(assembly.status);
  const canStartLive = assembly.status === "convened" && resolutions.length > 0;
  const isLive = assembly.status === "in_progress";

  return (
    <div className="p-0">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Link href="/syndic/assemblies">
            <Button variant="ghost" size="sm" className="text-foreground hover:text-foreground hover:bg-muted mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour aux assemblées
            </Button>
          </Link>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-foreground">{assembly.title}</h1>
                <Badge className={`${statusConfig.color} border`}>{statusConfig.label}</Badge>
              </div>
              <p className="text-muted-foreground font-mono text-sm">
                {assembly.reference_number || "Pas de référence"}
              </p>
            </div>
            <div className="flex gap-2">
              {canEdit && (
                <Link href={`/syndic/assemblies/${assembly.id}/edit`}>
                  <Button variant="outline" size="sm" className="border-input text-foreground hover:bg-muted">
                    <Edit className="h-4 w-4 mr-2" />
                    Modifier
                  </Button>
                </Link>
              )}
              {assembly.status !== "cancelled" && assembly.status !== "held" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  className="border-red-200 text-red-700 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Annuler
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Info card */}
        <Card className="">
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoItem
              icon={Calendar}
              label="Date prévue"
              value={`${formatDateShort(assembly.scheduled_at)} à ${new Date(assembly.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
            />
            {assembly.fiscal_year && (
              <InfoItem icon={FileText} label="Exercice" value={assembly.fiscal_year.toString()} />
            )}
            {assembly.location && <InfoItem icon={MapPin} label="Lieu" value={assembly.location} />}
            {assembly.online_meeting_url && (
              <InfoItem icon={Video} label="Visio" value="Lien de connexion disponible" />
            )}
            {assembly.quorum_required !== null && (
              <InfoItem icon={Users} label="Quorum requis" value={`${assembly.quorum_required} tantièmes`} />
            )}
            {assembly.first_convocation_sent_at && (
              <InfoItem
                icon={Send}
                label="Convoquée le"
                value={formatDateShort(assembly.first_convocation_sent_at)}
              />
            )}
          </CardContent>
          {assembly.description && (
            <div className="px-6 pb-6">
              <p className="text-sm text-foreground">{assembly.description}</p>
            </div>
          )}
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {canConvene && resolutions.length > 0 && (
            <Button
              onClick={() => setShowSendConvocations(true)}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              <Send className="h-4 w-4 mr-2" />
              Envoyer les convocations
            </Button>
          )}
          {canStartLive && (
            <Link href={`/syndic/assemblies/${assemblyId}/live`}>
              <Button className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700">
                <Radio className="h-4 w-4 mr-2" />
                Démarrer la session
              </Button>
            </Link>
          )}
          {isLive && (
            <Link href={`/syndic/assemblies/${assemblyId}/live`}>
              <Button className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 animate-pulse">
                <Radio className="h-4 w-4 mr-2" />
                Session en cours — accéder
              </Button>
            </Link>
          )}
          {resolutions.length > 0 && (
            <DownloadPdfButton
              variant="convocation"
              assemblyId={assemblyId}
              label="Télécharger convocation (PDF)"
              filename={`convocation-${assembly.reference_number || assembly.id}.pdf`}
            />
          )}
        </div>

        {/* Resolutions */}
        <Card className="">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Vote className="h-5 w-5 text-violet-600" />
                  Ordre du jour ({resolutions.length})
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Résolutions soumises au vote de l'assemblée
                </CardDescription>
              </div>
              {canAddResolution && (
                <Button
                  size="sm"
                  onClick={() => setShowAddResolution(true)}
                  className="bg-violet-500 hover:bg-violet-600"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {resolutions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Vote className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p>Aucune résolution pour le moment</p>
                {canAddResolution && (
                  <p className="text-xs mt-2">Ajoutez une résolution pour commencer l'ordre du jour</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {resolutions.map((resolution) => {
                  const resStatus =
                    RESOLUTION_STATUS_LABELS[resolution.status] || RESOLUTION_STATUS_LABELS.proposed;
                  const StatusIcon = resStatus.icon;
                  const hasVotes =
                    resolution.votes_for_count + resolution.votes_against_count + resolution.votes_abstain_count > 0;

                  return (
                    <div
                      key={resolution.id}
                      className="rounded-xl border border-border bg-muted/30 p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono text-xs text-muted-foreground">
                              #{resolution.resolution_number}
                            </span>
                            <Badge variant="outline" className="border-input text-foreground text-xs">
                              {CATEGORY_LABELS[resolution.category] || resolution.category}
                            </Badge>
                            <Badge variant="outline" className="border-violet-400/30 text-violet-700 text-xs">
                              {MAJORITY_LABELS[resolution.majority_rule] || resolution.majority_rule}
                            </Badge>
                          </div>
                          <h4 className="text-foreground font-medium">{resolution.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{resolution.description}</p>
                          {resolution.estimated_amount_cents && (
                            <p className="text-xs text-amber-700 mt-2">
                              Montant estimé : {(resolution.estimated_amount_cents / 100).toLocaleString("fr-FR")} €
                            </p>
                          )}
                        </div>
                        <Badge className={resStatus.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {resStatus.label}
                        </Badge>
                      </div>

                      {hasVotes && (
                        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
                          <VoteStat
                            label="Pour"
                            count={resolution.votes_for_count}
                            tantiemes={resolution.tantiemes_for}
                            color="text-emerald-300"
                          />
                          <VoteStat
                            label="Contre"
                            count={resolution.votes_against_count}
                            tantiemes={resolution.tantiemes_against}
                            color="text-red-300"
                          />
                          <VoteStat
                            label="Abstention"
                            count={resolution.votes_abstain_count}
                            tantiemes={resolution.tantiemes_abstain}
                            color="text-amber-300"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Convocations summary */}
        {convocations.length > 0 && (
          <Card className="">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-600" />
                Convocations ({convocations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ConvocationStats convocations={convocations} />
            </CardContent>
          </Card>
        )}

        {/* Minutes */}
        <Card className="">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              Procès-verbaux ({minutes.length})
            </CardTitle>
            {(assembly.status === "held" || assembly.status === "in_progress") && (
              <Button
                size="sm"
                variant="outline"
                className="border-input text-foreground hover:bg-muted"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/copro/assemblies/${assemblyId}/minutes`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({}),
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      throw new Error(err.error ?? "Erreur");
                    }
                    toast({ title: "PV généré" });
                    fetchAssembly();
                  } catch (err) {
                    toast({
                      title: "Erreur",
                      description: err instanceof Error ? err.message : "Échec",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Générer un nouveau PV
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {minutes.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Aucun procès-verbal généré pour le moment.
              </div>
            ) : (
              <div className="space-y-2">
                {minutes.map((minute) => (
                  <div
                    key={minute.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-foreground text-sm">Version {minute.version}</p>
                        <p className="text-xs text-muted-foreground">
                          {minute.signed_by_president_at
                            ? `Signé le ${formatDateShort(minute.signed_by_president_at)}`
                            : "Non signé"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-slate-100 text-foreground capitalize">{minute.status}</Badge>
                      <DownloadPdfButton
                        variant="minute"
                        minuteId={minute.id}
                        label="PDF"
                        filename={`pv-${assembly.reference_number || assembly.id}-v${minute.version}.pdf`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showAddResolution && (
        <AddResolutionDialog
          assemblyId={assemblyId}
          nextResolutionNumber={resolutions.length + 1}
          onClose={() => setShowAddResolution(false)}
          onCreated={() => {
            setShowAddResolution(false);
            fetchAssembly();
          }}
        />
      )}

      {showSendConvocations && (
        <SendConvocationsDialog
          assemblyId={assemblyId}
          onClose={() => setShowSendConvocations(false)}
          onSent={() => {
            setShowSendConvocations(false);
            fetchAssembly();
          }}
        />
      )}
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
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function VoteStat({
  label,
  count,
  tantiemes,
  color,
}: {
  label: string;
  count: number;
  tantiemes: number;
  color: string;
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{count}</p>
      <p className="text-xs text-muted-foreground">{tantiemes.toLocaleString("fr-FR")} tant.</p>
    </div>
  );
}

function ConvocationStats({ convocations }: { convocations: ConvocationSummary[] }) {
  const byStatus = convocations.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Object.entries(byStatus).map(([status, count]) => (
        <div key={status} className="rounded-lg border border-border bg-muted/30 p-3 text-center">
          <p className="text-xs text-muted-foreground capitalize">{status}</p>
          <p className="text-xl font-bold text-foreground mt-1">{count}</p>
        </div>
      ))}
    </div>
  );
}
