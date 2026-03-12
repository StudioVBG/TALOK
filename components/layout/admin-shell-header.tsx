"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoreShellHeader } from "@/components/layout/core-shell-header";
import { getCoreShellMetadata } from "@/lib/navigation/core-shell-metadata";

const ADMIN_TITLES: Array<{ pattern: string; title: string }> = [
  { pattern: "/admin/dashboard", title: "Tableau de bord" },
  { pattern: "/admin/reports", title: "Rapports" },
  { pattern: "/admin/people", title: "Annuaire" },
  { pattern: "/admin/tenants", title: "Locataires" },
  { pattern: "/admin/properties", title: "Parc immobilier" },
  { pattern: "/admin/moderation", title: "Modération IA" },
  { pattern: "/admin/compliance", title: "Documents & conformité" },
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

  return (
    <CoreShellHeader
      title={metadata.title}
      description={metadata.description}
      roleLabel={metadata.roleLabel}
      isDetailPage={isDetailPage}
      onBack={() => router.back()}
      rightContent={
        <Button variant="outline" size="sm" asChild className="hidden xl:flex">
          <Link href="/admin/reports">
            <BarChart3 className="mr-2 h-4 w-4" />
            Rapports
          </Link>
        </Button>
      }
    />
  );
}
