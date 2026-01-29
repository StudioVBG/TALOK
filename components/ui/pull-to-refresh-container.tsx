"use client";

import { useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { usePullToRefresh } from "@/lib/hooks/use-pull-to-refresh";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshContainerProps {
  children: ReactNode;
  /** Custom refresh handler. Defaults to router.refresh() for server components. */
  onRefresh?: () => Promise<void>;
  /** Whether pull-to-refresh is enabled (default: true) */
  enabled?: boolean;
  /** Additional className for the container */
  className?: string;
}

/**
 * Client wrapper that adds pull-to-refresh gesture to any page content.
 * On mobile, pulling down triggers a data refresh.
 * For server components, it calls router.refresh() by default.
 *
 * @example
 * ```tsx
 * // In a server component page:
 * <PullToRefreshContainer>
 *   <MyServerContent />
 * </PullToRefreshContainer>
 *
 * // With custom refetch:
 * <PullToRefreshContainer onRefresh={async () => { await refetch(); }}>
 *   <MyClientContent />
 * </PullToRefreshContainer>
 * ```
 */
export function PullToRefreshContainer({
  children,
  onRefresh,
  enabled = true,
  className,
}: PullToRefreshContainerProps) {
  const router = useRouter();

  const defaultRefresh = useCallback(async () => {
    router.refresh();
    // Small delay to let Next.js re-fetch server data
    await new Promise((resolve) => setTimeout(resolve, 800));
  }, [router]);

  const { isRefreshing, pullDistance, pullProgress, containerRef, containerProps } =
    usePullToRefresh({
      onRefresh: onRefresh || defaultRefresh,
      enabled,
    });

  return (
    <div
      ref={containerRef}
      {...containerProps}
      className={cn("relative min-h-0", className)}
    >
      {/* Pull indicator - only visible on mobile during pull gesture */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="flex items-center justify-center pointer-events-none lg:hidden"
          style={{
            height: pullDistance > 0 ? pullDistance : 40,
            transition: isRefreshing ? "height 0.2s ease" : "none",
          }}
        >
          <div
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full bg-background border shadow-sm",
              isRefreshing && "animate-spin"
            )}
            style={{
              opacity: isRefreshing ? 1 : pullProgress,
              transform: `rotate(${pullProgress * 360}deg)`,
            }}
          >
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
