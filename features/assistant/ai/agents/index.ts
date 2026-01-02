/**
 * Index des Agents Multi-Agent
 * SOTA 2026 - Architecture Supervisor
 */

export { createSupervisorAgent, routeToAgent } from "./supervisor.agent";
export { createPropertyAgent } from "./property.agent";
export { createFinanceAgent } from "./finance.agent";
export { createTicketAgent } from "./ticket.agent";
export { createLegalAgent } from "./legal.agent";

// Export par défaut pour faciliter l'import
export default {
  createSupervisorAgent,
  routeToAgent,
  createPropertyAgent,
  createFinanceAgent,
  createTicketAgent,
  createLegalAgent,
};

