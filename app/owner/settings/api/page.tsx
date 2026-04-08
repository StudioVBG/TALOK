"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Key, Webhook, BookOpen } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { APIKeyCard } from "@/components/api/APIKeyCard";
import { APIKeyCreator } from "@/components/api/APIKeyCreator";

interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  scopes: string[];
  rate_limit_per_hour: number;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export default function APISettingsPage() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/api-keys");
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data.api_keys || []);
      }
    } catch {
      console.error("Failed to fetch API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleKeyCreated = () => {
    setShowCreator(false);
    fetchKeys();
  };

  const handleKeyRevoked = async (keyId: string) => {
    try {
      const res = await fetch(`/api/v1/api-keys/${keyId}`, { method: "DELETE" });
      if (res.ok) {
        setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
      }
    } catch {
      console.error("Failed to revoke key");
    }
  };

  const handleKeyToggled = async (keyId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/v1/api-keys/${keyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      });
      if (res.ok) {
        setApiKeys((prev) =>
          prev.map((k) => (k.id === keyId ? { ...k, is_active: isActive } : k))
        );
      }
    } catch {
      console.error("Failed to toggle key");
    }
  };

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">API & Intégrations</h1>
            <p className="text-muted-foreground mt-1">
              Gérez vos clés API pour intégrer Talok avec vos outils
            </p>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Link href="/owner/settings/api/webhooks">
            <Card className="hover:border-blue-200 hover:shadow-md transition-all cursor-pointer h-full">
              <CardHeader className="pb-2">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600 w-fit">
                  <Webhook className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">Webhooks</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Recevez des notifications en temps réel
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
          <Link href="/owner/settings/api/docs">
            <Card className="hover:border-blue-200 hover:shadow-md transition-all cursor-pointer h-full">
              <CardHeader className="pb-2">
                <div className="p-2 rounded-lg bg-green-50 text-green-600 w-fit">
                  <BookOpen className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">Documentation</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Explorez les endpoints de l'API REST
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 w-fit">
                <Key className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Clés API</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                {apiKeys.length} clé{apiKeys.length !== 1 ? "s" : ""} active{apiKeys.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* API Keys section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Clés API</h2>
            <Button onClick={() => setShowCreator(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle clé
            </Button>
          </div>

          {showCreator && (
            <APIKeyCreator
              onCreated={handleKeyCreated}
              onCancel={() => setShowCreator(false)}
            />
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : apiKeys.length === 0 && !showCreator ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Key className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground text-center">
                  Aucune clé API. Créez-en une pour commencer à intégrer Talok.
                </p>
                <Button onClick={() => setShowCreator(true)} className="mt-4" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Créer ma première clé API
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <APIKeyCard
                  key={key.id}
                  apiKey={key}
                  onRevoke={() => handleKeyRevoked(key.id)}
                  onToggle={(active) => handleKeyToggled(key.id, active)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
