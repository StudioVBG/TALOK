/**
 * MSW Server pour les tests unitaires/integration (Node.js)
 *
 * Usage dans les tests :
 *   import { server } from "@/tests/mocks/server";
 *   server.use(http.get("/api/...", () => HttpResponse.json({...})));
 */

import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
