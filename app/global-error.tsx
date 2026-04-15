"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "root-layout", digest: error.digest },
    });
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: "'Manrope', sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          margin: 0,
          backgroundColor: "#f8fafc",
          color: "#1e293b",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: "480px" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            Une erreur inattendue est survenue
          </h2>
          <p style={{ color: "#64748b", marginBottom: "1.5rem", lineHeight: 1.6 }}>
            Notre équipe a été notifiée automatiquement. Vous pouvez réessayer ou revenir à l&apos;accueil.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                padding: "0.625rem 1.25rem",
                backgroundColor: "#2563EB",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Manrope', sans-serif",
              }}
            >
              Réessayer
            </button>
            <a
              href="/"
              style={{
                padding: "0.625rem 1.25rem",
                backgroundColor: "transparent",
                color: "#2563EB",
                border: "1px solid #2563EB",
                borderRadius: "0.5rem",
                fontWeight: 600,
                textDecoration: "none",
                fontFamily: "'Manrope', sans-serif",
              }}
            >
              Retour à l&apos;accueil
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
