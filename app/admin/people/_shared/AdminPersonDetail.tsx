"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, Calendar } from "lucide-react";

export interface DetailField {
  label: string;
  value: string | number | null | undefined;
}

export interface DetailSection {
  title: string;
  description?: string;
  fields: DetailField[];
}

interface AdminPersonDetailProps {
  backHref?: string;
  title: string;
  subtitle: string;
  roleLabel: string;
  profile: {
    prenom: string | null;
    nom: string | null;
    email: string | null;
    telephone: string | null;
    created_at: string | null;
  };
  sections: DetailSection[];
}

export function AdminPersonDetail({
  backHref = "/admin/people",
  title,
  subtitle,
  roleLabel,
  profile,
  sections,
}: AdminPersonDetailProps) {
  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{title}</h1>
            <Badge variant="secondary">{roleLabel}</Badge>
          </div>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
          <CardDescription>Coordonnées principales du compte</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{profile.email || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{profile.telephone || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>
              Créé le {profile.created_at ? new Date(profile.created_at).toLocaleDateString("fr-FR") : "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            {section.description && <CardDescription>{section.description}</CardDescription>}
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-2">
            {section.fields.length === 0 ? (
              <p className="text-muted-foreground">Aucune donnée renseignée.</p>
            ) : (
              section.fields.map((field) => (
                <div key={field.label}>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">{field.label}</p>
                  <p className="font-medium">
                    {field.value === null || field.value === undefined || field.value === ""
                      ? "—"
                      : String(field.value)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
