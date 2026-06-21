import type { IncomingMessage, ServerResponse } from "node:http";
import { handleLegacyRequest, startLegacyBackgroundServices } from "./legacy-request-handler.js";

type LegacyRequestHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>;

/**
 * 创建 legacy request handler，并补齐运行时需要的默认配置。
 */
export async function createLegacyRequestHandler(): Promise<LegacyRequestHandler> {
  startLegacyBackgroundServices();
  return handleLegacyRequest;
}
