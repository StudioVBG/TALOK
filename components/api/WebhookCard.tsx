"use client";

import { useState } from "react";
import { Webhook, MoreVertical, Play, Pause, Trash2, Send, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WebhookCardProps {
  webhook: {
    id: string;
    url: string;
    events: string[];
    description: string | null;
    is_active: boolean;
    last_triggered_at: string | null;
    last_status_code: number | null;
    failure_count: number;
    created_at: string;
  };
  onDelete: () => void;
  onToggle: (active: boolean) => void;
  onTest: () => Promise<{ success: boolean; status_code?: number; error?: string }>;
}

export function WebhookCard({ webhook, onDelete, onToggle, onTest }: WebhookCardProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest();
      setTestResult({
        success: result.success,
        message: result.success
          ? `OK (${result.status_code})`
          : result.error || "Échec",
      });
    } catch {
      setTestResult({ success: false, message: "Erreur réseau" });
    } finally {
      setTesting(false);
      // Clear result after 5 seconds
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const hasFailures = webhook.failure_count > 5;

  return (
    <Card className={!webhook.is_active ? "opacity-60" : hasFailures ? "border-red-200" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`p-2 rounded-lg flex-shrink-0 ${
                hasFailures
                  ? "bg-red-50 text-red-600"
                  : "bg-purple-50 text-purple-600"
              }`}
            >
              <Webhook className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-sm truncate">{webhook.url}</p>
              {webhook.description && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {webhook.description}
                </p>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                {webhook.events.slice(0, 4).map((event) => (
                  <Badge key={event} variant="outline" className="text-xs">
                    {event}
                  </Badge>
                ))}
                {webhook.events.length > 4 && (
                  <Badge variant="secondary" className="text-xs">
                    +{webhook.events.length - 4}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                {webhook.last_triggered_at && (
                  <span>
                    Dernier envoi :{" "}
                    {new Date(webhook.last_triggered_at).toLocaleDateString("fr-FR")}
                  </span>
                )}
                {webhook.last_status_code && (
                  <Badge
                    variant={webhook.last_status_code < 400 ? "default" : "destructive"}
                    className="text-[10px]"
                  >
                    {webhook.last_status_code}
                  </Badge>
                )}
                {hasFailures && (
                  <span className="text-red-600">
                    {webhook.failure_count} échecs
                  </span>
                )}
              </div>

              {/* Test result */}
              {testResult && (
                <div
                  className={`flex items-center gap-1.5 mt-2 text-xs ${
                    testResult.success ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  {testResult.message}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleTest}
              disabled={testing || !webhook.is_active}
              title="Envoyer un test"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onToggle(!webhook.is_active)}>
                  {webhook.is_active ? (
                    <>
                      <Pause className="mr-2 h-4 w-4" />
                      Désactiver
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Réactiver
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={onDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
