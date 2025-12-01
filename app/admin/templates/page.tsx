import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TemplatesClient } from "./TemplatesClient";
import { TemplatesSkeleton } from "./loading";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Templates de Bail | Administration",
  description: "Gérer les templates de contrats de location conformes à la loi ALUR",
};

async function fetchTemplates() {
  const supabase = await createClient();
  
  const { data: templates, error } = await supabase
    .from("lease_templates")
    .select("*")
    .order("type_bail", { ascending: true });

  if (error) {
    console.error("Erreur fetch templates:", error);
    return [];
  }

  return templates || [];
}

async function TemplatesContent() {
  const templates = await fetchTemplates();
  return <TemplatesClient templates={templates} />;
}

export default async function AdminTemplatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  // Vérifier le rôle admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <Suspense fallback={<TemplatesSkeleton />}>
      <TemplatesContent />
    </Suspense>
  );
}

