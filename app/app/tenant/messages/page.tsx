// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { fetchTenantTickets } from "../_data/fetchTenantTickets";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Home, ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { formatDateShort } from "@/lib/helpers/format";

export default async function TenantMessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const tickets = await fetchTenantTickets(user.id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Messages & échanges</h1>
          <p className="text-muted-foreground">
            Retrouvez vos conversations avec le propriétaire à partir de vos demandes.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/tenant/requests/new">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau message
          </Link>
        </Button>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <h2 className="text-xl font-semibold">Aucune conversation</h2>
            <p className="text-muted-foreground">
              Créez une demande pour démarrer un échange avec votre propriétaire.
            </p>
            <Button asChild className="mt-2">
              <Link href="/app/tenant/requests/new">Créer ma première demande</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle className="text-lg">{ticket.titre}</CardTitle>
                  <Badge variant={ticket.statut === "open" ? "default" : "secondary"} className="capitalize">
                    {ticket.statut}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {ticket.priorite}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MessageSquare className="h-4 w-4" />
                  dernière mise à jour le {formatDateShort(ticket.updated_at || ticket.created_at)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-700">{ticket.description}</p>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    {ticket.property?.adresse_complete || "Bien non renseigné"}
                  </div>
                  <Button variant="ghost" size="sm" asChild className="gap-2">
                    <Link href="/app/tenant/requests">
                      Voir la demande
                      <ArrowRight className="h-4 w-4" />
                    </Link>
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
