"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsService, type Notification } from "@/features/tenant/services/notifications.service";

async function fetchTenantNotifications(): Promise<Notification[]> {
  return notificationsService.getNotifications();
}

export function useTenantNotifications() {
  return useQuery({
    queryKey: ["tenant", "notifications"],
    queryFn: fetchTenantNotifications,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      notificationsService.markAsRead(notificationId),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ["tenant", "notifications"] });

      const previous = queryClient.getQueryData<Notification[]>(["tenant", "notifications"]);

      queryClient.setQueryData<Notification[]>(
        ["tenant", "notifications"],
        (old) =>
          old?.map((n) =>
            n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
          ) ?? []
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["tenant", "notifications"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant", "notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["tenant", "notifications"] });
      const previous = queryClient.getQueryData<Notification[]>(["tenant", "notifications"]);
      const now = new Date().toISOString();
      queryClient.setQueryData<Notification[]>(
        ["tenant", "notifications"],
        (old) => old?.map((n) => ({ ...n, read_at: now })) ?? []
      );
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["tenant", "notifications"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant", "notifications"] });
    },
  });
}
