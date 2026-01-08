"use client";
// @ts-nocheck

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { 
  Plus, Key, RotateCcw, Trash2, Eye, EyeOff, CheckCircle, XCircle, 
  Mail, Send, ExternalLink, AlertCircle, Loader2, CreditCard, 
  MessageSquare, FileSignature, Shield, MapPin, Settings, TestTube,
  ChevronRight
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";

// Types
interface Provider {
  id: string;
  name: string;
  category: string;
  pricing_model: string;
  status: string;
  metadata: {
    free_quota?: number;
    daily_limit?: number;
    docs?: string;
    test_address?: string;
  };
  is_configured: boolean;
  active_env: string | null;
  credentials: {
    id: string;
    name: string;
    env: string;
    is_active: boolean;
    config: Record<string, string>;
    created_at: string;
    rotated_at: string | null;
  }[];
}

interface ProvidersByCategory {
  [category: string]: Provider[];
}

// Icônes par catégorie
const categoryIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-5 w-5" />,
  payment: <CreditCard className="h-5 w-5" />,
  sms: <MessageSquare className="h-5 w-5" />,
  signature: <FileSignature className="h-5 w-5" />,
  kyc: <Shield className="h-5 w-5" />,
  maps: <MapPin className="h-5 w-5" />,
};

// Labels des catégories
const categoryLabels: Record<string, string> = {
  email: "📧 Email",
  payment: "💳 Paiement",
  sms: "📱 SMS",
  signature: "✍️ Signature électronique",
  kyc: "🔒 Vérification d'identité",
  maps: "🗺️ Cartographie",
};

// Couleurs des catégories
const categoryColors: Record<string, string> = {
  email: "from-blue-500 to-indigo-600",
  payment: "from-emerald-500 to-teal-600",
  sms: "from-purple-500 to-pink-600",
  signature: "from-amber-500 to-orange-600",
  kyc: "from-red-500 to-rose-600",
  maps: "from-cyan-500 to-sky-600",
};

// Configuration des champs par provider
const providerFields: Record<string, { key: string; label: string; type: string; placeholder: string; required?: boolean }[]> = {
  Resend: [
    { key: "api_key", label: "Clé API Resend", type: "password", placeholder: "re_xxxxxxxxxx", required: true },
    { key: "email_from", label: "Adresse d'envoi", type: "text", placeholder: "Talok <contact@domaine.com>" },
  ],
  Stripe: [
    { key: "api_key", label: "Clé secrète Stripe", type: "password", placeholder: "sk_live_xxxxxxxxxx", required: true },
    { key: "webhook_secret", label: "Secret Webhook", type: "password", placeholder: "whsec_xxxxxxxxxx" },
  ],
  Twilio: [
    { key: "api_key", label: "Auth Token", type: "password", placeholder: "xxxxxxxxxxxxxxxxxx", required: true },
    { key: "account_sid", label: "Account SID", type: "text", placeholder: "ACxxxxxxxxxx", required: true },
    { key: "phone_number", label: "Numéro d'envoi", type: "text", placeholder: "+33600000000" },
  ],
  Yousign: [
    { key: "api_key", label: "Clé API Yousign", type: "password", placeholder: "xxxxxxxxxx", required: true },
  ],
  Veriff: [
    { key: "api_key", label: "Clé API Veriff", type: "password", placeholder: "xxxxxxxxxx", required: true },
    { key: "api_secret", label: "Secret API", type: "password", placeholder: "xxxxxxxxxx", required: true },
  ],
  "Google Maps": [
    { key: "api_key", label: "Clé API Google Maps", type: "password", placeholder: "AIzaxxxxxxxxxx", required: true },
  ],
  GoCardless: [
    { key: "api_key", label: "Access Token", type: "password", placeholder: "xxxxxxxxxx", required: true },
  ],
  Brevo: [
    { key: "api_key", label: "Clé API Brevo", type: "password", placeholder: "xkeysib-xxxxxxxxxx", required: true },
    { key: "email_from", label: "Adresse d'envoi", type: "text", placeholder: "contact@domaine.com" },
  ],
};

