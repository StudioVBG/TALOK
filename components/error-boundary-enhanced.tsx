"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";
import { captureException, addBreadcrumb } from "@/lib/monitoring/error-reporter";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary amélioré avec:
 * - Reporting automatique des erreurs
 * - UI de fallback personnalisable
 * - Options de récupération
 * - Affichage des détails en dev
 */
export class ErrorBoundaryEnhanced extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Reporter l'erreur
    captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });

    addBreadcrumb("Error boundary caught error", "error", {
      error: error.message,
    });

    // Callback personnalisé
    this.props.onError?.(error, errorInfo);

    // Log en dev
    if (process.env.NODE_ENV === "development") {
      console.group("🔴 Error Boundary");
      console.error("Error:", error);
      console.error("Component Stack:", errorInfo.componentStack);
      console.groupEnd();
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      // Fallback personnalisé
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = process.env.NODE_ENV === "development";
      const showDetails = this.props.showDetails ?? isDev;

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <Card className="max-w-lg w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-xl">Une erreur est survenue</CardTitle>
              <CardDescription>
                Nous sommes désolés, quelque chose s'est mal passé.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {showDetails && this.state.error && (
                <div className="p-4 bg-muted rounded-lg overflow-auto max-h-48">
                  <p className="font-mono text-sm text-red-600 dark:text-red-400">
                    {this.state.error.message}
                  </p>
                  {isDev && this.state.errorInfo?.componentStack && (
                    <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack.slice(0, 500)}
                    </pre>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={this.handleReset}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Réessayer
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={this.handleReload}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recharger
                </Button>
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={this.handleGoHome}
                >
                  <Home className="mr-2 h-4 w-4" />
                  Accueil
                </Button>
              </div>

              {isDev && (
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Bug className="h-3 w-3" />
                    Mode développement - Les détails sont affichés
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook pour utiliser l'error boundary de manière déclarative
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = React.useCallback((error: Error) => {
    captureException(error);
    setError(error);
  }, []);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  // Re-throw pour que l'error boundary le capture
  if (error) {
    throw error;
  }

  return { handleError, resetError };
}

export default ErrorBoundaryEnhanced;

