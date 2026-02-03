/**
 * Hook personnalisé pour le module Fin de Bail + Rénovation
 */

import { useState, useEffect, useCallback } from "react";
import { endOfLeaseService } from "@/features/end-of-lease/services/end-of-lease.service";
import type {
  LeaseEndProcess,
  EDLInspectionItem,
  RenovationItem,
  LeaseEndTimelineItem,
} from "@/lib/types/end-of-lease";

interface UseEndOfLeaseOptions {
  autoFetch?: boolean;
}

export function useEndOfLeaseProcesses(options: UseEndOfLeaseOptions = { autoFetch: true }) {
  const [processes, setProcesses] = useState<LeaseEndProcess[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchProcesses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await endOfLeaseService.getProcesses();
      setProcesses(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Erreur inconnue"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (options.autoFetch) {
      fetchProcesses();
    }
  }, [options.autoFetch, fetchProcesses]);

  return {
    processes,
    isLoading,
    error,
    refetch: fetchProcesses,
  };
}

export function useEndOfLeaseProcess(processId: string | null) {
  const [process, setProcess] = useState<LeaseEndProcess | null>(null);
  const [inspectionItems, setInspectionItems] = useState<EDLInspectionItem[]>([]);
  const [renovationItems, setRenovationItems] = useState<RenovationItem[]>([]);
  const [timeline, setTimeline] = useState<LeaseEndTimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchProcess = useCallback(async () => {
    if (!processId) return;

    setIsLoading(true);
    setError(null);
    try {
      const [processData, items, rItems, tItems] = await Promise.all([
        endOfLeaseService.getProcessById(processId),
        endOfLeaseService.getInspectionItems(processId),
        endOfLeaseService.getRenovationItems(processId),
        endOfLeaseService.getTimeline(processId),
      ]);

      setProcess(processData);
      setInspectionItems(items);
      setRenovationItems(rItems);
      setTimeline(tItems);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Erreur inconnue"));
    } finally {
      setIsLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    if (processId) {
      fetchProcess();
    }
  }, [processId, fetchProcess]);

  // Actions
  const updateStatus = useCallback(
    async (status: LeaseEndProcess["status"]) => {
      if (!processId) return;
      const updated = await endOfLeaseService.updateProcessStatus(processId, status as any);
      setProcess(updated);
      return updated;
    },
    [processId]
  );

  const calculateTotals = useCallback(async () => {
    if (!processId) return;
    const totals = await endOfLeaseService.calculateTotals(processId);
    await fetchProcess();
    return totals;
  }, [processId, fetchProcess]);

  const markReadyToRent = useCallback(async () => {
    if (!processId) return;
    const updated = await endOfLeaseService.markReadyToRent(processId);
    setProcess(updated);
    return updated;
  }, [processId]);

  return {
    process,
    inspectionItems,
    renovationItems,
    timeline,
    isLoading,
    error,
    refetch: fetchProcess,
    updateStatus,
    calculateTotals,
    markReadyToRent,
  };
}

export function useUpcomingLeaseEnds() {
  const [upcomingLeases, setUpcomingLeases] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUpcoming = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/end-of-lease/trigger");
      if (response.ok) {
        const data = await response.json();
        setUpcomingLeases(data.upcoming_triggers || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Erreur inconnue"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUpcoming();
  }, [fetchUpcoming]);

  return {
    upcomingLeases,
    isLoading,
    error,
    refetch: fetchUpcoming,
  };
}

