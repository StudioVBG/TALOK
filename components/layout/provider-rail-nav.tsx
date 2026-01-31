"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface ProviderRailNavProps {
  navigation: NavItem[];
  secondaryNav: NavItem[];
}

export function ProviderRailNav({ navigation, secondaryNav }: ProviderRailNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="hidden md:flex lg:hidden fixed inset-y-0 left-0 z-50 w-16 flex-col bg-white dark:bg-card border-r border-slate-200 dark:border-border">
        {/* Logo compact */}
        <div className="flex h-14 shrink-0 items-center justify-center border-b border-slate-200 dark:border-border">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
        </div>

        {/* Main navigation */}
        <nav className="flex flex-1 flex-col items-center gap-1 py-3 overflow-y-auto">
          {navigation.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 touch-target",
                      active
                        ? "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 shadow-sm"
                        : "text-slate-500 dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-muted hover:text-slate-900 dark:hover:text-foreground"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.name}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Secondary navigation */}
        <div className="flex flex-col items-center gap-1 py-3 border-t border-slate-200 dark:border-border">
          {secondaryNav.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-lg transition-colors touch-target",
                      active
                        ? "bg-slate-100 dark:bg-muted text-slate-900 dark:text-foreground"
                        : "text-slate-500 dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-muted hover:text-slate-900 dark:hover:text-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {item.name}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </aside>
    </TooltipProvider>
  );
}
