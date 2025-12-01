"use client";

import { useEffect, useCallback, useRef, useState } from "react";

/**
 * Hook pour mesurer et optimiser les performances
 */

interface PerformanceMetrics {
  /** Time to First Byte */
  ttfb?: number;
  /** First Contentful Paint */
  fcp?: number;
  /** Largest Contentful Paint */
  lcp?: number;
  /** First Input Delay */
  fid?: number;
  /** Cumulative Layout Shift */
  cls?: number;
  /** Time to Interactive */
  tti?: number;
}

/**
 * Hook pour collecter les métriques Web Vitals
 */
export function useWebVitals(onReport?: (metrics: PerformanceMetrics) => void) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({});

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Collecter les métriques via Performance API
    const collectMetrics = () => {
      const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      
      if (navigationEntry) {
        const ttfb = navigationEntry.responseStart - navigationEntry.requestStart;
        setMetrics(prev => ({ ...prev, ttfb }));
      }

      // Écouter LCP
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        setMetrics(prev => ({ ...prev, lcp: lastEntry.startTime }));
      });
      
      try {
        lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
      } catch (e) {
        // Browser non supporté
      }

      // Écouter FID
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const firstEntry = entries[0] as PerformanceEventTiming;
        if (firstEntry) {
          setMetrics(prev => ({ ...prev, fid: firstEntry.processingStart - firstEntry.startTime }));
        }
      });
      
      try {
        fidObserver.observe({ type: "first-input", buffered: true });
      } catch (e) {
        // Browser non supporté
      }

      // Écouter CLS
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        setMetrics(prev => ({ ...prev, cls: clsValue }));
      });
      
      try {
        clsObserver.observe({ type: "layout-shift", buffered: true });
      } catch (e) {
        // Browser non supporté
      }

      return () => {
        lcpObserver.disconnect();
        fidObserver.disconnect();
        clsObserver.disconnect();
      };
    };

    const cleanup = collectMetrics();
    return cleanup;
  }, []);

  // Reporter les métriques
  useEffect(() => {
    if (onReport && Object.keys(metrics).length > 0) {
      onReport(metrics);
    }
  }, [metrics, onReport]);

  return metrics;
}

/**
 * Hook pour détecter si le composant est visible (Intersection Observer)
 */
export function useInView(
  options?: IntersectionObserverInit
): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: "50px",
        ...options,
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [options]);

  return [ref, isInView];
}

/**
 * Hook pour debouncer une valeur
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook pour throttler un callback
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCall = useRef<number>(0);
  const lastCallArgs = useRef<Parameters<T> | null>(null);

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      
      if (now - lastCall.current >= delay) {
        lastCall.current = now;
        return callback(...args);
      } else {
        lastCallArgs.current = args;
        setTimeout(() => {
          if (lastCallArgs.current) {
            lastCall.current = Date.now();
            callback(...lastCallArgs.current);
            lastCallArgs.current = null;
          }
        }, delay - (now - lastCall.current));
      }
    }) as T,
    [callback, delay]
  );
}

/**
 * Hook pour lazy loading de composants lourds
 */
export function useLazyLoad(
  importFn: () => Promise<any>,
  options?: { preload?: boolean }
) {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (Component || isLoading) return;
    
    setIsLoading(true);
    try {
      const importedModule = await importFn();
      setComponent(() => importedModule.default || importedModule);
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
  }, [Component, isLoading, importFn]);

  // Preload si demandé
  useEffect(() => {
    if (options?.preload) {
      load();
    }
  }, [options?.preload, load]);

  return { Component, load, isLoading, error };
}

/**
 * Hook pour mesurer le temps de render
 */
export function useRenderTime(componentName: string) {
  const renderStart = useRef<number>(performance.now());

  useEffect(() => {
    const renderTime = performance.now() - renderStart.current;
    
    if (process.env.NODE_ENV === "development" && renderTime > 16) {
      console.warn(
        `[Performance] ${componentName} render time: ${renderTime.toFixed(2)}ms (> 16ms budget)`
      );
    }
  });
}

/**
 * Hook pour détecter les re-renders inutiles
 */
export function useWhyDidYouRender<T extends Record<string, any>>(
  componentName: string,
  props: T
) {
  const prevProps = useRef<T>();

  useEffect(() => {
    if (prevProps.current && process.env.NODE_ENV === "development") {
      const changedProps: Record<string, { from: any; to: any }> = {};
      
      Object.keys({ ...prevProps.current, ...props }).forEach((key) => {
        if (prevProps.current![key] !== props[key]) {
          changedProps[key] = {
            from: prevProps.current![key],
            to: props[key],
          };
        }
      });

      if (Object.keys(changedProps).length > 0) {
        console.log(`[WhyDidYouRender] ${componentName}:`, changedProps);
      }
    }

    prevProps.current = props;
  });
}

export default {
  useWebVitals,
  useInView,
  useDebounce,
  useThrottle,
  useLazyLoad,
  useRenderTime,
  useWhyDidYouRender,
};

