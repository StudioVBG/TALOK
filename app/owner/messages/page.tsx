"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessagesPageContent } from "@/components/messages/MessagesPageContent";

export default function OwnerMessagesPage() {
  const router = useRouter();
  const onNotAuthenticated = useCallback(() => {
    router.replace("/auth/signin");
  }, [router]);

  return (
    <MessagesPageContent
      subtitle="Communiquez avec vos locataires"
      onNotAuthenticated={onNotAuthenticated}
    />
  );
}
