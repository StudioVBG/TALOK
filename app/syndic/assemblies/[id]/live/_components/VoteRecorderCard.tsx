"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ThumbsUp,
  ThumbsDown,
  Minus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

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

interface VoteRecorderCardProps {
  resolution: Resolution;
  units: Unit[];
  onVoted: () => void | Promise<void>;
}

const MAJORITY_LABELS: Record<string, string> = {
  article_24: "Art. 24",
  article_25: "Art. 25",
  article_25_1: "Art. 25-1",
  article_26: "Art. 26",
  article_26_1: "Art. 26-1",
  unanimite: "Unanimité",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  proposed: { label: "Non votée", color: "bg-slate-500/20 text-slate-200", icon: Clock },
  voted_for: { label: "ADOPTÉE", color: "bg-emerald-500/20 text-emerald-200", icon: CheckCircle2 },
  voted_against: { label: "REJETÉE", color: "bg-red-500/20 text-red-200", icon: XCircle },
  abstained: { label: "Abstention", color: "bg-amber-500/20 text-amber-200", icon: AlertCircle },
  adjourned: { label: "Ajournée", color: "bg-orange-500/20 text-orange-200", icon: Clock },
  withdrawn: { label: "Retirée", color: "bg-slate-500/20 text-slate-300", icon: XCircle },
};

export function VoteRecorderCard({ resolution, units, onVoted }: VoteRecorderCardProps) {
  const { toast } = useToast();
  const isSubmittingRef = useRef(false);
  const [expanded, setExpanded] = useState(true);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const statusConfig = STATUS_CONFIG[resolution.status] || STATUS_CONFIG.proposed;
  const StatusIcon = statusConfig.icon;
  const isVoted = ["voted_for", "voted_against", "abstained", "adjourned", "withdrawn"].includes(
    resolution.status
  );

  const totalVotes =
    resolution.votes_for_count + resolution.votes_against_count + resolution.votes_abstain_count;

  const castVote = async (voteType: "for" | "against" | "abstain") => {
    if (isSubmittingRef.current) return;
    if (!selectedUnitId) {
      toast({ title: "Sélectionnez un lot", variant: "destructive" });
      return;
    }

    const unit = units.find((u) => u.id === selectedUnitId);
    if (!unit) {
      toast({ title: "Lot introuvable", variant: "destructive" });
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      const payload = {
        unit_id: unit.id,
        voter_profile_id: unit.owner_profile_id || undefined,
        voter_name: unit.owner_name,
        voter_tantiemes: unit.tantieme_general,
        vote: voteType,
        vote_method: "hand_vote" as const,
      };

      const res = await fetch(`/api/copro/resolutions/${resolution.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors du vote");
      }

      toast({
        title: "Vote enregistré",
        description: `${unit.owner_name} (${unit.tantieme_general} tant.) — ${voteType === "for" ? "Pour" : voteType === "against" ? "Contre" : "Abstention"}`,
      });

      setSelectedUnitId("");
      await onVoted();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'enregistrer le vote",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs text-slate-500">#{resolution.resolution_number}</span>
              <Badge variant="outline" className="border-violet-400/30 text-violet-200 text-xs">
                {MAJORITY_LABELS[resolution.majority_rule] || resolution.majority_rule}
              </Badge>
              <Badge className={statusConfig.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>
            <h4 className="text-white font-medium">{resolution.title}</h4>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-slate-400 hover:text-white hover:bg-white/10 flex-shrink-0"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-400">{resolution.description}</p>

          {/* Vote counts */}
          {totalVotes > 0 && (
            <div className="grid grid-cols-3 gap-3 py-3 border-t border-white/10">
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase">Pour</p>
                <p className="text-xl font-bold text-emerald-300">{resolution.votes_for_count}</p>
                <p className="text-xs text-slate-500">{resolution.tantiemes_for.toLocaleString("fr-FR")} tant.</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase">Contre</p>
                <p className="text-xl font-bold text-red-300">{resolution.votes_against_count}</p>
                <p className="text-xs text-slate-500">{resolution.tantiemes_against.toLocaleString("fr-FR")} tant.</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase">Abstention</p>
                <p className="text-xl font-bold text-amber-300">{resolution.votes_abstain_count}</p>
                <p className="text-xs text-slate-500">{resolution.tantiemes_abstain.toLocaleString("fr-FR")} tant.</p>
              </div>
            </div>
          )}

          {/* Vote input */}
          {!isVoted && (
            <div className="space-y-3 pt-3 border-t border-white/10">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Enregistrer un vote</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={selectedUnitId} onValueChange={setSelectedUnitId} disabled={submitting}>
                  <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Sélectionner un lot" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        Lot {unit.lot_number} — {unit.owner_name} ({unit.tantieme_general} tant.)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Button
                    onClick={() => castVote("for")}
                    disabled={!selectedUnitId || submitting}
                    size="sm"
                    className="bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 border border-emerald-400/40"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <ThumbsUp className="h-4 w-4 mr-1" />
                        Pour
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => castVote("against")}
                    disabled={!selectedUnitId || submitting}
                    size="sm"
                    className="bg-red-500/20 text-red-200 hover:bg-red-500/30 border border-red-400/40"
                  >
                    <ThumbsDown className="h-4 w-4 mr-1" />
                    Contre
                  </Button>
                  <Button
                    onClick={() => castVote("abstain")}
                    disabled={!selectedUnitId || submitting}
                    size="sm"
                    className="bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 border border-amber-400/40"
                  >
                    <Minus className="h-4 w-4 mr-1" />
                    Abstention
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
