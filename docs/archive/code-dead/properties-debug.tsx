"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function PropertiesDebug() {
  const { profile, user } = useAuth();
  const [apiData, setApiData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testApi = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get("/properties");
      setApiData(data);
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
      console.error("API Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      testApi();
    }
  }, [profile]);

  if (!profile) {
    return (
      <Card className="border-yellow-500">
        <CardHeader>
          <CardTitle>Debug - Connexion</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Profil non chargé</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-500">
      <CardHeader>
        <CardTitle>Debug - Connexion Frontend/Backend</CardTitle>
        <CardDescription>Vérification des données et de la connexion</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2">Informations du profil</h3>
          <div className="space-y-1 text-sm">
            <p><strong>ID:</strong> {profile.id}</p>
            <p><strong>Rôle:</strong> <Badge>{profile.role}</Badge></p>
            <p><strong>User ID:</strong> {user?.id || "N/A"}</p>
            <p><strong>Email:</strong> {user?.email || "N/A"}</p>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Test API</h3>
          <Button onClick={testApi} disabled={loading}>
            {loading ? "Test en cours..." : "Tester l'API"}
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800 font-semibold">Erreur:</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {apiData && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800 font-semibold">✅ Données reçues:</p>
            <div className="text-sm space-y-1 mt-2">
              <p><strong>Propriétés trouvées:</strong> {apiData.properties?.length || 0}</p>
              {apiData.debug && (
                <div className="mt-2 p-2 bg-white rounded">
                  <p><strong>Debug API:</strong></p>
                  <pre className="text-xs overflow-auto">{JSON.stringify(apiData.debug, null, 2)}</pre>
                </div>
              )}
              {apiData.properties && apiData.properties.length > 0 && (
                <div className="mt-2">
                  <p><strong>Liste des propriétés:</strong></p>
                  <ul className="list-disc list-inside space-y-1">
                    {apiData.properties.slice(0, 5).map((prop: any, idx: number) => (
                      <li key={idx} className="text-xs">
                        {prop.type || "N/A"} - {prop.adresse_complete || prop.ville || "Adresse non renseignée"}
                      </li>
                    ))}
                    {apiData.properties.length > 5 && (
                      <li className="text-xs text-muted-foreground">... et {apiData.properties.length - 5} autres</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

