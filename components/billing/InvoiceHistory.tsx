"use client";

import { useState } from "react";
import { Receipt, Download, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { useInvoices } from "@/hooks/useInvoices";
import { formatPrice, formatDateShort, formatDateLong } from "@/lib/billing-utils";
import type { SubscriptionStatus } from "@/types/billing";

interface InvoiceHistoryProps {
  subscriptionStatus: SubscriptionStatus;
  trialEnd?: string | null;
}

export function InvoiceHistory({ subscriptionStatus, trialEnd }: InvoiceHistoryProps) {
  const [cursor, setCursor] = useState<string | null>(null);
  const { data, isLoading } = useInvoices(cursor);

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-white">
          <Receipt className="w-5 h-5 text-violet-400" aria-hidden="true" />
          Historique des factures
        </CardTitle>
        <CardDescription className="text-slate-300">
          Telechargez vos factures pour votre comptabilite (CGI Art. 289)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full bg-slate-700/50" />
            ))}
          </div>
        ) : !data || data.invoices.length === 0 ? (
          <EmptyInvoices status={subscriptionStatus} trialEnd={trialEnd} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-400">Numero</TableHead>
                  <TableHead className="text-slate-400">Periode</TableHead>
                  <TableHead className="text-slate-400">Montant TTC</TableHead>
                  <TableHead className="text-slate-400">Statut</TableHead>
                  <TableHead className="text-right text-slate-400">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.invoices.map((invoice) => (
                  <TableRow key={invoice.id} className="border-slate-700/50 hover:bg-slate-800/50">
                    <TableCell className="text-slate-300 font-medium">
                      {invoice.number}
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {formatDateShort(invoice.period_start)} — {formatDateShort(invoice.period_end)}
                    </TableCell>
                    <TableCell className="text-white font-medium">
                      {formatPrice(invoice.amount_ttc)}
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {invoice.pdf_url && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" asChild>
                                <a
                                  href={invoice.pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Telecharger facture ${invoice.number} au format PDF`}
                                >
                                  <Download className="w-4 h-4" aria-hidden="true" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Telecharger le PDF</TooltipContent>
                          </Tooltip>
                        )}
                        {invoice.hosted_url && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" asChild>
                                <a
                                  href={invoice.hosted_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Voir facture ${invoice.number} en ligne`}
                                >
                                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Voir en ligne</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-700 text-slate-400"
                onClick={() => setCursor(null)}
                disabled={!cursor}
              >
                <ChevronLeft className="w-4 h-4 mr-1" aria-hidden="true" />
                Precedent
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-700 text-slate-400"
                onClick={() => {
                  if (data.has_more && data.next_cursor) {
                    setCursor(data.next_cursor);
                  }
                }}
                disabled={!data.has_more}
              >
                Suivant
                <ChevronRight className="w-4 h-4 ml-1" aria-hidden="true" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyInvoices({
  status,
  trialEnd,
}: {
  status: SubscriptionStatus;
  trialEnd?: string | null;
}) {
  const isTrial = status === "trialing";

  return (
    <div className="text-center py-6">
      <Receipt className="w-8 h-8 mx-auto mb-3 text-slate-500" aria-hidden="true" />
      <p className="text-slate-300 mb-1">Aucune facture pour l&apos;instant</p>
      <p className="text-sm text-slate-400">
        {isTrial && trialEnd
          ? `Votre premiere facture sera generee a la fin de votre essai gratuit le ${formatDateLong(trialEnd)}.`
          : "Aucune facture trouvee. Contactez le support si c'est inattendu."}
      </p>
      {!isTrial && (
        <Button variant="outline" size="sm" className="mt-3 border-slate-700 text-slate-300" asChild>
          <a href="mailto:support@talok.fr">Contacter le support</a>
        </Button>
      )}
    </div>
  );
}
