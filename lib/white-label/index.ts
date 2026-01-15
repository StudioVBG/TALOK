/**
 * White-Label System
 *
 * Export central pour le système de marque blanche
 */

// Types
export * from './types';

// Services
export {
  WhiteLabelService,
  WhiteLabelClientService,
  createWhiteLabelService,
  getWhiteLabelClientService,
} from './white-label.service';
