"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Mail,
  Search,
  ChevronRight,
  Eye,
  Code,
  Save,
  Send,
  History,
  Power,
  PowerOff,
  Clock,
  Copy,
  Check,
  Monitor,
  Smartphone,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Types
interface AvailableVariable {
  key: string;
  label: string;
  example: string;
}

interface EmailTemplate {
  id: string;
  slug: string;
  category: string;
  name: string;
  description: string | null;
  subject: string;
  body_html: string;
  body_text: string;
  available_variables: AvailableVariable[];
  is_active: boolean;
  send_delay_minutes: number;
  created_at: string;
  updated_at: string;
}

interface TemplateVersion {
  id: string;
  template_id: string;
  subject: string;
  body_html: string;
  body_text: string;
  modified_by: string | null;
  created_at: string;
}

// Category config
const CATEGORIES: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  auth: { label: "Authentification", color: "bg-blue-100 text-blue-700", icon: "🔐" },
  invitation: { label: "Invitations & Onboarding", color: "bg-indigo-100 text-indigo-700", icon: "👤" },
  lease: { label: "Baux", color: "bg-purple-100 text-purple-700", icon: "🏠" },
  payment: { label: "Paiements & Loyers", color: "bg-green-100 text-green-700", icon: "💰" },
  document: { label: "Documents & Quittances", color: "bg-amber-100 text-amber-700", icon: "📄" },
  edl: { label: "États des lieux", color: "bg-cyan-100 text-cyan-700", icon: "🔍" },
  incident: { label: "Incidents & Interventions", color: "bg-orange-100 text-orange-700", icon: "🔧" },
  subscription: { label: "Abonnement Talok", color: "bg-pink-100 text-pink-700", icon: "💳" },
  messaging: { label: "Messagerie", color: "bg-yellow-100 text-yellow-700", icon: "💬" },
  report: { label: "Rapports", color: "bg-slate-100 text-slate-700", icon: "📊" },
};

// Simple template renderer for preview
function renderPreview(template: string, variables: AvailableVariable[]): string {
  let result = template;
  for (const v of variables) {
    result = result.replace(
      new RegExp(`\\{\\{${v.key}\\}\\}`, "g"),
      v.example
    );
  }
  return result;
}

