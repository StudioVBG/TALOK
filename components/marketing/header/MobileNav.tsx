"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Home } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PRODUCT_ITEMS, SOLUTIONS_ITEMS } from "./nav-items";

export function MobileNav({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 ${className}`}
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[300px] p-6 sm:w-[360px]">
        <nav className="mt-8 flex flex-col">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="produit" className="border-b border-slate-100">
              <AccordionTrigger className="py-3 text-sm font-medium text-slate-700 hover:no-underline">
                Produit
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-1 pb-2">
                  {PRODUCT_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={close}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#1B2A6B]"
                    >
                      <item.icon className="h-4 w-4 text-[#2563EB]" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="solutions" className="border-b border-slate-100">
              <AccordionTrigger className="py-3 text-sm font-medium text-slate-700 hover:no-underline">
                Solutions
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-1 pb-2">
                  {SOLUTIONS_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={close}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#1B2A6B]"
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 text-[#2563EB]" />
                        {item.label}
                      </div>
                      {item.badge && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#2563EB]">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Link
            href="/pricing"
            onClick={close}
            className="border-b border-slate-100 py-3 text-sm font-medium text-slate-700 transition-colors hover:text-[#1B2A6B]"
          >
            Tarifs
          </Link>

          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/auth/signin"
              onClick={close}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#2563EB]/30 py-2.5 text-sm font-medium text-[#2563EB]"
            >
              <Home className="h-4 w-4" />
              Mon espace
            </Link>
            <Link
              href="/essai-gratuit"
              onClick={close}
              className="rounded-lg bg-[#2563EB] py-2.5 text-center text-sm font-medium text-white"
            >
              Essai gratuit
            </Link>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
