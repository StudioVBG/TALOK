"use client";
// @ts-nocheck

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  User, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Home,
  Euro,
  AlertCircle
} from "lucide-react";
import Link from "next/link";

export default function GuarantorDashboardPage() {
  // TODO: Fetch guarantor data
  const guarantees: any[] = [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
              <Shield className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Espace Garant</h1>
              <p className="text-muted-foreground">
                Gérez vos engagements de caution
              </p>
            </div>
          </div>
        </div>

        {/* Statut général */}
        <Card className="mb-6 border-purple-200 bg-purple-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle2 className="h-8 w-8 text-purple-600" />
              <div>
                <h3 className="font-semibold text-lg">Votre dossier est complet</h3>
                <p className="text-muted-foreground">
                  Vous êtes prêt à vous porter garant pour un locataire
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Garanties actives */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Mes garanties
            </CardTitle>
            <CardDescription>
              Les locations pour lesquelles vous êtes garant
            </CardDescription>
          </CardHeader>
          <CardContent>
            {guarantees.length > 0 ? (
              <div className="space-y-4">
                {guarantees.map((guarantee: any) => (
                  <div key={guarantee.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{guarantee.tenant_name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Home className="h-3 w-3" />
                            {guarantee.property_address}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                        Actif
                      </Badge>
                    </div>
                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Euro className="h-3 w-3" />
                          Loyer : {guarantee.rent} €/mois
                        </span>
                      </div>
                      <Button variant="outline" size="sm">
                        Voir les détails
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Shield className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-medium text-lg mb-2">Aucune garantie active</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Vous n'êtes actuellement garant pour aucun locataire. 
                  Vous recevrez une notification lorsqu'un locataire vous demandera 
                  de vous porter garant.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Informations importantes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              À savoir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="font-medium mb-1">Vos engagements en tant que garant</h4>
                <p className="text-muted-foreground">
                  En vous portant garant, vous vous engagez à payer les loyers et charges 
                  en cas de défaillance du locataire. Cet engagement est valable pour toute 
                  la durée du bail.
                </p>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium mb-1">Vos droits</h4>
                <p className="text-muted-foreground">
                  Vous avez le droit d'être informé de tout impayé du locataire dans les 
                  15 jours suivant sa survenance. Vous pouvez également demander une copie 
                  des documents relatifs au bail.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lien vers les documents */}
        <div className="mt-6 flex justify-center">
          <Button variant="outline" asChild>
            <Link href="/documents">
              <FileText className="h-4 w-4 mr-2" />
              Accéder à mes documents
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

