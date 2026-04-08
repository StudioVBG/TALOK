"use client";

import Link from "next/link";
import { FileText, Building2 } from "lucide-react";

export function AccountingEmptyState() {
  return (
    <div className="bg-card rounded-xl border border-border flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* Illustration placeholder */}
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <FileText className="w-10 h-10 text-primary" />
      </div>

      <h2 className="text-xl font-bold text-foreground mb-2">
        Bienvenue dans votre comptabilite
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mb-8">
        Commencez par scanner un justificatif ou connectez votre banque pour
        importer automatiquement vos transactions.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/owner/documents/upload"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
        >
          <FileText className="w-4 h-4" />
          Scanner un justificatif
        </Link>
        <Link
          href="/owner/money/settings"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-card border border-border text-foreground font-medium text-sm hover:bg-muted transition-colors"
        >
          <Building2 className="w-4 h-4" />
          Connecter ma banque
        </Link>
      </div>
    </div>
  );
}

export default AccountingEmptyState;
