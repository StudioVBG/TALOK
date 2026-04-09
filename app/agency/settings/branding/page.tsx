"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandingEditor } from "@/components/agency/BrandingEditor";
import { DomainVerifier } from "@/components/agency/DomainVerifier";
import { useWhiteLabelConfig } from "@/lib/hooks/use-whitelabel-config";
import { PlanGate } from "@/components/subscription/plan-gate";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export default function BrandingSettingsPage() {
  const { config, isLoading, updateConfig, verifyDomain } = useWhiteLabelConfig();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <PlanGate feature="white_label" mode="block">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Back link */}
        <motion.div variants={itemVariants}>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/agency/settings">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour aux parametres
            </Link>
          </Button>
        </motion.div>

        {/* Header */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
              <Palette className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                White-label & Branding
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Personnalisez l&apos;apparence de votre espace agence
              </p>
            </div>
          </div>
        </motion.div>

        {/* Branding Editor */}
        <motion.div variants={itemVariants}>
          <BrandingEditor
            config={config}
            onSave={async (updates) => {
              await updateConfig(updates);
            }}
          />
        </motion.div>

        {/* Domain Verifier */}
        <motion.div variants={itemVariants}>
          <DomainVerifier
            domain={config?.custom_domain || null}
            subdomain={config?.subdomain || null}
            domainVerified={config?.domain_verified || false}
            onDomainChange={async (domain) => {
              await updateConfig({ custom_domain: domain } as any);
            }}
            onVerify={verifyDomain}
          />
        </motion.div>
      </motion.div>
    </PlanGate>
  );
}
