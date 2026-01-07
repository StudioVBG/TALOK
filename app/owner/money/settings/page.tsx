// @ts-nocheck
import { Metadata } from "next";
import { ConnectedAccountsList } from "@/features/finance/components/connected-accounts-list";
import { BankConnectButton } from "@/features/finance/components/bank-connect-button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Connexions Bancaires | Talok",
  description: "Gérez vos connexions bancaires pour l'automatisation des paiements",
};

export default function BankSettingsPage() {
  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/owner/money">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Connexions Bancaires</h1>
          <p className="text-muted-foreground">
            Connectez vos comptes pour automatiser le suivi des paiements.
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <ConnectedAccountsList />
        
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-200">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            ℹ️ Comment ça marche ?
          </h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Nous nous connectons à votre banque en <strong>lecture seule</strong> via GoCardless.</li>
            <li>Nous récupérons uniquement l'historique des transactions.</li>
            <li>Notre algorithme détecte automatiquement les virements correspondant à vos loyers.</li>
            <li>Vos factures sont marquées comme "Payées" automatiquement.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

