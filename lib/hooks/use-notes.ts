"use client";

/**
 * Hook pour gérer les notes rapides
 * Stocke les notes dans localStorage pour une persistance simple
 */

import { useState, useEffect, useCallback } from "react";

export type NoteEntityType = "property" | "lease" | "tenant" | "ticket";

export interface Note {
  id: string;
  entityType: NoteEntityType;
  entityId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  color?: "yellow" | "blue" | "green" | "pink" | "purple";
  pinned?: boolean;
}

interface UseNotesReturn {
  /** Liste de toutes les notes */
  notes: Note[];
  /** Obtenir les notes pour une entité */
  getNotesForEntity: (entityType: NoteEntityType, entityId: string) => Note[];
  /** Ajouter une note */
  addNote: (entityType: NoteEntityType, entityId: string, content: string, color?: Note["color"]) => Note;
  /** Modifier une note */
  updateNote: (noteId: string, updates: Partial<Pick<Note, "content" | "color" | "pinned">>) => void;
  /** Supprimer une note */
  deleteNote: (noteId: string) => void;
  /** Toggle pin */
  togglePin: (noteId: string) => void;
  /** Nombre total de notes */
  count: number;
}

const STORAGE_KEY = "gestion_locative_notes";

function generateId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function useNotes(): UseNotesReturn {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Charger les notes depuis localStorage au montage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setNotes(JSON.parse(stored));
        }
      } catch (error) {
        console.error("[useNotes] Erreur lecture localStorage:", error);
      }
      setIsLoaded(true);
    }
  }, []);

  // Sauvegarder dans localStorage à chaque changement
  useEffect(() => {
    if (isLoaded && typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      } catch (error) {
        console.error("[useNotes] Erreur sauvegarde localStorage:", error);
      }
    }
  }, [notes, isLoaded]);

  const getNotesForEntity = useCallback(
    (entityType: NoteEntityType, entityId: string) => {
      return notes
        .filter((n) => n.entityType === entityType && n.entityId === entityId)
        .sort((a, b) => {
          // Notes épinglées en premier
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          // Puis par date de mise à jour
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
    },
    [notes]
  );

  const addNote = useCallback(
    (entityType: NoteEntityType, entityId: string, content: string, color?: Note["color"]): Note => {
      const now = new Date().toISOString();
      const newNote: Note = {
        id: generateId(),
        entityType,
        entityId,
        content,
        createdAt: now,
        updatedAt: now,
        color: color || "yellow",
        pinned: false,
      };

      setNotes((prev) => [...prev, newNote]);
      return newNote;
    },
    []
  );

  const updateNote = useCallback(
    (noteId: string, updates: Partial<Pick<Note, "content" | "color" | "pinned">>) => {
      setNotes((prev) =>
        prev.map((note) =>
          note.id === noteId
            ? { ...note, ...updates, updatedAt: new Date().toISOString() }
            : note
        )
      );
    },
    []
  );

  const deleteNote = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== noteId));
  }, []);

  const togglePin = useCallback((noteId: string) => {
    setNotes((prev) =>
      prev.map((note) =>
        note.id === noteId
          ? { ...note, pinned: !note.pinned, updatedAt: new Date().toISOString() }
          : note
      )
    );
  }, []);

  return {
    notes,
    getNotesForEntity,
    addNote,
    updateNote,
    deleteNote,
    togglePin,
    count: notes.length,
  };
}

export default useNotes;

