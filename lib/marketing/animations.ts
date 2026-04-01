import type { Variants } from "framer-motion";

// ============================================
// FRAMER MOTION — Variants réutilisables
// Landing page Talok SOTA 2026
// ============================================

/** Fade-in + slide-up (section reveal) */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

/** Parent container — stagger children */
export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

/** Stagger with larger delay for feature sections */
export const staggerWide: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

/** Stagger with tight delay for FAQ items */
export const staggerTight: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

/** Simple fade-in */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
};

/** Float animation for dashboard badges */
export const floatVariants = (delay: number): Variants => ({
  animate: {
    y: [-8, 0, -8],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut",
      delay,
    },
  },
});

/** CTA pulse animation */
export const ctaPulse: Variants = {
  animate: {
    scale: [1, 1.02, 1],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      repeatDelay: 3,
      ease: "easeInOut",
    },
  },
};

/** Hover lift for cards */
export const hoverLift = {
  whileHover: { y: -4, transition: { duration: 0.2 } },
};

/** Spring item reveal for before/after section */
export const springItem = (index: number): Variants => ({
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 200, delay: index * 0.1 },
  },
});

/** Spring scale for check/cross icons */
export const springIcon = (index: number): Variants => ({
  hidden: { scale: 0 },
  visible: {
    scale: 1,
    transition: { type: "spring", stiffness: 400, delay: 0.2 + index * 0.1 },
  },
});

/** Default viewport config for whileInView */
export const defaultViewport = { once: true, margin: "-100px" as const };
