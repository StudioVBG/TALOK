export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerProfile } from "@/lib/helpers/auth-helper";
import { getRoleDashboardUrl } from "@/lib/helpers/role-redirects";
import CsrfTokenInjector from "@/components/security/CsrfTokenInjector";
import { AdminDataProvider } from "./_data/AdminDataProvider";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { ErrorBoundary } from "@/components/error-boundary";
import { OfflineIndicator } from "@/components/ui/offline-indicator";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";

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

  // Récupérer le profil (avec fallback service role en cas de récursion RLS)
  const { profile } = await getServerProfile<{ id: string; role: string }>(
    user.id,
    "id, role"
  );

  if (!profile || (profile.role !== "admin" && profile.role !== "platform_admin")) {
    redirect(getRoleDashboardUrl(profile?.role));
  }

  // On ne charge plus les stats ici pour éviter de bloquer la navigation globale.
  // Chaque page chargera ses données via loading.tsx (Streaming)

  return (
    <ErrorBoundary>
      <CsrfTokenInjector />
      <AdminDataProvider stats={null}>
        {/* Offline indicator - visible when device loses connectivity */}
        <OfflineIndicator />
        {/* Bannière d'impersonation (visible si session active) */}
        <ImpersonationBanner />
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
