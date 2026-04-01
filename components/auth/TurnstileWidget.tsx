"use client";

import { Turnstile } from "@marsidev/react-turnstile";

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

/**
 * Cloudflare Turnstile CAPTCHA widget
 * Graceful degradation: renders nothing if site key is not configured
 */
export function TurnstileWidget({ onSuccess, onError, onExpire }: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if (!siteKey) return null;

  return (
    <Turnstile
      siteKey={siteKey}
      onSuccess={onSuccess}
      onError={onError}
      onExpire={onExpire}
      options={{
        theme: "auto",
        size: "flexible",
      }}
    />
  );
}
