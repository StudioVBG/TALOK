"use client";

import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Send, MessageSquare, Lock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Comment {
  id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  author?: {
    id: string;
    nom: string;
    prenom: string;
    role: string;
    avatar_url?: string;
  } | null;
}

interface TicketCommentsProps {
  ticketId: string;
  comments: Comment[];
  currentUserRole: string;
  isOwner: boolean;
  onCommentAdded: () => void;
  isResolved?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  tenant: "Locataire",
  provider: "Prestataire",
  admin: "Admin",
};

export function TicketComments({
  ticketId,
  comments,
  currentUserRole,
  isOwner,
  onCommentAdded,
  isResolved,
}: TicketCommentsProps) {
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const handleSend = async () => {
    if (!newComment.trim() || sending) return;
    setSending(true);

    try {
      const res = await fetch(`/api/v1/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newComment.trim(),
          is_internal: isOwner ? isInternal : false,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur");
      }

      setNewComment("");
      setIsInternal(false);
      onCommentAdded();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer le commentaire.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/50 flex items-center justify-between">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          Commentaires ({comments.length})
        </h3>
      </div>

      {/* Messages */}
      <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
        {comments.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">
            Aucun commentaire. Soyez le premier à commenter.
          </p>
        ) : (
          comments.map((comment) => {
            const authorName = comment.author
              ? `${comment.author.prenom} ${comment.author.nom}`.trim()
              : "Système";
            const initials = authorName
              .split(" ")
              .map((w) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 2) || "?";
            const isOwnerComment = comment.author?.role === "owner" || comment.author?.role === "admin";

            return (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback
                    className={cn(
                      "text-xs font-bold",
                      isOwnerComment
                        ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                        : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                    )}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{authorName}</span>
                    {comment.author?.role && (
                      <Badge variant="secondary" className="text-[10px] py-0">
                        {ROLE_LABELS[comment.author.role] || comment.author.role}
                      </Badge>
                    )}
                    {comment.is_internal && (
                      <Badge variant="outline" className="text-[10px] py-0 gap-1 border-amber-200 text-amber-600">
                        <Lock className="h-2.5 w-2.5" />
                        Interne
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {comment.content}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {(() => {
                      const d = new Date(comment.created_at);
                      return isNaN(d.getTime())
                        ? ""
                        : formatDistanceToNow(d, { addSuffix: true, locale: fr });
                    })()}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      {!isResolved ? (
        <div className="p-4 border-t border-border bg-muted/30 space-y-3">
          {isOwner && (
            <div className="flex items-center gap-2">
              <Switch
                id="internal"
                checked={isInternal}
                onCheckedChange={setIsInternal}
                className="h-4 w-7"
              />
              <Label htmlFor="internal" className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Note interne (invisible au locataire)
              </Label>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              placeholder="Écrire un commentaire..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[44px] max-h-[120px] resize-none bg-background"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              size="icon"
              className="h-11 w-11 shrink-0 bg-indigo-600 hover:bg-indigo-700"
              onClick={handleSend}
              disabled={!newComment.trim() || sending}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 border-t border-border bg-emerald-50 dark:bg-emerald-950/20 text-center">
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
            Ce ticket est résolu. Les commentaires sont désactivés.
          </p>
        </div>
      )}
    </div>
  );
}
