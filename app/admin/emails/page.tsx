export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminEmailsClient } from "./AdminEmailsClient";

export const metadata = {
  title: "Templates d'Emails | Administration",
  description: "Visualiser et gérer tous les templates d'emails envoyés par Talok",
};

function EmailsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="h-8 w-64 bg-slate-200 rounded animate-pulse" />
      <div className="flex gap-4">
        <div className="h-10 w-72 bg-slate-200 rounded animate-pulse" />
        <div className="h-10 w-48 bg-slate-200 rounded animate-pulse" />
      </div>
      <div className="flex gap-6 h-[600px]">
        <div className="w-96 bg-slate-100 rounded-xl animate-pulse" />
        <div className="flex-1 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

export default async function AdminEmailsPage() {
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
    <Suspense fallback={<EmailsSkeleton />}>
      <AdminEmailsClient />
    </Suspense>
  );
}
