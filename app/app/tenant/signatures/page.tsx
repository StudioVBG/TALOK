// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { fetchTenantLease } from "../_data/fetchTenantLease";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileSignature, Clock, CheckCircle2 } from "lucide-react";
import { formatDateShort } from "@/lib/helpers/format";

export default async function TenantSignaturesPage() {
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

  if (!profile) {
    return null;
  }

  const lease = await fetchTenantLease(user.id);
  const signers = lease?.lease_signers ?? [];
  const mySignature = signers.find((signer: any) => signer.profiles?.id === profile?.id);
  const pendingSignatures = signers.filter((signer: any) => signer.signature_status !== "signed");
  const signedSignatures = signers.filter((signer: any) => signer.signature_status === "signed");

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Signatures</h1>
        <p className="text-muted-foreground">
          Suivez l’état de signature de votre bail et des documents associés.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Votre signature
          </CardTitle>
          <CardDescription>
            Statut actuel de vos signatures électroniques
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mySignature ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Bail de location</p>
                <p className="text-sm text-muted-foreground">
                  {mySignature.signature_status === "signed"
                    ? `Signé le ${mySignature.signed_at ? formatDateShort(mySignature.signed_at) : ""}`
                    : "En attente de votre signature"}
                </p>
              </div>
              <Badge variant={mySignature.signature_status === "signed" ? "default" : "secondary"}>
                {mySignature.signature_status === "signed" ? "Signé" : "En attente"}
              </Badge>
            </div>
          ) : (
            <p className="text-muted-foreground">Aucun document ne nécessite votre signature.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Signataires en attente
          </CardTitle>
          <CardDescription>
            Les personnes qui doivent encore signer le bail
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingSignatures.length > 0 ? (
            <div className="space-y-3">
              {pendingSignatures.map((signer: any) => (
                <div key={signer.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">
                      {signer.profiles?.prenom} {signer.profiles?.nom}
                    </p>
                    <p className="text-sm text-muted-foreground capitalize">{signer.role}</p>
                  </div>
                  <Badge variant="secondary">En attente</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileSignature className="h-12 w-12 mx-auto mb-4 opacity-30" />
              Toutes les signatures sont complètes.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Historique des signatures
          </CardTitle>
        </CardHeader>
        <CardContent>
          {signedSignatures.length > 0 ? (
            <div className="space-y-3">
              {signedSignatures.map((signer: any) => (
                <div key={signer.id} className="flex items-center justify-between border-b pb-3 last:border-none last:pb-0">
                  <div>
                    <p className="font-medium">
                      {signer.profiles?.prenom} {signer.profiles?.nom}
                    </p>
                    <p className="text-sm text-muted-foreground capitalize">{signer.role}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Signé le {signer.signed_at ? formatDateShort(signer.signed_at) : "—"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-6">Aucune signature enregistrée pour le moment.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

