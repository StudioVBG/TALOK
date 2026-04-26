"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { apiClient, ResourceNotFoundError } from "@/lib/api-client";
import { formatCents } from "@/lib/utils/format-cents";
import { cn } from "@/lib/utils";
import { PlanGate } from "@/components/subscription/plan-gate";

interface EntryLine {
  id: string;
  account_number: string;
  label: string | null;
  debit_cents: number;
  credit_cents: number;
  lettrage: string | null;
  piece_ref: string | null;
}

interface EntryDetail {
  id: string;
  entity_id: string | null;
  exercise_id: string | null;
  journal_code: string;
  entry_number: string | null;
  entry_date: string | null;
  label: string | null;
  source: string | null;
  reference: string | null;
  is_validated: boolean;
  is_locked: boolean;
  reversal_of: string | null;
  informational?: boolean;
  created_at: string;
  updated_at: string;
  // Legacy flat-entry fields
  ecriture_num?: string | null;
  ecriture_date?: string | null;
  ecriture_lib?: string | null;
  compte_num?: string | null;
  compte_lib?: string | null;
  debit?: number | null;
  credit?: number | null;
  piece_ref?: string | null;
  valid_date?: string | null;
  // Joins
  lines?: EntryLine[] | null;
  invoice?: { id: string; periode: string | null; montant_total: number | null; statut: string | null } | null;
  payment?: { id: string; montant: number | null; statut: string | null; date_paiement: string | null } | null;
}

interface EntryDetailResponse {
  success: boolean;
  data: EntryDetail;
}

const SOURCE_BADGE_STYLES: Record<string, string> = {
  manual: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  stripe: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  ocr: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  import: "bg-teal-500/10 text-teal-400 border-teal-500/20",
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manuel",
  stripe: "Stripe",
  ocr: "OCR",
  import: "Import",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SourceBadge({ source }: { source: string | null }) {
  const key = source ?? "manual";
  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border",
        SOURCE_BADGE_STYLES[key] ?? SOURCE_BADGE_STYLES.manual,
      )}
    >
      {SOURCE_LABELS[key] ?? key}
    </span>
  );
}

function StatusBadge({ entry }: { entry: EntryDetail }) {
  const isValidated = entry.is_validated || !!entry.valid_date;
  const isReversed = !!entry.reversal_of;

  if (isReversed) {
    return (
      <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border bg-red-500/10 text-red-500 border-red-500/20">
        Contre-passée
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border",
        isValidated
          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
          : "bg-amber-500/10 text-amber-500 border-amber-500/20",
      )}
    >
      {isValidated ? "Validée" : "Brouillon"}
    </span>
  );
}

function deriveLines(entry: EntryDetail): EntryLine[] {
  if (entry.lines && entry.lines.length > 0) return entry.lines;

  // Legacy flat-entry fallback: synthesize a single line from compte_num/debit/credit
  if (entry.compte_num && (entry.debit || entry.credit)) {
    return [
      {
        id: entry.id,
        account_number: entry.compte_num,
        label: entry.compte_lib ?? entry.ecriture_lib ?? null,
        debit_cents: Math.round((entry.debit ?? 0) * 100),
        credit_cents: Math.round((entry.credit ?? 0) * 100),
        lettrage: null,
        piece_ref: entry.piece_ref ?? null,
      },
    ];
  }
  return [];
}

export default function EntryDetailClient({ entryId }: { entryId: string }) {
  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <EntryDetailContent entryId={entryId} />
    </PlanGate>
  );
}

