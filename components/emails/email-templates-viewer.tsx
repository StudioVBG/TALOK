"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Eye,
  Code,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  X,
  Smartphone,
  Monitor,
  Tablet,
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

// Types
export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  category: EmailCategory;
  subject: string;
  html: string;
  variables: string[];
  previewData?: Record<string, any>;
}

export type EmailCategory =
  | "onboarding"
  | "payment"
  | "lease"
  | "maintenance"
  | "visit"
  | "notification"
  | "legal"
  | "account";

export const CATEGORY_LABELS: Record<EmailCategory, { label: string; color: string; icon: string }> = {
  onboarding: { label: "Onboarding", color: "bg-blue-100 text-blue-700", icon: "🚀" },
  payment: { label: "Paiements", color: "bg-green-100 text-green-700", icon: "💳" },
  lease: { label: "Baux", color: "bg-purple-100 text-purple-700", icon: "📝" },
  maintenance: { label: "Maintenance", color: "bg-orange-100 text-orange-700", icon: "🔧" },
  visit: { label: "Visites", color: "bg-pink-100 text-pink-700", icon: "📅" },
  notification: { label: "Notifications", color: "bg-yellow-100 text-yellow-700", icon: "🔔" },
  legal: { label: "Légal", color: "bg-red-100 text-red-700", icon: "⚖️" },
  account: { label: "Compte", color: "bg-gray-100 text-gray-700", icon: "👤" },
};

