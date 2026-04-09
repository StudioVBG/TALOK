"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, FileText, Calendar, CheckCircle } from "lucide-react";
import type { Application } from "@/lib/types/candidatures";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from "@/lib/types/candidatures";
import { CompletenessBar } from "./CompletenessBar";
import { ScoreBadge } from "./ScoreBadge";

interface Ranking {
  application_id: string;
  applicant_name: string;
  total_score: number;
  rank: number;
}

interface ComparisonTableProps {
  applications: Application[];
  ranking: Ranking[];
  onSelectWinner?: (id: string) => void;
}

export function ComparisonTable({
  applications,
  ranking,
  onSelectWinner,
}: ComparisonTableProps) {
  // Merger applications avec ranking
  const rows = ranking.map((r) => {
    const app = applications.find((a) => a.id === r.application_id);
    return { ...r, application: app };
  });

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-12">#</TableHead>
            <TableHead>Candidat</TableHead>
            <TableHead>Complétude</TableHead>
            <TableHead>Score IA</TableHead>
            <TableHead>Score total</TableHead>
            <TableHead>Documents</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Statut</TableHead>
            {onSelectWinner && <TableHead className="text-right">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.application_id}
              className={row.rank === 1 ? "bg-emerald-50/50 dark:bg-emerald-900/10" : ""}
            >
              <TableCell>
                <div className="flex items-center gap-1">
                  {row.rank === 1 && <Trophy className="h-4 w-4 text-amber-500" />}
                  <span className="font-semibold">{row.rank}</span>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <span className="font-medium">{row.applicant_name}</span>
                  {row.application?.applicant_email && (
                    <span className="block text-xs text-muted-foreground">
                      {row.application.applicant_email}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="w-32">
                  <CompletenessBar score={row.application?.completeness_score || 0} />
                </div>
              </TableCell>
              <TableCell>
                {row.application?.ai_score !== null && row.application?.ai_score !== undefined ? (
                  <ScoreBadge score={row.application.ai_score} />
                ) : (
                  <span className="text-xs text-muted-foreground">N/A</span>
                )}
              </TableCell>
              <TableCell>
                <span className="font-bold text-lg">{row.total_score}</span>
                <span className="text-xs text-muted-foreground">/100</span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  {row.application?.documents.length || 0}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {row.application ? new Date(row.application.created_at).toLocaleDateString("fr-FR") : "-"}
                </div>
              </TableCell>
              <TableCell>
                {row.application && (
                  <Badge className={APPLICATION_STATUS_COLORS[row.application.status]}>
                    {APPLICATION_STATUS_LABELS[row.application.status]}
                  </Badge>
                )}
              </TableCell>
              {onSelectWinner && (
                <TableCell className="text-right">
                  {row.application && !["accepted", "rejected", "withdrawn"].includes(row.application.status) && (
                    <button
                      onClick={() => onSelectWinner(row.application_id)}
                      className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Retenir
                    </button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
