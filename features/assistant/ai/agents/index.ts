/**
 * Index des Agents Multi-Agent
 * SOTA 2026 - Architecture Supervisor
 */

import { createSupervisorAgent, routeToAgent } from "./supervisor.agent";
import { createPropertyAgent } from "./property.agent";
import { createFinanceAgent } from "./finance.agent";
import { createTicketAgent } from "./ticket.agent";
import { createLegalAgent } from "./legal.agent";

export {
  createSupervisorAgent,
  routeToAgent,
  createPropertyAgent,
  createFinanceAgent,
  createTicketAgent,
  createLegalAgent,
};

// Export par défaut pour faciliter l'import
export default {
  createSupervisorAgent,
  routeToAgent,
  createPropertyAgent,
  createFinanceAgent,
  createTicketAgent,
  createLegalAgent,
};
