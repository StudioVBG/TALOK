"use client"

import { useScroll, useSpring, motion } from "framer-motion"

export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[3px] bg-[#2563EB] origin-left z-50"
      style={{ scaleX }}
      aria-hidden="true"
    />
  )
}
