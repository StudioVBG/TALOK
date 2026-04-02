"use client"

import { useRef, useState, useEffect, useCallback, useMemo } from "react"
import {
  useScroll,
  useTransform,
  useSpring,
  useInView,
  type MotionValue,
  type Variants,
} from "framer-motion"

/* ─────────────────────────────────────────────
 * useCountUp — Animate a number from 0 to target
 * Triggers when element scrolls into view
 * ───────────────────────────────────────────── */
export function useCountUp(
  target: number,
  duration = 1.5,
  options?: { decimals?: number; prefix?: string; suffix?: string }
) {
  const decimals = options?.decimals ?? 0
  const prefix = options?.prefix ?? ""
  const suffix = options?.suffix ?? ""

  // Format number without locale to avoid SSR/client mismatch
  const formatNum = useCallback(
    (n: number) => {
      const fixed = n.toFixed(decimals)
      // Manual French formatting (space as thousands separator)
      const [int, dec] = fixed.split(".")
      const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0")
      return `${prefix}${dec ? `${formatted},${dec}` : formatted}${suffix}`
    },
    [decimals, prefix, suffix]
  )

  // Initialize with the final value to avoid hydration mismatch
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  const [display, setDisplay] = useState(() => formatNum(target))
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (!inView || hasAnimated.current) return
    hasAnimated.current = true

    // Reset to 0, then animate to target
    setDisplay(formatNum(0))
    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = Math.min((now - startTime) / (duration * 1000), 1)
      const eased = 1 - Math.pow(1 - elapsed, 3)
      setDisplay(formatNum(eased * target))
      if (elapsed < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }, [inView, target, duration, formatNum])

  return { ref, display, inView }
}

/* ─────────────────────────────────────────────
 * useParallax — Scroll-linked Y offset
 * Desktop only, respects reduced motion
 * ───────────────────────────────────────────── */
export function useParallax(speed = 0.15): {
  ref: React.RefObject<HTMLDivElement | null>
  y: MotionValue<number>
} {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  const rawY = useTransform(scrollYProgress, [0, 1], [-40 * speed, 40 * speed])
  const y = useSpring(rawY, { stiffness: 100, damping: 30 })

  return { ref, y }
}

/* ─────────────────────────────────────────────
 * useMagnetic — Cursor-following button effect
 * Desktop only (pointer: fine)
 * ───────────────────────────────────────────── */
export function useMagnetic(strength = 0.3) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const handleMouse = useCallback(
    (e: MouseEvent) => {
      if (!ref.current) return
      // Skip on touch devices
      if (window.matchMedia("(pointer: coarse)").matches) return

      const rect = ref.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      setPosition({
        x: (e.clientX - centerX) * strength,
        y: (e.clientY - centerY) * strength,
      })
    },
    [strength]
  )

  const reset = useCallback(() => setPosition({ x: 0, y: 0 }), [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener("mousemove", handleMouse)
    el.addEventListener("mouseleave", reset)
    return () => {
      el.removeEventListener("mousemove", handleMouse)
      el.removeEventListener("mouseleave", reset)
    }
  }, [handleMouse, reset])

  return { ref, x: position.x, y: position.y }
}

/* ─────────────────────────────────────────────
 * useSplitText — Split text into word spans
 * Returns array of words for staggered reveal
 * ───────────────────────────────────────────── */
export function useSplitText(text: string) {
  return useMemo(() => text.split(/\s+/).filter(Boolean), [text])
}

/* ─────────────────────────────────────────────
 * use3DTilt — Mouse-following 3D card tilt
 * Desktop only (pointer: fine)
 * ───────────────────────────────────────────── */
export function use3DTilt(maxDeg = 6) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 })

  const handleMouse = useCallback(
    (e: MouseEvent) => {
      if (!ref.current) return
      if (window.matchMedia("(pointer: coarse)").matches) return

      const rect = ref.current.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      setTilt({
        rotateX: -y * maxDeg,
        rotateY: x * maxDeg,
      })
    },
    [maxDeg]
  )

  const reset = useCallback(() => setTilt({ rotateX: 0, rotateY: 0 }), [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener("mousemove", handleMouse)
    el.addEventListener("mouseleave", reset)
    return () => {
      el.removeEventListener("mousemove", handleMouse)
      el.removeEventListener("mouseleave", reset)
    }
  }, [handleMouse, reset])

  return { ref, ...tilt }
}

/* ─────────────────────────────────────────────
 * Framer Motion Variant factories
 * ───────────────────────────────────────────── */
const ease = [0.22, 1, 0.36, 1] as const

export const blurUp: Variants = {
  hidden: { opacity: 0, y: 30, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease },
  },
}

export const blurIn: Variants = {
  hidden: { opacity: 0, filter: "blur(10px)", scale: 0.96 },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    scale: 1,
    transition: { duration: 0.6, ease },
  },
}

export const blurWord = (i: number): Variants => ({
  hidden: { opacity: 0, y: 20, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, delay: i * 0.06, ease },
  },
})

export const scaleSpring: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 500, damping: 15 },
  },
}

export const bounceIn: Variants = {
  hidden: { opacity: 0, scale: 0.3 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 600, damping: 12 },
  },
}

export const slideFromLeft: Variants = {
  hidden: { opacity: 0, x: -30, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease },
  },
}

export const slideFromRight: Variants = {
  hidden: { opacity: 0, x: 30, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease },
  },
}

export const drawPath: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.8, ease },
  },
}

export const growBar = (i: number, targetHeight: number): Variants => ({
  hidden: { height: 0, opacity: 0 },
  visible: {
    height: targetHeight,
    opacity: 1,
    transition: { duration: 0.6, delay: i * 0.05, ease },
  },
})
