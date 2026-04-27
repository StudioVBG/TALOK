"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useChartOfAccounts, type ChartAccount } from "@/lib/hooks/use-accounting-entries";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { formatCents } from "@/lib/utils/format-cents";
import { Plus, Trash2, Check, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

// -- Types -------------------------------------------------------------------

interface EntryLine {
  id: string;
  accountNumber: string;
  label: string;
  debitCents: number;
  creditCents: number;
}

interface QuickEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId?: string;
  exerciseId?: string;
}

const JOURNAL_OPTIONS = [
  { value: "ACH", label: "ACH - Achats" },
  { value: "VE", label: "VE - Ventes" },
  { value: "BQ", label: "BQ - Banque" },
  { value: "OD", label: "OD - Operations diverses" },
] as const;

function createEmptyLine(): EntryLine {
  return {
    id: crypto.randomUUID(),
    accountNumber: "",
    label: "",
    debitCents: 0,
    creditCents: 0,
  };
}

// -- Templates --------------------------------------------------------------
// Modeles d'ecritures pre-remplis pour les scenarios immobilier courants.
// Chaque template positionne le journal + une liste de comptes attendus
// (debit / credit), l'utilisateur n'a plus qu'a saisir les montants. Les
// comptes choisis correspondent aux auto-entries de l'engine (loan_payment,
// tax_paid, payroll, etc.) — l'ecriture posee manuellement est equivalente
// a celle qu'aurait genere createAutoEntry().

interface EntryTemplate {
  id: string;
  label: string;
  journal: "ACH" | "VE" | "BQ" | "OD";
  defaultLabel: string;
  /** Tuple [accountNumber, lineLabel, side] — side indique sur quel cote
   *  la ligne attend un montant (l'autre cote reste a 0). */
  lines: Array<{
    accountNumber: string;
    label: string;
    side: "debit" | "credit";
  }>;
}

const ENTRY_TEMPLATES: EntryTemplate[] = [
  {
    id: "manual",
    label: "Saisie libre",
    journal: "BQ",
    defaultLabel: "",
    lines: [],
  },
  {
    id: "loan_payment",
    label: "Echeance credit immobilier",
    journal: "BQ",
    defaultLabel: "Echeance credit immobilier",
    lines: [
      { accountNumber: "661000", label: "Interets", side: "debit" },
      { accountNumber: "164000", label: "Capital rembourse", side: "debit" },
      { accountNumber: "512100", label: "Banque", side: "credit" },
    ],
  },
  {
    id: "tax_property",
    label: "Paiement taxe fonciere",
    journal: "BQ",
    defaultLabel: "Taxe fonciere",
    lines: [
      { accountNumber: "635100", label: "Taxe fonciere", side: "debit" },
      { accountNumber: "512100", label: "Banque", side: "credit" },
    ],
  },
  {
    id: "tax_cfe",
    label: "Paiement CFE",
    journal: "BQ",
    defaultLabel: "CFE",
    lines: [
      { accountNumber: "635400", label: "CFE", side: "debit" },
      { accountNumber: "512100", label: "Banque", side: "credit" },
    ],
  },
  {
    id: "tax_is",
    label: "Paiement IS",
    journal: "BQ",
    defaultLabel: "IS",
    lines: [
      { accountNumber: "695000", label: "IS", side: "debit" },
      { accountNumber: "512100", label: "Banque", side: "credit" },
    ],
  },
  {
    id: "social_charges_foncier",
    label: "Prelevements sociaux 17,2% (revenus fonciers IR)",
    journal: "BQ",
    defaultLabel: "Prelevements sociaux 17,2%",
    lines: [
      { accountNumber: "695100", label: "Prelevements sociaux", side: "debit" },
      { accountNumber: "512100", label: "Banque", side: "credit" },
    ],
  },
  {
    id: "payroll",
    label: "Paie gardien / employe",
    journal: "BQ",
    defaultLabel: "Paie gardien",
    lines: [
      { accountNumber: "641100", label: "Salaire brut", side: "debit" },
      { accountNumber: "645100", label: "Cotisations sociales patronales", side: "debit" },
      { accountNumber: "512100", label: "Banque", side: "credit" },
    ],
  },
  {
    id: "insurance_indemnity",
    label: "Indemnite assurance recue",
    journal: "BQ",
    defaultLabel: "Indemnite assurance",
    lines: [
      { accountNumber: "512100", label: "Banque", side: "debit" },
      { accountNumber: "758100", label: "Indemnite assurance", side: "credit" },
    ],
  },
  {
    id: "recoverable_water",
    label: "Recuperation charges — eau",
    journal: "BQ",
    defaultLabel: "Recuperation eau",
    lines: [
      { accountNumber: "512100", label: "Banque", side: "debit" },
      { accountNumber: "708100", label: "Charges recuperees eau", side: "credit" },
    ],
  },
  {
    id: "recoverable_teom",
    label: "Recuperation charges — TEOM",
    journal: "BQ",
    defaultLabel: "Recuperation TEOM",
    lines: [
      { accountNumber: "512100", label: "Banque", side: "debit" },
      { accountNumber: "708200", label: "Charges recuperees TEOM", side: "credit" },
    ],
  },
  {
    id: "supplier_invoice_works",
    label: "Facture fournisseur (travaux)",
    journal: "ACH",
    defaultLabel: "Facture travaux",
    lines: [
      { accountNumber: "615100", label: "Travaux et reparations", side: "debit" },
      { accountNumber: "401000", label: "Fournisseur", side: "credit" },
    ],
  },
];

