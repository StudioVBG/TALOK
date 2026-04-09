"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Mail,
  Phone,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Sparkles,
} from "lucide-react";
import type { Application } from "@/lib/types/candidatures";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from "@/lib/types/candidatures";
import { CompletenessBar } from "./CompletenessBar";
import { ScoreBadge } from "./ScoreBadge";

interface ApplicationCardProps {
  application: Application;
  listingId: string;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onScore?: (id: string) => void;
  selected?: boolean;
  onSelect?: (id: string) => void;
  acceptLoading?: boolean;
  rejectLoading?: boolean;
  scoreLoading?: boolean;
}

export function ApplicationCard({
  application,
  listingId,
  onAccept,
  onReject,
  onScore,
  selected,
  onSelect,
  acceptLoading,
  rejectLoading,
  scoreLoading,
}: ApplicationCardProps) {
  const isActionable = !["accepted", "rejected", "withdrawn"].includes(application.status);

  return (
    <Card
      className={`transition-all ${
        selected ? "ring-2 ring-primary shadow-md" : "hover:shadow-sm"
      }`}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header: nom + statut */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {onSelect && (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onSelect(application.id)}
                className="h-4 w-4 rounded border-gray-300 text-primary"
              />
            )}
            <div className="min-w-0">
              <Link
                href={`/owner/listings/${listingId}/applications/${application.id}`}
                className="font-semibold text-foreground hover:text-primary transition-colors block truncate"
              >
                {application.applicant_name}
              </Link>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {application.applicant_email}
                </span>
                {application.applicant_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {application.applicant_phone}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Badge className={APPLICATION_STATUS_COLORS[application.status]}>
            {APPLICATION_STATUS_LABELS[application.status]}
          </Badge>
        </div>

        {/* Complétude + Score IA */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <CompletenessBar score={application.completeness_score} />
          </div>
          {application.ai_score !== null && (
            <ScoreBadge score={application.ai_score} />
          )}
        </div>

        {/* Documents + date */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {application.documents.length} document{application.documents.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {new Date(application.created_at).toLocaleDateString("fr-FR")}
            </span>
          </div>
        </div>

        {/* Message preview */}
        {application.message && (
          <p className="text-sm text-muted-foreground line-clamp-2 italic border-l-2 border-muted pl-3">
            {application.message}
          </p>
        )}

        {/* Actions */}
        {isActionable && (
          <div className="flex items-center gap-2 pt-1 border-t">
            <Button
              size="sm"
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => onAccept?.(application.id)}
              disabled={acceptLoading}
            >
              <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
              Accepter
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => onReject?.(application.id)}
              disabled={rejectLoading}
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
              Refuser
            </Button>
            {application.ai_score === null && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onScore?.(application.id)}
                disabled={scoreLoading}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Scorer
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
