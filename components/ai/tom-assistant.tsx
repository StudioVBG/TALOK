'use client';

import { useChat } from 'ai/react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, MessageCircle, Send, Sparkles, Minimize2, Maximize2 } from 'lucide-react';
import { usePropertyWizardStore } from '@/features/properties/stores/wizard-store';
import { cn } from '@/lib/utils';
import type { UpdatePropertyArgs, AddRoomArgs } from '@/lib/ai/tools-schema';

export function TomAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Accès au store
  const updateFormData = usePropertyWizardStore(s => s.updateFormData);
  const addRoom = usePropertyWizardStore(s => s.addRoom);

  const { messages, input, handleInputChange, handleSubmit, addToolResult } = useChat({
    api: '/api/chat',
    maxSteps: 5, // Autoriser plusieurs étapes (ex: update -> addRoom -> répondre)
    onToolCall: async ({ toolCall }) => {
      // Exécution des outils côté client
      if (toolCall.toolName === 'updateProperty') {
        const args = toolCall.args as UpdatePropertyArgs;
        updateFormData(args);
        return "Les informations du bien ont été mises à jour avec succès.";
      }
      
      if (toolCall.toolName === 'addRoom') {
        const args = toolCall.args as AddRoomArgs;
        addRoom(args);
        return `La pièce ${args.label_affiche || args.type_piece} a été ajoutée.`;
      }
    },
  });

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // SOTA 2026: FAB supprimé - intégré dans UnifiedFAB
  // L'assistant est maintenant ouvert via UnifiedFAB ou raccourci clavier
  if (!isOpen) {
    return null;
  }

  return (
    <Card className={cn(
      "fixed right-6 z-50 shadow-2xl border-slate-200 transition-all duration-300 flex flex-col bg-white",
      isMinimized ? "bottom-6 w-72 h-16" : "bottom-6 w-[400px] h-[600px]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-slate-50 rounded-t-lg cursor-pointer"
           onClick={() => setIsMinimized(!isMinimized)}>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-lg">🤖</span>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Tom</h3>
            <p className="text-xs text-slate-500">Assistant intelligent</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}>
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chat Area */}
      {!isMinimized && (
        <>
          <ScrollArea className="flex-1 p-4" viewportRef={scrollRef}>
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <Sparkles className="h-12 w-12 mx-auto mb-3 text-blue-200" />
                  <p>Bonjour ! Je suis Tom.</p>
                  <p className="text-sm mt-2">Décrivez votre bien, je remplis le formulaire pour vous !</p>
                  <div className="mt-4 space-y-2">
                    <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => handleInputChange({ target: { value: "C'est un T3 de 65m2 à Paris, loyer 1200€" } } as any)}>
                      "C'est un T3 de 65m² à Paris..."
                    </Button>
                  </div>
                </div>
              )}
              
              {messages.map(m => (
                <div
                  key={m.id}
                  className={cn(
                    "flex w-max max-w-[80%] flex-col gap-2 rounded-lg px-3 py-2 text-sm",
                    m.role === 'user'
                      ? "ml-auto bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-900"
                  )}
                >
                  {/* Contenu texte */}
                  {m.content && <div className="whitespace-pre-wrap">{m.content}</div>}

                  {/* Indicateur d'action (Tool Calls) */}
                  {m.toolInvocations?.map(toolInvocation => {
                    const toolCallId = toolInvocation.toolCallId;
                    const addResult = (result: string) =>
                      addToolResult({ toolCallId, result });

                    // Si l'outil demande confirmation (optionnel, ici on auto-exécute via onToolCall du hook mais on affiche l'état)
                     if (toolInvocation.state === 'result') {
                      return (
                        <div key={toolCallId} className="text-xs italic opacity-70 mt-1 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {toolInvocation.toolName === 'updateProperty' ? 'Infos mises à jour' : 'Pièce ajoutée'}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t mt-auto bg-white">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Décrivez votre bien..."
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={!input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </>
      )}
    </Card>
  );
}

