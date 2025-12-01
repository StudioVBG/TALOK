// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { fetchTenantLease } from "../_data/fetchTenantLease";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, ClipboardList } from "lucide-react";

export default async function TenantColocationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return null;

  const lease = await fetchTenantLease(user.id);
  const roommates =
    lease?.lease_signers?.filter(
      (signer: any) =>
        signer.profiles?.id !== profile.id && ["locataire_principal", "colocataire"].includes(signer.role)
    ) ?? [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Colocation</h1>
        <p className="text-muted-foreground">Vos colocataires et leurs statuts de signature.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Mes colocataires
          </CardTitle>
          <CardDescription>Personnes ajoutées comme signataires sur ce bail.</CardDescription>
        </CardHeader>
        <CardContent>
          {roommates.length > 0 ? (
            <div className="space-y-3">
              {roommates.map((roommate: any) => (
                <div key={roommate.id} className="flex items-center gap-4 rounded-lg border p-3">
                  <Avatar>
                    <AvatarImage src={roommate.profiles?.avatar_url || undefined} />
                    <AvatarFallback>
                      {roommate.profiles?.prenom?.[0]}
                      {roommate.profiles?.nom?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">
                      {roommate.profiles?.prenom} {roommate.profiles?.nom}
                    </p>
                    <p className="text-sm text-muted-foreground">{roommate.profiles?.email}</p>
                  </div>
                  <div className="text-sm text-muted-foreground capitalize">{roommate.role}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">Vous n’avez pas de colocataire enregistré.</p>
              <p className="text-sm text-muted-foreground">Le bail répertorie uniquement votre profil.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Organisation commune
          </CardTitle>
          <CardDescription>
            Les fonctionnalités de partage des tâches et des dépenses arriveront très bientôt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Vous pourrez bientôt répartir automatiquement les loyers, charges et tâches ménagères depuis cette page.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

