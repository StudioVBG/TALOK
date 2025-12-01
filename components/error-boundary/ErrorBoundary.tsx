"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/lib/monitoring";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary global pour capturer les erreurs React
 * Affiche une interface de récupération au lieu d'un écran blanc
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Logger l'erreur
    logger.error("React Error Boundary caught an error", {
      error,
      componentStack: errorInfo.componentStack,
    });

    // Callback optionnel
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = (): void => {
    window.location.href = "/";
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Fallback personnalisé
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Interface de récupération par défaut
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
          <Card className="w-full max-w-lg shadow-xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-full w-fit">
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-2xl">Une erreur est survenue</CardTitle>
              <CardDescription className="text-base">
                Nous nous excusons pour ce désagrément. L&apos;erreur a été signalée automatiquement.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {this.props.showDetails && this.state.error && (
                <details className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 text-sm">
                  <summary className="cursor-pointer font-medium flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    Détails techniques
                  </summary>
                  <div className="mt-2 space-y-2">
                    <p className="font-mono text-red-600 dark:text-red-400 break-all">
                      {this.state.error.message}
                    </p>
                    {this.state.error.stack && (
                      <pre className="text-xs text-muted-foreground overflow-x-auto max-h-40 whitespace-pre-wrap">
                        {this.state.error.stack}
                      </pre>
                    )}
                  </div>
                </details>
              )}

              <div className="text-sm text-muted-foreground">
                <p>Que pouvez-vous faire ?</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Rafraîchir la page</li>
                  <li>Retourner à l&apos;accueil</li>
                  <li>Réessayer l&apos;action précédente</li>
                </ul>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={this.handleGoHome}
              >
                <Home className="h-4 w-4 mr-2" />
                Accueil
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={this.handleRetry}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Réessayer
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={this.handleReload}
              >
                Rafraîchir la page
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook pour déclencher une erreur programmatiquement
 * Utile pour tester l'Error Boundary
 */
export function useErrorTrigger(): (message: string) => void {
  const [, setError] = React.useState<Error | null>(null);

  return React.useCallback((message: string) => {
    setError(() => {
      throw new Error(message);
    });
  }, []);
}

/**
 * Composant wrapper pour simplifier l'utilisation
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">
): React.FC<P> {
  const WithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundary.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;

  return WithErrorBoundary;
}

export default ErrorBoundary;


