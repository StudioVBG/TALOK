"use client";

import { useEffect } from "react";

/**
 * Page d'erreur globale pour les erreurs au niveau du root layout
 * Cette page doit inclure les balises html et body car le layout peut être cassé
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // En production, envoyer à Sentry ou autre service de monitoring
    console.error("Critical global error:", error);
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            background: "linear-gradient(to bottom right, #f8fafc, #e2e8f0)",
          }}
        >
          <div
            style={{
              maxWidth: "28rem",
              width: "100%",
              background: "white",
              borderRadius: "1rem",
              boxShadow:
                "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
              padding: "2rem",
              textAlign: "center",
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: "4rem",
                height: "4rem",
                margin: "0 auto 1.5rem",
                background: "#fee2e2",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>

            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: "700",
                color: "#1e293b",
                marginBottom: "0.5rem",
              }}
            >
              Erreur critique
            </h1>

            <p
              style={{
                color: "#64748b",
                marginBottom: "1.5rem",
              }}
            >
              Une erreur inattendue s&apos;est produite. Veuillez rafraîchir la page
              ou retourner à l&apos;accueil.
            </p>

            {process.env.NODE_ENV === "development" && (
              <div
                style={{
                  background: "#f1f5f9",
                  borderRadius: "0.5rem",
                  padding: "1rem",
                  marginBottom: "1.5rem",
                  textAlign: "left",
                }}
              >
                <p
                  style={{
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                    color: "#dc2626",
                    wordBreak: "break-all",
                  }}
                >
                  {error.message}
                </p>
                {error.digest && (
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "#94a3b8",
                      marginTop: "0.5rem",
                    }}
                  >
                    Digest: {error.digest}
                  </p>
                )}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                justifyContent: "center",
              }}
            >
              <button
                onClick={() => (window.location.href = "/")}
                style={{
                  padding: "0.625rem 1.25rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0",
                  background: "white",
                  color: "#1e293b",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                Accueil
              </button>
              <button
                onClick={reset}
                style={{
                  padding: "0.625rem 1.25rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  background: "#6366f1",
                  color: "white",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                Réessayer
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}


