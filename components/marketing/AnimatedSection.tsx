"use client"

import { motion, type Variants } from "framer-motion"
import { type ReactNode } from "react"

const ease = [0.22, 1, 0.36, 1] as const

const directions = {
  up: {
    hidden: { opacity: 0, y: 40, filter: "blur(6px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)" },
  },
  down: {
    hidden: { opacity: 0, y: -40, filter: "blur(6px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)" },
  },
  left: {
    hidden: { opacity: 0, x: 40, filter: "blur(4px)" },
    visible: { opacity: 1, x: 0, filter: "blur(0px)" },
  },
  right: {
    hidden: { opacity: 0, x: -40, filter: "blur(4px)" },
    visible: { opacity: 1, x: 0, filter: "blur(0px)" },
  },
} satisfies Record<string, Variants>

interface AnimatedSectionProps {
  children: ReactNode
  delay?: number
  direction?: keyof typeof directions
  className?: string
  as?: "div" | "section" | "article" | "li"
}

export function AnimatedSection({
  children,
  delay = 0,
  direction = "up",
  className,
  as = "div",
}: AnimatedSectionProps) {
  const Tag = motion[as]
  const variants = directions[direction]

  return (
    <Tag
      variants={{
        hidden: variants.hidden,
        visible: {
          ...variants.visible,
          transition: { duration: 0.6, delay, ease },
        },
      }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      className={className}
    >
      {children}
    </Tag>
  )
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

export const staggerContainerSlow: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease },
  },
}

export const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.95, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease },
  },
}
