import type { IncomingMessage, ServerResponse } from "node:http";
import { handleLegacyRequest, startLegacyBackgroundServices } from "./legacy-request-handler.js";

type LegacyRequestHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>;

export async function createLegacyRequestHandler(): Promise<LegacyRequestHandler> {
  startLegacyBackgroundServices();
  return handleLegacyRequest;
}
