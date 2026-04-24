import Link from "next/link";
import { ProductDropdown } from "./ProductDropdown";
import { SolutionsDropdown } from "./SolutionsDropdown";

export function DesktopNav({ className = "" }: { className?: string }) {
  return (
    <nav className={`items-center gap-1 ${className}`}>
      <ProductDropdown />
      <SolutionsDropdown />
      <Link
        href="/pricing"
        className="group relative px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-[#1B2A6B]"
      >
        Tarifs
        <span className="absolute bottom-0 left-3 right-3 h-[2px] origin-left scale-x-0 bg-[#2563EB] transition-transform duration-200 group-hover:scale-x-100" />
      </Link>
    </nav>
  );
}
