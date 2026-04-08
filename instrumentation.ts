/**
 * Instrumentation Next.js
 * Initialise Sentry, OpenTelemetry et autres outils de monitoring au demarrage
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Initialiser Sentry cote serveur Node.js
    await import("./sentry.server.config");

    // Initialiser OpenTelemetry si configure
    // Sentry v10+ consomme les spans OTEL automatiquement
    if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
      const { NodeSDK } = await import("@opentelemetry/sdk-node");
      const { OTLPTraceExporter } = await import(
        "@opentelemetry/exporter-trace-otlp-http"
      );
      const { HttpInstrumentation } = await import(
        "@opentelemetry/instrumentation-http"
      );
      const { FetchInstrumentation } = await import(
        "@opentelemetry/instrumentation-fetch"
      );

      const sdk = new NodeSDK({
        serviceName: "talok-api",
        traceExporter: new OTLPTraceExporter({
          url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
        }),
        instrumentations: [
          new HttpInstrumentation(),
          new FetchInstrumentation(),
        ],
      });

      sdk.start();
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Initialiser Sentry pour Edge Runtime
    await import("./sentry.edge.config");
  }
}

