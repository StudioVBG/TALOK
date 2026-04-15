"use client";

import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CoreShellHeaderProps {
  title: string;
  description: string;
  roleLabel?: string;
  mobileBrand?: string;
  isDetailPage?: boolean;
  onBack?: () => void;
  rightContent?: ReactNode;
  className?: string;
}

export function CoreShellHeader({
  title,
  description,
  roleLabel,
  mobileBrand = "Talok",
  isDetailPage = false,
  onBack,
  rightContent,
  className,
}: CoreShellHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-background/95 px-3 shadow-sm backdrop-blur-sm xs:px-4 sm:px-6 lg:px-8",
        className,
      )}
    >
      <div className="flex min-h-16 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {isDetailPage && onBack ? (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden"
              onClick={onBack}
              aria-label="Retour"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          ) : null}

          <img
            src="/images/talok-logo-horizontal.png"
            alt={mobileBrand}
            className="h-8 w-auto object-contain md:hidden"
          />

          <div className="hidden min-w-0 md:block">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold text-foreground lg:text-lg">{title}</h2>
              {roleLabel ? (
                <Badge variant="secondary" className="hidden text-xs sm:inline-flex">
                  {roleLabel}
                </Badge>
              ) : null}
            </div>
            <p className="hidden truncate text-xs text-muted-foreground lg:block">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">{rightContent}</div>
      </div>
    </header>
  );
}
