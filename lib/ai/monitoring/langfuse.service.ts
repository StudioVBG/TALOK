/**
 * Service Langfuse - Monitoring IA
 * SOTA 2026 - Observabilité et Analytics
 * 
 * Langfuse permet de :
 * - Tracer les appels LLM (latence, tokens, coûts)
 * - Analyser les conversations
 * - Détecter les problèmes de qualité
 * - Optimiser les prompts
 */

// Note: Installer avec `npm install langfuse`
// Si Langfuse n'est pas installé, ce service fonctionne en mode silencieux

// ============================================
// TYPES
// ============================================

export interface TraceOptions {
  name: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface SpanOptions {
  name: string;
  traceId: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
}

export interface TraceEndOptions {
  output?: string;
  metadata?: Record<string, unknown>;
  level?: "default" | "debug" | "warning" | "error";
}

export interface GenerationOptions {
  traceId: string;
  name: string;
  model: string;
  input: unknown;
  output?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, unknown>;
}

// ============================================
// SERVICE
// ============================================

class LangfuseService {
  private client: any = null;
  private enabled: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialise le client Langfuse
   */
  private async initialize() {
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const baseUrl = process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com";

    if (!publicKey || !secretKey) {
      console.log("[Langfuse] Keys not configured, monitoring disabled");
      return;
    }

    try {
      // Import dynamique pour éviter les erreurs si le package n'est pas installé
      // Utiliser eval pour éviter que webpack ne résolve le module au build time
      const langfuseModule = await eval('import("langfuse")');
      const Langfuse = langfuseModule.default || langfuseModule.Langfuse;
      
      this.client = new Langfuse({
        publicKey,
        secretKey,
        baseUrl,
      });

      this.enabled = true;
      console.log("[Langfuse] Monitoring enabled");
    } catch (error) {
      console.warn("[Langfuse] Package not installed, monitoring disabled");
      this.enabled = false;
    }
  }

  /**
   * Démarre un nouveau trace
   */
  async startTrace(options: TraceOptions): Promise<string | null> {
    if (!this.enabled || !this.client) {
      return null;
    }

    try {
      const trace = this.client.trace({
        name: options.name,
        userId: options.userId,
        sessionId: options.sessionId,
        metadata: options.metadata,
        tags: options.tags,
      });

      return trace.id;
    } catch (error) {
      console.warn("[Langfuse] Failed to start trace:", error);
      return null;
    }
  }

  /**
   * Termine un trace
   */
  async endTrace(traceId: string, options?: TraceEndOptions): Promise<void> {
    if (!this.enabled || !this.client || !traceId) {
      return;
    }

    try {
      // Langfuse trace update
      this.client.trace({
        id: traceId,
        output: options?.output,
        metadata: options?.metadata,
        level: options?.level,
      });

      // Flush pour envoyer immédiatement
      await this.client.flush();
    } catch (error) {
      console.warn("[Langfuse] Failed to end trace:", error);
    }
  }

  /**
   * Crée un span dans un trace
   */
  async startSpan(options: SpanOptions): Promise<string | null> {
    if (!this.enabled || !this.client) {
      return null;
    }

    try {
      const span = this.client.span({
        traceId: options.traceId,
        name: options.name,
        input: options.input,
        metadata: options.metadata,
      });

      return span.id;
    } catch (error) {
      console.warn("[Langfuse] Failed to start span:", error);
      return null;
    }
  }

  /**
   * Log une génération LLM
   */
  async logGeneration(options: GenerationOptions): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    try {
      this.client.generation({
        traceId: options.traceId,
        name: options.name,
        model: options.model,
        input: options.input,
        output: options.output,
        usage: options.usage,
        metadata: options.metadata,
      });
    } catch (error) {
      console.warn("[Langfuse] Failed to log generation:", error);
    }
  }

  /**
   * Log un score (feedback utilisateur)
   */
  async logScore(
    traceId: string,
    name: string,
    value: number,
    comment?: string
  ): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    try {
      this.client.score({
        traceId,
        name,
        value,
        comment,
      });
    } catch (error) {
      console.warn("[Langfuse] Failed to log score:", error);
    }
  }

  /**
   * Log un événement
   */
  async logEvent(
    traceId: string,
    name: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    try {
      this.client.event({
        traceId,
        name,
        metadata,
      });
    } catch (error) {
      console.warn("[Langfuse] Failed to log event:", error);
    }
  }

  /**
   * Force l'envoi des données
   */
  async flush(): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    try {
      await this.client.flush();
    } catch (error) {
      console.warn("[Langfuse] Flush failed:", error);
    }
  }

  /**
   * Ferme proprement le client
   */
  async shutdown(): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    try {
      await this.client.shutdown();
    } catch (error) {
      console.warn("[Langfuse] Shutdown failed:", error);
    }
  }

  /**
   * Vérifie si le monitoring est actif
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Singleton
export const langfuseService = new LangfuseService();

export default langfuseService;

