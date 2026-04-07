"use client";

import { formatCents } from "@/lib/utils/format-cents";

interface EntryLine {
  account: string;
  label: string;
  debitCents: number;
  creditCents: number;
}

interface ProposedEntryProps {
  lines: EntryLine[];
}

export function ProposedEntry({ lines }: ProposedEntryProps) {
  const totalDebit = lines.reduce((s, l) => s + l.debitCents, 0);
  const totalCredit = lines.reduce((s, l) => s + l.creditCents, 0);
  const isBalanced = totalDebit === totalCredit;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">
        Ecriture proposee
      </h4>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Compte
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Libelle
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                Debit
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                Credit
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{line.account}</td>
                <td className="px-3 py-2">{line.label}</td>
                <td className="px-3 py-2 text-right">
                  {line.debitCents > 0 ? formatCents(line.debitCents) : ""}
                </td>
                <td className="px-3 py-2 text-right">
                  {line.creditCents > 0 ? formatCents(line.creditCents) : ""}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 font-semibold">
              <td colSpan={2} className="px-3 py-2">
                Total
                {!isBalanced && (
                  <span className="ml-2 text-xs text-red-400 font-normal">
                    Desequilibre
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right">{formatCents(totalDebit)}</td>
              <td className="px-3 py-2 text-right">{formatCents(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
