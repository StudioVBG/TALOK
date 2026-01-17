/**
 * Client API unifié pour les appels aux routes API Next.js
 */

import { createClient } from "@/lib/supabase/client";

const API_BASE = '/api';

export class ResourceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceNotFoundError";
  }
}

export class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const supabase = createClient();
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // Gérer l'erreur de refresh token invalide
      if (sessionError && (sessionError.message?.includes('refresh_token') || sessionError.message?.includes('Invalid Refresh Token'))) {
        console.error('[api-client] Refresh token invalide, redirection vers connexion');
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth')) {
          // Nettoyer la session invalide
          await supabase.auth.signOut();
          window.location.href = '/auth/signin?error=session_expired';
        }
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }

      const headers = new Headers({
        'Content-Type': 'application/json',
        ...options.headers,
      });

      if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`);
      }

      const url = `${API_BASE}${endpoint}`;
      if (process.env.NODE_ENV === "development") {
        console.log(`[api-client] Request: ${options.method || "GET"} ${url}`);
      }

      // Timeout de 20 secondes pour les requêtes complexes (properties, leases)
      // Augmenté de 10s à 20s pour éviter les timeouts prématurés
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
        signal: controller.signal,
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        console.error(`[api-client] Error ${response.status}:`, error);
        if (response.status === 404) {
          const notFoundError = new ResourceNotFoundError(error.error || "Ressource introuvable");
          (notFoundError as any).statusCode = 404;
          (notFoundError as any).data = error;
          throw notFoundError;
        }
        if (response.status === 400) {
          const badRequestError = new Error(error.error || "Données invalides");
          (badRequestError as any).statusCode = 400;
          (badRequestError as any).data = error;
          throw badRequestError;
        }
        if (response.status === 504) {
          const timeoutError = new Error("Le chargement prend trop de temps. Veuillez réessayer.");
          (timeoutError as any).statusCode = 504;
          (timeoutError as any).data = error;
          throw timeoutError;
        }
        const genericError = new Error(error.error || `Erreur ${response.status}`);
        (genericError as any).statusCode = response.status;
        (genericError as any).data = error;
        throw genericError;
      }

      const data = await response.json();
      // Log minimal seulement en développement pour améliorer les performances
      if (process.env.NODE_ENV === 'development') {
        console.log(`[api-client] ${options.method || 'GET'} ${url} - ${response.status}`);
      }
      return data;
    } catch (error: unknown) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Gérer les erreurs de timeout/abort
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        const timeoutError = new Error("Le chargement prend trop de temps. Veuillez réessayer.");
        (timeoutError as any).statusCode = 504;
        throw timeoutError;
      }
      
      // Propager les autres erreurs (y compris les erreurs de session)
      throw error;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Upload de fichier avec FormData
   */
  async uploadFile<T>(endpoint: string, formData: FormData): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur serveur' }));
      throw new Error(error.error || `Erreur ${response.status}`);
    }

    return response.json();
  }
}

export const apiClient = new ApiClient();

