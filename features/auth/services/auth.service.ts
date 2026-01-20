import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import { getAuthCallbackUrl, getResetPasswordUrl } from "@/lib/utils/redirect-url";

export interface SignUpData {
  email: string;
  password: string;
  role: UserRole;
  prenom: string;
  nom: string;
  telephone?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export class AuthService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  async signUp(data: SignUpData) {
    // Normaliser l'email de la même manière que lors de la connexion
    const normalizedEmail = data.email.trim().toLowerCase();
    
    // Créer l'utilisateur avec le rôle dans les metadata pour que le trigger le lise
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email: normalizedEmail,
      password: data.password,
      options: {
        data: {
          role: data.role, // Passer le rôle dans les metadata
          prenom: data.prenom,
          nom: data.nom,
          telephone: data.telephone,
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("User creation failed");

    // Le profil est créé automatiquement par le trigger handle_new_user
    // qui lit le rôle, prénom, nom et téléphone depuis les metadata de l'utilisateur
    // Donc pas besoin de faire un upsert ici
    
    return authData;
  }

  async signIn(data: SignInData) {
    try {
      const normalizedEmail = data.email.trim().toLowerCase();
      console.log("[AuthService] Tentative de connexion avec email normalisé:", normalizedEmail);
      
      const { data: authData, error } = await this.supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: data.password,
      });

      if (error) {
        console.error("[AuthService] Erreur Supabase:", {
          message: error.message,
          status: error.status,
          code: error.code,
          email_used: normalizedEmail,
        });
        
        // Améliorer les messages d'erreur
        if (error.message?.includes("Invalid login credentials") || error.status === 400) {
          const improvedError = new Error("Email ou mot de passe incorrect. Vérifiez vos identifiants.");
          (improvedError as any).code = error.code;
          (improvedError as any).status = error.status;
          throw improvedError;
        }
        if (error.message?.includes("Email not confirmed") || error.message?.includes("email_not_confirmed")) {
          const improvedError = new Error("Veuillez confirmer votre email avant de vous connecter");
          (improvedError as any).code = error.code;
          (improvedError as any).status = error.status;
          throw improvedError;
        }
        throw error;
      }

      console.log("[AuthService] Connexion réussie pour:", normalizedEmail);
      return authData;
    } catch (error: unknown) {
      // Logger toutes les erreurs pour le debug (sauf les 400 normales)
      if (error.status !== 400) {
        console.error("[AuthService] Erreur d'authentification:", {
          message: error.message,
          status: error.status,
          code: error.code,
        });
      }
      throw error;
    }
  }

