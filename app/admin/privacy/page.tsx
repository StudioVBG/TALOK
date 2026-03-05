"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Shield, UserX, Download } from "lucide-react";

export default function AdminPrivacyPage() {
  const { toast } = useToast();
  const [anonymizing, setAnonymizing] = useState(false);

  async function handleAnonymize(userId: string) {
    if (!confirm("Êtes-vous sûr de vouloir anonymiser ces données ?")) {
      return;
    }

    setAnonymizing(true);
    try {
      const response = await fetch("/api/privacy/anonymize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });

      if (response.ok) {
        toast({
          title: "Données anonymisées",
          description: "Les données ont été anonymisées avec succès",
        });
      } else {
        throw new Error("Erreur lors de l'anonymisation");
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'anonymiser les données",
        variant: "destructive",
      });
    } finally {
      setAnonymizing(false);
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">RGPD & Confidentialité</h1>
        <p className="text-muted-foreground mt-2">
          Gestion des données personnelles et conformité RGPD
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Anonymisation</CardTitle>
            <CardDescription>
              Anonymiser les données d'un utilisateur (droit à l'oubli)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Entrez l'ID utilisateur à anonymiser
              </p>
              <input
                type="text"
                placeholder="UUID utilisateur"
                className="w-full px-3 py-2 border rounded-md"
                id="anonymize-user-id"
              />
              <Button
                onClick={() => {
                  const input = document.getElementById("anonymize-user-id") as HTMLInputElement;
                  if (input?.value) {
                    handleAnonymize(input.value);
                  }
                }}
                disabled={anonymizing}
                variant="destructive"
                className="w-full"
              >
                <UserX className="mr-2 h-4 w-4" />
                Anonymiser
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export de données</CardTitle>
            <CardDescription>
              Exporter toutes les données d'un utilisateur (droit à la portabilité)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Entrez l'ID utilisateur pour exporter ses données
              </p>
              <input
                type="text"
                placeholder="UUID utilisateur"
                className="w-full px-3 py-2 border rounded-md"
                id="export-user-id"
              />
              <Button
                onClick={() => {
                  toast({
                    title: "Export de données",
                    description: "Fonctionnalité à implémenter",
                  });
                }}
                className="w-full"
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                Exporter les données
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}





