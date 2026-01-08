"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCircle2, Clock, Info, MessageSquare, Loader2, Trash2, ArrowLeft } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/ui/page-transition";
import { notificationsService, type Notification } from "@/features/tenant/services/notifications.service";
import { formatDateShort } from "@/lib/helpers/format";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function TenantNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await notificationsService.getNotifications();
        setNotifications(data || []);
      } catch (error) {
        console.error("Error loading notifications:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsService.markAsRead(id);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
      );
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "success": return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
      case "info": return <Info className="h-5 w-5 text-blue-600" />;
      case "warning": return <AlertCircle className="h-5 w-5 text-amber-600" />;
      case "message": return <MessageSquare className="h-5 w-5 text-indigo-600" />;
      default: return <Bell className="h-5 w-5 text-slate-400" />;
    }
  };

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <Link 
              href="/tenant/dashboard" 
              className="group text-sm font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-2 transition-colors mb-4"
            >
              <div className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-indigo-50 transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </div>
              Retour au tableau de bord
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200">
                <Bell className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Notifications</h1>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="animate-spin h-10 w-10 text-indigo-600" /></div>
        ) : notifications.length === 0 ? (
          <GlassCard className="p-12 text-center border-slate-200">
            <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Bell className="h-10 w-10 text-slate-200" />
            </div>
            <h3 className="text-xl font-bold">Aucune notification</h3>
            <p className="text-slate-500 mt-2">Vous êtes à jour ! Toutes les nouvelles alertes apparaîtront ici.</p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {notifications.map((n) => (
              <GlassCard 
                key={n.id} 
                className={cn(
                  "p-5 border-slate-200 bg-white hover:shadow-xl transition-all group",
                  !n.read_at && "border-l-4 border-l-indigo-600 bg-indigo-50/10"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "p-3 rounded-2xl flex-shrink-0",
                      !n.read_at ? "bg-indigo-100" : "bg-slate-50"
                    )}>
                      {getIcon(n.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-slate-900">{n.title}</h4>
                        {!n.read_at && <Badge className="bg-indigo-600 h-2 w-2 p-0 rounded-full" />}
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed">{n.body}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-1.5">
                        <Clock className="h-3 w-3" /> {formatDateShort(n.created_at)}
                      </p>
                    </div>
                  </div>
                  {!n.read_at && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleMarkAsRead(n.id)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                    >
                      Marquer comme lu
                    </Button>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        )}

      </div>
    </PageTransition>
  );
}

function AlertCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}


