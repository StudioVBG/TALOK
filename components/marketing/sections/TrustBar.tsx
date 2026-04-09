"use client"

import { useTheme } from "next-themes"
import { Sparkles } from "@/components/ui/sparkles"
import { InfiniteSlider } from "@/components/ui/infinite-slider"
import { ProgressiveBlur } from "@/components/ui/progressive-blur"

const items = [
  { emoji: "🤖", title: "Intelligence artificielle", desc: "Incluse dans tous les plans" },
  { emoji: "✅", title: "Toujours conforme à la loi", desc: "Mis à jour automatiquement" },
  { emoji: "📱", title: "App iPhone & Android", desc: "Gérez depuis votre téléphone" },
  { emoji: "🔒", title: "Données sécurisées en France", desc: "Hébergement français certifié" },
  { emoji: "🇲🇶", title: "Né en Martinique", desc: "France d\u2019outre-mer intégrée nativement" },
]

export function TrustBar() {
  const { resolvedTheme } = useTheme()

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto mt-16 w-full px-4">
        <div className="relative h-[70px] w-full">
          <InfiniteSlider
            className="flex h-full w-full items-center"
            duration={25}
            gap={56}
          >
            {items.map((item) => (
              <div key={item.title} className="flex shrink-0 items-center gap-3">
                <span className="text-[32px]">{item.emoji}</span>
                <div>
                  <div className="text-[15px] font-semibold text-[#1B2A6B] dark:text-white whitespace-nowrap">
                    {item.title}
                  </div>
                  <div className="text-[13px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </InfiniteSlider>
          <ProgressiveBlur
            className="pointer-events-none absolute top-0 left-0 h-full w-[200px]"
            direction="left"
            blurIntensity={1}
          />
          <ProgressiveBlur
            className="pointer-events-none absolute top-0 right-0 h-full w-[200px]"
            direction="right"
            blurIntensity={1}
          />
        </div>
      </div>

      <div className="relative -mt-16 h-48 w-full overflow-hidden [mask-image:radial-gradient(50%_50%,white,transparent)]">
        <div className="absolute inset-0 before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_bottom_center,#3b82f6,transparent_70%)] before:opacity-40" />
        <div className="absolute -left-1/2 top-1/2 aspect-[1/0.7] z-10 w-[200%] rounded-[100%] border-t border-zinc-900/20 dark:border-white/20 bg-white dark:bg-zinc-900" />
        <Sparkles
          density={1200}
          className="absolute inset-x-0 bottom-0 h-full w-full [mask-image:radial-gradient(50%_50%,white,transparent_85%)]"
          color={resolvedTheme === "dark" ? "#ffffff" : "#000000"}
        />
      </div>
    </section>
  )
}
