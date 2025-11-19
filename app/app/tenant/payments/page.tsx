import { createClient } from "@/lib/supabase/server";
import { fetchTenantInvoices } from "../_data/fetchTenantInvoices";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { Download } from "lucide-react";

export default async function TenantPaymentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const invoices = await fetchTenantInvoices(user.id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Paiements</h1>
        <p className="text-muted-foreground">Historique de vos loyers et factures</p>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Aucune facture disponible.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {invoices.map((invoice: any) => (
            <Card key={invoice.id}>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold text-lg">Loyer {invoice.periode}</span>
                    <Badge 
                      variant={invoice.statut === "paid" ? "outline" : "destructive"}
                      className={invoice.statut === "paid" ? "text-green-600 border-green-200 bg-green-50" : ""}
                    >
                      {invoice.statut === "paid" ? "Payé" : "À régler"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Date d'émission : {formatDateShort(invoice.created_at)}
                  </p>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="font-bold text-lg">{formatCurrency(invoice.montant_total)}</p>
                    {invoice.montant_charges > 0 && (
                      <p className="text-xs text-muted-foreground">dont {formatCurrency(invoice.montant_charges)} charges</p>
                    )}
                  </div>
                  
                  <Button variant="ghost" size="icon">
                    <Download className="h-5 w-5 text-slate-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
