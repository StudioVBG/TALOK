'use client';

import { useChat } from 'ai/react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, AlertTriangle, PenTool, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CreateTicketArgs } from '@/lib/ai/tools-schema';
import { Avatar } from "@/components/ui/avatar";

interface TomTicketCreatorProps {
  onTicketCreated: (data: CreateTicketArgs) => void;
}

export function TomTicketCreator({ onTicketCreated }: TomTicketCreatorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
    body: { context: 'maintenance_ticket' },
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: "Bonjour. Je suis Tom, assistant technique. 🛠️\n\nQuel est le problème ? Décrivez-le moi simplement (ex: 'J'ai une fuite sous l'évier' ou 'La lumière du salon ne marche plus')."
      }
    ],
    onToolCall: async ({ toolCall }) => {
      if (toolCall.toolName === 'createTicket') {
        const args = toolCall.args as CreateTicketArgs;
        onTicketCreated(args);
        setIsCompleted(true);
        return `Ticket créé : ${args.titre}`;
      }
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-[600px] w-full max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
      {/* Header */}
      <div className="bg-slate-50 p-4 border-b flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold shadow-sm">
          🛠️
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">Nouvelle demande</h3>
          <p className="text-xs text-slate-500">Diagnostic intelligent</p>
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
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                m.role === 'user' ? "bg-slate-900" : "bg-white border border-slate-200"
              )}>
                {m.role === 'user' ? <span className="text-white text-xs">Moi</span> : <span className="text-lg">🤖</span>}
              </div>

              <div className={cn(
                "rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm",
                m.role === 'user' 
                  ? "bg-slate-900 text-white rounded-tr-none" 
                  : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
              )}>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          ))}
          
          {isCompleted && (
              <div className="flex justify-center my-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium border border-green-200">
                      <CheckCircle2 className="h-4 w-4" />
                      Ticket créé avec succès !
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
            placeholder="Décrivez le problème..."
            className="pl-4 pr-12 py-6 text-base rounded-xl border-slate-200 focus-visible:ring-orange-500"
            autoFocus
            disabled={isCompleted}
          />
          <Button 
            type="submit" 
            size="icon" 
            className="absolute right-2 top-2 h-9 w-9 rounded-lg bg-orange-600 hover:bg-orange-700"
            disabled={!input.trim() || isCompleted}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

