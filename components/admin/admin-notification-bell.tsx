"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithCsrf } from "@/lib/security/csrf";
import { useRouter } from "next/navigation";
import { Bell, Check, UserPlus, CreditCard, Clock, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface AdminNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  message?: string;
  is_read: boolean;
  action_url?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  new_user: UserPlus,
  payment_failed: CreditCard,
  trial_expired: Clock,
  new_ticket: Ticket,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "A l'instant";
  if (minutes < 60) return `Il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
}

export function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["admin", "notifications"],
    queryFn: async () => {
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) return { notifications: [], unread_count: 0 };
      return res.json();
    },
    refetchInterval: 30000,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await fetchWithCsrf("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
    },
  });

  const notifications: AdminNotification[] = data?.notifications || [];
  const unreadCount: number = data?.unread_count || 0;

  const handleClick = (notif: AdminNotification) => {
    if (!notif.is_read) {
      markRead.mutate(notif.id);
    }
    if (notif.action_url) {
      setOpen(false);
      router.push(notif.action_url);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">{unreadCount} non lues</Badge>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Aucune notification
            </div>
          ) : (
            <div className="divide-y">
              {notifications.slice(0, 10).map((notif) => {
                const Icon = TYPE_ICON[notif.type] || Bell;
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={cn(
                      "flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-accent/50 transition-colors",
                      !notif.is_read && "bg-accent/20"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", !notif.is_read ? "text-primary" : "text-muted-foreground")} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm truncate", !notif.is_read && "font-medium")}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {notif.body || notif.message}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        {timeAgo(notif.created_at)}
                      </p>
                    </div>
                    {!notif.is_read && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