export default function AdminIntegrationsPage() {
  const { toast } = useToast();
  const supabase = createClient();
  
  // États
  const [providers, setProviders] = useState<Provider[]>([]);
  const [byCategory, setByCategory] = useState<ProvidersByCategory>({});
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [selectedEnv, setSelectedEnv] = useState<string>("prod");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Fetch avec authentification
  const fetchWithAuth = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(init?.headers);
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
    return fetch(input, { ...init, credentials: "include", headers });
  }, [supabase]);

  // Charger les données
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth("/api/admin/integrations/providers");
      
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers || []);
        setByCategory(data.byCategory || {});
      } else {
        const error = await response.json();
        throw new Error(error.error || "Erreur de chargement");
      }
    } catch (error: any) {
      console.error("Erreur chargement:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de charger les intégrations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Ouvrir le popup de configuration
  const openConfigDialog = (provider: Provider) => {
    setSelectedProvider(provider);
    setFormData({});
    
    // Pré-remplir avec la config existante si disponible
    const existingCredential = provider.credentials?.find(c => c.is_active);
    if (existingCredential?.config) {
      setFormData(existingCredential.config);
      setSelectedEnv(existingCredential.env);
    }
    
    setConfigDialogOpen(true);
  };

  // Sauvegarder la configuration
  const handleSaveConfig = async () => {
    if (!selectedProvider) return;

    const fields = providerFields[selectedProvider.name] || [];
    const apiKeyField = fields.find(f => f.key === "api_key");
    
    if (apiKeyField?.required && !formData.api_key) {
      toast({
        title: "Erreur",
        description: "La clé API est requise",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Préparer le config (sans la clé API)
      const config: Record<string, string> = {};
      fields.forEach(field => {
        if (field.key !== "api_key" && formData[field.key]) {
          config[field.key] = formData[field.key];
        }
      });

      const response = await fetchWithAuth("/api/admin/integrations/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: selectedProvider.id,
          api_key: formData.api_key,
          config,
          env: selectedEnv,
          name: `${selectedProvider.name} - ${selectedEnv}`,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "✅ Configuration enregistrée",
          description: result.message,
        });
        setConfigDialogOpen(false);
        fetchData();
      } else {
        const error = await response.json();
        throw new Error(error.error);
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Tester la connexion
  const handleTestConnection = async () => {
    if (!selectedProvider) return;

    setTesting(true);
    try {
      const response = await fetchWithAuth(`/api/admin/integrations/providers/${selectedProvider.id}/test`, {
        method: "POST",
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "✅ Test réussi",
          description: result.message,
        });
      } else {
        toast({
          title: "❌ Test échoué",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de tester la connexion",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  // Rendu d'une carte provider
  const renderProviderCard = (provider: Provider) => {
    const isConfigured = provider.is_configured;
    const metadata = provider.metadata || {};

    return (
      <Card 
        key={provider.id}
        className={`relative overflow-hidden transition-all hover:shadow-md cursor-pointer ${
          isConfigured ? "border-green-200 bg-green-50/30" : "border-slate-200"
        }`}
        onClick={() => openConfigDialog(provider)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg">{provider.name}</h3>
                {isConfigured ? (
                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Configuré
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-slate-100 text-slate-600">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Non configuré
                  </Badge>
                )}
              </div>
              
              {/* Info quota gratuit */}
              {metadata.free_quota && (
                <p className="text-sm text-slate-600">
                  {metadata.free_quota.toLocaleString()} / mois gratuits
                </p>
              )}
              
              {/* Environnement actif */}
              {provider.active_env && (
                <p className="text-xs text-slate-500 mt-1">
                  Env: <span className="font-medium">{provider.active_env}</span>
                </p>
              )}
            </div>
            
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </div>
        </CardContent>
      </Card>
    );
  };

  // Rendu du formulaire de configuration
  const renderConfigForm = () => {
    if (!selectedProvider) return null;

    const fields = providerFields[selectedProvider.name] || [
      { key: "api_key", label: "Clé API", type: "password", placeholder: "Entrez votre clé API", required: true },
    ];
    const metadata = selectedProvider.metadata || {};

    return (
      <div className="space-y-6">
        {/* Info provider */}
        <div className={`p-4 rounded-lg bg-gradient-to-r ${categoryColors[selectedProvider.category] || "from-slate-500 to-slate-600"} text-white`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              {categoryIcons[selectedProvider.category] || <Settings className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-lg">{selectedProvider.name}</h3>
              <p className="text-sm text-white/80">
                {categoryLabels[selectedProvider.category] || selectedProvider.category}
              </p>
            </div>
          </div>
        </div>

        {/* Quota gratuit si disponible */}
        {metadata.free_quota && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-sm text-blue-800">
              💡 <strong>Plan gratuit :</strong> {metadata.free_quota.toLocaleString()} requêtes/mois
              {metadata.daily_limit && ` (${metadata.daily_limit}/jour max)`}
            </p>
            {metadata.docs && (
              <a 
                href={metadata.docs} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
              >
                Documentation <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {/* Environnement */}
        <div>
          <Label>Environnement</Label>
          <Select value={selectedEnv} onValueChange={setSelectedEnv}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prod">🟢 Production</SelectItem>
              <SelectItem value="dev">🟡 Développement</SelectItem>
              <SelectItem value="stage">🟠 Staging</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Champs de configuration */}
        {fields.map((field) => (
          <div key={field.key}>
            <Label className="flex items-center gap-1">
              {field.label}
              {field.required && <span className="text-red-500">*</span>}
            </Label>
            <div className="relative mt-1">
              <Input
                type={field.type}
                placeholder={field.placeholder}
                value={formData[field.key] || ""}
                onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                className="pr-10"
              />
              {field.type === "password" && formData[field.key] && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => {
                    const input = document.querySelector(`input[placeholder="${field.placeholder}"]`) as HTMLInputElement;
                    if (input) {
                      input.type = input.type === "password" ? "text" : "password";
                    }
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}

        {/* Adresse de test pour email */}
        {selectedProvider.category === "email" && metadata.test_address && (
          <p className="text-xs text-slate-500">
            💡 Pour les tests, utilisez : <code className="bg-slate-100 px-1 rounded">{metadata.test_address}</code>
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
          Intégrations & API
        </h1>
        <p className="text-muted-foreground mt-2">
          Configurez les services externes : email, paiement, signature, SMS...
        </p>
      </div>

      {/* Chargement */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : (
        /* Grille par catégorie */
        <div className="space-y-8">
          {Object.entries(byCategory).map(([category, categoryProviders]) => (
            <div key={category}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                {categoryIcons[category]}
                {categoryLabels[category] || category}
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categoryProviders.map(renderProviderCard)}
              </div>
            </div>
          ))}

          {/* Message si aucun provider */}
          {Object.keys(byCategory).length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Aucun fournisseur API configuré.
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Exécutez la migration SQL pour ajouter les providers.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Dialog de configuration */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurer {selectedProvider?.name}
            </DialogTitle>
            <DialogDescription>
              Entrez vos identifiants pour connecter ce service
            </DialogDescription>
          </DialogHeader>

          {renderConfigForm()}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedProvider?.is_configured && (
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing}
                className="w-full sm:w-auto"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Tester la connexion
              </Button>
            )}
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => setConfigDialogOpen(false)}
                className="flex-1 sm:flex-none"
              >
                Annuler
              </Button>
              <Button
                onClick={handleSaveConfig}
                disabled={saving}
                className="flex-1 sm:flex-none"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Enregistrer
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
