/**
 * Layout de base React Email pour Talok
 *
 * Remplace le baseLayout() HTML string de templates.ts.
 * Utilise les composants React Email pour la compatibilite multi-client.
 *
 * Usage :
 * ```tsx
 * <TalokEmailLayout preheader="Votre quittance est prête">
 *   <EmailHeading>Titre</EmailHeading>
 *   <EmailText>Contenu...</EmailText>
 *   <EmailButton href="https://talok.fr/...">Action</EmailButton>
 * </TalokEmailLayout>
 * ```
 */

import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
  Button,
  Heading,
} from "@react-email/components";
import * as React from "react";

// Design system Talok
const COLORS = {
  primary: "#2563eb",
  primaryDark: "#1d4ed8",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray500: "#6b7280",
  gray700: "#374151",
  gray900: "#111827",
};

// =============================================================================
// Layout principal
// =============================================================================

interface TalokEmailLayoutProps {
  preheader?: string;
  children: React.ReactNode;
}

export function TalokEmailLayout({ preheader, children }: TalokEmailLayoutProps) {
  return (
    <Html lang="fr">
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      {preheader && <Preview>{preheader}</Preview>}
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header avec logo */}
          <Section style={styles.header}>
            <Link href="https://talok.fr" style={styles.logoLink}>
              <Text style={styles.logoText}>TALOK</Text>
            </Link>
          </Section>

          {/* Contenu */}
          <Section style={styles.content}>
            {children}
          </Section>

          {/* Footer */}
          <Hr style={styles.hr} />
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Cet email a ete envoye par Talok — Logiciel de gestion locative
            </Text>
            <Text style={styles.footerText}>
              <Link href="https://talok.fr" style={styles.footerLink}>talok.fr</Link>
              {" | "}
              <Link href="mailto:support@talok.fr" style={styles.footerLink}>support@talok.fr</Link>
            </Text>
            <Text style={styles.footerMuted}>
              Si vous ne souhaitez plus recevoir ces notifications, modifiez vos
              preferences dans votre espace Talok.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// =============================================================================
// Composants reutilisables
// =============================================================================

export function EmailHeading({ children }: { children: React.ReactNode }) {
  return <Heading style={styles.heading}>{children}</Heading>;
}

export function EmailText({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <Text style={muted ? styles.textMuted : styles.text}>{children}</Text>;
}

interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "success" | "warning";
}

export function EmailButton({ href, children, variant = "primary" }: EmailButtonProps) {
  const bgColor = variant === "success" ? COLORS.success : variant === "warning" ? COLORS.warning : COLORS.primary;
  return (
    <Button
      href={href}
      style={{ ...styles.button, backgroundColor: bgColor }}
    >
      {children}
    </Button>
  );
}

export function EmailCard({ children }: { children: React.ReactNode }) {
  return <Section style={styles.card}>{children}</Section>;
}

export function EmailKeyValue({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.text}>
      <span style={{ color: COLORS.gray500 }}>{label} : </span>
      <strong>{value}</strong>
    </Text>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  body: {
    backgroundColor: COLORS.gray100,
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    margin: "0",
    padding: "0",
  } as React.CSSProperties,
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    overflow: "hidden" as const,
  } as React.CSSProperties,
  header: {
    background: `linear-gradient(135deg, ${COLORS.primaryDark}, ${COLORS.primary})`,
    padding: "24px 32px",
    textAlign: "center" as const,
  } as React.CSSProperties,
  logoLink: {
    textDecoration: "none",
  } as React.CSSProperties,
  logoText: {
    color: "#ffffff",
    fontSize: "28px",
    fontWeight: "800" as const,
    letterSpacing: "2px",
    margin: "0",
  } as React.CSSProperties,
  content: {
    padding: "32px",
  } as React.CSSProperties,
  heading: {
    color: COLORS.gray900,
    fontSize: "22px",
    fontWeight: "700" as const,
    lineHeight: "1.3",
    margin: "0 0 16px 0",
  } as React.CSSProperties,
  text: {
    color: COLORS.gray700,
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 12px 0",
  } as React.CSSProperties,
  textMuted: {
    color: COLORS.gray500,
    fontSize: "14px",
    lineHeight: "1.5",
    margin: "0 0 12px 0",
  } as React.CSSProperties,
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: "8px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: "600" as const,
    padding: "12px 24px",
    textDecoration: "none",
    textAlign: "center" as const,
  } as React.CSSProperties,
  card: {
    backgroundColor: COLORS.gray50,
    borderRadius: "8px",
    border: `1px solid ${COLORS.gray200}`,
    padding: "20px",
    margin: "16px 0",
  } as React.CSSProperties,
  hr: {
    borderColor: COLORS.gray200,
    margin: "24px 0",
  } as React.CSSProperties,
  footer: {
    padding: "0 32px 24px",
    textAlign: "center" as const,
  } as React.CSSProperties,
  footerText: {
    color: COLORS.gray500,
    fontSize: "13px",
    margin: "0 0 4px 0",
  } as React.CSSProperties,
  footerLink: {
    color: COLORS.primary,
    textDecoration: "none",
  } as React.CSSProperties,
  footerMuted: {
    color: COLORS.gray500,
    fontSize: "11px",
    margin: "12px 0 0 0",
  } as React.CSSProperties,
};
