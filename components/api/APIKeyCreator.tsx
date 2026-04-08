"use client";

import React, { useState } from "react";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const SCOPES = [
  { value: "properties", label: "Biens" },
  { value: "leases", label: "Baux" },
  { value: "documents", label: "Documents" },
  { value: "accounting", label: "Comptabilité" },
  { value: "tenants", label: "Locataires" },
  { value: "payments", label: "Paiements" },
];

const PERMISSIONS = [
  { value: "read", label: "Lecture" },
  { value: "write", label: "Écriture" },
  { value: "delete", label: "Suppression" },
];

interface APIKeyCreatorProps {
  onCreated: () => void;
  onCancel: () => void;
}

export function APIKeyCreator({ onCreated, onCancel }: APIKeyCreatorProps) {
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["properties"]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(["read"]);
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(365);
  const [loading, setLoading] = useState(false);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev: string[]) =>
      prev.includes(scope) ? prev.filter((s: string) => s !== scope) : [...prev, scope]
    );
  };

  const togglePermission = (perm: string) => {
    setSelectedPermissions((prev: string[]) =>
      prev.includes(perm) ? prev.filter((p: string) => p !== perm) : [...prev, perm]
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Le nom est requis");
      return;
    }
    if (selectedScopes.length === 0) {
      setError("Au moins un scope est requis");
      return;
    }
    if (selectedPermissions.length === 0) {
      setError("Au moins une permission est requise");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          scopes: selectedScopes,
          permissions: selectedPermissions,
          expires_in_days: expiresInDays,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur lors de la création");
        return;
      }

      setRawKey(data.raw_key);
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (rawKey) {
      navigator.clipboard.writeText(rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Show the raw key after creation
  if (rawKey) {
    return (
      <Card className="border-green-200 bg-green-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <Check className="h-5 w-5" />
            Clé API créée
          </CardTitle>
          <CardDescription>
            Copiez cette clé maintenant. Elle ne sera plus jamais affichée.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={rawKey}
              className="font-mono text-sm bg-white"
            />
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p className="text-sm">
              Cette clé ne sera plus jamais affichée. Si vous la perdez, vous devrez en créer une nouvelle.
            </p>
          </div>
          <Button onClick={onCreated} className="w-full">
            J'ai copié ma clé
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nouvelle clé API</CardTitle>
        <CardDescription>
          Créez une clé pour intégrer Talok avec vos outils externes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="key-name">Nom</Label>
          <Input
            id="key-name"
            placeholder="Ex: Mon ERP, Zapier, N8N..."
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          />
        </div>

        {/* Scopes */}
        <div className="space-y-2">
          <Label>Scopes (données accessibles)</Label>
          <div className="flex flex-wrap gap-2">
            {SCOPES.map((scope) => (
              <label key={scope.value} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selectedScopes.includes(scope.value)}
                  onCheckedChange={() => toggleScope(scope.value)}
                />
                <span className="text-sm">{scope.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Permissions */}
        <div className="space-y-2">
          <Label>Permissions</Label>
          <div className="flex flex-wrap gap-4">
            {PERMISSIONS.map((perm) => (
              <label key={perm.value} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selectedPermissions.includes(perm.value)}
                  onCheckedChange={() => togglePermission(perm.value)}
                />
                <span className="text-sm">{perm.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Expiration */}
        <div className="space-y-2">
          <Label>Expiration</Label>
          <div className="flex gap-2">
            {[30, 90, 180, 365].map((days) => (
              <Badge
                key={days}
                variant={expiresInDays === days ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setExpiresInDays(days)}
              >
                {days}j
              </Badge>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "Création..." : "Créer la clé"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
