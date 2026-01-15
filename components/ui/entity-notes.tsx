"use client";

import { useState } from "react";
import { StickyNote, Plus, Trash2, Pin, X, Edit2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotes, type NoteEntityType, type Note } from "@/lib/hooks/use-notes";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const colorClasses: Record<NonNullable<Note["color"]>, string> = {
  yellow: "bg-amber-50 border-amber-200 hover:bg-amber-100",
  blue: "bg-blue-50 border-blue-200 hover:bg-blue-100",
  green: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
  pink: "bg-pink-50 border-pink-200 hover:bg-pink-100",
  purple: "bg-violet-50 border-violet-200 hover:bg-violet-100",
};

const colorDots: Record<NonNullable<Note["color"]>, string> = {
  yellow: "bg-amber-400",
  blue: "bg-blue-400",
  green: "bg-emerald-400",
  pink: "bg-pink-400",
  purple: "bg-violet-400",
};

interface EntityNotesProps {
  entityType: NoteEntityType;
  entityId: string;
  className?: string;
  maxDisplay?: number;
}

export function EntityNotes({
  entityType,
  entityId,
  className,
  maxDisplay = 3,
}: EntityNotesProps) {
  const { getNotesForEntity, addNote, updateNote, deleteNote, togglePin } = useNotes();
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [selectedColor, setSelectedColor] = useState<Note["color"]>("yellow");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const entityNotes = getNotesForEntity(entityType, entityId);
  const displayedNotes = entityNotes.slice(0, maxDisplay);
  const hiddenCount = Math.max(0, entityNotes.length - maxDisplay);

  const handleAdd = () => {
    if (newContent.trim()) {
      addNote(entityType, entityId, newContent.trim(), selectedColor);
      setNewContent("");
      setIsAdding(false);
    }
  };

  const handleStartEdit = (note: Note) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = (noteId: string) => {
    if (editContent.trim()) {
      updateNote(noteId, { content: editContent.trim() });
    }
    setEditingId(null);
    setEditContent("");
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <StickyNote className="h-4 w-4" />
          Notes ({entityNotes.length})
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsAdding(!isAdding)}
          className="h-7 text-xs"
        >
          {isAdding ? (
            <>
              <X className="h-3 w-3 mr-1" />
              Annuler
            </>
          ) : (
            <>
              <Plus className="h-3 w-3 mr-1" />
              Ajouter
            </>
          )}
        </Button>
      </div>

      {/* Formulaire d'ajout */}
      {isAdding && (
        <div className="p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 space-y-2">
          <Textarea
            placeholder="Écrivez votre note..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            className="min-h-[80px] text-sm resize-none"
            autoFocus
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {(Object.keys(colorDots) as Note["color"][]).map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    "w-5 h-5 rounded-full transition-all",
                    colorDots[color!],
                    selectedColor === color
                      ? "ring-2 ring-offset-2 ring-slate-400 scale-110"
                      : "hover:scale-110"
                  )}
                />
              ))}
            </div>
            <Button size="sm" onClick={handleAdd} disabled={!newContent.trim()}>
              Enregistrer
            </Button>
          </div>
        </div>
      )}

      {/* Liste des notes */}
      {entityNotes.length === 0 && !isAdding ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Aucune note pour le moment
        </p>
      ) : (
        <div className="space-y-2">
          {displayedNotes.map((note) => (
            <div
              key={note.id}
              className={cn(
                "p-3 rounded-lg border transition-colors relative group",
                colorClasses[note.color || "yellow"]
              )}
            >
              {/* Pin indicator */}
              {note.pinned && (
                <div className="absolute -top-1 -right-1 bg-slate-700 text-white rounded-full p-0.5">
                  <Pin className="h-2.5 w-2.5" />
                </div>
              )}

              {editingId === note.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[60px] text-sm resize-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSaveEdit(note.id)}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap pr-16">
                    {note.content}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {formatDistanceToNow(new Date(note.updatedAt), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </p>

                  {/* Actions */}
                  <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => togglePin(note.id)}
                      aria-label={note.pinned ? "Désépingler la note" : "Épingler la note"}
                    >
                      <Pin
                        className={cn(
                          "h-3 w-3",
                          note.pinned && "fill-slate-700"
                        )}
                      />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => handleStartEdit(note)}
                      aria-label="Modifier la note"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-red-500 hover:text-red-600"
                      onClick={() => deleteNote(note.id)}
                      aria-label="Supprimer la note"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Indicateur de notes supplémentaires */}
          {hiddenCount > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                >
                  + {hiddenCount} note{hiddenCount > 1 ? "s" : ""} supplémentaire
                  {hiddenCount > 1 ? "s" : ""}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 max-h-[300px] overflow-auto">
                <div className="space-y-2">
                  {entityNotes.slice(maxDisplay).map((note) => (
                    <div
                      key={note.id}
                      className={cn(
                        "p-2 rounded border text-sm",
                        colorClasses[note.color || "yellow"]
                      )}
                    >
                      <p className="text-slate-700">{note.content}</p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {formatDistanceToNow(new Date(note.updatedAt), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}
    </div>
  );
}

export default EntityNotes;