// Composant carte de template
function TemplateCard({
  template,
  isSelected,
  onClick,
}: {
  template: EmailTemplate;
  isSelected: boolean;
  onClick: () => void;
}) {
  const category = CATEGORY_LABELS[template.category];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md",
        isSelected
          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20"
          : "border-slate-200 bg-white hover:border-slate-300"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{category.icon}</span>
            <h3 className="font-semibold text-slate-900 truncate">{template.name}</h3>
          </div>
          <p className="text-sm text-slate-500 line-clamp-2">{template.description}</p>
        </div>
        <Badge className={cn("shrink-0", category.color)}>{category.label}</Badge>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
        <Mail className="w-3 h-3" />
        <span className="truncate">{template.subject}</span>
      </div>

      {template.variables.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {template.variables.slice(0, 3).map((v) => (
            <span
              key={v}
              className="px-1.5 py-0.5 rounded bg-slate-100 text-xs text-slate-600 font-mono"
            >
              {`{{${v}}}`}
            </span>
          ))}
          {template.variables.length > 3 && (
            <span className="px-1.5 py-0.5 text-xs text-slate-400">
              +{template.variables.length - 3}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

// Composant prévisualisation
function EmailPreviewPane({
  template,
  onClose,
}: {
  template: EmailTemplate | null;
  onClose: () => void;
}) {
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [deviceSize, setDeviceSize] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    if (!template) return;
    await navigator.clipboard.writeText(template.html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const deviceWidths = {
    desktop: "100%",
    tablet: "768px",
    mobile: "375px",
  };

  if (!template) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
        <div className="text-center p-8">
          <Mail className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="font-medium text-slate-600 mb-2">Sélectionnez un template</h3>
          <p className="text-sm text-slate-400">
            Cliquez sur un template pour voir son aperçu
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{CATEGORY_LABELS[template.category].icon}</span>
          <div>
            <h2 className="font-semibold text-slate-900">{template.name}</h2>
            <p className="text-sm text-slate-500">{template.subject}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Device size toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100">
            <button
              onClick={() => setDeviceSize("desktop")}
              className={cn(
                "p-1.5 rounded",
                deviceSize === "desktop" ? "bg-white shadow-sm" : "hover:bg-slate-200"
              )}
              title="Desktop"
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeviceSize("tablet")}
              className={cn(
                "p-1.5 rounded",
                deviceSize === "tablet" ? "bg-white shadow-sm" : "hover:bg-slate-200"
              )}
              title="Tablet"
            >
              <Tablet className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeviceSize("mobile")}
              className={cn(
                "p-1.5 rounded",
                deviceSize === "mobile" ? "bg-white shadow-sm" : "hover:bg-slate-200"
              )}
              title="Mobile"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>

          {/* View mode toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList className="h-9">
              <TabsTrigger value="preview" className="text-xs">
                <Eye className="w-3 h-3 mr-1" />
                Aperçu
              </TabsTrigger>
              <TabsTrigger value="code" className="text-xs">
                <Code className="w-3 h-3 mr-1" />
                HTML
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Copy button */}
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-1 text-green-600" />
                Copié
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" />
                Copier
              </>
            )}
          </Button>

          {/* Close button */}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 bg-slate-100">
        {viewMode === "preview" ? (
          <div
            className="mx-auto bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-300"
            style={{ maxWidth: deviceWidths[deviceSize] }}
          >
            <iframe
              srcDoc={template.html}
              className="w-full border-0"
              style={{ minHeight: "600px" }}
              title={template.name}
            />
          </div>
        ) : (
          <div className="bg-slate-900 rounded-lg p-4 overflow-auto">
            <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap">
              {template.html}
            </pre>
          </div>
        )}
      </div>

      {/* Variables footer */}
      {template.variables.length > 0 && (
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <h4 className="text-xs font-medium text-slate-500 uppercase mb-2">
            Variables disponibles
          </h4>
          <div className="flex flex-wrap gap-2">
            {template.variables.map((v) => (
              <code
                key={v}
                className="px-2 py-1 rounded bg-slate-200 text-xs text-slate-700 font-mono"
              >
                {`{{${v}}}`}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Composant principal
interface EmailTemplatesViewerProps {
  templates: EmailTemplate[];
  title?: string;
  showFilters?: boolean;
  className?: string;
}

export function EmailTemplatesViewer({
  templates,
  title = "Templates d'Emails",
  showFilters = true,
  className,
}: EmailTemplatesViewerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<EmailCategory | "all">("all");
  const [isListCollapsed, setIsListCollapsed] = useState(false);

  // Filtrer les templates
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      searchQuery === "" ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.subject.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || template.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Grouper par catégorie
  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<EmailCategory, EmailTemplate[]>);

  const categories = Object.keys(groupedTemplates) as EmailCategory[];

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {templates.length} templates disponibles
          </p>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Rechercher un template..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as EmailCategory | "all")}
          >
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([key, { label, icon }]) => (
                <SelectItem key={key} value={key}>
                  <span className="mr-2">{icon}</span>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Templates list */}
        <AnimatePresence mode="wait">
          <motion.div
            animate={{ width: isListCollapsed ? "60px" : "400px" }}
            className="flex-shrink-0 overflow-hidden"
          >
            {isListCollapsed ? (
              <Button
                variant="ghost"
                className="w-full h-full"
                onClick={() => setIsListCollapsed(false)}
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            ) : (
              <div className="h-full flex flex-col bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between p-3 border-b border-slate-200">
                  <span className="text-sm font-medium text-slate-700">
                    {filteredTemplates.length} templates
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setIsListCollapsed(true)}
                  >
                    <ChevronDown className="w-4 h-4 rotate-90" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                  {categories.map((category) => (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span>{CATEGORY_LABELS[category].icon}</span>
                        <span className="text-sm font-medium text-slate-600">
                          {CATEGORY_LABELS[category].label}
                        </span>
                        <span className="text-xs text-slate-400">
                          ({groupedTemplates[category].length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {groupedTemplates[category].map((template) => (
                          <TemplateCard
                            key={template.id}
                            template={template}
                            isSelected={selectedTemplate?.id === template.id}
                            onClick={() => setSelectedTemplate(template)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  {filteredTemplates.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Aucun template trouvé</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Preview pane */}
        <EmailPreviewPane
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
        />
      </div>
    </div>
  );
}

export default EmailTemplatesViewer;
