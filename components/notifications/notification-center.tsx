'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, Settings, X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Notification,
  formatRelativeTime,
  getNotificationIcon,
  getNotificationPriorityColor,
  groupNotificationsByDate,
} from '@/lib/types/notifications';
import Link from 'next/link';

interface NotificationCenterProps {
  className?: string;
}

export function NotificationCenter({ className }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // Charger les notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const unreadOnly = activeTab === 'unread';
      const response = await fetch(`/api/notifications?unread=${unreadOnly}&limit=50`);
      const data = await response.json();
      
      if (response.ok) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Poll pour les nouvelles notifications
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/notifications?limit=1');
        const data = await response.json();
        if (response.ok) {
          setUnreadCount(data.unread_count || 0);
        }
      } catch (error) {
        // Silently fail
      }
    }, 30000); // 30 secondes

    return () => clearInterval(interval);
  }, []);

  // Marquer une notification comme lue
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId
              ? { ...n, read_at: new Date().toISOString() }
              : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Marquer toutes comme lues
  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
      });
      
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const groupedNotifications = groupNotificationsByDate(notifications);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative', className)}
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1"
              >
                <Badge
                  variant="destructive"
                  className="h-5 min-w-5 flex items-center justify-center text-xs px-1"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] max-w-[400px] p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Tout marquer lu
              </Button>
            )}
            <Link href="/settings/notifications">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full rounded-none border-b bg-transparent">
            <TabsTrigger
              value="all"
              className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              Toutes
            </TabsTrigger>
            <TabsTrigger
              value="unread"
              className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              Non lues {unreadCount > 0 && `(${unreadCount})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="m-0">
            <ScrollArea className="h-[50vh] sm:h-[400px] max-h-[400px]">
              {isLoading ? (
                <div className="p-4 space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mb-4 opacity-20" />
                  <p className="text-sm">
                    {activeTab === 'unread'
                      ? 'Aucune notification non lue'
                      : 'Aucune notification'}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {Object.entries(groupedNotifications).map(([date, notifs]) => (
                    <div key={date}>
                      <div className="px-4 py-2 bg-muted/50 sticky top-0">
                        <span className="text-xs font-medium text-muted-foreground">
                          {date}
                        </span>
                      </div>
                      {notifs.map((notification) => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          onMarkAsRead={markAsRead}
                          onClose={() => setIsOpen(false)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="p-3 border-t">
          <Link href="/notifications" onClick={() => setIsOpen(false)}>
            <Button variant="outline" size="sm" className="w-full">
              Voir toutes les notifications
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Composant pour une notification individuelle
interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onClose: () => void;
}

function NotificationItem({ notification, onMarkAsRead, onClose }: NotificationItemProps) {
  const isUnread = !notification.read_at;
  const priorityColors = getNotificationPriorityColor(notification.priority);

  const handleClick = () => {
    if (isUnread) {
      onMarkAsRead(notification.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative flex gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors',
        isUnread && 'bg-blue-50/50 dark:bg-blue-950/20'
      )}
      onClick={handleClick}
    >
      {/* Indicateur non lu */}
      {isUnread && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500" />
      )}

      {/* Icône */}
      <div
        className={cn(
          'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg',
          priorityColors.bg,
          priorityColors.text
        )}
      >
        {getNotificationIcon(notification.type)}
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm font-medium', isUnread && 'font-semibold')}>
            {notification.title}
          </p>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatRelativeTime(notification.created_at)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        
        {/* Action */}
        {notification.action_url && (
          <Link
            href={notification.action_url}
            onClick={(e) => {
              e.stopPropagation();
              onMarkAsRead(notification.id);
              onClose();
            }}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
          >
            {notification.action_label || 'Voir les détails'}
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      {/* Actions */}
      {isUnread && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onMarkAsRead(notification.id);
          }}
        >
          <Check className="h-4 w-4" />
        </Button>
      )}
    </motion.div>
  );
}

export default NotificationCenter;
