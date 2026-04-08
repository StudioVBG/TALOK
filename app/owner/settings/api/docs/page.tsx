"use client";

import { ArrowLeft, Copy, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/ui/page-transition";

const API_BASE = "https://api.talok.fr/v1";

const ENDPOINTS = [
  {
    category: "Properties",
    endpoints: [
      { method: "GET", path: "/v1/properties", description: "Liste des biens", scope: "properties" },
      { method: "GET", path: "/v1/properties/{id}", description: "Détail d'un bien", scope: "properties" },
      { method: "POST", path: "/v1/properties", description: "Créer un bien", scope: "properties", permission: "write" },
      { method: "PATCH", path: "/v1/properties/{id}", description: "Modifier un bien", scope: "properties", permission: "write" },
    ],
  },
  {
    category: "Leases",
    endpoints: [
      { method: "GET", path: "/v1/leases", description: "Liste des baux", scope: "leases" },
      { method: "GET", path: "/v1/leases/{id}", description: "Détail d'un bail", scope: "leases" },
      { method: "GET", path: "/v1/leases/{id}/invoices", description: "Factures d'un bail", scope: "leases" },
    ],
  },
  {
    category: "Documents",
    endpoints: [
      { method: "GET", path: "/v1/documents", description: "Liste des documents", scope: "documents" },
      { method: "GET", path: "/v1/documents/{id}", description: "Métadonnées + URL signée", scope: "documents" },
      { method: "POST", path: "/v1/documents", description: "Uploader un document", scope: "documents", permission: "write" },
    ],
  },
  {
    category: "Accounting",
    endpoints: [
      { method: "GET", path: "/v1/accounting/entries", description: "Écritures comptables", scope: "accounting" },
      { method: "GET", path: "/v1/accounting/fec", description: "Export FEC", scope: "accounting" },
      { method: "GET", path: "/v1/accounting/balance", description: "Balance des comptes", scope: "accounting" },
    ],
  },
  {
    category: "Tenants",
    endpoints: [
      { method: "GET", path: "/v1/tenants", description: "Liste des locataires", scope: "tenants" },
      { method: "GET", path: "/v1/tenants/{id}", description: "Détail locataire", scope: "tenants" },
    ],
  },
  {
    category: "Payments",
    endpoints: [
      { method: "GET", path: "/v1/payments", description: "Liste des paiements", scope: "payments" },
    ],
  },
  {
    category: "Webhooks",
    endpoints: [
      { method: "GET", path: "/v1/webhooks", description: "Liste des webhooks" },
      { method: "POST", path: "/v1/webhooks", description: "Créer un webhook" },
      { method: "PATCH", path: "/v1/webhooks/{id}", description: "Modifier un webhook" },
      { method: "DELETE", path: "/v1/webhooks/{id}", description: "Supprimer un webhook" },
      { method: "POST", path: "/v1/webhooks/{id}/test", description: "Tester un webhook" },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-100 text-blue-700",
  POST: "bg-green-100 text-green-700",
  PATCH: "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

export default function APIDocsPage() {
  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/owner/settings/api">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Documentation API</h1>
            <p className="text-muted-foreground mt-1">
              Référence complète de l'API REST Talok v1
            </p>
          </div>
        </div>

        {/* Auth section */}
        <Card>
          <CardHeader>
            <CardTitle>Authentification</CardTitle>
            <CardDescription>
              Toutes les requêtes doivent inclure votre clé API dans le header Authorization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4 font-mono text-sm flex items-center justify-between">
              <span>
                <span className="text-muted-foreground">Authorization:</span>{" "}
                Bearer tlk_live_xxxxxxxxxx
              </span>
              <CopyButton text="Authorization: Bearer tlk_live_xxxxxxxxxx" />
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Exemple cURL</p>
              <div className="bg-muted rounded-lg p-4 font-mono text-xs overflow-x-auto">
                <pre>{`curl -H "Authorization: Bearer tlk_live_xxx" \\
     ${API_BASE}/properties`}</pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rate limits */}
        <Card>
          <CardHeader>
            <CardTitle>Limites</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4">Plan</th>
                    <th className="text-left py-2 pr-4">Requêtes/heure</th>
                    <th className="text-left py-2 pr-4">Webhooks</th>
                    <th className="text-left py-2">Clés API</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-medium">Pro</td>
                    <td className="py-2 pr-4">1 000</td>
                    <td className="py-2 pr-4">5</td>
                    <td className="py-2">3</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium">Enterprise</td>
                    <td className="py-2 pr-4">10 000</td>
                    <td className="py-2 pr-4">20</td>
                    <td className="py-2">10</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Les headers X-RateLimit-Limit, X-RateLimit-Remaining et X-RateLimit-Reset
              sont inclus dans chaque réponse.
            </p>
          </CardContent>
        </Card>

        {/* Pagination */}
        <Card>
          <CardHeader>
            <CardTitle>Pagination</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-3">
              Toutes les listes sont paginées. Paramètres disponibles :
            </p>
            <div className="bg-muted rounded-lg p-4 font-mono text-xs">
              <pre>{`GET /v1/properties?page=1&limit=20

// Réponse
{
  "properties": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "total_pages": 3
  }
}`}</pre>
            </div>
          </CardContent>
        </Card>

        {/* Endpoints */}
        {ENDPOINTS.map((category) => (
          <Card key={category.category}>
            <CardHeader>
              <CardTitle>{category.category}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {category.endpoints.map((ep) => (
                  <div
                    key={`${ep.method}-${ep.path}`}
                    className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Badge
                      className={`font-mono text-xs min-w-[60px] justify-center ${METHOD_COLORS[ep.method] || ""}`}
                      variant="secondary"
                    >
                      {ep.method}
                    </Badge>
                    <code className="text-sm font-mono flex-1">{ep.path}</code>
                    <span className="text-sm text-muted-foreground hidden sm:block">
                      {ep.description}
                    </span>
                    {ep.scope && (
                      <Badge variant="outline" className="text-xs hidden md:inline-flex">
                        {ep.scope}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Error format */}
        <Card>
          <CardHeader>
            <CardTitle>Format des erreurs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4 font-mono text-xs">
              <pre>{`{
  "error": "Description de l'erreur",
  "code": "VALIDATION_ERROR",
  "timestamp": "2026-04-08T12:00:00.000Z"
}`}</pre>
            </div>
            <div className="mt-4 space-y-1 text-sm">
              <p><code className="bg-muted px-1.5 rounded">400</code> — Requête invalide</p>
              <p><code className="bg-muted px-1.5 rounded">401</code> — Non authentifié</p>
              <p><code className="bg-muted px-1.5 rounded">403</code> — Accès refusé (scope/permission manquant)</p>
              <p><code className="bg-muted px-1.5 rounded">404</code> — Ressource non trouvée</p>
              <p><code className="bg-muted px-1.5 rounded">429</code> — Rate limit dépassé</p>
              <p><code className="bg-muted px-1.5 rounded">500</code> — Erreur serveur</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
