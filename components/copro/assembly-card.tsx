// =====================================================
// Composant: Carte Assemblée Générale
// =====================================================

"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Calendar, MapPin, Video, Users, 
  Vote, Clock, CheckCircle2, AlertCircle,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { AssemblySummary } from "@/lib/types/copro-assemblies";
import { 
  ASSEMBLY_TYPE_LABELS, 
  ASSEMBLY_STATUS_LABELS,
  ASSEMBLY_STATUS_COLORS 
} from "@/lib/types/copro-assemblies";

interface AssemblyCardProps {
  assembly: AssemblySummary;
  compact?: boolean;
}

export function AssemblyCard({ assembly, compact = false }: AssemblyCardProps) {
  const scheduledDate = new Date(assembly.scheduled_at);
  const isUpcoming = scheduledDate > new Date();
  const isPast = assembly.status === 'closed';
  const isInProgress = assembly.status === 'in_progress';

  const quorumPercentage = assembly.total_tantiemes > 0
    ? ((assembly.present_tantiemes + assembly.represented_tantiemes) / assembly.total_tantiemes) * 100
    : 0;

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (compact) {
    return (
      <Link href={`/syndic/assemblies/${assembly.id}`}>
        <motion.div
          whileHover={{ x: 4 }}
          className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              isUpcoming && "bg-blue-500/20",
              isInProgress && "bg-yellow-500/20",
              isPast && "bg-green-500/20"
            )}>
              <Calendar className={cn(
                "w-4 h-4",
                isUpcoming && "text-blue-400",
                isInProgress && "text-yellow-400",
                isPast && "text-green-400"
              )} />
            </div>
            <div>
              <p className="text-white font-medium text-sm">{assembly.label}</p>
              <p className="text-xs text-slate-400">{formatDate(scheduledDate)}</p>
            </div>
          </div>
          <Badge className={ASSEMBLY_STATUS_COLORS[assembly.status]}>
            {ASSEMBLY_STATUS_LABELS[assembly.status]}
          </Badge>
        </motion.div>
      </Link>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="border-white/10 bg-white/5 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-cyan-400 border-cyan-500/50">
                  {assembly.assembly_number}
                </Badge>
                <Badge className={ASSEMBLY_STATUS_COLORS[assembly.status]}>
                  {ASSEMBLY_STATUS_LABELS[assembly.status]}
                </Badge>
              </div>
              <h3 className="text-lg font-semibold text-white">{assembly.label}</h3>
              <p className="text-sm text-slate-400">{assembly.site_name}</p>
            </div>
            <Badge variant="outline" className="text-slate-400">
              {ASSEMBLY_TYPE_LABELS[assembly.assembly_type]}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Date et lieu */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-slate-300">
              <Calendar className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-sm">{formatDate(scheduledDate)}</p>
                <p className="text-xs text-slate-400">{formatTime(scheduledDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              {assembly.location_type === 'video' ? (
                <Video className="w-4 h-4 text-slate-400" />
              ) : (
                <MapPin className="w-4 h-4 text-slate-400" />
              )}
              <div>
                <p className="text-sm">
                  {assembly.location_type === 'video' ? 'Visioconférence' : assembly.location_address || 'À définir'}
                </p>
                {assembly.location_room && (
                  <p className="text-xs text-slate-400">{assembly.location_room}</p>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 p-3 rounded-lg bg-slate-800/50">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                <Users className="w-3.5 h-3.5" />
              </div>
              <p className="text-lg font-semibold text-white">
                {assembly.present_count + assembly.represented_count}
              </p>
              <p className="text-xs text-slate-400">Présents/Représentés</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                <Vote className="w-3.5 h-3.5" />
              </div>
              <p className="text-lg font-semibold text-white">{assembly.motions_count}</p>
              <p className="text-xs text-slate-400">Résolutions</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <p className="text-lg font-semibold text-emerald-400">{assembly.motions_adopted}</p>
              <p className="text-xs text-slate-400">Adoptées</p>
            </div>
          </div>

          {/* Quorum */}
          {(isInProgress || isPast) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Quorum</span>
                <span className={cn(
                  "font-medium",
                  assembly.quorum_reached ? "text-emerald-400" : "text-orange-400"
                )}>
                  {quorumPercentage.toFixed(1)}% / {assembly.quorum_required}%
                </span>
              </div>
              <Progress 
                value={quorumPercentage} 
                className="h-2 bg-slate-700"
              />
              <div className="flex items-center gap-1 text-xs">
                {assembly.quorum_reached ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Quorum atteint</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 text-orange-400" />
                    <span className="text-orange-400">Quorum non atteint</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* CTA */}
          <Link href={`/syndic/assemblies/${assembly.id}`}>
            <Button 
              variant="ghost" 
              className="w-full text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
            >
              {isUpcoming ? 'Préparer l\'AG' : isPast ? 'Voir le PV' : 'Accéder à l\'AG'}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default AssemblyCard;

