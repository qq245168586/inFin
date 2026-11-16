import type { IncomingMessage, ServerResponse } from "node:http";
import { handleCompatRequest, startCompatRequestServices } from "../interfaces/http/compat-request-handler.js";

type CompatRequestHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>;

/**
 * 创建 HTTP 兼容请求处理器，并补齐运行时需要的后台服务。
 */
export async function createCompatRequestHandler(): Promise<CompatRequestHandler> {
  startCompatRequestServices();
  return handleCompatRequest;
}
