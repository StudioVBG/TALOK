'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from '@/components/ui/sheet';
import { 
  Sparkles, 
  Send, 
  MessageCircle, 
  X, 
  Loader2, 
  Bot, 
  User, 
  Wrench,
  Search,
  FileText,
  Calendar,
  CreditCard,
  AlertCircle,
  ChevronDown,
  Trash2,
  Plus,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
}

interface ToolCall {
  name: string;
  result?: string;
}

interface Thread {
  id: string;
  title: string;
  lastMessage?: string;
  updatedAt: Date;
  messageCount: number;
}

// Tool icons mapping
const toolIcons: Record<string, React.ReactNode> = {
  search_properties: <Search className="h-3 w-3" />,
  search_tenants: <User className="h-3 w-3" />,
  search_payments: <CreditCard className="h-3 w-3" />,
  search_tickets: <AlertCircle className="h-3 w-3" />,
  search_documents: <FileText className="h-3 w-3" />,
  create_ticket: <AlertCircle className="h-3 w-3" />,
  generate_receipt: <FileText className="h-3 w-3" />,
  create_invoice: <CreditCard className="h-3 w-3" />,
  schedule_visit: <Calendar className="h-3 w-3" />,
  get_rent_summary: <CreditCard className="h-3 w-3" />,
};

// Suggestions par rôle
const suggestionsByRole: Record<string, string[]> = {
  owner: [
    "Montre-moi mes propriétés",
    "Résumé des loyers ce mois",
    "Y a-t-il des tickets ouverts ?",
    "Génère une quittance"
  ],
  tenant: [
    "Où en est mon bail ?",
    "Je veux signaler un problème",
    "Mes paiements récents",
    "Mes documents"
  ],
  provider: [
    "Mes interventions en cours",
    "Créer un devis",
    "Historique des jobs",
    "Mon planning"
  ],
  admin: [
    "Stats globales",
    "Propriétés en attente",
    "Utilisateurs récents",
    "Revenus du mois"
  ]
};

export function AssistantPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [userRole, setUserRole] = useState<string>('owner');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut (Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Fetch threads on mount
  useEffect(() => {
    if (isOpen && threads.length === 0) {
      fetchThreads();
    }
  }, [isOpen, threads.length]);

  const fetchThreads = async () => {
    try {
      const response = await fetch('/api/assistant/threads');
      if (response.ok) {
        const data = await response.json();
        setThreads(data.threads || []);
      }
    } catch (err) {
      console.error('Erreur chargement threads:', err);
    }
  };

  const createNewThread = async () => {
    setCurrentThreadId(null);
    setMessages([]);
    setShowHistory(false);
    setError(null);
  };

  const selectThread = async (threadId: string) => {
    setCurrentThreadId(threadId);
    setShowHistory(false);
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/assistant/threads/${threadId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages?.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          toolCalls: m.tool_calls,
          timestamp: new Date(m.created_at)
        })) || []);
      }
    } catch (err) {
      console.error('Erreur chargement messages:', err);
      setError('Impossible de charger les messages');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteThread = async (threadId: string) => {
    try {
      await fetch(`/api/assistant/threads/${threadId}`, { method: 'DELETE' });
      setThreads(prev => prev.filter(t => t.id !== threadId));
      if (currentThreadId === threadId) {
        createNewThread();
      }
    } catch (err) {
      console.error('Erreur suppression thread:', err);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          threadId: currentThreadId,
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Utiliser le message d'erreur de l'API s'il existe
        const errorMessage = data?.error || 'Erreur de communication avec l\'assistant';
        throw new Error(errorMessage);
      }

      // Update thread ID if new conversation
      if (data.threadId && !currentThreadId) {
        setCurrentThreadId(data.threadId);
        fetchThreads(); // Refresh thread list
      }

      const assistantMessage: Message = {
        id: data.messageId || crypto.randomUUID(),
        role: 'assistant',
        content: data.response || data.content || 'Désolé, je n\'ai pas pu répondre.',
        toolCalls: data.toolCalls,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Erreur envoi message:', err);
      setError(err.message || 'Une erreur est survenue');
      
      // Add error message
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Désolé, une erreur est survenue. Veuillez réessayer.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    handleSubmit();
  };

  const suggestions = suggestionsByRole[userRole] || suggestionsByRole.owner;

  return (
    <>
      {/* Floating Trigger Button */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className={cn(
            "rounded-full w-14 h-14 shadow-lg",
            "bg-gradient-to-r from-violet-600 to-indigo-600",
            "hover:from-violet-700 hover:to-indigo-700",
            "transition-all duration-300 hover:scale-110",
            "group"
          )}
        >
          <Sparkles className="h-6 w-6 text-white group-hover:animate-pulse" />
        </Button>
        
        {/* Keyboard hint */}
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Badge variant="secondary" className="text-xs whitespace-nowrap">
            ⌘K
          </Badge>
        </div>
      </motion.div>

      {/* Assistant Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent 
          side="right" 
          className="w-full sm:w-[440px] p-0 flex flex-col bg-background/95 backdrop-blur-sm"
        >
          {/* Header */}
          <SheetHeader className="p-4 border-b bg-gradient-to-r from-violet-600/10 to-indigo-600/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <SheetTitle className="text-lg">Tom Assistant</SheetTitle>
                  <SheetDescription className="text-xs">
                    IA • LangGraph • GPT-4o
                  </SheetDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowHistory(!showHistory)}
                  className="h-8 w-8"
                >
                  <Clock className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={createNewThread}
                  className="h-8 w-8"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          {/* History Panel */}
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-b overflow-hidden"
              >
                <div className="p-2 max-h-48 overflow-y-auto">
                  <p className="text-xs text-muted-foreground px-2 py-1">
                    Conversations récentes
                  </p>
                  {threads.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-2 py-4 text-center">
                      Aucune conversation
                    </p>
                  ) : (
                    threads.slice(0, 5).map((thread) => (
                      <div
                        key={thread.id}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg cursor-pointer",
                          "hover:bg-muted/50 transition-colors",
                          currentThreadId === thread.id && "bg-muted"
                        )}
                        onClick={() => selectThread(thread.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {thread.title || 'Nouvelle conversation'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {thread.messageCount} messages
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteThread(thread.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages Area */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-violet-600/20 to-indigo-600/20 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-violet-600" />
                </div>
                <h3 className="font-semibold mb-2">Comment puis-je vous aider ?</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Je peux rechercher vos biens, locataires, paiements, créer des tickets et plus encore.
                </p>
                
                {/* Quick suggestions */}
                <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                  {suggestions.map((suggestion, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="text-xs h-auto py-2 px-3 justify-start"
                      onClick={() => {
                        setInput(suggestion);
                        setTimeout(() => handleSubmit(), 100);
                      }}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex gap-3",
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                    )}
                    
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-2.5",
                        message.role === 'user'
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      
                      {/* Tool calls badges */}
                      {message.toolCalls && message.toolCalls.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/50">
                          {message.toolCalls.map((tool, i) => (
                            <Badge 
                              key={i} 
                              variant="secondary" 
                              className="text-xs gap-1"
                            >
                              {toolIcons[tool.name] || <Wrench className="h-3 w-3" />}
                              {tool.name.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {message.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-3 items-start"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-muted rounded-2xl px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Error display */}
          {error && (
            <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
              <p className="text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t bg-background">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Posez votre question..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                type="submit" 
                size="icon"
                disabled={!input.trim() || isLoading}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Tom peut faire des erreurs. Vérifiez les informations importantes.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

