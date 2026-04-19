"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, User, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CoreShellHeader } from "@/components/layout/core-shell-header";
import { getCoreShellMetadata } from "@/lib/navigation/core-shell-metadata";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSignOut } from "@/lib/hooks/use-sign-out";
import { buildAvatarUrl, formatFullName } from "@/lib/helpers/format";
import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";

const ADMIN_TITLES: Array<{ pattern: string; title: string }> = [
  { pattern: "/admin/dashboard", title: "Tableau de bord" },
  { pattern: "/admin/reports", title: "Rapports" },
  { pattern: "/admin/people", title: "Annuaire" },
  { pattern: "/admin/properties", title: "Parc immobilier" },
  { pattern: "/admin/moderation", title: "Moderation IA" },
  { pattern: "/admin/compliance", title: "Conformité prestataires" },
  { pattern: "/admin/audit-logs", title: "Journal d'audit" },
];

function getAdminTitle(pathname: string) {
  return (
    ADMIN_TITLES.find((entry) => pathname === entry.pattern || pathname.startsWith(`${entry.pattern}/`))
      ?.title || "Administration"
  );
}

export function AdminShellHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const title = getAdminTitle(pathname);
  const metadata = getCoreShellMetadata({
    role: "admin",
    pathname,
    fallbackTitle: title,
  });
  const isDetailPage = pathname.split("/").filter(Boolean).length > 2;
  const { user, profile } = useAuth();
  const { signOut: handleSignOut, isLoading: isSigningOut } = useSignOut({ redirectTo: "/login" });

  const getInitials = () => {
    if (profile?.prenom && profile?.nom) {
      return `${profile.prenom[0]}${profile.nom[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "A";
  };

  return (
    <CoreShellHeader
      title={metadata.title}
      description={metadata.description}
      roleLabel={metadata.roleLabel}
      isDetailPage={isDetailPage}
      onBack={() => router.back()}
      rightContent={
        <div className="flex items-center gap-2">
          <AdminNotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={buildAvatarUrl(profile?.avatar_url) || undefined} />
                  <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm font-medium truncate max-w-[120px]">
                  {formatFullName(profile?.prenom || null, profile?.nom || null) || user?.email || "Admin"}
                </span>
                <ChevronDown className="h-4 w-4 hidden sm:block opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {formatFullName(profile?.prenom || null, profile?.nom || null) || "Administrateur"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link href="/profile">
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  Mon profil
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-500 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {isSigningOut ? "Deconnexion..." : "Deconnexion"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    />
  );
}
