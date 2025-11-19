import { createClient } from "@/lib/supabase/server";
import { fetchTenantTickets } from "../_data/fetchTenantTickets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateShort } from "@/lib/helpers/format";
import { Plus, MessageSquare } from "lucide-react";
import Link from "next/link";

export default async function TenantRequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const tickets = await fetchTenantTickets(user.id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Mes demandes</h1>
          <p className="text-muted-foreground">Suivi de vos incidents et requêtes</p>
        </div>
        <Button asChild>
          <Link href="/app/tenant/requests/new">
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle demande
          </Link>
        </Button>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium mb-2">Aucune demande en cours</h3>
            <p className="text-muted-foreground mb-6">Vous n'avez pas encore créé de demande d'intervention ou de signalement.</p>
            <Button asChild>
              <Link href="/app/tenant/requests/new">Créer ma première demande</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket: any) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{ticket.titre}</h3>
                      <Badge variant={ticket.statut === "open" ? "default" : "secondary"}>
                        {ticket.statut}
                      </Badge>
                      <Badge variant="outline">{ticket.priorite}</Badge>
                    </div>
                    <p className="text-slate-600 mb-3">{ticket.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Créé le {formatDateShort(ticket.created_at)}
                    </p>
                  </div>
                  
                  {/* Placeholder pour actions futures (ex: voir détails) */}
                  {/* <Button variant="ghost" size="sm">Détails</Button> */}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
