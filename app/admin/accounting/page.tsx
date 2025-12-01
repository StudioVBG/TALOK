"use client";
// @ts-nocheck

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Download, FileSpreadsheet, FileText } from "lucide-react";

export default function AdminAccountingPage() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  async function handleExport(format: "csv" | "excel" | "fec") {
    setExporting(true);
    try {
      const response = await fetch(
        `/api/accounting/exports?scope=global&format=${format}`
      );
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `comptabilite-${format}-${new Date().toISOString().split("T")[0]}.${format === "excel" ? "xlsx" : format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: "Export réussi",
          description: `Fichier ${format.toUpperCase()} téléchargé`,
        });
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'exporter les données",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Comptabilité</h1>
        <p className="text-muted-foreground mt-2">
          Exports comptables et grand-livre
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Exports comptables</CardTitle>
            <CardDescription>
              Téléchargez les données comptables au format CSV, Excel ou FEC
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => handleExport("csv")}
              disabled={exporting}
              className="w-full"
              variant="outline"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Exporter CSV
            </Button>
            <Button
              onClick={() => handleExport("excel")}
              disabled={exporting}
              className="w-full"
              variant="outline"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Exporter Excel
            </Button>
            <Button
              onClick={() => handleExport("fec")}
              disabled={exporting}
              className="w-full"
              variant="outline"
            >
              <FileText className="mr-2 h-4 w-4" />
              Exporter FEC
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Grand-livre</CardTitle>
            <CardDescription>
              Consultez le grand-livre agrégé
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={async () => {
                const response = await fetch("/api/accounting/gl");
                if (response.ok) {
                  const data = await response.json();
                  toast({
                    title: "Grand-livre",
                    description: `${data.entries?.length || 0} entrées`,
                  });
                }
              }}
              className="w-full"
              variant="outline"
            >
              <Download className="mr-2 h-4 w-4" />
              Consulter le grand-livre
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}





