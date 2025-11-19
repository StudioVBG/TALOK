"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Key, RotateCcw, Trash2, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

interface ApiProvider {
  id: string;
  name: string;
  category: string;
  status: string;
}

interface ApiCredential {
  id: string;
  provider_id: string;
  name: string;
  key_hash: string;
  is_active: boolean;
  created_at: string;
  rotated_at?: string;
  provider?: {
    name: string;
    type: string;
  };
}

interface SupabaseEnvStatus {
  supabaseUrl: string | null;
  serviceRoleKeySet: boolean;
}

export default function AdminIntegrationsPage() {
  const { toast } = useToast();
  const supabase = createClient();
  const [apiKeys, setApiKeys] = useState<ApiCredential[]>([]);
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [envStatus, setEnvStatus] = useState<SupabaseEnvStatus | null>(null);
  const [testingServiceRole, setTestingServiceRole] = useState(false);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiCredential | null>(null);
  const [newKeyData, setNewKeyData] = useState({
    provider_id: "",
    name: "",
    permissions: {},
  });
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);

  const fetchWithAuth = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(init?.headers);

    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }

    return fetch(input, {
      ...init,
      credentials: "include",
      headers,
    });
  }, [supabase]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [keysResponse, providersResponse, envResponse] = await Promise.all([
        fetchWithAuth("/api/admin/api-keys"),
        fetchWithAuth("/api/admin/api-providers"),
        fetchWithAuth("/api/admin/integrations/env-status"),
      ]);

      if (keysResponse.ok) {
        const keysData = await keysResponse.json();
        setApiKeys(keysData.credentials || []);
      }

      if (providersResponse.ok) {
        const providersData = await providersResponse.json();
        setProviders(providersData.providers || []);
      }

      if (envResponse.ok) {
        const envData = (await envResponse.json()) as SupabaseEnvStatus;
        setEnvStatus(envData);
      }
    } catch (error) {
      console.error("Erreur chargement:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCreateKey() {
    if (!newKeyData.provider_id || !newKeyData.name) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetchWithAuth("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newKeyData),
      });

      if (response.ok) {
        const data = await response.json();
        setNewKeyValue(data.api_key);
        setCreateDialogOpen(false);
        toast({
          title: "Clé créée",
          description: "La clé API a été créée avec succès. Sauvegardez-la maintenant !",
        });
        setNewKeyData({ provider_id: "", name: "", permissions: {} });
        fetchData();
      } else {
        const error = await response.json();
        throw new Error(error.error);
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la clé",
        variant: "destructive",
      });
    }
  }

  async function handleRotateKey(keyId: string) {
    if (!confirm("Êtes-vous sûr de vouloir rotater cette clé ? L'ancienne clé ne fonctionnera plus.")) {
      return;
    }

    try {
      const response = await fetchWithAuth(`/api/admin/api-keys/${keyId}/rotate`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setNewKeyValue(data.api_key);
        setSelectedKey(data.credential);
        toast({
          title: "Clé rotatée",
          description: "La nouvelle clé a été générée. Sauvegardez-la maintenant !",
        });
        fetchData();
      } else {
        const error = await response.json();
        throw new Error(error.error);
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de rotater la clé",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteKey(keyId: string) {
    if (!confirm("Êtes-vous sûr de vouloir désactiver cette clé ?")) {
      return;
    }

    try {
      const response = await fetchWithAuth(`/api/admin/api-keys/${keyId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Clé désactivée",
          description: "La clé API a été désactivée avec succès",
        });
        fetchData();
      } else {
        const error = await response.json();
        throw new Error(error.error);
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la clé",
        variant: "destructive",
      });
    }
  }

  async function handleToggleActive(keyId: string, currentStatus: boolean) {
    try {
      const response = await fetchWithAuth(`/api/admin/api-keys/${keyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (response.ok) {
        toast({
          title: "Statut mis à jour",
          description: `La clé a été ${!currentStatus ? "activée" : "désactivée"}`,
        });
        fetchData();
      } else {
        const error = await response.json();
        throw new Error(error.error);
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier le statut",
        variant: "destructive",
      });
    }
  }

  async function handleTestServiceRole() {
    try {
      setTestingServiceRole(true);
      const response = await fetchWithAuth("/api/admin/integrations/test-service-role", {
        method: "POST",
      });

      if (response.ok) {
        toast({
          title: "Test réussi",
          description: "La clé service-role est valide.",
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || "Test échoué");
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de tester la clé",
        variant: "destructive",
      });
    } finally {
      setTestingServiceRole(false);
    }
  }

  return (
    <div className="py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Intégrations & Clés API</h1>
          <p className="text-muted-foreground mt-2">
            Gérez les clés API et les fournisseurs externes
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle clé API
        </Button>
      </div>

      {/* Configuration Supabase */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configuration Supabase</CardTitle>
          <CardDescription>
            Vérifiez l'état de la connexion Supabase et des clés sensibles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">URL Supabase</p>
              <p className="font-medium">{envStatus?.supabaseUrl || "Non configurée"}</p>
            </div>
            {envStatus?.supabaseUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(envStatus.supabaseUrl!);
                  toast({ title: "Copié", description: "URL Supabase copiée" });
                }}
              >
                Copier l’URL
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Clé Service Role</p>
              <p className="font-medium">
                {envStatus?.serviceRoleKeySet ? "✅ Configurée" : "⚠️ Manquante"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestServiceRole}
              disabled={testingServiceRole}
            >
              {testingServiceRole ? "Test en cours..." : "Tester l’accès"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Ces variables doivent être configurées dans votre environnement (.env.local ou gestionnaire de secrets).
            La clé service-role ne doit jamais être exposée côté client.
          </p>
        </CardContent>
      </Card>

      {/* Liste des providers disponibles */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Fournisseurs API disponibles</CardTitle>
          <CardDescription>
            Liste de tous les fournisseurs d'API configurés
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Chargement...</p>
          ) : providers.length === 0 ? (
            <p className="text-muted-foreground">Aucun fournisseur configuré</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className="p-4 border rounded-lg flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold">{provider.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {provider.category} • {provider.status}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      provider.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {provider.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Liste des clés API */}
      <Card>
        <CardHeader>
          <CardTitle>Clés API</CardTitle>
          <CardDescription>
            Liste des clés API configurées pour les intégrations externes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Chargement...</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-muted-foreground">Aucune clé API configurée</p>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{key.name}</h3>
                      {key.is_active ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {key.provider?.name || "Provider inconnu"} • {key.key_hash} • Créée le{" "}
                      {new Date(key.created_at).toLocaleDateString()}
                      {key.rotated_at && (
                        <> • Rotatée le {new Date(key.rotated_at).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(key.id, key.is_active)}
                    >
                      {key.is_active ? (
                        <EyeOff className="h-4 w-4 mr-2" />
                      ) : (
                        <Eye className="h-4 w-4 mr-2" />
                      )}
                      {key.is_active ? "Désactiver" : "Activer"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRotateKey(key.id)}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Rotater
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteKey(key.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de création */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer une nouvelle clé API</DialogTitle>
            <DialogDescription>
              Sélectionnez un fournisseur et donnez un nom à votre clé
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Fournisseur</Label>
              <Select
                value={newKeyData.provider_id}
                onValueChange={(value) =>
                  setNewKeyData({ ...newKeyData, provider_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un fournisseur" />
                </SelectTrigger>
                <SelectContent>
                  {providers
                    .filter((p) => p.status === "active")
                    .map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name} ({provider.category})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nom de la clé</Label>
              <Input
                value={newKeyData.name}
                onChange={(e) =>
                  setNewKeyData({ ...newKeyData, name: e.target.value })
                }
                placeholder="Ex: Production Stripe"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateKey}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog d'affichage de la nouvelle clé */}
      {newKeyValue && (
        <Dialog open={!!newKeyValue} onOpenChange={() => setNewKeyValue(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>⚠️ Clé API générée</DialogTitle>
              <DialogDescription>
                Cette clé ne sera plus affichée. Copiez-la maintenant !
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                <code className="text-sm break-all">{newKeyValue}</code>
              </div>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(newKeyValue);
                  toast({
                    title: "Copié",
                    description: "La clé a été copiée dans le presse-papiers",
                  });
                }}
                className="w-full"
              >
                Copier la clé
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => setNewKeyValue(null)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
