"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Webhook, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { WebhookEditor } from "@/components/api/WebhookEditor";
import { WebhookCard } from "@/components/api/WebhookCard";

interface WebhookData {
  id: string;
  url: string;
  events: string[];
  description: string | null;
  is_active: boolean;
  last_triggered_at: string | null;
  last_status_code: number | null;
  failure_count: number;
  created_at: string;
  secret?: string;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/webhooks");
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.webhooks || []);
      }
    } catch {
      console.error("Failed to fetch webhooks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleCreated = () => {
    setShowEditor(false);
    fetchWebhooks();
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/webhooks/${id}`, { method: "DELETE" });
      if (res.ok) {
        setWebhooks((prev) => prev.filter((w) => w.id !== id));
      }
    } catch {
      console.error("Failed to delete webhook");
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/v1/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      });
      if (res.ok) {
        setWebhooks((prev) =>
          prev.map((w) => (w.id === id ? { ...w, is_active: isActive } : w))
        );
      }
    } catch {
      console.error("Failed to toggle webhook");
    }
  };

  const handleTest = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/webhooks/${id}/test`, { method: "POST" });
      return await res.json();
    } catch {
      return { success: false, error: "Erreur réseau" };
    }
  };

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/owner/settings/api">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
            <p className="text-muted-foreground mt-1">
              Recevez des notifications HTTP lorsque des événements se produisent
            </p>
          </div>
          <Button onClick={() => setShowEditor(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau webhook
          </Button>
        </div>

        {showEditor && (
          <WebhookEditor
            onCreated={handleCreated}
            onCancel={() => setShowEditor(false)}
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
        ) : webhooks.length === 0 && !showEditor ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Webhook className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-center">
                Aucun webhook configuré. Créez-en un pour recevoir des notifications.
              </p>
              <Button onClick={() => setShowEditor(true)} className="mt-4" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Créer mon premier webhook
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {webhooks.map((webhook) => (
              <WebhookCard
                key={webhook.id}
                webhook={webhook}
                onDelete={() => handleDelete(webhook.id)}
                onToggle={(active) => handleToggle(webhook.id, active)}
                onTest={() => handleTest(webhook.id)}
              />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
