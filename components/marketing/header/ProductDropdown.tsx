"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { PRODUCT_ITEMS } from "./nav-items";

export function ProductDropdown() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="group flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-600 outline-none transition-colors hover:text-[#1B2A6B] data-[state=open]:text-[#1B2A6B]"
      >
        <span>Produit</span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={8}
          align="start"
          className="z-50 min-w-[260px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[side=bottom]:slide-in-from-top-2"
        >
          {PRODUCT_ITEMS.map((item) => (
            <DropdownMenu.Item key={item.href} asChild>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-50 hover:text-[#1B2A6B] focus:bg-slate-50 focus:text-[#1B2A6B] cursor-pointer"
              >
                <item.icon className="h-4 w-4 text-[#2563EB]" />
                <span>{item.label}</span>
              </Link>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