function createLineFromTemplate(
  spec: EntryTemplate["lines"][number],
): EntryLine {
  return {
    id: crypto.randomUUID(),
    accountNumber: spec.accountNumber,
    label: spec.label,
    debitCents: 0,
    creditCents: 0,
  };
}

// -- Component ---------------------------------------------------------------

export function QuickEntryForm({
  open,
  onOpenChange,
  entityId,
  exerciseId,
}: QuickEntryFormProps) {
  const { profile } = useAuth();
  const resolvedEntityId =
    entityId ??
    (profile as { default_entity_id?: string | null } | null)?.default_entity_id ??
    "";
  const queryClient = useQueryClient();

  const { data: accounts = [] } = useChartOfAccounts(resolvedEntityId);

  // Form state
  const today = new Date().toISOString().split("T")[0];
  const [entryDate, setEntryDate] = useState(today);
  const [journalCode, setJournalCode] = useState("BQ");
  const [label, setLabel] = useState("");
  const [templateId, setTemplateId] = useState<string>("manual");
  const [lines, setLines] = useState<EntryLine[]>([
    createEmptyLine(),
    createEmptyLine(),
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyTemplate = useCallback((nextId: string) => {
    setTemplateId(nextId);
    const tpl = ENTRY_TEMPLATES.find((t) => t.id === nextId);
    if (!tpl || tpl.id === "manual" || tpl.lines.length === 0) {
      // Saisie libre : on garde au moins 2 lignes vides comme avant.
      setLines([createEmptyLine(), createEmptyLine()]);
      return;
    }
    setJournalCode(tpl.journal);
    if (tpl.defaultLabel && !label.trim()) {
      setLabel(tpl.defaultLabel);
    }
    setLines(tpl.lines.map(createLineFromTemplate));
  }, [label]);

  // -- Balance computation ---------------------------------------------------

  const totalDebit = useMemo(
    () => lines.reduce((sum: number, l: EntryLine) => sum + l.debitCents, 0),
    [lines]
  );
  const totalCredit = useMemo(
    () => lines.reduce((sum: number, l: EntryLine) => sum + l.creditCents, 0),
    [lines]
  );
  const balance = totalDebit - totalCredit;
  const isBalanced = balance === 0 && totalDebit > 0;

  // -- Line helpers ----------------------------------------------------------

  const updateLine = useCallback(
    (id: string, patch: Partial<EntryLine>) => {
      setLines((prev: EntryLine[]) =>
        prev.map((l: EntryLine) => (l.id === id ? { ...l, ...patch } : l))
      );
    },
    []
  );

  const removeLine = useCallback((id: string) => {
    setLines((prev: EntryLine[]) => (prev.length <= 2 ? prev : prev.filter((l: EntryLine) => l.id !== id)));
  }, []);

  const addLine = useCallback(() => {
    setLines((prev: EntryLine[]) => [...prev, createEmptyLine()]);
  }, []);

  const autoBalanceLastLine = useCallback(() => {
    if (lines.length < 2) return;
    const allButLast = lines.slice(0, -1);
    const sumDebit = allButLast.reduce((s: number, l: EntryLine) => s + l.debitCents, 0);
    const sumCredit = allButLast.reduce((s: number, l: EntryLine) => s + l.creditCents, 0);
    const diff = sumDebit - sumCredit;
    const lastLine = lines[lines.length - 1];
    if (diff > 0) {
      updateLine(lastLine.id, { debitCents: 0, creditCents: diff });
    } else if (diff < 0) {
      updateLine(lastLine.id, { debitCents: Math.abs(diff), creditCents: 0 });
    }
  }, [lines, updateLine]);

  // -- Account autocomplete helper -------------------------------------------

  const getAccountSuggestions = useCallback(
    (query: string) => {
      if (!query || query.length < 2) return [];
      const q = query.toLowerCase();
      return accounts
        .filter(
          (a: ChartAccount) =>
            a.account_number.startsWith(query) ||
            a.label.toLowerCase().includes(q)
        )
        .slice(0, 8);
    },
    [accounts]
  );

  // -- Submit ----------------------------------------------------------------

  const handleSubmit = async (validate: boolean) => {
    setError(null);

    if (!label.trim()) {
      setError("Le libelle est requis.");
      return;
    }

    if (!isBalanced) {
      setError("L'ecriture n'est pas equilibree.");
      return;
    }

    const hasEmptyAccounts = lines.some((l: EntryLine) => !l.accountNumber.trim());
    if (hasEmptyAccounts) {
      setError("Toutes les lignes doivent avoir un numero de compte.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        entity_id: resolvedEntityId,
        exercise_id: exerciseId ?? "",
        journal_code: journalCode,
        entry_date: entryDate,
        label: label.trim(),
        source: "manual",
        lines: lines.map((l: EntryLine) => ({
          accountNumber: l.accountNumber,
          label: l.label || undefined,
          debitCents: l.debitCents,
          creditCents: l.creditCents,
        })),
      };

      await apiClient.post("/accounting/entries", payload);

      if (validate) {
        // The entry is created as draft; for direct validation we would
        // need the returned id, but the user can validate from the list.
      }

      // Reset form
      setLabel("");
      setLines([createEmptyLine(), createEmptyLine()]);
      setEntryDate(today);
      setJournalCode("BQ");
      setTemplateId("manual");

      // Refresh list
      queryClient.invalidateQueries({ queryKey: ["accounting", "entries"] });

      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message ?? "Erreur lors de la creation de l'ecriture.");
    } finally {
      setSubmitting(false);
    }
  };

  // -- Reset on close --------------------------------------------------------

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setError(null);
    }
    onOpenChange(v);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto bg-background"
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="font-[family-name:var(--font-manrope)]">
            Nouvelle ecriture
          </SheetTitle>
          <SheetDescription>
            Saisissez les informations de l'ecriture comptable.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Modele d'ecriture — pre-remplit journal + lignes pour les
              scenarios courants (credit immo, taxe, paie, indemnite,
              recuperation charges...). "Saisie libre" reset a deux
              lignes vides comme avant. */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Modele
            </label>
            <select
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {ENTRY_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            {templateId !== "manual" && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Comptes pre-remplis. Saisissez les montants puis validez.
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Journal */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Journal
            </label>
            <select
              value={journalCode}
              onChange={(e) => setJournalCode(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {JOURNAL_OPTIONS.map((j) => (
                <option key={j.value} value={j.value}>
                  {j.label}
                </option>
              ))}
            </select>
          </div>

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Libelle
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Loyer janvier 2026"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">
                Lignes
              </label>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter une ligne
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((line, index) => (
                <EntryLineRow
                  key={line.id}
                  line={line}
                  index={index}
                  canRemove={lines.length > 2}
                  accounts={accounts}
                  getAccountSuggestions={getAccountSuggestions}
                  onUpdate={updateLine}
                  onRemove={removeLine}
                  isLast={index === lines.length - 1}
                  onAutoBalance={autoBalanceLastLine}
                />
              ))}
            </div>
          </div>

          {/* Balance indicator */}
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              isBalanced
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-red-500/10 text-red-500"
            }`}
          >
            {isBalanced ? (
              <Check className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <span>
              {isBalanced
                ? "Ecriture equilibree"
                : `Ecart : ${formatCents(Math.abs(balance))}`}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              D : {formatCents(totalDebit)} | C : {formatCents(totalCredit)}
            </span>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(false)}
              className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              {submitting ? "Enregistrement..." : "Enregistrer brouillon"}
            </button>
            <button
              type="button"
              disabled={submitting || !isBalanced}
              onClick={() => handleSubmit(true)}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Valider directement
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// -- Entry line row component ------------------------------------------------

interface EntryLineRowProps {
  line: EntryLine;
  index: number;
  canRemove: boolean;
  accounts: { account_number: string; label: string }[];
  getAccountSuggestions: (q: string) => { account_number: string; label: string }[];
  onUpdate: (id: string, patch: Partial<EntryLine>) => void;
  onRemove: (id: string) => void;
  isLast: boolean;
  onAutoBalance: () => void;
}

function EntryLineRow({
  line,
  index,
  canRemove,
  getAccountSuggestions,
  onUpdate,
  onRemove,
  isLast,
  onAutoBalance,
}: EntryLineRowProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = getAccountSuggestions(line.accountNumber);

  const handleAccountSelect = (account: { account_number: string; label: string }) => {
    onUpdate(line.id, {
      accountNumber: account.account_number,
      label: account.label,
    });
    setShowSuggestions(false);
  };

  // Parse amount input: user types euros, we store cents
  const handleAmountChange = (
    field: "debitCents" | "creditCents",
    value: string
  ) => {
    const cleaned = value.replace(/[^0-9.,]/g, "").replace(",", ".");
    const euros = parseFloat(cleaned) || 0;
    const cents = Math.round(euros * 100);

    if (field === "debitCents") {
      onUpdate(line.id, { debitCents: cents, creditCents: 0 });
    } else {
      onUpdate(line.id, { creditCents: cents, debitCents: 0 });
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Ligne {index + 1}
        </span>
        <div className="flex items-center gap-1">
          {isLast && (
            <button
              type="button"
              onClick={onAutoBalance}
              className="text-xs text-primary hover:text-primary/80 transition-colors mr-2"
            >
              Equilibrer
            </button>
          )}
          {canRemove && (
            <button
              type="button"
              onClick={() => onRemove(line.id)}
              className="p-1 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Account number with autocomplete */}
      <div className="relative">
        <input
          type="text"
          value={line.accountNumber}
          onChange={(e) => {
            onUpdate(line.id, { accountNumber: e.target.value });
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="N de compte (ex: 512000)"
          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 rounded-md border border-border bg-card shadow-lg max-h-40 overflow-y-auto">
            {suggestions.map((a) => (
              <button
                key={a.account_number}
                type="button"
                onMouseDown={() => handleAccountSelect(a)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
              >
                <span className="font-mono text-xs text-primary">
                  {a.account_number}
                </span>{" "}
                <span className="text-foreground">{a.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Account label (auto-filled) */}
      {line.label && (
        <p className="text-xs text-muted-foreground truncate pl-0.5">
          {line.label}
        </p>
      )}

      {/* Debit / Credit */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-muted-foreground mb-0.5">
            Debit
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={line.debitCents ? (line.debitCents / 100).toFixed(2) : ""}
            onChange={(e) => handleAmountChange("debitCents", e.target.value)}
            placeholder="0,00"
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 text-right"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-0.5">
            Credit
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={line.creditCents ? (line.creditCents / 100).toFixed(2) : ""}
            onChange={(e) => handleAmountChange("creditCents", e.target.value)}
            placeholder="0,00"
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 text-right"
          />
        </div>
      </div>
    </div>
  );
}

export default QuickEntryForm;
