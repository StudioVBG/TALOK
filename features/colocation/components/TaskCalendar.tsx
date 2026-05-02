"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buildAvatarUrl } from "@/lib/helpers/format";
import { Plus, RotateCw, ClipboardList, CheckCircle2 } from "lucide-react";
import { colocationTasksService } from "../services/tasks.service";
import type { ColocationTaskRow } from "@/lib/supabase/database.types";

interface TaskCalendarProps {
  propertyId: string;
  readOnly?: boolean;
}

const RECURRENCE_LABELS: Record<string, string> = {
  daily: "Quotidien",
  weekly: "Hebdomadaire",
  biweekly: "Bi-mensuel",
  monthly: "Mensuel",
};

export function TaskCalendar({ propertyId, readOnly }: TaskCalendarProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    loadTasks();
  }, [propertyId]);

  const loadTasks = async () => {
    try {
      const data = await colocationTasksService.getTasks(propertyId);
      setTasks(data);
    } catch (err) {
      console.error("Erreur chargement taches:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (taskId: string) => {
    try {
      await colocationTasksService.completeTask(taskId);
      await loadTasks();
    } catch (err) {
      console.error("Erreur completion:", err);
    }
  };

  const handleRotate = async () => {
    setRotating(true);
    try {
      await colocationTasksService.rotateTasks(propertyId);
      await loadTasks();
    } catch (err) {
      console.error("Erreur rotation:", err);
    } finally {
      setRotating(false);
    }
  };

  const pendingTasks = tasks.filter((t) => !t.completed_at);
  const completedTasks = tasks.filter((t) => t.completed_at);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Taches partagees
        </CardTitle>
        {!readOnly && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRotate}
              disabled={rotating}
            >
              <RotateCw className={`h-4 w-4 mr-1 ${rotating ? "animate-spin" : ""}`} />
              Rotation
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Aucune tache definie.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Pending tasks */}
            {pendingTasks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  A faire ({pendingTasks.length})
                </h4>
                {pendingTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onComplete={() => handleComplete(task.id)}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            )}

            {/* Completed tasks */}
            {completedTasks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Terminees ({completedTasks.length})
                </h4>
                {completedTasks.slice(0, 5).map((task) => (
                  <TaskItem key={task.id} task={task} readOnly />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TaskItem({
  task,
  onComplete,
  readOnly,
}: {
  task: any;
  onComplete?: () => void;
  readOnly?: boolean;
}) {
  const isCompleted = !!task.completed_at;
  const assignee = task.assigned_member?.profiles;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${isCompleted ? "opacity-60" : ""}`}>
      {!readOnly && !isCompleted && onComplete ? (
        <Checkbox onCheckedChange={() => onComplete()} />
      ) : isCompleted ? (
        <CheckCircle2 className="h-5 w-5 text-green-500" />
      ) : (
        <div className="h-5 w-5" />
      )}

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isCompleted ? "line-through" : ""}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {task.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {RECURRENCE_LABELS[task.recurrence] || task.recurrence}
        </Badge>
        {assignee && (
          <Avatar className="h-6 w-6">
            {assignee.avatar_url && <AvatarImage src={buildAvatarUrl(assignee.avatar_url) ?? undefined} />}
            <AvatarFallback className="text-xs">
              {(assignee.prenom?.[0] || "")}{(assignee.nom?.[0] || "")}
            </AvatarFallback>
          </Avatar>
        )}
        {task.due_date && (
          <span className="text-xs text-muted-foreground">
            {new Date(task.due_date).toLocaleDateString("fr-FR")}
          </span>
        )}
      </div>
    </div>
  );
}
