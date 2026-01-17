/**
 * Retry utility with exponential backoff
 *
 * Permet de réessayer automatiquement les appels API en cas d'échec
 * avec un délai croissant entre les tentatives.
 */

export interface RetryOptions {
  /** Nombre maximum de tentatives (défaut: 3) */
  maxRetries?: number;
  /** Délai initial en ms (défaut: 1000) */
  initialDelayMs?: number;
  /** Multiplicateur pour le backoff (défaut: 2) */
  backoffMultiplier?: number;
  /** Délai maximum entre les tentatives en ms (défaut: 30000) */
  maxDelayMs?: number;
  /** Fonction pour déterminer si une erreur est retriable */
  isRetryable?: (error: Error) => boolean;
  /** Callback appelé à chaque retry */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
  isRetryable: (error: Error) => {
    // Retry sur erreurs réseau ou rate limit
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('econnreset') ||
      message.includes('enotfound')
    );
  },
  onRetry: () => {},
};

/**
 * Attend un certain délai
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calcule le délai pour une tentative donnée avec jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  backoffMultiplier: number,
  maxDelayMs: number
): number {
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Ajouter du jitter (±25%) pour éviter les thundering herds
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(cappedDelay + jitter);
}

/**
 * Exécute une fonction avec retry automatique
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => sendEmailViaResend(options),
 *   { maxRetries: 3, initialDelayMs: 1000 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const isLastAttempt = attempt === opts.maxRetries;
      const shouldRetry = !isLastAttempt && opts.isRetryable(error);

      if (!shouldRetry) {
        throw error;
      }

      const delay = calculateDelay(
        attempt,
        opts.initialDelayMs,
        opts.backoffMultiplier,
        opts.maxDelayMs
      );

      console.warn(
        `[Retry] Tentative ${attempt}/${opts.maxRetries} échouée: ${error.message}. ` +
        `Nouvelle tentative dans ${delay}ms...`
      );

      opts.onRetry(error, attempt, delay);
      await sleep(delay);
    }
  }

  // Ne devrait jamais arriver mais TypeScript l'exige
  throw lastError || new Error('Retry failed');
}

/**
 * Wrapper pour créer une fonction avec retry intégré
 *
 * @example
 * ```typescript
 * const sendWithRetry = createRetryableFunction(
 *   sendEmail,
 *   { maxRetries: 3 }
 * );
 * await sendWithRetry({ to: 'test@example.com', ... });
 * ```
 */
export function createRetryableFunction<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}
