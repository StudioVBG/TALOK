"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, FileSignature, AlertCircle, CheckCircle2, ChevronRight, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";

interface Activity {
  type: "invoice" | "ticket" | "signature";
  title: string;
  date: string;
}

interface OwnerRecentActivityProps {
  activities: Activity[];
}

const activityConfig = {
  invoice: {
    icon: FileText,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    label: "Facture",
  },
  ticket: {
    icon: AlertCircle,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    label: "Ticket",
  },
  signature: {
    icon: FileSignature,
    color: "text-green-600",
    bgColor: "bg-green-100",
    label: "Signature",
  },
};

export function OwnerRecentActivity({ activities }: OwnerRecentActivityProps) {
  if (!activities || activities.length === 0) {
    return (
      <Card className="border-0 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Activité récente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucune activité récente pour le moment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm bg-card/60 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Activité récente</CardTitle>
        <Badge variant="outline" className="font-normal text-xs">
          {activities.length} nouveaux événements
        </Badge>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-4">
          {activities.map((activity, index) => {
            const config = activityConfig[activity.type] || activityConfig.invoice;
            const Icon = config.icon;
            const timeAgo = formatDistanceToNow(new Date(activity.date), {
              addSuffix: true,
              locale: fr,
            });

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group flex items-start gap-4 p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <div className={`p-2 rounded-full ${config.bgColor}`}>
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-blue-600 transition-colors truncate">
                    {activity.title}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {timeAgo}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors mt-1" />
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

