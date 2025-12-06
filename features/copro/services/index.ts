// =====================================================
// Export centralisé des services COPRO
// =====================================================

export { sitesService } from './sites.service';
export { invitesService } from './invites.service';
export { chargesService } from './charges.service';
export { assembliesService } from './assemblies.service';

// Re-export des fonctions individuelles si nécessaire
export * from './sites.service';
export * from './invites.service';
export * from './charges.service';
export * from './assemblies.service';

