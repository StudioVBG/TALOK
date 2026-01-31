/**
 * Export centralisé des hooks personnalisés
 */

// Hooks de performance
export {
  useWebVitals,
  useInView,
  useDebounce,
  useThrottle,
  useLazyLoad,
  useRenderTime,
  useWhyDidYouRender,
} from "./use-performance";

// Hooks de prefetch
export {
  usePrefetchPage,
  usePrefetchQuery,
  usePrefetchOnMount,
  usePrefetchOnVisible,
  usePrefetch,
  withPrefetchOnHover,
} from "./use-prefetch";

// Hooks de mutations optimistes
export {
  useOptimisticMutation,
  useOptimisticToggle,
  useOptimisticDelete,
  useOptimisticCreate,
} from "./use-optimistic-mutation";

// Hooks pour les formulaires avec validation
export {
  useFormWithValidation,
  useServerValidation,
  useFormApiErrors,
} from "./use-form-with-validation";

// Hooks pour les API avec cache
export {
  queryKeys,
  useApiQuery,
  useApiMutation,
  usePropertyApi,
  useInvoiceApi,
  useTicketApi,
} from "./use-api";

// Hooks pour les propriétés
export {
  useProperties,
  usePropertiesInfinite,
  useProperty,
  useCreateProperty,
  useUpdateProperty,
  useDeleteProperty,
} from "./use-properties";

// Hooks pour les baux
export {
  useLeases,
  useLease,
  useCreateLease,
  useUpdateLease,
} from "./use-leases";

// Hook pour les notifications temps réel
export {
  useNotifications,
  type Notification,
  type UseNotificationsOptions,
  type UseNotificationsReturn,
} from "./use-notifications";

// Hook pour les notifications push du navigateur
export { usePushNotifications } from "./use-push-notifications";

// Hooks mobile UX
export { usePullToRefresh } from "./use-pull-to-refresh";
export { useOnlineStatus } from "./use-online-status";
export { useHaptic } from "./use-haptic";

// Re-export des hooks courants
export { useToast, toast } from "@/components/ui/use-toast";
