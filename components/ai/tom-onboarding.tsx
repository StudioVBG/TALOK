'use client';

import { useChat } from 'ai/react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Sparkles, User, Building2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UpdateOwnerProfileArgs } from '@/lib/ai/tools-schema';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from '@/components/ui/card';

interface TomOnboardingProps {
  onDataUpdate: (data: UpdateOwnerProfileArgs) => void;
  onComplete: () => void;
}

export function TomOnboarding({ onDataUpdate, onComplete }: TomOnboardingProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  const { messages, input, handleInputChange, handleSubmit, addToolResult } = useChat({
    api: '/api/chat',
    body: { context: 'onboarding_owner' }, // Indique le contexte à l'API
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: "Bonjour ! Je suis Tom, votre assistant personnel. 🤖\n\nPour commencer, dites-moi : êtes-vous un propriétaire particulier ou représentez-vous une société (SCI, SARL...) ?"
      }
    ],
    onToolCall: async ({ toolCall }) => {
      if (toolCall.toolName === 'updateOwnerProfile') {
        const args = toolCall.args as UpdateOwnerProfileArgs;
        onDataUpdate(args);
        
        // Si on a au moins le type, on peut considérer que c'est une bonne étape
        // Si c'est une société, on attend le SIRET idéalement, mais l'IA gère la conversation
        if (args.type === 'particulier' || (args.type === 'societe' && args.raison_sociale)) {
            setIsCompleted(true);
            setTimeout(onComplete, 2000); // Délai pour laisser l'utilisateur lire la confirmation
        }
        
        return "Profil mis à jour.";
      }
    },
  });

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-[600px] w-full max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
      {/* Header */}
      <div className="bg-slate-50 p-4 border-b flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg">
          T
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">Assistant d'inscription</h3>
          <p className="text-xs text-slate-500">Tom configure votre compte</p>
        </div>
      </div>

      {/* Chat Area */}
      <ScrollArea className="flex-1 p-6 bg-slate-50/50" ref={scrollRef as any}>
        <div className="space-y-6">
          {messages.map(m => (
            <div
              key={m.id}
              className={cn(
                "flex gap-3 max-w-[85%]",
                m.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              {/* Avatar */}
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                m.role === 'user' ? "bg-blue-600" : "bg-white border border-slate-200"
              )}>
                {m.role === 'user' ? <User className="h-4 w-4 text-white" /> : <span className="text-lg">🤖</span>}
              </div>

              {/* Bulle */}
              <div className={cn(
                "rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm",
                m.role === 'user' 
                  ? "bg-blue-600 text-white rounded-tr-none" 
                  : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
              )}>
                <div className="whitespace-pre-wrap">{m.content}</div>
                
                {/* Suggestions rapides (Quick replies) simulées si c'est le premier message */}
                {m.id === 'welcome' && messages.length === 1 && (
                   <div className="mt-4 flex gap-2 flex-wrap">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="bg-white hover:bg-blue-50 border-blue-200 text-blue-700"
                        onClick={() => handleInputChange({ target: { value: "Je suis un particulier" } } as any)}
                      >
                        <User className="h-3 w-3 mr-2" />
                        Je suis un particulier
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="bg-white hover:bg-purple-50 border-purple-200 text-purple-700"
                        onClick={() => handleInputChange({ target: { value: "Je représente une société" } } as any)}
                      >
                        <Building2 className="h-3 w-3 mr-2" />
                        Je suis une société
                      </Button>
                   </div>
                )}
              </div>
            </div>
          ))}
          
          {/* Indicateur de succès */}
          {isCompleted && (
              <div className="flex justify-center my-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium border border-green-200">
                      <CheckCircle2 className="h-4 w-4" />
                      Configuration terminée ! Redirection...
                  </div>
              </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 bg-white border-t">
        <form onSubmit={handleSubmit} className="flex gap-2 relative">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Écrivez votre réponse..."
            className="pl-4 pr-12 py-6 text-base rounded-xl border-slate-200 focus-visible:ring-blue-500"
            autoFocus
            disabled={isCompleted}
          />
          <Button 
            type="submit" 
            size="icon" 
            className="absolute right-2 top-2 h-9 w-9 rounded-lg bg-blue-600 hover:bg-blue-700"
            disabled={!input.trim() || isCompleted}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

