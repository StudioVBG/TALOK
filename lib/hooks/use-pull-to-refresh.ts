"use client";

import { useCallback, useRef, useState, useEffect } from "react";

interface UsePullToRefreshOptions {
  /** Callback to execute on pull-to-refresh */
  onRefresh: () => Promise<void>;
  /** Distance in px to trigger refresh (default: 80) */
  threshold?: number;
  /** Maximum pull distance in px (default: 150) */
  maxPull?: number;
  /** Whether pull-to-refresh is enabled (default: true) */
  enabled?: boolean;
}

interface UsePullToRefreshReturn {
  /** Whether a refresh is currently in progress */
  isRefreshing: boolean;
  /** Current pull distance (0 when not pulling) */
  pullDistance: number;
  /** Progress from 0 to 1 (how close to triggering) */
  pullProgress: number;
  /** Ref to attach to the scrollable container */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Props to spread on the container element */
  containerProps: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

/**
 * Hook for pull-to-refresh gesture on mobile.
 * Attach `containerRef` and spread `containerProps` on the scrollable container.
 *
 * @example
 * ```tsx
 * const { isRefreshing, pullDistance, containerRef, containerProps } = usePullToRefresh({
 *   onRefresh: async () => { await refetch(); },
 * });
 *
 * return (
 *   <div ref={containerRef} {...containerProps}>
 *     {pullDistance > 0 && <PullIndicator distance={pullDistance} />}
 *     {isRefreshing && <Spinner />}
 *     <ListContent />
 *   </div>
 * );
 * ```
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 150,
  enabled = true,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const containerRef = useRef<HTMLDivElement>(null!);
  const startYRef = useRef<number>(0);
  const currentYRef = useRef<number>(0);
  const isPullingRef = useRef(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const pullProgress = Math.min(pullDistance / threshold, 1);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || isRefreshing) return;

      const container = containerRef.current;
      if (!container) return;

      // Only enable pull when scrolled to top
      if (container.scrollTop > 0) return;

      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    },
    [enabled, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPullingRef.current || !enabled || isRefreshing) return;

      currentYRef.current = e.touches[0].clientY;
      const distance = currentYRef.current - startYRef.current;

      if (distance > 0) {
        // Apply rubber-band effect: diminishing returns past threshold
        const dampened = distance > threshold
          ? threshold + (distance - threshold) * 0.3
          : distance;
        const clamped = Math.min(dampened, maxPull);
        setPullDistance(clamped);
      } else {
        setPullDistance(0);
        isPullingRef.current = false;
      }
    },
    [enabled, isRefreshing, threshold, maxPull]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold * 0.5); // Snap to loading position
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  // Reset on unmount
  useEffect(() => {
    return () => {
      isPullingRef.current = false;
    };
  }, []);

  return {
    isRefreshing,
    pullDistance,
    pullProgress,
    containerRef,
    containerProps: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
