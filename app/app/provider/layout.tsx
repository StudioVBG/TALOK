// @ts-nocheck
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, prenom, nom")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "provider") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Vendor-specific layout */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r min-h-screen p-4 hidden md:block">
          <div className="mb-8">
            <h2 className="font-bold text-lg">Espace Prestataire</h2>
            <p className="text-sm text-muted-foreground">
              {profile.prenom} {profile.nom}
            </p>
          </div>
          <nav className="space-y-2">
            <a
              href="/app/provider/dashboard"
              className="block px-4 py-2 rounded-lg hover:bg-gray-100 text-sm font-medium"
            >
              Tableau de bord
            </a>
            <a
              href="/app/provider/jobs"
              className="block px-4 py-2 rounded-lg hover:bg-gray-100 text-sm font-medium"
            >
              Mes missions
            </a>
            <a
              href="/app/provider/invoices"
              className="block px-4 py-2 rounded-lg hover:bg-gray-100 text-sm font-medium"
            >
              Mes factures
            </a>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

