"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CreditCard, ExternalLink, Users, CheckCircle, AlertCircle } from "lucide-react";

export default function AdminStripePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "stripe"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stripe");
      if (!res.ok) throw new Error("Erreur de chargement");
      return res.json();
    },
  });

  const accounts = data?.accounts || [];
  const stats = data?.stats || { total_connect_accounts: 0, total_stripe_customers: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stripe Connect</h1>
        <p className="text-muted-foreground">Comptes Connect des proprietaires pour les reversements de loyers</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comptes Connect</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{stats.total_connect_accounts}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients Stripe</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{stats.total_stripe_customers}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dernier compte</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-sm text-muted-foreground">
                {accounts.length > 0
                  ? new Date(accounts[0].created_at).toLocaleDateString("fr-FR")
                  : "Aucun"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Comptes Connect</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Aucun compte Connect enregistre</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proprietaire</TableHead>
                  <TableHead>Account ID</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date creation</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account: any) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      {account.owner_name || account.owner_id || "—"}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {account.stripe_account_id || account.id}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.charges_enabled || account.status === "active" ? "default" : "secondary"}>
                        {account.charges_enabled || account.status === "active" ? "Actif" : "En cours"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(account.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-right">
                      {(account.stripe_account_id || account.id?.startsWith("acct_")) && (
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={`https://dashboard.stripe.com/connect/accounts/${account.stripe_account_id || account.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Dashboard
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