  /**
   * Déconnexion SOTA 2026
   * - Déconnexion Supabase
   * - Nettoyage complet du cache client
   * - Ne throw jamais pour garantir la redirection
   */
  async signOut(): Promise<void> {
    try {
      console.log("[AuthService] Déconnexion en cours...");

      // 1. Déconnecter de Supabase
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        console.error("[AuthService] Erreur Supabase signOut:", error);
        // On continue quand même pour nettoyer le client
      }

      // 2. Nettoyer le localStorage/sessionStorage (cache client)
      if (typeof window !== "undefined") {
        try {
          // Supprimer les tokens Supabase
          const keysToRemove = Object.keys(localStorage).filter(
            (key) => key.startsWith("sb-") || key.includes("supabase")
          );
          keysToRemove.forEach((key) => localStorage.removeItem(key));

          // Supprimer aussi de sessionStorage
          const sessionKeys = Object.keys(sessionStorage).filter(
            (key) => key.startsWith("sb-") || key.includes("supabase")
          );
          sessionKeys.forEach((key) => sessionStorage.removeItem(key));

          console.log("[AuthService] Cache local nettoyé");
        } catch (storageError) {
          console.warn("[AuthService] Erreur nettoyage storage:", storageError);
        }
      }

      console.log("[AuthService] Déconnexion réussie");
    } catch (error) {
      console.error("[AuthService] Erreur lors de la déconnexion:", error);
      // On ne throw pas, on veut quand même permettre la redirection
    }
  }

  async sendMagicLink(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const redirectUrl = getAuthCallbackUrl();
    const { error } = await this.supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) throw error;
  }

  async resetPassword(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const redirectUrl = getResetPasswordUrl();
    const { error } = await this.supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: redirectUrl,
    });

    if (error) throw error;
  }

  async resendConfirmationEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const redirectUrl = getAuthCallbackUrl();
    
    // Cette méthode peut fonctionner sans session active
    // On utilise directement l'email fourni
    const { error } = await this.supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      // Si erreur liée à la session, on peut quand même essayer
      // car resend peut fonctionner sans session si l'email est fourni
      if (
        error.message?.includes("session") ||
        error.message?.includes("Auth session missing")
      ) {
        // Créer un nouveau client pour forcer l'envoi sans session
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error: retryError } = await supabase.auth.resend({
          type: "signup",
          email: normalizedEmail,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });
        if (retryError) throw retryError;
      } else {
        throw error;
      }
    }
  }

  async getUser() {
    const { data: { user }, error } = await this.supabase.auth.getUser();
    if (error) throw error;
    return user;
  }

  async getProfile() {
    try {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      
      if (userError) {
        console.error("[AuthService] Erreur récupération user:", userError);
        throw userError;
      }
      
      if (!user) {
        console.warn("[AuthService] Aucun utilisateur trouvé");
        return null;
      }

      console.log("[AuthService] Récupération profil pour user_id:", user.id);

      // Essayer d'abord avec .single()
      const { data: profile, error } = await this.supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id as any)
        .maybeSingle(); // Utiliser maybeSingle() pour éviter les erreurs si pas de profil

      if (error) {
        console.error("[AuthService] Erreur récupération profil:", error);
        // Si erreur RLS, essayer via API
        if (error.code === "42501" || error.code === "42P17") {
          console.warn("[AuthService] Erreur RLS détectée, tentative via API...");
          try {
            const response = await fetch("/api/me/profile", {
              credentials: "include",
            });
            if (response.ok) {
              const apiProfile = await response.json();
              console.log("[AuthService] Profil récupéré via API:", apiProfile?.role);
              return apiProfile;
            }
          } catch (apiError) {
            console.error("[AuthService] Erreur API fallback:", apiError);
          }
        }
        if (error.code === "PGRST116") {
          console.warn("[AuthService] Aucun profil trouvé (PGRST116)");
          return null;
        }
        throw error;
      }

      console.log("[AuthService] Profil récupéré:", profile?.role);
      return profile;
    } catch (error: unknown) {
      console.error("[AuthService] Erreur dans getProfile:", error);
      throw error;
    }
  }

  /**
   * Connexion OAuth avec Google
   */
  async signInWithGoogle() {
    const redirectUrl = getAuthCallbackUrl();
    console.log("[AuthService] Démarrage OAuth Google, redirect:", redirectUrl);
    
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      console.error("[AuthService] Erreur OAuth Google:", error);
      throw error;
    }

    return data;
  }

  /**
   * Connexion OAuth avec GitHub
   */
  async signInWithGitHub() {
    const redirectUrl = getAuthCallbackUrl();
    console.log("[AuthService] Démarrage OAuth GitHub, redirect:", redirectUrl);
    
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error("[AuthService] Erreur OAuth GitHub:", error);
      throw error;
    }

    return data;
  }

  /**
   * Connexion OAuth avec Apple
   */
  async signInWithApple() {
    const redirectUrl = getAuthCallbackUrl();
    console.log("[AuthService] Démarrage OAuth Apple, redirect:", redirectUrl);
    
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: redirectUrl,
        // Apple-specific options
        scopes: "name email",
      },
    });

    if (error) {
      console.error("[AuthService] Erreur OAuth Apple:", error);
      throw error;
    }

    return data;
  }

  /**
   * Connexion OAuth générique
   */
  async signInWithOAuth(provider: "google" | "github" | "azure" | "apple") {
    const redirectUrl = getAuthCallbackUrl();
    console.log(`[AuthService] Démarrage OAuth ${provider}, redirect:`, redirectUrl);
    
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error(`[AuthService] Erreur OAuth ${provider}:`, error);
      throw error;
    }

    return data;
  }
}

export const authService = new AuthService();

// ============ PASSKEY AUTH FUNCTIONS ============

/**
 * Authentification via Passkey (WebAuthn) - SOTA 2026
 */
export async function signInWithPasskey(email?: string): Promise<{
  success: boolean;
  user?: { id: string; email: string };
  error?: string;
}> {
  try {
    // 1. Obtenir les options d'authentification
    const optionsResponse = await fetch("/api/auth/passkeys/authenticate/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const options = await optionsResponse.json();

    if (!optionsResponse.ok) {
      return { success: false, error: options.error };
    }

    // 2. Authentifier avec WebAuthn
    const { authenticateWithPasskey } = await import("@/lib/auth/passkeys");
    const credential = await authenticateWithPasskey(options);

    // 3. Vérifier côté serveur
    const verifyResponse = await fetch("/api/auth/passkeys/authenticate/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credential,
        challengeId: options.challengeId,
      }),
    });

    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok) {
      return { success: false, error: verifyData.error };
    }

    return {
      success: true,
      user: verifyData.user,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur d'authentification passkey",
    };
  }
}

