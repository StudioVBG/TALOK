"use client";

import { useEffect, useState, use } from "react";
import { ArrowLeft, Activity } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/ui/page-transition";
import { APIUsageChart } from "@/components/api/APIUsageChart";

interface APIKeyDetail {
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

interface UsageData {
  total_calls_30d: number;
  error_calls_30d: number;
  avg_response_time_ms: number;
  daily: { date: string; count: number }[];
}

interface LogEntry {
  method: string;
  path: string;
  status_code: number;
  response_time_ms: number;
  created_at: string;
}

export default function APIKeyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [apiKey, setApiKey] = useState<APIKeyDetail | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/v1/api-keys/${id}`);
        if (res.ok) {
          const data = await res.json();
          setApiKey(data.api_key);
          setUsage(data.usage);
          setLogs(data.recent_logs || []);
        }
      } catch {
        console.error("Failed to fetch API key details");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <p className="text-muted-foreground">Clé API non trouvée</p>
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold tracking-tight">{apiKey.name}</h1>
            <p className="text-muted-foreground font-mono text-sm mt-1">
              {apiKey.key_prefix}...
            </p>
          </div>
          <Badge variant={apiKey.is_active ? "default" : "secondary"}>
            {apiKey.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Stats cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Appels (30j)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{usage?.total_calls_30d || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Erreurs (30j)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{usage?.error_calls_30d || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Temps moyen</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{usage?.avg_response_time_ms || 0}ms</p>
            </CardContent>
          </Card>
        </div>

        {/* Usage chart */}
        {usage && usage.daily.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Utilisation quotidienne
              </CardTitle>
            </CardHeader>
            <CardContent>
              <APIUsageChart data={usage.daily} />
            </CardContent>
          </Card>
        )}

        {/* Key details */}
        <Card>
          <CardHeader>
            <CardTitle>Détails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Permissions</p>
                <div className="flex gap-1 mt-1">
                  {apiKey.permissions.map((p) => (
                    <Badge key={p} variant="outline">{p}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Scopes</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {apiKey.scopes.map((s) => (
                    <Badge key={s} variant="secondary">{s}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Limite</p>
                <p className="font-mono">{apiKey.rate_limit_per_hour} req/h</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expire le</p>
                <p>
                  {apiKey.expires_at
                    ? new Date(apiKey.expires_at).toLocaleDateString("fr-FR")
                    : "Jamais"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Dernière utilisation</p>
                <p>
                  {apiKey.last_used_at
                    ? new Date(apiKey.last_used_at).toLocaleString("fr-FR")
                    : "Jamais"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Créée le</p>
                <p>{new Date(apiKey.created_at).toLocaleDateString("fr-FR")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent logs */}
        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Derniers appels</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-4">Méthode</th>
                      <th className="text-left py-2 pr-4">Endpoint</th>
                      <th className="text-left py-2 pr-4">Status</th>
                      <th className="text-left py-2 pr-4">Temps</th>
                      <th className="text-left py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-4">
                          <Badge variant="outline" className="font-mono text-xs">
                            {log.method}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs truncate max-w-[200px]">
                          {log.path}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge
                            variant={log.status_code < 400 ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {log.status_code}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {log.response_time_ms}ms
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString("fr-FR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}
