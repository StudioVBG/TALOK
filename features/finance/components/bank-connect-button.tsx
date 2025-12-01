"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Building2 } from "lucide-react";
import { BankSelectionModal } from "./bank-selection-modal";
import { cn } from "@/lib/utils";

interface BankConnectButtonProps {
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
}

export function BankConnectButton({ 
  className, 
  variant = "default",
  size = "default",
  label = "Connecter une banque" 
}: BankConnectButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button 
        onClick={() => setIsModalOpen(true)} 
        className={cn("gap-2 shadow-sm", className)}
        variant={variant}
        size={size}
      >
        <Plus className="w-4 h-4" />
        <Building2 className="w-4 h-4" />
        <span className="hidden sm:inline">{label}</span>
        <span className="inline sm:hidden">Banque</span>
      </Button>

      <BankSelectionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
}

