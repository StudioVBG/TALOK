"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, CreditCard, BookOpen, FileText, Car, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DocumentType, DOCUMENT_TYPES } from "../types";

interface DocumentSelectorProps {
  open: boolean;
  onSelect: (type: DocumentType) => void;
  onClose: () => void;
}

const iconMap = {
  "credit-card": CreditCard,
  "book-open": BookOpen,
  "file-text": FileText,
  car: Car,
};

export function DocumentSelector({ open, onSelect, onClose }: DocumentSelectorProps) {
  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <SheetContent
        side="bottom"
        className="rounded-t-[2rem] bg-white px-0 pb-10 pt-0 border-0 max-h-[85vh]"
      >
        {/* Handle de drag */}
        <div className="flex justify-center py-4">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
        </div>

        {/* Bouton fermer */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>

        {/* Header */}
        <div className="px-6 mb-6 text-center">
          <SheetTitle className="text-xl font-bold text-slate-900">
            Choisir une pièce d&apos;identité
          </SheetTitle>
          <p className="text-slate-500 mt-2">Document français valide à scanner</p>
        </div>

        {/* Options */}
        <div className="px-4 space-y-2">
          <AnimatePresence>
            {DOCUMENT_TYPES.map((doc, index) => {
              const IconComponent = iconMap[doc.icon as keyof typeof iconMap];

              return (
                <motion.button
                  key={doc.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  onClick={() => onSelect(doc.id)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all duration-200 group active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center group-hover:shadow-md transition-shadow">
                      {IconComponent && (
                        <IconComponent className="w-6 h-6 text-slate-600" />
                      )}
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-slate-900">{doc.label}</p>
                      <p className="text-sm text-slate-500">{doc.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Note en bas */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-xs text-slate-400 mt-6 px-6"
        >
          Assurez-vous que votre document est en cours de validité
        </motion.p>
      </SheetContent>
    </Sheet>
  );
}