function EntryDetailContent({ entryId }: { entryId: string }) {
  const { data, isLoading, error } = useQuery<EntryDetailResponse>({
    queryKey: ["accounting", "entry", entryId],
    queryFn: () => apiClient.get<EntryDetailResponse>(`/accounting/entries/${entryId}`),
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Chargement de l'écriture…</span>
      </div>
    );
  }

  if (error || !data?.data) {
    const notFound = error instanceof ResourceNotFoundError;
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <BackLink />
        <div className="mt-6 bg-card rounded-xl border border-border p-8 text-center space-y-3">
          <p className="text-sm font-medium text-foreground">
            {notFound ? "Écriture introuvable" : "Erreur lors du chargement"}
          </p>
          <p className="text-sm text-muted-foreground">
            {notFound
              ? "Cette écriture n'existe plus ou ne fait pas partie de vos entités."
              : "Veuillez réessayer dans quelques instants."}
          </p>
        </div>
      </div>
    );
  }

  const entry = data.data;
  const entryNumber = entry.entry_number ?? entry.ecriture_num ?? "-";
  const entryDate = entry.entry_date ?? entry.ecriture_date ?? null;
  const entryLabel = entry.label ?? entry.ecriture_lib ?? "-";
  const lines = deriveLines(entry);
  const totalDebit = lines.reduce((s, l) => s + (l.debit_cents ?? 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit_cents ?? 0), 0);
  const balanced = totalDebit === totalCredit;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <BackLink />

      {/* Header */}
      <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-xs text-muted-foreground font-mono">
              {entry.journal_code} · {entryNumber}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)] break-words">
              {entryLabel}
            </h1>
            <p className="text-sm text-muted-foreground">{formatDate(entryDate)}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge entry={entry} />
            <SourceBadge source={entry.source} />
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-border">
          <Field label="Référence" value={entry.reference ?? entry.piece_ref ?? "-"} />
          <Field label="Journal" value={entry.journal_code} mono />
          <Field label="Créée le" value={formatDateTime(entry.created_at)} />
          <Field label="Modifiée le" value={formatDateTime(entry.updated_at)} />
        </dl>
      </div>

      {/* Lines */}
      <section className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 sm:px-6 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Lignes ({lines.length})
          </h2>
          {!balanced && lines.length > 0 && (
            <span className="text-xs font-medium text-red-500">
              Écriture déséquilibrée
            </span>
          )}
        </div>

        {lines.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Aucune ligne associée à cette écriture.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium">Compte</th>
                    <th className="text-left px-4 py-2.5 font-medium">Libellé</th>
                    <th className="text-left px-4 py-2.5 font-medium">Lettrage</th>
                    <th className="text-right px-4 py-2.5 font-medium">Débit</th>
                    <th className="text-right px-4 py-2.5 font-medium">Crédit</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr
                      key={line.id}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-foreground whitespace-nowrap">
                        {line.account_number}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {line.label ?? "-"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {line.lettrage ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">
                        {line.debit_cents > 0 ? formatCents(line.debit_cents) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">
                        {line.credit_cents > 0 ? formatCents(line.credit_cents) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-medium">
                    <td colSpan={3} className="px-4 py-2.5 text-right text-muted-foreground">
                      Totaux
                    </td>
                    <td className="px-4 py-2.5 text-right text-foreground whitespace-nowrap">
                      {formatCents(totalDebit)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-foreground whitespace-nowrap">
                      {formatCents(totalCredit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {lines.map((line) => (
                <div key={line.id} className="px-4 py-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">
                        {line.account_number}
                      </p>
                      <p className="text-sm text-foreground truncate">
                        {line.label ?? "-"}
                      </p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      {line.debit_cents > 0 && (
                        <p className="text-sm font-medium text-foreground">
                          D · {formatCents(line.debit_cents)}
                        </p>
                      )}
                      {line.credit_cents > 0 && (
                        <p className="text-sm font-medium text-foreground">
                          C · {formatCents(line.credit_cents)}
                        </p>
                      )}
                    </div>
                  </div>
                  {line.lettrage && (
                    <p className="text-xs text-muted-foreground font-mono">
                      Lettrage : {line.lettrage}
                    </p>
                  )}
                </div>
              ))}
              <div className="px-4 py-3 bg-muted/30 flex items-center justify-between text-sm font-medium">
                <span className="text-muted-foreground">Totaux</span>
                <span className="text-foreground">
                  D {formatCents(totalDebit)} · C {formatCents(totalCredit)}
                </span>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Linked documents */}
      {(entry.invoice || entry.payment) && (
        <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Pièces liées
          </h2>
          <ul className="space-y-2 text-sm">
            {entry.invoice && (
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Facture {entry.invoice.periode ?? ""}
                </span>
                <span className="text-foreground">
                  {entry.invoice.montant_total != null
                    ? formatCents(Math.round(entry.invoice.montant_total * 100))
                    : "-"}{" "}
                  · {entry.invoice.statut ?? "-"}
                </span>
              </li>
            )}
            {entry.payment && (
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Paiement {formatDate(entry.payment.date_paiement)}
                </span>
                <span className="text-foreground">
                  {entry.payment.montant != null
                    ? formatCents(Math.round(entry.payment.montant * 100))
                    : "-"}{" "}
                  · {entry.payment.statut ?? "-"}
                </span>
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/owner/accounting/entries"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Retour aux écritures
    </Link>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "text-sm text-foreground break-words",
          mono && "font-mono",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
