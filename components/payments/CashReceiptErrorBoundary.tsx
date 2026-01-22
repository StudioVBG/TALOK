"use client";

/**
 * Error Boundary pour le flux de paiement en espèces
 * SOTA 2026 - Gestion gracieuse des erreurs
 *
 * Capture les erreurs React et les erreurs réseau
 * pour offrir une UX résiliente
 */

import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw, Home, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// ============================================
// TYPES
// ============================================

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Callback appelé lors d'une erreur */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Callback pour réessayer */
  onRetry?: () => void;
  /** Afficher le bouton de téléchargement du reçu partiel */
  showPartialReceipt?: boolean;
  /** ID de la facture pour le support */
  invoiceId?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorCount: number;
}

// ============================================
// ERROR BOUNDARY CLASS COMPONENT
// ============================================

/**
 * Error Boundary pour capturer les erreurs de rendu React
 * Requis car les hooks ne peuvent pas capturer les erreurs de rendu
 */
export class CashReceiptErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState((prev) => ({
      errorInfo,
      errorCount: prev.errorCount + 1,
    }));

    // Callback parent
    this.props.onError?.(error, errorInfo);

    // Log pour debugging (en dev uniquement)
    if (process.env.NODE_ENV === "development") {
      console.error("[CashReceiptErrorBoundary] Erreur capturée:", error);
      console.error("[CashReceiptErrorBoundary] Component stack:", errorInfo.componentStack);
    }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onRetry?.();
  };

  handleGoHome = (): void => {
    window.location.href = "/dashboard";
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <CashReceiptErrorFallback
          error={this.state.error}
          errorCount={this.state.errorCount}
          invoiceId={this.props.invoiceId}
          showPartialReceipt={this.props.showPartialReceipt}
          onRetry={this.handleRetry}
          onGoHome={this.handleGoHome}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================
// ERROR FALLBACK COMPONENT
// ============================================

interface ErrorFallbackProps {
  error: Error | null;
  errorCount: number;
  invoiceId?: string;
  showPartialReceipt?: boolean;
  onRetry: () => void;
  onGoHome: () => void;
}

/**
 * Composant d'affichage d'erreur avec options de récupération
 */
function CashReceiptErrorFallback({
  error,
  errorCount,
  invoiceId,
  showPartialReceipt,
  onRetry,
  onGoHome,
}: ErrorFallbackProps): JSX.Element {
  const isNetworkError = error?.message?.includes("fetch") ||
    error?.message?.includes("network") ||
    error?.message?.includes("Failed to fetch");

  const isAuthError = error?.message?.includes("401") ||
    error?.message?.includes("authentifié") ||
    error?.message?.includes("Non autorisé");

  const maxRetries = 3;
  const canRetry = errorCount < maxRetries;

  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl border-destructive/20">
      <CardHeader className="bg-destructive/5 border-b border-destructive/10">
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="w-5 h-5" />
          Erreur lors du paiement
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {/* Message d'erreur principal */}
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {isNetworkError
              ? "Problème de connexion"
              : isAuthError
                ? "Session expirée"
                : "Une erreur est survenue"}
          </AlertTitle>
          <AlertDescription>
            {isNetworkError
              ? "Impossible de contacter le serveur. Vérifiez votre connexion internet."
              : isAuthError
                ? "Votre session a expiré. Veuillez vous reconnecter."
                : "Le paiement n'a pas pu être traité. Vos données sont sécurisées."}
          </AlertDescription>
        </Alert>

        {/* Détails techniques (en dev) */}
        {process.env.NODE_ENV === "development" && error && (
          <details className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <summary className="cursor-pointer font-medium">Détails techniques</summary>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap">
              {error.message}
              {"\n\n"}
              Stack: {error.stack}
            </pre>
          </details>
        )}

        {/* Informations de récupération */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Que s'est-il passé ?</strong>
            {" "}Le processus de génération du reçu a rencontré un problème.
          </p>
          <p>
            <strong>Vos données sont-elles perdues ?</strong>
            {" "}Non, aucun paiement n'a été enregistré. Vous pouvez réessayer en toute sécurité.
          </p>
          {invoiceId && (
            <p className="text-xs">
              Référence facture : <code className="bg-muted px-1 rounded">{invoiceId.slice(0, 8)}</code>
            </p>
          )}
        </div>

        {/* Compteur de tentatives */}
        {errorCount > 1 && (
          <p className="text-xs text-amber-600">
            Tentative {errorCount}/{maxRetries} - {canRetry ? "Vous pouvez réessayer" : "Contactez le support"}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row gap-3 bg-muted/30 p-4">
        {/* Bouton Réessayer */}
        {canRetry && (
          <Button onClick={onRetry} className="flex-1 gap-2">
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </Button>
        )}

        {/* Bouton Reçu partiel */}
        {showPartialReceipt && (
          <Button variant="outline" className="flex-1 gap-2">
            <FileText className="w-4 h-4" />
            Télécharger reçu partiel
          </Button>
        )}

        {/* Bouton Retour accueil */}
        <Button variant="ghost" onClick={onGoHome} className="flex-1 gap-2">
          <Home className="w-4 h-4" />
          Retour au tableau de bord
        </Button>
      </CardFooter>
    </Card>
  );
}

// ============================================
// HOOK FOR ASYNC ERROR HANDLING
// ============================================

import { useState, useCallback } from "react";

interface AsyncErrorState {
  error: Error | null;
  isError: boolean;
  reset: () => void;
  captureError: (error: Error) => void;
}

/**
 * Hook pour gérer les erreurs asynchrones (fetch, API calls)
 * Complémentaire à l'Error Boundary pour les erreurs non-rendu
 */
export function useAsyncError(): AsyncErrorState {
  const [error, setError] = useState<Error | null>(null);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  const captureError = useCallback((err: Error) => {
    setError(err);
    // Log pour monitoring
    console.error("[useAsyncError] Erreur async capturée:", err);
  }, []);

  return {
    error,
    isError: error !== null,
    reset,
    captureError,
  };
}

// ============================================
// WRAPPER COMPONENT
// ============================================

import { CashReceiptFlow, type CashReceiptFlowProps } from "./CashReceiptFlow";

interface CashReceiptWithErrorBoundaryProps extends Omit<CashReceiptFlowProps, "onComplete"> {
  onComplete?: CashReceiptFlowProps["onComplete"];
  onError?: (error: Error) => void;
}

/**
 * Wrapper du CashReceiptFlow avec Error Boundary intégré
 * Utiliser ce composant au lieu de CashReceiptFlow directement
 */
export function CashReceiptWithErrorBoundary({
  onError,
  ...props
}: CashReceiptWithErrorBoundaryProps): JSX.Element {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    onError?.(error);

    // Envoyer à un service de monitoring (ex: Sentry)
    // if (typeof window !== "undefined" && window.Sentry) {
    //   window.Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    // }
  };

  return (
    <CashReceiptErrorBoundary
      onError={handleError}
      invoiceId={props.invoiceId}
    >
      <CashReceiptFlow {...props} />
    </CashReceiptErrorBoundary>
  );
}

export default CashReceiptWithErrorBoundary;
