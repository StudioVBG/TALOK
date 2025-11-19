"use client";

import Link from "next/link";
import { useTenantData } from "../_data/TenantDataProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Home, 
  FileText, 
  Wallet, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  ArrowRight,
  Phone
} from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";

export function DashboardClient() {
  const { dashboard } = useTenantData();

  if (!dashboard) {
    return (
        <div className="p-8 text-center">
            <p className="text-muted-foreground">Chargement des données impossible.</p>
        </div>
    );
  }

  const { lease, property, invoices, tickets, stats } = dashboard;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Bonjour !</h1>
        <p className="text-muted-foreground mt-1">
          Bienvenue sur votre espace locataire
        </p>
      </div>

      {/* Alerte Impayés */}
      {stats.unpaid_amount > 0 && (
        <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-900">Paiement en attente</p>
              <p className="text-sm text-red-700">
                Vous avez {stats.unpaid_count} facture(s) en attente pour un total de {formatCurrency(stats.unpaid_amount)}.
              </p>
            </div>
          </div>
          <Button size="sm" variant="destructive" asChild>
            <Link href="/app/tenant/payments">Régler maintenant</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne Gauche : Mon Logement */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="overflow-hidden border-none shadow-md bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold opacity-90 mb-1">Mon logement</h2>
                  {property ? (
                    <>
                      <p className="text-2xl font-bold mb-2">{property.adresse_complete}</p>
                      <p className="opacity-80 flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        {property.ville}, {property.code_postal}
                      </p>
                    </>
                  ) : (
                    <p className="opacity-80">Aucun logement assigné</p>
                  )}
                </div>
                {property?.cover_url && (
                  <div className="h-16 w-16 rounded-lg bg-white/20 backdrop-blur-sm overflow-hidden">
                    <img src={property.cover_url} alt="Logement" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>
              
              {lease && (
                <div className="mt-6 pt-6 border-t border-white/20 flex justify-between items-center">
                  <div>
                    <p className="text-sm opacity-70">Loyer actuel</p>
                    <p className="text-xl font-bold">
                      {formatCurrency((lease.loyer || 0) + (lease.charges_forfaitaires || 0))}
                      <span className="text-sm font-normal opacity-70 ml-1">/ mois</span>
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" className="bg-white text-blue-700 hover:bg-blue-50" asChild>
                    <Link href="/app/tenant/lease">Voir mon bail</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dernières factures */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Dernières factures</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/app/tenant/payments">Tout voir</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {invoices.length > 0 ? (
                <div className="space-y-4">
                  {invoices.map((invoice: any) => (
                    <div key={invoice.id} className="flex items-center justify-between border-b last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className={invoice.statut === 'paid' ? 'p-2 bg-green-100 rounded text-green-700' : 'p-2 bg-slate-100 rounded text-slate-700'}>
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">Loyer {invoice.periode}</p>
                          <p className="text-xs text-muted-foreground">
                            {invoice.statut === 'paid' ? 'Payé' : 'À régler'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(invoice.montant_total)}</p>
                        {invoice.statut === 'paid' ? (
                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Payé</Badge>
                        ) : (
                          <Badge variant="destructive">Impayé</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-4 text-muted-foreground">Aucune facture récente</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Colonne Droite : Actions & Tickets */}
        <div className="space-y-6">
          {/* Propriétaire / Contact */}
          <Card>
            <CardHeader>
              <CardTitle>Mon gestionnaire</CardTitle>
            </CardHeader>
            <CardContent>
              {property?.owner_name ? (
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                    {property.owner_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">{property.owner_name}</p>
                    <p className="text-xs text-muted-foreground">Propriétaire</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-4">Information non disponible</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/app/tenant/requests/new">
                    <Clock className="mr-2 h-3 w-3" />
                    Intervention
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full">
                  <Phone className="mr-2 h-3 w-3" />
                  Contact
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Demandes en cours */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Mes demandes</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/app/tenant/requests">Voir</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {tickets.length > 0 ? (
                <div className="space-y-3">
                  {tickets.map((ticket: any) => (
                    <div key={ticket.id} className="p-3 border rounded-lg bg-slate-50">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-medium text-sm">{ticket.titre}</p>
                        <Badge variant={ticket.statut === 'open' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                          {ticket.statut}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{ticket.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <CheckCircle className="h-10 w-10 mx-auto text-slate-200 mb-2" />
                  <p className="text-sm text-muted-foreground">Aucune demande en cours</p>
                  <Button variant="link" className="text-blue-600 p-0 h-auto mt-2" asChild>
                    <Link href="/app/tenant/requests/new">Faire une demande</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

