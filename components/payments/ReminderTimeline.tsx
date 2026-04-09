"use client";

import { REMINDER_SCHEDULE } from "@/lib/payments/invoice-state-machine";
import {
  Mail,
  Bell,
  AlertTriangle,
  FileWarning,
  CheckCircle,
} from "lucide-react";

interface ReminderTimelineProps {
  /** Number of reminders already sent */
  reminderCount: number;
  /** Days overdue (0 = not overdue) */
  daysOverdue: number;
  /** Last reminder date */
  lastReminderAt?: string | null;
}

const STEP_ICONS = [Mail, Mail, Bell, FileWarning];

export function ReminderTimeline({
  reminderCount,
  daysOverdue,
  lastReminderAt,
}: ReminderTimelineProps) {
  if (daysOverdue <= 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">
        Relances automatiques
      </h4>
      <div className="relative">
        {REMINDER_SCHEDULE.map((step, index) => {
          const isSent = daysOverdue >= step.days && index < reminderCount;
          const isNext =
            !isSent &&
            (index === 0 || (daysOverdue >= REMINDER_SCHEDULE[index - 1]?.days));
          const Icon = STEP_ICONS[index] || AlertTriangle;

          return (
            <div key={step.days} className="flex items-start gap-3 pb-4 last:pb-0">
              {/* Timeline dot */}
              <div className="relative flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    isSent
                      ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                      : isNext
                        ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isSent ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                {index < REMINDER_SCHEDULE.length - 1 && (
                  <div
                    className={`absolute top-8 h-full w-px ${
                      isSent ? "bg-green-300 dark:bg-green-700" : "bg-border"
                    }`}
                  />
                )}
              </div>

              {/* Content */}
              <div className="pt-1">
                <p
                  className={`text-sm font-medium ${
                    isSent
                      ? "text-green-700 dark:text-green-400"
                      : isNext
                        ? "text-orange-700 dark:text-orange-400"
                        : "text-muted-foreground"
                  }`}
                >
                  J+{step.days} — {step.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {Array.isArray(step.channel)
                    ? step.channel.join(" + ")
                    : step.channel}
                </p>
                {isSent && lastReminderAt && index === reminderCount - 1 && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Envoyée le{" "}
                    {new Date(lastReminderAt).toLocaleDateString("fr-FR")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
