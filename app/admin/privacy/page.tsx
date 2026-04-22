"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Shield, UserX, Download, Loader2 } from "lucide-react";

export default function AdminPrivacyPage() {
  return <AdminPrivacyPageContent />;
}

function AdminPrivacyPageContent() {
  const { toast } = useToast();
  const [anonymizing, setAnonymizing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [anonymizeUserId, setAnonymizeUserId] = useState("");
  const [exportUserId, setExportUserId] = useState("");

  async function handleAnonymize() {
    if (!anonymizeUserId.trim()) {
      toast({
        title: "Champ requis",
        description: "Veuillez entrer un ID utilisateur",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("Êtes-vous sûr de vouloir anonymiser ces données ? Cette action est irréversible.")) {
      return;
    }

    setAnonymizing(true);
    try {
      const response = await fetch("/api/privacy/anonymize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: anonymizeUserId.trim() }),
      });

      if (response.ok) {
        toast({
          title: "Données anonymisées",
          description: "Les données ont été anonymisées avec succès",
        });
        setAnonymizeUserId("");
      } else {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'anonymisation");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Impossible d'anonymiser les données";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setAnonymizing(false);
    }
  }

  async function handleExport() {
    if (!exportUserId.trim()) {
      toast({
        title: "Champ requis",
        description: "Veuillez entrer un ID utilisateur",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    try {
      const response = await fetch(`/api/privacy/export?user_id=${encodeURIComponent(exportUserId.trim())}`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'export");
      }

      const data = await response.json();

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `export-rgpd-${exportUserId.trim()}-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export réussi",
        description: "Le fichier JSON a été téléchargé",
      });
      setExportUserId("");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Impossible d'exporter les données";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          RGPD & Confidentialité
        </h1>
        <p className="text-muted-foreground mt-2">
          Gestion des données personnelles et conformité RGPD
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-red-500" />
              Anonymisation
            </CardTitle>
            <CardDescription>
              Anonymiser les données d'un utilisateur (droit à l'oubli)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="anonymize-user-id">ID utilisateur</Label>
                <Input
                  id="anonymize-user-id"
                  type="text"
                  placeholder="UUID utilisateur"
                  value={anonymizeUserId}
                  onChange={(e) => setAnonymizeUserId(e.target.value)}
                />
              </div>
              <Button
                onClick={handleAnonymize}
                disabled={anonymizing || !anonymizeUserId.trim()}
                variant="destructive"
                className="w-full"
              >
                {anonymizing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserX className="mr-2 h-4 w-4" />
                )}
                {anonymizing ? "Anonymisation..." : "Anonymiser"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-500" />
              Export de données
            </CardTitle>
            <CardDescription>
              Exporter toutes les données d'un utilisateur (droit à la portabilité)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="export-user-id">ID utilisateur</Label>
                <Input
                  id="export-user-id"
                  type="text"
                  placeholder="UUID utilisateur"
                  value={exportUserId}
                  onChange={(e) => setExportUserId(e.target.value)}
                />
              </div>
              <Button
                onClick={handleExport}
                disabled={exporting || !exportUserId.trim()}
                className="w-full"
                variant="outline"
              >
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {exporting ? "Export en cours..." : "Exporter les données"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}





