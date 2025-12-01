/**
 * Variants d'animation Framer Motion réutilisables
 * 
 * Ces variants peuvent être utilisés avec les composants motion de Framer Motion
 * pour créer des animations cohérentes dans toute l'application.
 */

import { Variants, Transition } from "framer-motion";

// ============================================
// TRANSITIONS PRÉDÉFINIES
// ============================================

export const springTransition: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export const smoothTransition: Transition = {
  duration: 0.3,
  ease: [0.4, 0, 0.2, 1], // easeInOutCubic
};

export const fastTransition: Transition = {
  duration: 0.15,
  ease: "easeOut",
};

export const slowTransition: Transition = {
  duration: 0.5,
  ease: [0.4, 0, 0.2, 1],
};

// ============================================
// VARIANTS DE PAGE
// ============================================

export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: smoothTransition,
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: fastTransition,
  },
};

export const pageSlideVariants: Variants = {
  initial: {
    opacity: 0,
    x: 20,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: smoothTransition,
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: fastTransition,
  },
};

export const pageFadeVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: smoothTransition,
  },
  exit: {
    opacity: 0,
    transition: fastTransition,
  },
};

// ============================================
// VARIANTS DE LISTE (STAGGER)
// ============================================

export const containerVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: smoothTransition,
  },
};

export const itemSlideVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -20,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: smoothTransition,
  },
};

export const itemScaleVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springTransition,
  },
};

// ============================================
// VARIANTS DE MODAL / DIALOG
// ============================================

export const modalOverlayVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: fastTransition,
  },
  exit: {
    opacity: 0,
    transition: fastTransition,
  },
};

export const modalContentVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: fastTransition,
  },
};

export const slideUpVariants: Variants = {
  hidden: {
    opacity: 0,
    y: "100%",
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    y: "100%",
    transition: smoothTransition,
  },
};

// ============================================
// VARIANTS DE CARTE
// ============================================

export const cardVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: smoothTransition,
  },
  hover: {
    y: -4,
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
    transition: fastTransition,
  },
  tap: {
    scale: 0.98,
    transition: fastTransition,
  },
};

export const cardExpandVariants: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    overflow: "hidden",
  },
  expanded: {
    height: "auto",
    opacity: 1,
    overflow: "visible",
    transition: {
      height: smoothTransition,
      opacity: { duration: 0.2, delay: 0.1 },
    },
  },
};

// ============================================
// VARIANTS DE BOUTON
// ============================================

export const buttonVariants: Variants = {
  initial: {
    scale: 1,
  },
  hover: {
    scale: 1.02,
    transition: fastTransition,
  },
  tap: {
    scale: 0.98,
    transition: fastTransition,
  },
};

export const buttonPulseVariants: Variants = {
  initial: {
    scale: 1,
  },
  pulse: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 0.3,
      repeat: 2,
    },
  },
};

// ============================================
// VARIANTS DE NOTIFICATION / TOAST
// ============================================

export const toastVariants: Variants = {
  initial: {
    opacity: 0,
    y: -20,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.95,
    transition: fastTransition,
  },
};

export const notificationBadgeVariants: Variants = {
  initial: {
    scale: 0,
  },
  animate: {
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 500,
      damping: 15,
    },
  },
  exit: {
    scale: 0,
    transition: fastTransition,
  },
};

// ============================================
// VARIANTS DE SKELETON / LOADING
// ============================================

export const skeletonPulse: Variants = {
  animate: {
    opacity: [0.5, 1, 0.5],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

export const spinnerVariants: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "linear",
    },
  },
};

// ============================================
// VARIANTS D'ICÔNE
// ============================================

export const checkmarkVariants: Variants = {
  initial: {
    pathLength: 0,
    opacity: 0,
  },
  animate: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 0.3, ease: "easeOut" },
      opacity: { duration: 0.1 },
    },
  },
};

export const iconBounceVariants: Variants = {
  initial: {
    y: 0,
  },
  animate: {
    y: [0, -5, 0],
    transition: {
      duration: 0.5,
      repeat: Infinity,
      repeatDelay: 2,
    },
  },
};

// ============================================
// VARIANTS DE MENU / DROPDOWN
// ============================================

export const dropdownVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -10,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: fastTransition,
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.95,
    transition: fastTransition,
  },
};

export const sidebarVariants: Variants = {
  hidden: {
    x: -280,
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: smoothTransition,
  },
  exit: {
    x: -280,
    opacity: 0,
    transition: smoothTransition,
  },
};

// ============================================
// EXPORT PAR DÉFAUT
// ============================================

export default {
  // Transitions
  springTransition,
  smoothTransition,
  fastTransition,
  slowTransition,
  // Pages
  pageVariants,
  pageSlideVariants,
  pageFadeVariants,
  // Listes
  containerVariants,
  itemVariants,
  itemSlideVariants,
  itemScaleVariants,
  // Modals
  modalOverlayVariants,
  modalContentVariants,
  slideUpVariants,
  // Cartes
  cardVariants,
  cardExpandVariants,
  // Boutons
  buttonVariants,
  buttonPulseVariants,
  // Toasts
  toastVariants,
  notificationBadgeVariants,
  // Loading
  skeletonPulse,
  spinnerVariants,
  // Icônes
  checkmarkVariants,
  iconBounceVariants,
  // Menus
  dropdownVariants,
  sidebarVariants,
};