export function EmailTemplatesManager({
  initialTemplates,
}: {
  initialTemplates: EmailTemplate[];
}) {
  const [templates, setTemplates] = useState<EmailTemplate[]>(initialTemplates);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialTemplates[0]?.id || null
  );
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editTab, setEditTab] = useState("preview");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Editable fields
  const [editSubject, setEditSubject] = useState("");
  const [editHtml, setEditHtml] = useState("");
  const [editText, setEditText] = useState("");
  const [editDelay, setEditDelay] = useState(0);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) || null,
    [templates, selectedId]
  );

  // When selecting a template, load its content into edit fields
  const selectTemplate = useCallback(
    (id: string) => {
      const tpl = templates.find((t) => t.id === id);
      if (tpl) {
        setSelectedId(id);
        setEditSubject(tpl.subject);
        setEditHtml(tpl.body_html);
        setEditText(tpl.body_text);
        setEditDelay(tpl.send_delay_minutes);
        setShowVersions(false);
        setEditTab("preview");
      }
    },
    [templates]
  );

  // Filtered and grouped templates
  const filteredTemplates = useMemo(() => {
    let list = templates;
    if (categoryFilter !== "all") {
      list = list.filter((t) => t.category === categoryFilter);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(s) ||
          t.slug.toLowerCase().includes(s) ||
          (t.description || "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [templates, categoryFilter, search]);

  const groupedTemplates = useMemo(() => {
    const groups: Record<string, EmailTemplate[]> = {};
    for (const t of filteredTemplates) {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    }
    return groups;
  }, [filteredTemplates]);

  // Save template
  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/email-templates/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editSubject,
          body_html: editHtml,
          body_text: editText,
          send_delay_minutes: editDelay,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTemplates((prev) =>
        prev.map((t) => (t.id === selected.id ? data.template : t))
      );
      toast.success("Template sauvegardé");
    } catch (err) {
      toast.error(
        `Erreur : ${err instanceof Error ? err.message : "Sauvegarde échouée"}`
      );
    } finally {
      setSaving(false);
    }
  };

  // Toggle active
  const handleToggleActive = async () => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/admin/email-templates/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !selected.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTemplates((prev) =>
        prev.map((t) => (t.id === selected.id ? data.template : t))
      );
      toast.success(
        data.template.is_active ? "Template activé" : "Template désactivé"
      );
    } catch (err) {
      toast.error("Erreur lors du changement de statut");
    }
  };

  // Send test email
  const handleSendTest = async () => {
    if (!selected) return;
    setSendingTest(true);
    try {
      const res = await fetch(
        `/api/admin/email-templates/${selected.id}/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
    } catch (err) {
      toast.error(
        `Erreur : ${err instanceof Error ? err.message : "Envoi échoué"}`
      );
    } finally {
      setSendingTest(false);
    }
  };

  // Load versions
  const handleLoadVersions = async () => {
    if (!selected) return;
    setShowVersions(true);
    try {
      const res = await fetch(
        `/api/admin/email-templates/${selected.id}/versions`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVersions(data.versions || []);
    } catch {
      toast.error("Erreur lors du chargement des versions");
    }
  };

  // Restore version
  const handleRestoreVersion = (version: TemplateVersion) => {
    setEditSubject(version.subject);
    setEditHtml(version.body_html);
    setEditText(version.body_text);
    setShowVersions(false);
    setEditTab("html");
    toast.info("Version restaurée — sauvegardez pour appliquer");
  };

  // Copy variable
  const handleCopyVar = (key: string) => {
    navigator.clipboard.writeText(`{{${key}}}`);
    setCopiedVar(key);
    setTimeout(() => setCopiedVar(null), 1500);
  };

  // Has unsaved changes
  const hasChanges =
    selected &&
    (editSubject !== selected.subject ||
      editHtml !== selected.body_html ||
      editText !== selected.body_text ||
      editDelay !== selected.send_delay_minutes);

  return (
    <div className="p-6 h-[calc(100vh-80px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Templates Email
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {templates.length} templates — Modifiez le contenu des emails
            envoyés par Talok
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Rechercher un template..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Toutes les catégories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {Object.entries(CATEGORIES).map(([key, cat]) => (
              <SelectItem key={key} value={key}>
                {cat.icon} {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main content */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Sidebar — template list */}
        <div className="w-80 shrink-0 overflow-y-auto border rounded-lg bg-white">
          {Object.entries(groupedTemplates).map(([category, tpls]) => {
            const cat = CATEGORIES[category] || {
              label: category,
              color: "bg-slate-100 text-slate-700",
              icon: "📧",
            };
            return (
              <div key={category}>
                <div className="px-3 py-2 bg-slate-50 border-b sticky top-0 z-10">
                  <span className="text-xs font-semibold text-slate-500 uppercase">
                    {cat.icon} {cat.label} ({tpls.length})
                  </span>
                </div>
                {tpls.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => selectTemplate(tpl.id)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 border-b hover:bg-slate-50 transition-colors flex items-center gap-2",
                      selectedId === tpl.id && "bg-blue-50 border-l-2 border-l-blue-500"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {tpl.name}
                        </span>
                        {!tpl.is_active && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                            Inactif
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 truncate block">
                        {tpl.slug}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                  </button>
                ))}
              </div>
            );
          })}
          {filteredTemplates.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-sm">
              Aucun template trouvé
            </div>
          )}
        </div>

        {/* Editor panel */}
        {selected ? (
          <div className="flex-1 min-w-0 flex flex-col border rounded-lg bg-white overflow-hidden">
            {/* Template header */}
            <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between shrink-0">
              <div>
                <h2 className="font-semibold text-slate-900">{selected.name}</h2>
                <p className="text-xs text-slate-500">
                  {selected.description} — <code className="text-xs">{selected.slug}</code>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleToggleActive}
                  className={cn(
                    selected.is_active
                      ? "text-green-600 hover:text-red-600"
                      : "text-red-600 hover:text-green-600"
                  )}
                >
                  {selected.is_active ? (
                    <Power className="h-4 w-4 mr-1" />
                  ) : (
                    <PowerOff className="h-4 w-4 mr-1" />
                  )}
                  {selected.is_active ? "Actif" : "Inactif"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLoadVersions}
                >
                  <History className="h-4 w-4 mr-1" />
                  Historique
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSendTest}
                  disabled={sendingTest}
                >
                  <Send className="h-4 w-4 mr-1" />
                  {sendingTest ? "Envoi..." : "Tester"}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {saving ? "Sauvegarde..." : "Sauvegarder"}
                </Button>
              </div>
            </div>

            {/* Versions panel */}
            {showVersions && (
              <div className="border-b bg-amber-50 p-3 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-amber-800">
                    Historique des versions
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowVersions(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {versions.length === 0 ? (
                  <p className="text-xs text-amber-600">Aucune version précédente</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {versions.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between bg-white rounded px-3 py-1.5 text-sm"
                      >
                        <span className="text-slate-600">
                          {new Date(v.created_at).toLocaleString("fr-FR")}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => handleRestoreVersion(v)}
                        >
                          Restaurer
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Subject + delay */}
            <div className="px-4 py-3 border-b space-y-2 shrink-0">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">
                  Sujet de l&apos;email
                </label>
                <Input
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="font-medium"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <label className="text-xs text-slate-500">Délai d&apos;envoi :</label>
                  <Input
                    type="number"
                    min={0}
                    value={editDelay}
                    onChange={(e) => setEditDelay(parseInt(e.target.value) || 0)}
                    className="w-20 h-8 text-sm"
                  />
                  <span className="text-xs text-slate-400">minutes (0 = immédiat)</span>
                </div>
              </div>
            </div>

            {/* Variables panel */}
            <div className="px-4 py-2 border-b bg-slate-50 shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-slate-500">
                  Variables :
                </span>
                {selected.available_variables.map((v: AvailableVariable) => (
                  <button
                    key={v.key}
                    onClick={() => handleCopyVar(v.key)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border rounded text-xs text-slate-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    title={`${v.label} — ex: ${v.example}`}
                  >
                    <code>{`{{${v.key}}}`}</code>
                    {copiedVar === v.key ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3 text-slate-300" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabs: preview / html / text */}
            <Tabs
              value={editTab}
              onValueChange={setEditTab}
              className="flex-1 flex flex-col min-h-0"
            >
              <div className="px-4 pt-2 shrink-0 flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="preview">
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Aperçu
                  </TabsTrigger>
                  <TabsTrigger value="html">
                    <Code className="h-3.5 w-3.5 mr-1" />
                    HTML
                  </TabsTrigger>
                  <TabsTrigger value="text">
                    <Mail className="h-3.5 w-3.5 mr-1" />
                    Texte
                  </TabsTrigger>
                </TabsList>
                {editTab === "preview" && (
                  <div className="flex items-center gap-1 border rounded-md p-0.5">
                    <button
                      onClick={() => setPreviewDevice("desktop")}
                      className={cn(
                        "p-1 rounded",
                        previewDevice === "desktop" && "bg-slate-200"
                      )}
                    >
                      <Monitor className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setPreviewDevice("mobile")}
                      className={cn(
                        "p-1 rounded",
                        previewDevice === "mobile" && "bg-slate-200"
                      )}
                    >
                      <Smartphone className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <TabsContent value="preview" className="flex-1 p-4 overflow-auto">
                <div
                  className={cn(
                    "mx-auto bg-white border rounded-lg shadow-sm overflow-auto",
                    previewDevice === "desktop" ? "max-w-2xl" : "max-w-sm"
                  )}
                >
                  <div className="px-4 py-2 border-b bg-slate-50 text-sm text-slate-600">
                    <strong>Sujet :</strong>{" "}
                    {renderPreview(editSubject, selected.available_variables)}
                  </div>
                  <div
                    className="p-6 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: renderPreview(
                        editHtml,
                        selected.available_variables
                      ),
                    }}
                  />
                </div>
              </TabsContent>

              <TabsContent value="html" className="flex-1 p-4 overflow-auto">
                <textarea
                  value={editHtml}
                  onChange={(e) => setEditHtml(e.target.value)}
                  className="w-full h-full min-h-[400px] font-mono text-sm p-4 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  spellCheck={false}
                />
              </TabsContent>

              <TabsContent value="text" className="flex-1 p-4 overflow-auto">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full h-full min-h-[400px] font-mono text-sm p-4 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  spellCheck={false}
                />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center border rounded-lg bg-slate-50">
            <div className="text-center text-slate-400">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Sélectionnez un template pour l&apos;éditer</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
