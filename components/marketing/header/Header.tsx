"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";
import { CTAButtons } from "./CTAButtons";

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="Talok — accueil">
          <Image
            src="/images/talok-logo-horizontal.png"
            alt="TALOK"
            width={160}
            height={64}
            className="h-14 w-auto"
            priority
          />
        </Link>

        <DesktopNav className="hidden lg:flex" />

        <div className="flex items-center gap-2">
          <CTAButtons />
          <MobileNav className="lg:hidden" />
        </div>
      </div>
    </header>
  );
}
