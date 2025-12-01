import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminDataProvider } from "./_data/AdminDataProvider";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { ErrorBoundary } from "@/components/error-boundary";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    if (profile?.role === "owner") redirect("/app/owner/dashboard");
    if (profile?.role === "tenant") redirect("/app/tenant/dashboard");
    redirect("/");
  }

  // On ne charge plus les stats ici pour éviter de bloquer la navigation globale.
  // Chaque page chargera ses données via loading.tsx (Streaming)

  return (
    <ErrorBoundary>
      <AdminDataProvider stats={null}>
        <div className="flex min-h-screen mesh-gradient">
          <AdminSidebar />
          <main className="flex-1 lg:pl-64 transition-all duration-200">
            <div className="container mx-auto py-6 px-4 lg:px-8 max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </AdminDataProvider>
    </ErrorBoundary>
  );
}
