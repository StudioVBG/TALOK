export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerProfile } from "@/lib/helpers/auth-helper";
import { getRoleDashboardUrl } from "@/lib/helpers/role-redirects";
import CsrfTokenInjector from "@/components/security/CsrfTokenInjector";

import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { ErrorBoundary } from "@/components/error-boundary";
import { OfflineIndicator } from "@/components/ui/offline-indicator";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { AdminKeyboardShortcuts } from "@/components/admin/admin-keyboard-shortcuts";
import { AdminShellHeader } from "@/components/layout/admin-shell-header";

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

  return (
    <ErrorBoundary>
      <CsrfTokenInjector />
      {/* Offline indicator - visible when device loses connectivity */}
      <OfflineIndicator />
      {/* Bannière d'impersonation (visible si session active) */}
      <ImpersonationBanner />
      <AdminKeyboardShortcuts />
      {/* Skip to content - accessibility */}
      <a
        href="#admin-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
      >
        Aller au contenu principal
      </a>
      <div className="flex min-h-screen mesh-gradient">
        <AdminSidebar />
        <main className="flex-1 pl-14 lg:pl-64 transition-all duration-200" id="admin-main-content">
          <AdminShellHeader />
          <div className="container mx-auto max-w-7xl px-4 py-6 lg:px-8">
            <Breadcrumb homeHref="/admin/dashboard" className="mb-4" />
            {children}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
