"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SidebarLinkProps {
  href: string;
  icon: ReactNode;
  label: string;
}

export function SidebarLink({ href, icon, label }: SidebarLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <span
        className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}
