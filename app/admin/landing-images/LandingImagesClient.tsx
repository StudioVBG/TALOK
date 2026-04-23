"use client";

import { useState, useRef } from "react";
import { fetchWithCsrf } from "@/lib/security/csrf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Link as LinkIcon, Loader2 } from "lucide-react";

export interface SiteConfigEntry {
  key: string;
  value: string | null;
  label: string | null;
  section: string | null;
  updated_at: string | null;
}

interface Props {
  configs: SiteConfigEntry[];
}

function groupBySection(configs: SiteConfigEntry[]) {
  const groups: Record<string, SiteConfigEntry[]> = {};
  for (const c of configs) {
    const section = c.section ?? "Autre";
    if (!groups[section]) groups[section] = [];
    groups[section].push(c);
  }
  return groups;
}

function ImageCard({ config, onUpdated }: { config: SiteConfigEntry; onUpdated: (key: string, value: string) => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [preview, setPreview] = useState(config.value ?? "");

  async function handleFileUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Erreur", description: "Seules les images sont acceptées", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Erreur", description: "Taille maximale : 5 Mo", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("key", config.key);

      const res = await fetchWithCsrf("/api/admin/landing-images/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setPreview(json.url);
      onUpdated(config.key, json.url);
      toast({ title: "Image mise à jour" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleUrlSave() {
    if (!urlInput.trim()) return;

    setSavingUrl(true);
    try {
      const res = await fetchWithCsrf("/api/admin/site-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: config.key, value: urlInput.trim() }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setPreview(urlInput.trim());
      setUrlInput("");
      onUpdated(config.key, urlInput.trim());
      toast({ title: "URL mise à jour" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSavingUrl(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <Label className="text-sm font-medium">{config.label ?? config.key}</Label>

        {/* Preview */}
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={config.label ?? config.key}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Aucune image
            </div>
          )}
        </div>

        {/* Upload button */}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {uploading ? "Upload…" : "Uploader"}
          </Button>
        </div>

        {/* URL input */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Ou coller une URL d'image…"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUrlSave();
              }}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUrlSave}
            disabled={savingUrl || !urlInput.trim()}
          >
            {savingUrl ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LinkIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function LandingImagesClient({ configs }: Props) {
  const [items, setItems] = useState(configs);
  const groups = groupBySection(items);

  function handleUpdated(key: string, value: string) {
    setItems((prev) =>
      prev.map((c) => (c.key === key ? { ...c, value } : c))
    );
  }

  return (
    <div className="space-y-8">
      {Object.entries(groups).map(([section, entries]) => (
        <div key={section}>
          <h2 className="text-lg font-semibold mb-4">{section}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((config) => (
              <ImageCard
                key={config.key}
                config={config}
                onUpdated={handleUpdated}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
