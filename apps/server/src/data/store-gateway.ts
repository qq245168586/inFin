import { Injectable } from "@nestjs/common";
import { createJsonFileStore } from "../runtime/store-runtime.js";

type StoreFunction = (...args: unknown[]) => unknown;
type StoreModule = Record<string, StoreFunction>;

const WRITE_OPERATION_PREFIXES = [
  "add",
  "bind",
  "copy",
  "create",
  "delete",
  "heartbeat",
  "login",
  "refresh",
  "register",
  "rescan",
  "save",
  "set",
  "unbind",
  "update",
  "upsert"
];

@Injectable()
export class StoreGateway {
  private readonly store: StoreModule;

  /**
   * 初始化 JSON file store 网关，允许测试注入替代 store。
   */
  constructor(store: StoreModule = createJsonFileStore()) {
    this.store = store;
  }

  /**
   * 通过名称调用 JSON file store 方法，统一处理缺失方法错误。
   */
  call(functionName: string, ...args: unknown[]) {
    const handler = this.store[functionName];

    if (typeof handler !== "function") {
      throw new Error(`Store function not found: ${functionName}`);
    }
    return handler(...args);
  }

  /**
   * 返回底层 JSON file store，供 request 适配层继续使用现有 API。
   */
  raw() {
    return this.store;
  }

  /**
   * 列出 JSON file store 暴露的方法，便于测试和诊断。
   */
  functionNames() {
    return Object.keys(this.store).sort();
  }

  /**
   * 判断是否满足 is write operation 条件，供调用方做分支处理。
   */
  isWriteOperation(functionName: string) {
    return WRITE_OPERATION_PREFIXES.some((prefix) => functionName.startsWith(prefix));
  }
}

let defaultStoreGateway: StoreGateway | null = null;

/**
 * 读取 default JSON file store gateway，并保持返回结构稳定。
 */
export function getDefaultStoreGateway() {
  if (!defaultStoreGateway) {
    defaultStoreGateway = new StoreGateway();
  }
  return defaultStoreGateway;
}
