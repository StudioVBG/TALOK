"use client";

import { Key, MoreVertical, ExternalLink, Pause, Play, Trash2 } from "lucide-react";
import Link from "next/link";
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

interface APIKeyCardProps {
  apiKey: {
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
  };
  onRevoke: () => void;
  onToggle: (active: boolean) => void;
}

export function APIKeyCard({ apiKey, onRevoke, onToggle }: APIKeyCardProps) {
  const isExpired = apiKey.expires_at && new Date(apiKey.expires_at) < new Date();

  return (
    <Card className={!apiKey.is_active || isExpired ? "opacity-60" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">
              <Key className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  href={`/owner/settings/api/keys/${apiKey.id}`}
                  className="font-medium hover:underline"
                >
                  {apiKey.name}
                </Link>
                {!apiKey.is_active && (
                  <Badge variant="secondary">Inactive</Badge>
                )}
                {isExpired && (
                  <Badge variant="destructive">Expirée</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground font-mono mt-0.5">
                {apiKey.key_prefix}...
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {apiKey.scopes.map((scope) => (
                  <Badge key={scope} variant="outline" className="text-xs">
                    {scope}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {apiKey.last_used_at
                  ? `Dernière utilisation : ${new Date(apiKey.last_used_at).toLocaleDateString("fr-FR")}`
                  : "Jamais utilisée"}
                {apiKey.expires_at && (
                  <span className="ml-2">
                    {isExpired ? "Expirée" : `Expire le ${new Date(apiKey.expires_at).toLocaleDateString("fr-FR")}`}
                  </span>
                )}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/owner/settings/api/keys/${apiKey.id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Voir les détails
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggle(!apiKey.is_active)}>
                {apiKey.is_active ? (
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
                onClick={onRevoke}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Révoquer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
